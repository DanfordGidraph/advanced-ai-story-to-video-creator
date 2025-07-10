import { getMetaPrompt, JSONModel } from "@helpers";
import { StoryBlueprint } from "@typings";


/**
 * Takes a prose story and generates a structured StoryBlueprint JSON object.
 * @param {string} storyProse The input story.
 * @returns {Promise<StoryBlueprint>} A promise that resolves to the structured story blueprint.
 */
export async function generateStoryBlueprint(storyProse: string): Promise<StoryBlueprint> {
    console.log("Constructing prompt for Gemini...");

    const metaPrompt = getMetaPrompt();
    const fullPrompt = `${metaPrompt}\n${storyProse}`;

    console.log("Sending request to Gemini API...");

    const result = await JSONModel.generateContent(fullPrompt);
    const response = result.response;
    const jsonText = response.text();

    console.log("Received response from Gemini. Parsing JSON...");

    // The Gemini API, when configured with `application/json`, should return a parsable JSON string.
    const blueprint: StoryBlueprint = JSON.parse(jsonText);

    console.log("Successfully parsed story blueprint.");
    return blueprint;
}