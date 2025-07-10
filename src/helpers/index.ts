import { GoogleGenerativeAI, } from "@google/generative-ai";


const getGeminiApiKey = () => {
    // It's highly recommended to use environment variables for your API key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable not set.");
    }
    return GEMINI_API_KEY;
}

export const genAI = new GoogleGenerativeAI(getGeminiApiKey());

export const JSONModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // Or any other suitable model
    generationConfig: {
        // Ensure the output is JSON
        responseMimeType: "application/json",
    }
});


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