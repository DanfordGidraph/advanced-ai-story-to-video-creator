import { AIVoice, Character, SceneAsset } from '@typings';
import path from 'path';
import { writeFileSync } from 'fs';
import Ffmpeg from 'fluent-ffmpeg';

export const getEnvironmentVariable = (name: string): string => {
    // It's highly recommended to use environment variables for your API key
    const envVariable = process.env[name];
    if (!envVariable) {
        throw new Error(`${envVariable} environment variable not set.`);
    }
    return envVariable;
}


/**
 * Creates a temporary SRT subtitle file for a single scene.
 * @param sceneAsset - The asset containing dialogue and duration.
 * @param assetsDir - The directory to save the temp file.
 * @returns The path to the generated SRT file.
 */
export async function createSrtFile(sceneAsset: SceneAsset, assetsDir: string): Promise<string> {
    const dialogue = sceneAsset.dialogue.replace(/"/g, "''");
    const srtPath = path.join(assetsDir, `${sceneAsset.sceneId}.srt`);

    // SRT time format: HH:MM:SS,ms
    const endTime = new Date(sceneAsset.durationSeconds * 1000).toISOString().substr(11, 12);
    const srtContent = `1\n00:00:00,000 --> ${endTime}\n${dialogue}`;

    writeFileSync(srtPath, srtContent);
    return srtPath;
}


/**
 * Converts a base64 image string into the format required by the Gemini API.
 * @param {string} base64Data The base64 encoded image.
 * @returns An object formatted for the Gemini API's contents array.
 */
export function fileToGenerativePart(base64Data: string) {
    return {
        inlineData: {
            data: base64Data,
            mimeType: "image/png", // Assuming PNG, adjust if necessary
        },
    };
}


/**
* Constructs the detailed "meta-prompt" that instructs the AI.
* @returns {string} The full instructional prompt.
*/
export function getMetaPrompt(): string {
    // The full prompt from the previous step is inserted here.
    // It tells Gemini how to behave.
    return `
        You are an expert AI Story-to-Screenplay Architect. Your primary function is to receive a prose story and a target JSON schema, and then transform the story into a structured, sequential JSON blueprint. This blueprint will be used by other AI systems (image and audio generators) to create a complete, multi-modal video narrative.

        You must meticulously follow the algorithm and directives below to ensure the output is consistent, logical, and optimized for downstream AI processes.

        ## Input You Will Receive
        1.  **A Prose Story:** A block of text containing the narrative.
        2.  **A Target JSON Schema:** The strict structure your final output must follow.

        ## Your Task
        Your task is to read and deeply analyze the provided prose story. You will then populate a JSON object according to the provided schema. This involves:
        *   Extracting the core story elements (title, logline).
        *   Identifying and creating detailed profiles for all characters, including a non-visual narrator if present.
        *   Segmenting the prose into distinct, sequential scenes.
        *   For each scene, generating a highly descriptive and context-aware \`image_prompt\`.
        *   For each scene, generating a corresponding \`audio_prompt\` for dialogue or narration.
        *   Your final output must be **only the generated JSON object**, with no preceding or succeeding text. It must be perfectly valid and conform to the schema.

        ## Core Algorithm and Directives
        1.  **Character Analysis:** Identify all characters. For each, create a rich \`description\` including physical appearance, clothing, and persona. If the story is third-person, create a "Narrator" character with \`is_narrator\` set to true.
        2.  **Scene Segmentation:** Break the prose into logical scenes based on location, time, or action shifts.
        3.  **Initial Character Generation (First Scene):** The first scene's \`image_prompt\` must have \`prompt_type\` set to \`initial_character_generation\`. Its description must direct the creation of a labeled reference image of all primary characters.
        4.  **Subsequent Scene Prompts:** Subsequent prompts must maintain visual consistency by referencing the initial character image. Use \`prompt_type\` ('scene_update' or 'new_scene') and be hyper-descriptive about actions and expressions, not appearances.
        5.  **Audio Prompt Generation:** Create an \`audio_prompt\` for every scene with dialogue or narration, assigning the correct \`character_id\` and a helpful \`voice_style\`.

        ## The JSON Schema to Follow
        {
        "project_name": "...", "story_prose": "...", "screenplay": { "title": "...", "logline": "...", "characters": [ { "character_id": "char_001", "name": "...", "description": "...", "is_narrator": false } ], "scenes": [ { "scene_id": "scene_001", "setting_description": "...", "image_prompt": { "prompt_type": "initial_character_generation", "description": "...", "required_character_ids": ["..."], "required_image_ids": [], "output_image_id": "img_001" }, "audio_prompt": { "character_id": "...", "dialogue": "...", "voice_style": "..." } } ] }
        }

        ## Now, begin. Here is the prose story:
  `;
}

/**
 * Deterministically assigns a unique voice to a character for the duration of the script run.
 * @param character - The character object.
 * @returns The name of a Gemini TTS voice (e.g., "Charon").
 */
export function getGeminiVoiceForCharacter(character: Character, characterVoiceMap: Map<string, string>, usedVoices: Set<string>, aiVoices: AIVoice[]): string {
    // If we've already assigned a voice to this character, return it.
    if (characterVoiceMap.has(character.name)) {
        return characterVoiceMap.get(character.name)!;
    }

    // --- Hardcoded assignments for key characters for consistency ---
    if (character.is_narrator) {
        const narratorVoice = "Rasalgethi"; // Sounds "Informative"
        characterVoiceMap.set(character.name, narratorVoice);
        usedVoices.add(narratorVoice);
        return narratorVoice;
    }

    // --- Dynamically assign a voice for any other character ---
    for (const voice of aiVoices) {
        if (!usedVoices.has(voice.voice)) {
            usedVoices.add(voice.voice);
            characterVoiceMap.set(character.name, voice.voice);
            return voice.voice;
        }
    }

    // Fallback if we run out of unique voices
    return "Zephyr";
}


/**
 * Saves PCM audio data to a WAV file.
 *
 * @param filename The path to the output WAV file.
 * @param pcmData The raw PCM audio data. This should typically be a Node.js `Buffer`
 *                containing interleaved samples (e.g., Little-endian Int16 for 16-bit audio).
 * @param channels The number of audio channels (e.g., 1 for mono, 2 for stereo). Defaults to 1.
 * @param rate The sample rate in Hz (e.g., 44100, 24000). Defaults to 24000.
 * @param sampleWidth The width of each sample in bytes (e.g., 2 for 16-bit, 4 for 32-bit float).
 *                    Defaults to 2.
 * @returns A Promise that resolves when the file is successfully written, or rejects on error.
 */
export async function saveWaveFile(filename: string, pcmData: Buffer, channels: number = 1, sampleRate: number = 24000, sampleWidth: number = 2,): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const bitsPerSample = sampleWidth * 8;

        // 2) calculate sizes
        const byteRate = sampleRate * channels * bitsPerSample / 8;
        const blockAlign = channels * bitsPerSample / 8;
        const dataChunkSize = pcmData.length;
        const riffChunkSize = 36 + dataChunkSize;   // 4 + (8 + fmtChunkSize) + (8 + dataChunkSize)

        // 3) build 44‑byte WAV header
        const header = Buffer.alloc(44);
        let offset = 0;

        header.write("RIFF", offset); offset += 4;
        header.writeUInt32LE(riffChunkSize, offset); offset += 4;  // file size minus 8
        header.write("WAVE", offset); offset += 4;

        // fmt subchunk
        header.write("fmt ", offset); offset += 4;
        header.writeUInt32LE(16, offset); offset += 4;  // subchunk1 size = 16 for PCM
        header.writeUInt16LE(1, offset); offset += 2;  // audio format = 1 (PCM)
        header.writeUInt16LE(channels, offset); offset += 2;
        header.writeUInt32LE(sampleRate, offset); offset += 4;
        header.writeUInt32LE(byteRate, offset); offset += 4;
        header.writeUInt16LE(blockAlign, offset); offset += 2;
        header.writeUInt16LE(bitsPerSample, offset); offset += 2;

        // data subchunk
        header.write("data", offset); offset += 4;
        header.writeUInt32LE(dataChunkSize, offset); offset += 4;

        // 4) concatenate header + pcm and write to disk
        const wavBuffer = Buffer.concat([header, Buffer.from(pcmData)]);
        writeFileSync(filename, wavBuffer)
        setTimeout(() => { resolve(); }, 250);
    });
}

/**
 * Generates an individual, silent video clip for a single scene.
 * This clip includes the Ken Burns effect and burned-in subtitles.
 * @param sceneAsset - The asset for the scene.
 * @param imagePath - The path to the source image.
 * @param srtPath - The path to the subtitle file.
 * @param outputPath - Where to save the temporary video clip.
 * @returns A promise that resolves when the clip is created.
 */
export function createAnimatedSceneClip(sceneAsset: SceneAsset, srtPath: string, outputPath: string): Promise<void> {
    const VIDEO_FPS = Number(getEnvironmentVariable('VIDEO_FPS'));
    const OUTPUT_RESOLUTION = getEnvironmentVariable('OUTPUT_RESOLUTION');
    const durationFrames = VIDEO_FPS * sceneAsset.durationSeconds;

    // escape any colons/backslashes in the path
    const escapedSrt = srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:');

    // build a single filter graph string
    const filterGraph = [
        // 1) zoompan on the looping image
        `[0:v]zoompan=\
        z='min(zoom+0.001,1.5)':\
        d=${durationFrames}:\
        s=${OUTPUT_RESOLUTION}:\
        x='iw/2-(iw/zoom/2)':\
        y='ih/2-(ih/zoom/2)'[zoomed]`,
        // 2) burn subtitles onto that zoomed stream
        // `[zoomed]subtitles='${escapedSrt}':\
        // force_style='Fontsize=24,PrimaryColour=&HFFFFFF&,BorderStyle=3,Outline=1,Shadow=1,Alignment=2,MarginV=25'[out]`
    ].join(';');

    return new Promise((resolve, reject) => {
        Ffmpeg()
            .input(sceneAsset.imageFilePath)
            .inputOptions(['-loop 1'])
            .complexFilter(filterGraph, 'out')   // “out” is the only video stream we want
            .outputOptions([`-t ${sceneAsset.durationSeconds}`])
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', err =>
                reject(
                    new Error(
                        `Failed to create clip for ${sceneAsset.sceneId}: ${err.message}`
                    )
                )
            )
            .run();
    });
}
