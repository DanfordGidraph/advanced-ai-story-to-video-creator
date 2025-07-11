import 'dotenv/config'
import 'module-alias/register';

import { generateAllAssets, regenerateVideo, generateStoryBlueprint } from '@handlers';
import path from 'path';
import { readFileSync } from 'fs';

async function main() {
    // const assets = await regenerateVideo(path.join(__dirname, 'assets', 'The_Hare_and_The_Tortoise'));

    try {
        const myStory = readFileSync(path.join(__dirname, 'data', 'story.txt'), 'utf8');

        // STAGE 1: Blueprint Generation
        const storyBlueprint = await generateStoryBlueprint(myStory);

        console.log("--- Generated Project ---");
        console.log("Project Name:", storyBlueprint.project_name);
        console.log("Screenplay Title:", storyBlueprint.screenplay.title);
        console.log("Number of Characters:", storyBlueprint.screenplay.characters.length);
        console.log("Number of Scenes:", storyBlueprint.screenplay.scenes.length);
        console.log("--- First Scene's Image Prompt ---");
        console.log(storyBlueprint.screenplay.scenes[0].image_prompt.description);

        // STAGE 2: Generate all media assets based on the blueprint
        await generateAllAssets(storyBlueprint);

    } catch (error) {
        console.error("An error occurred:", error);
    }
}

main();