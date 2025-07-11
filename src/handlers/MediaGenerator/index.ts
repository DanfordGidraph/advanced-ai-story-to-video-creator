import { compileVideo } from "@handlers/VideoGenerator";
import { GeneratedAssets, SceneAsset, SceneAudio, StoryBlueprint } from "@typings";
import { generateSceneAudio, generateSceneImage } from "@utilities";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const generateAudioAndImages = async (blueprint: StoryBlueprint, imagesAssetsDir: string, audioAssetsDir: string): Promise<GeneratedAssets> => {
    const imageCache: Record<string, string> = {};
    const characterVoiceMap = new Map<string, string>();
    const usedVoices = new Set<string>();
    const characters = blueprint.screenplay.characters;
    const allAssets: GeneratedAssets = {};

    for (const scene of blueprint.screenplay.scenes) {
        try {
            console.log(`Processing Scene: ${scene.scene_id}...`);

            // --- Image Generation ---
            console.log(`   - Generating image for scene: ${scene.scene_id}`);
            const generatedSceneImage = await generateSceneImage(scene, imageCache, imagesAssetsDir);
            imageCache[scene.image_prompt.output_image_id] = generatedSceneImage.base64Image;
            console.log(`   - Successfully generated and cached image: ${scene.image_prompt.output_image_id}`);

            // --- Audio Generation (Placeholder) ---
            console.log(`   - Generate audio for scene dialogue: "${scene.audio_prompt.dialogue}"`);
            const generatedAudio: SceneAudio = await generateSceneAudio(scene, characters, audioAssetsDir, characterVoiceMap, usedVoices);
            console.log(`   - Successfully generated audio for dialogue: "${scene.audio_prompt.dialogue}"`);

            // --- Collect all generated assets for this scene ---
            const sceneAsset: SceneAsset = {
                sceneId: scene.scene_id,
                dialogue: scene.audio_prompt.dialogue,
                audioFilePath: generatedAudio.filePath,
                durationSeconds: generatedAudio.duration,
                imageFilePath: generatedSceneImage.filePath,
                base64Image: generatedSceneImage.base64Image,
                outputImageId: scene.image_prompt.output_image_id,
            };

            allAssets[scene.scene_id] = sceneAsset;

        } catch (error) {
            console.error(`Failed to process scene ${scene.scene_id}:`, error);
            // Decide if you want to stop the whole process or just skip the scene
            throw error; // For now, we stop on failure
        }
    }
    return allAssets;

}
/**
 * Orchestrates the entire asset generation process.
 * It loops through scenes, generates media, and collects them.
 *
 * @param {StoryBlueprint} blueprint - The full story blueprint from Stage 1.
 * @returns {Promise<GeneratedAssets>} A promise that resolves to an object containing all generated media assets.
 */
export async function generateAllAssets(blueprint: StoryBlueprint): Promise<GeneratedAssets> {
    console.log("\n--- STAGE 2: ASSET GENERATION ---");




    const storyTitle = blueprint.screenplay.title.replaceAll(/[^a-zA-Z0-9]/g, '_');
    const assetsDir = path.join(__dirname, '../..', 'assets', storyTitle);
    const jsonAassetsDir = path.join(assetsDir, 'json',);
    const videoAssetsDir = path.join(assetsDir, 'video',);
    const audioAssetsDir = path.join(assetsDir, 'audio');
    const imagesAssetsDir = path.join(assetsDir, 'images');
    mkdirSync(imagesAssetsDir, { recursive: true });
    mkdirSync(audioAssetsDir, { recursive: true });
    mkdirSync(jsonAassetsDir, { recursive: true });

    const allAssets = await generateAudioAndImages(blueprint, imagesAssetsDir, audioAssetsDir);

    writeFileSync(path.join(jsonAassetsDir, 'generatedAssets.json'), JSON.stringify(allAssets, null, 2));

    // Create a single video file from all the individual clips
    const videoFilePath = await compileVideo(allAssets, storyTitle, videoAssetsDir);
    console.log(`   - Final video file saved to: ${videoFilePath}`);
    allAssets['videoFilePath'] = videoFilePath;

    console.log("--- ASSET GENERATION COMPLETE ---");
    return allAssets;
}

export async function regenerateVideo(assetsDir: string): Promise<GeneratedAssets> {

    if (!existsSync(path.join(assetsDir, 'json', 'storyBlueprint.json'))) {
        throw new Error('No story blueprint found in assets directory. Please run the Blueprint Generator first.');
    }
    if (!existsSync(path.join(assetsDir, 'json', 'generatedAssets.json'))) {
        throw new Error('No generated assets found in assets directory. Please run the Asset Generator first.');
    }
    const blueprint = readFileSync(path.join(assetsDir, 'json', 'storyBlueprint.json'), 'utf8');
    const blueprintJson = JSON.parse(blueprint);
    const projectAssets = readFileSync(path.join(assetsDir, 'json', 'generatedAssets.json'), 'utf8');
    const generatedAssets = JSON.parse(projectAssets) as GeneratedAssets;

    const storyTitle = blueprintJson.screenplay.title.replaceAll(/[^a-zA-Z0-9]/g, '_');
    const videoAssetsDir = path.join(assetsDir, 'video',);
    mkdirSync(videoAssetsDir, { recursive: true });

    // Create a single video file from all the individual clips
    const videoFilePath = await compileVideo(generatedAssets, storyTitle, videoAssetsDir);
    console.log(`   - Final video file saved to: ${videoFilePath}`);
    generatedAssets['videoFilePath'] = videoFilePath;

    console.log("--- ASSET GENERATION COMPLETE ---");
    return generatedAssets;
}