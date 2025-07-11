import { getMetaPrompt } from "@helpers";
import { StoryBlueprint } from "@typings";
import { generateBlueprintJson } from "@utilities";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

/**
 * Takes a prose story and generates a structured StoryBlueprint JSON object.
 * @param {string} storyProse The input story.
 * @returns {Promise<StoryBlueprint>} A promise that resolves to the structured story blueprint.
 */
export async function generateStoryBlueprint(storyProse: string): Promise<StoryBlueprint> {
    console.log("Constructing prompt for Gemini...");

    const metaPrompt = getMetaPrompt();
    const fullPrompt = `${metaPrompt}\n${storyProse}`;

    const blueprintJson = await generateBlueprintJson(fullPrompt) as StoryBlueprint;
    console.log("Received response from Gemini. Parsing JSON...");

    console.log("Successfully parsed story blueprint.");
    const storyTitle = blueprintJson.screenplay.title.replaceAll(/[^a-zA-Z0-9]/g, '_');
    const assetsDir = path.join(__dirname, '../..', 'assets', storyTitle);
    const jsonAassetsDir = path.join(assetsDir, 'json',);
    mkdirSync(jsonAassetsDir, { recursive: true });

    const storyBlueprintName = path.join(jsonAassetsDir, 'storyBlueprint.json');
    writeFileSync(storyBlueprintName, JSON.stringify(blueprintJson, null, 2));

    return blueprintJson;
}