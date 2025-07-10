import 'dotenv/config'
import 'module-alias/register';

import { generateStoryBlueprint, } from '@utilities';

async function main() {
    const myStory = `
    The village of Lyra's End grew silent. Not quiet, but an absence of sound, as if the world itself held its breath. Birds ceased their song, children’s laughter faded, and even the river’s rush became a dull pressure. Lyra, a young sound-weaver, felt the emptiness in her bones. The village’s ancient Heart Chime, the source of their vibrant harmony, had fallen silent. Only its return could break the encroaching stillness.

    Guided by a fragmented map etched onto an old wooden token, Lyra ventured into the Muted Mountains. The air there was heavy, devoid of echoes. She found the forgotten cave, cold and silent as a tomb. Deep within, a single, dull crystal pulsed faintly. She touched it, and a low, resonating hum filled the chamber. It wasn't the chime, but its ancient guardian.

    "Only true song can awaken it," a voice echoed, not from the crystal, but from the very stones. Lyra, though scared, sang a lullaby her grandmother taught her—a simple tune of starlight and moss. The crystal vibrated, revealing a hidden alcove. There, nestled on velvet, lay the Heart Chime. It was a simple silver bell, silent until Lyra’s touch.

    A soft, vibrant ringing filled the cave, then the peaks, then Lyra's End itself. Birds burst into song, children’s laughter rippled through the air, and the river hummed its joyous tune once more. Life, vibrant and full of sound, had returned.
  `;

    try {
        const storyBlueprint = await generateStoryBlueprint(myStory);

        // You can now work with the structured object
        console.log("--- Generated Project ---");
        console.log("Project Name:", storyBlueprint.project_name);
        console.log("Screenplay Title:", storyBlueprint.screenplay.title);
        console.log("Number of Characters:", storyBlueprint.screenplay.characters.length);
        console.log("Number of Scenes:", storyBlueprint.screenplay.scenes.length);
        console.log("--- First Scene's Image Prompt ---");
        console.log(storyBlueprint.screenplay.scenes[0].image_prompt.description);


    } catch (error) {
        console.error("An error occurred:", error);
    }
}

main();