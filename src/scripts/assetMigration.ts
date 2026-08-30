// scripts/testMigration.ts
import cloudinary from "../config/cloudinary"; // adjust path to your existing configured instance
import Song from "../models/song.model"; // adjust path

export async function testMigration() {
  const songs = await Song.find({}, { publicId: 1, title: 1, fileUrl: 1 })
    .sort({ createdAt: -1 })
    .limit(2);

  if (songs.length < 2) {
    console.log("Not enough songs found.");
    return;
  }

  console.log("=== Testing with these 2 songs ===");
  songs.forEach((s) => console.log(`- ${s.title} (${s.publicId})`));

  console.log("\n=== OLD public URLs (should work right now) ===");
  songs.forEach((s) => console.log(`${s.title}: ${s.fileUrl}`));

  console.log("\n=== Locking to 'authenticated' via rename ===");
  for (const s of songs) {
    try {
      const result = await cloudinary.uploader.rename(s.publicId, s.publicId, {
        resource_type: "video",
        type: "upload",
        to_type: "authenticated",
        overwrite: true,
      });
      console.log(`✓ Locked: ${s.title} — new type: ${result.type}`);
    } catch (err: any) {
      console.error(`✗ Failed: ${s.title}`, err.message || err);
    }
  }

  console.log("\n=== Same OLD public URLs (should now fail/403) ===");
  songs.forEach((s) => console.log(`${s.title}: ${s.fileUrl}`));

  console.log("\n=== NEW signed URLs (expires in 60 seconds) ===");
  const expiresAt = Math.floor(Date.now() / 1000) + 60;
  songs.forEach((s) => {
    const signedUrl = cloudinary.utils.private_download_url(s.publicId, "mp3", {
      resource_type: "video",
      type: "authenticated",
      expires_at: expiresAt,
      attachment: false,
    });
    console.log(`${s.title}: ${signedUrl}`);
  });

  console.log("\n=== Done. Test the links above manually. ===");
}
