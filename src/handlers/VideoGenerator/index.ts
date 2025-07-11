import { createAnimatedSceneClip, createSrtFile, getEnvironmentVariable } from "@helpers";
import { GeneratedAssets, SceneAsset } from "@typings";
import Ffmpeg from "fluent-ffmpeg";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";


async function stitchClipsWithTransitions(tempClipPaths: string[], tempDir: string, sceneAssets: SceneAsset[]): Promise<string> {
    const TRANS = Number(getEnvironmentVariable('TRANSITION_DURATION_SECONDS'));
    const stitchedVideoPath = path.join(tempDir, 'stitched_silent.mp4');

    // Build up a manual filter_complex string
    let filterGraph = '';
    let runningLabel = '0:v';
    let cum = sceneAssets[0].durationSeconds;

    for (let i = 1; i < tempClipPaths.length; i++) {
        const offset = (cum - TRANS).toFixed(3);
        const in1 = `[${runningLabel}]`;      // e.g. "[0:v]" or "[v1]"
        const in2 = `[${i}:v]`;              // "[1:v]", "[2:v]", etc.
        const out = `[v${i}]`;               // "[v1]", "[v2]"

        filterGraph += `${in1}${in2}` +
            `xfade=transition=fade:duration=${TRANS}` +
            `:offset=${offset}` +
            `${out}`;

        if (i < tempClipPaths.length - 1) filterGraph += ';';

        // update for next loop
        cum = cum + sceneAssets[i].durationSeconds - TRANS;
        runningLabel = `v${i}`;             // no brackets here
    }

    // 2) Run FFmpeg with that filter graph
    await new Promise<void>((resolve, reject) => {
        const cmd = Ffmpeg();
        tempClipPaths.forEach(p => cmd.input(p));

        const finalVideoLabel = `v${tempClipPaths.length - 1}`; // e.g., v2 for 3 clips

        cmd
            .complexFilter(filterGraph, finalVideoLabel)
            .outputOptions([
                '-c:v', 'libx264',
                '-preset', 'veryfast',
                '-crf', '23',
                '-y'
            ])
            .output(stitchedVideoPath)
            .on('start', line => console.log('> ffmpeg', line))
            // .on('stderr', line => console.error('  ', line))
            .on('end', () => resolve())
            .on('error', err => reject(new Error(`Failed to stitch videos: ${err.message}`)))
            .run();
    });

    return stitchedVideoPath;
}

async function concatenateAudio(audioFilePaths: string[], tempDir: string) {
    // 1) write the list file
    const audioListPath = path.join(tempDir, 'audiolist.txt');
    const fullAudioPath = path.join(tempDir, 'stitched_audio.wav');
    const audioListContent = audioFilePaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    writeFileSync(audioListPath, audioListContent, 'utf8');

    await new Promise(resolve => {
        Ffmpeg()
            .input(audioListPath)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            // copy the PCM directly into a WAV container
            .outputOptions(['-c:a', 'pcm_s16le', '-y'])
            .save(fullAudioPath)
            .on('end', () => resolve(fullAudioPath));
    });

    console.log('   - Full audio track (WAV) created:', fullAudioPath);

    return fullAudioPath;
}

/**
 * The main function to orchestrate the entire video compilation process.
 * @param assets - The collection of all generated assets.
 * @param storyTitle - The title of the story for the output filename.
 * @param assetsDir - The main directory where assets are stored.
 */
export async function compileVideo(assets: GeneratedAssets, storyTitle: string, assetsDir: string): Promise<string> {
    console.log("\n--- STAGE 3: VIDEO COMPILATION ---");
    Ffmpeg.setFfmpegPath(getEnvironmentVariable('FFMPEG_BINARY_PATH'));

    const tempDir = path.join(assetsDir, 'temp');
    rmSync(tempDir, { recursive: true, force: true });
    mkdirSync(tempDir, { recursive: true });

    const sceneAssets = Object.values(assets);
    const tempClipPaths: string[] = [];
    const tempSrtPaths: string[] = [];
    const audioFilePaths: string[] = [];
    let cumulativeDuration = 0;

    // --- 1. Create an animated clip for each scene ---
    for (const scene of sceneAssets) {
        console.log(`   - Creating animated clip for ${scene.sceneId}...`);
        const srtPath = await createSrtFile(scene, tempDir);
        const clipPath = path.join(tempDir, `${scene.sceneId}.mp4`);

        await createAnimatedSceneClip(scene, srtPath, clipPath);

        tempClipPaths.push(clipPath);
        tempSrtPaths.push(srtPath);
        audioFilePaths.push(scene.audioFilePath);
        cumulativeDuration += scene.durationSeconds;
    }
    console.log("   - All scene clips created successfully.");

    // --- 2. Concatenate clips with fade transitions ---
    console.log("   - Stitching clips together with transitions...");
    const silentStitchedVideoPath = await stitchClipsWithTransitions(tempClipPaths, tempDir, sceneAssets);

    console.log("   - Silent video with transitions is complete.");

    // --- 3. Concatenate all audio files ---
    const stitchedAudioPath = await concatenateAudio(audioFilePaths, tempDir);
    console.log("   - Full audio track has been created.");

    // --- 4. Combine final video and audio ---
    const finalVideoPath = path.join(assetsDir, `${storyTitle}.mp4`); // Save final video outside the story's asset folder
    console.log(`   - Merging final video and audio into: ${finalVideoPath}`);
    await new Promise((resolve, reject) => {
        Ffmpeg()
            .input(silentStitchedVideoPath)               // 0:v
            .input(stitchedAudioPath)                   // 1:a
            // tell ffmpeg exactly which streams to keep
            .outputOptions([
                '-map', '0:v:0',                      // map video from first input
                '-map', '1:a:0',                      // map audio from second input
                '-c:v', 'copy',                       // copy that video stream
                '-c:a', 'pcm_s16le',                  // encode that audio stream as PCM
                // '-shortest'                        // <— only if you want to stop at the shorter of the two
            ])
            .output(finalVideoPath)
            .on('start', cmd => console.log('FFmpeg CLI:', cmd))
            .on('stderr', line => console.error('[ffmpeg]', line))
            .on('end', () => resolve(finalVideoPath))
            .on('error', err => reject(new Error(`Failed to merge final video: ${err.message}`)))
            .run();
    });

    // --- 5. Cleanup temporary files ---
    console.log("   - Cleaning up temporary files...");
    rmSync(tempDir, { recursive: true, force: true });
    console.log("--- VIDEO COMPILATION COMPLETE ---");

    return finalVideoPath;
}
