/**
 * Extract palette from cover images using Vibrant.
 * Paste into server.ts and call runExtractPalette() after connectDb().
 *
 *   import { runExtractPalette } from "./scripts/extractPalette";
 *   await runExtractPalette();
 */

import { Vibrant } from "node-vibrant/node";
import Song from "../models/song.model";

export async function runExtractPalette() {
  console.log("\n🎨 Extracting palettes for whole DB...\n");

  const songs = await Song.find({
    coverImageUrl: { $exists: true, $nin: [null, ""] },
    "palette.vibrant": { $exists: false },
  }).lean();

  console.log(`${songs.length} song(s) to process...\n`);

  let saved = 0;
  let failed = 0;

  for (const song of songs) {
    try {
      const palette = await Vibrant.from(song.coverImageUrl!).getPalette();
      await Song.updateOne(
        { _id: song._id },
        {
          $set: {
            palette: {
              vibrant: palette.Vibrant?.hex ?? null,
              muted: palette.Muted?.hex ?? null,
              darkVibrant: palette.DarkVibrant?.hex ?? null,
              lightVibrant: palette.LightVibrant?.hex ?? null,
            },
          },
        },
      );
      saved++;
      console.log(`  ✓ [${song._id}] ${song.title}`);
    } catch (err: any) {
      failed++;
      console.log(`  ✗ [${song._id}] ${song.title}: ${err.message}`);
    }
  }

  console.log(`\n🎨 Done. Saved: ${saved}, Failed: ${failed}\n`);
}