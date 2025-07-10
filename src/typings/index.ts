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