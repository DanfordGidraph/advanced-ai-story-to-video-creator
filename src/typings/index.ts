export interface Character {
    character_id: string;
    name: string;
    description: string;
    is_narrator: boolean;
}

export interface ImagePrompt {
    prompt_type: 'initial_character_generation' | 'scene_update' | 'new_scene';
    description: string;
    required_character_ids: string[];
    required_image_ids: string[];
    output_image_id: string;
}

export interface AudioPrompt {
    character_id: string;
    dialogue: string;
    voice_style: string;
}

export interface Scene {
    scene_id: string;
    setting_description: string;
    image_prompt: ImagePrompt;
    audio_prompt: AudioPrompt;
}

export interface SceneAudio {
    filePath: string;
    duration: number;
}

export interface SceneImage {
    base64Image: string;
    filePath: string;
}

export interface Screenplay {
    title: string;
    logline: string;
    characters: Character[];
    scenes: Scene[];
}

export interface StoryBlueprint {
    project_name: string;
    story_prose: string;
    screenplay: Screenplay;
}

/**
 * Represents the generated assets for a single scene.
 */
export interface SceneAsset {
    sceneId: string;
    dialogue: string;
    outputImageId: string;
    imageFilePath: string;
    base64Image: string; // The base64 encoded image data from the API
    audioFilePath?: string; // The local path where the generated audio will be saved
    durationSeconds?: number; // The duration of the audio clip, crucial for video timing
}

/**
 * An object that holds all generated assets, keyed by their scene_id.
 * This object is the final output of the asset generation stage.
 */
export interface GeneratedAssets {
    [sceneId: string]: SceneAsset;
    videoFilePath?: string; // The local path where the generated video clip will be saved
}

export interface AIVoice {
    voice: string;
    sounds: string;
}

export interface AnimatedLine {
    text: string;
    startTime: number; // When this line appears (in seconds)
    endTime: number;   // When this line disappears (in seconds)
    yPosition: number; // Vertical position on screen
}