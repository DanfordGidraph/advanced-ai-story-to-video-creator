import {
    fileToGenerativePart,
    getEnvironmentVariable,
    getGeminiVoiceForCharacter,
    saveWaveFile,
} from "@helpers";
import { Modality } from "@google/genai";
import * as mm from 'music-metadata';

import { Character, Scene, SceneImage } from "@typings";

import { GoogleGenAI, } from "@google/genai";
import path from "path";

import { geminiVoices } from "@data";
import { writeFileSync } from "fs";

export const genAI = new GoogleGenAI({ apiKey: getEnvironmentVariable('GEMINI_API_KEY') });

/**
 * Generates a structured StoryBlueprint JSON object.
 * @param {string} promptText The input story.
 * @returns {Promise<object>} A promise that resolves to the structured story blueprint.
 */
export const generateBlueprintJson = async (promptText: string, retries = 3): Promise<object> => {

    console.log("Sending request to Gemini API...");

    const result = await genAI.models.generateContent({
        contents: promptText,
        model: getEnvironmentVariable('GEMINI_2_5_FLASH_MODEL'),
        config: { responseModalities: [Modality.TEXT], candidateCount: 1, responseMimeType: "application/json", },
    });

    const promptResponse = result.candidates[0].content;
    const jsonText = promptResponse.parts.find(part => part.text).text;

    console.log("Received response from Gemini. Parsing JSON...", jsonText);

    try {
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error parsing JSON response from Gemini:", error);
        // throw error;
        if (retries <= 0) {
            throw error;
        }
        return generateBlueprintJson(promptText, retries - 1);
    }

}


/**
 * Generates a single scene's image using the Gemini API.
 * It dynamically constructs a multimodal prompt based on the scene's requirements.
 *
 * @param {Scene} scene - The scene object from the StoryBlueprint.
 * @param {Record<string, string>} imageCache - A map of already generated images (outputImageId -> base64Data).
 * @returns {Promise<string>} A promise that resolves to the base64 encoded string of the newly generated image.
 */
export async function generateSceneImage(scene: Scene, imageCache: Record<string, string>, imagesAssetsDir: string): Promise<SceneImage> {
    const { description, required_image_ids } = scene.image_prompt;

    console.log(`   - Constructing image prompt for scene: ${scene.scene_id}`);

    // 1. Start with the text part of the prompt
    const textPrompt = { text: description };

    // 2. Gather the required reference images from our cache
    const imagePrompts = [];
    for (const imageId of required_image_ids) {
        const cachedImage = imageCache[imageId];
        if (!cachedImage) {
            throw new Error(`Logical error: Required image '${imageId}' for scene '${scene.scene_id}' not found in cache.`);
        }
        imagePrompts.push(fileToGenerativePart(cachedImage));
    }

    // 3. Combine text and image parts into the final `contents` array for the API
    const promptParts = [
        ...imagePrompts,
        textPrompt
    ];

    console.log(`   - Sending multimodal prompt to Gemini Vision API...`);
    const response = await genAI.models.generateContent({
        contents: promptParts,
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE], candidateCount: 1, },
        model: getEnvironmentVariable('GEMINI_2_0_FLASH_PREVIEW_IMAGEN_MODEL'),
    });

    // 4. Extract the base64 image data from the response
    // It's good practice to check if the response contains the expected data
    const candidateImages = [];
    for (const part of response.candidates[0].content.parts) {
        // Based on the part type, either show the text or save the image
        if (part.text) {
            console.log(part.text);
        } else if (part.inlineData) {
            const imageData = part.inlineData.data;
            candidateImages.push(imageData);
        }
    }
    if (candidateImages.length > 0) {
        console.log(`Successfully generated ${candidateImages.length} images.`);
        for (const [index, image] of candidateImages.entries()) {
            const imageFilename = path.join(imagesAssetsDir, `${scene.scene_id}_${scene.image_prompt.output_image_id}_${index + 1}.png`);
            try {
                // Write the file to the disk. The 'base64' encoding hint is crucial for correctly interpreting the data string.
                writeFileSync(imageFilename, image, 'base64');
                console.log(`✅ Saved image for Scene ID ${scene.scene_id} to ${imageFilename}`);
            } catch (error) {
                console.error(`❌ Failed to save image for Scene ID ${scene.scene_id}:`, error);
            }
        }
        return { base64Image: candidateImages[0], filePath: path.join(imagesAssetsDir, `${scene.scene_id}_${scene.image_prompt.output_image_id}_1.png`) };
    } else {
        // Log the problematic response for debugging
        console.error("Invalid response structure from Gemini API:", JSON.stringify(response, null, 2));
        throw new Error(`Failed to generate image for scene ${scene.scene_id}. API did not return image data.`);
    }
}


/**
 * Generates audio for a scene using the new TTS API structure.
 * @param scene - The current scene object.
 * @param characters - The list of all characters to find voice info.
 * @param assetsDir - The directory to save the audio file.
 * @param characterVoiceMap - A map of character names to voice names.
 * @param usedVoices - A set of voice names that have already been used.
 * @returns A promise resolving to the file path and duration of the audio.
 */
// State to ensure deterministic and unique voice assignments per script run
export async function generateSceneAudio(scene: Scene, characters: Character[], assetsDir: string, characterVoiceMap: Map<string, string>, usedVoices: Set<string>): Promise<{ filePath: string, duration: number }> {
    const { character_id, dialogue, voice_style } = scene.audio_prompt;

    const speaker = characters.find(c => c.character_id === character_id);
    if (!speaker) throw new Error(`Speaker with ID '${character_id}' not found.`);

    const voiceName = getGeminiVoiceForCharacter(speaker, characterVoiceMap, usedVoices, geminiVoices);
    console.log(`   - Synthesizing speech for ${speaker.name} with voice ${voiceName}...`);

    // Combine the style hint with the dialogue for a more expressive prompt
    const promptText = `Speaking in a ${voice_style} tone: ${dialogue}`;

    // Construct the request using the new API format
    const response = await genAI.models.generateContent({
        model: getEnvironmentVariable('GEMINI_2_0_FLASH_PREVIEW_TTS_MODEL'),
        contents: [{ parts: [{ text: promptText }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                },
            },
        },
    }).catch(error => {
        console.error("Error generating audio for scene", scene.scene_id, error);
        throw error;
    });

    const data = response.candidates?.[0]?.content?.parts?.find(part => part?.inlineData).inlineData.data
    if (!data) throw new Error("No audio data found in response from Gemini API.");
    const audioBuffer = Buffer.from(data, 'base64');

    // Define the output path and save the file
    const audioFilename = `${scene.scene_id}_audio.wav`;
    const audioFilePath = path.join(assetsDir, audioFilename);
    await saveWaveFile(audioFilePath, audioBuffer);

    // Get the duration of the saved audio file
    const metadata = await mm.parseFile(audioFilePath, { duration: true, skipCovers: true })
        .catch(error => {
            console.error("Error parsing audio metadata: for file", audioFilePath, error);
            throw error;
        });
    const duration = metadata.format.duration || 5; // Default to 5s if duration not found
    console.log(`   - Audio saved to ${audioFilePath} (Duration: ${duration.toFixed(2)}s)`);

    return { filePath: audioFilePath, duration };

}