// scripts/migrateSongTitles.ts
// 1. Check for songs without any extension
// 2. Remove .mp3 suffix from title
// 3. Add extension field to every doc (default ".mp3")
import Song from "../models/song.model";

export async function migrateSongTitles() {
  console.log("=== Starting Song Title Migration ===\n");

  // Step 1: Find songs WITHOUT any file extension (no dot near the end)
  const noExtensionSongs = await Song.find({
    $or: [
      { title: { $not: /\.[a-zA-Z0-9]{1,5}$/i } },
      { title: { $eq: "" } },
    ],
  }).select("_id title");

  console.log(`Songs without extension: ${noExtensionSongs.length}`);
  if (noExtensionSongs.length > 0) {
    console.log("Sample docs without extension:");
    noExtensionSongs.slice(0, 5).forEach((doc) => {
      console.log(`  ID: ${doc._id}, Title: "${doc.title}"`);
    });
  }

  // Step 2: Count and remove .mp3 suffix from titles
  const songsWithMp3 = await Song.countDocuments({
    title: { $regex: /\.mp3$/i },
  });
  console.log(`\nSongs with .mp3 suffix: ${songsWithMp3}`);

  const removeResult = await Song.updateMany(
    { title: { $regex: /\.mp3$/i } },
    [
      {
        $set: {
          title: {
            $substrCP: [
              "$title",
              0,
              { $subtract: [{ $strLenCP: "$title" }, 4] }, // remove last 4 chars (.mp3)
            ],
          },
        },
      },
    ],
  );
  console.log(`Removed .mp3 from ${removeResult.modifiedCount} documents`);

  // Step 3: Add extension field to ALL docs (default ".mp3")
  const extResult = await Song.updateMany(
    { extension: { $exists: false } },
    { $set: { extension: ".mp3" } },
  );
  console.log(`Added extension field to ${extResult.modifiedCount} documents`);

  // Verify sample results
  const sample = await Song.find().limit(5).select("_id title extension");
  console.log("\nSample results:");
  sample.forEach((doc) => {
    console.log(`  Title: "${doc.title}", Extension: "${doc.extension}"`);
  });

  console.log("\n=== Migration Complete ===");
}