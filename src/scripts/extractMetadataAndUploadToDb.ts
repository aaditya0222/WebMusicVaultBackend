import { v2 as cloudinary } from "cloudinary";
import { uploadFile } from "../config/cloudinary";
import Song from "../models/song.model";
import { parseWebStream } from "music-metadata";
import fs from "fs";
import path from "path";

const LOG_PATH = path.resolve("migration-log.json");

interface LogEntry {
  songId: string;
  title: string;
  status: "success" | "skipped" | "failed" | "deleted";
  reason?: string;
  updates?: string[];
  timestamp: string;
}

function writeLog(entries: LogEntry[]) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(entries, null, 2));
}

export async function extractMetaData() {
  const songs = await Song.find({}).sort({ createdAt: -1 });
  const log: LogEntry[] = [];

  console.log(`Starting migration for ${songs.length} songs...`);

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    console.log(`[${i + 1}/${songs.length}] Processing: ${song.title}`);

    try {
      const response = await fetch(song.fileUrl);
      const contentLength = response.headers.get("Content-Length");
      const size = contentLength ? parseInt(contentLength, 10) : undefined;
      const mimeType = response.headers.get("content-Type");

      const body = response.body;
      if (!body) {
        console.warn(`  Skipping: response body is null`);
        log.push({
          songId: song._id.toString(),
          title: song.title,
          status: "skipped",
          reason: "response body is null",
          timestamp: new Date().toISOString(),
        });
        writeLog(log);
        continue;
      }

      const metadata = await parseWebStream(body, {
        mimeType: mimeType ?? undefined,
        size,
      });

      const extractedArtist = metadata.common.artist;
      const finalArtist = extractedArtist || song.artist;

      // ── Extract metadata FIRST, then check for duplicates ──
      const duplicate = await Song.findOne({
        _id: { $ne: song._id },
        title: { $regex: `^${song.title}$`, $options: "i" },
        artist: { $regex: `^${finalArtist}$`, $options: "i" },
      });

      if (duplicate) {
        console.log(
          `  DUPLICATE: "${song.title}" by "${finalArtist}" already exists (ID: ${duplicate._id}). Deleting this copy.`,
        );
        // Delete Cloudinary files for this duplicate
        if (song.publicId) {
          try {
            await cloudinary.uploader.destroy(song.publicId, {
              resource_type: "video",
            });
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        if (song.coverImagePublicId) {
          try {
            await cloudinary.uploader.destroy(song.coverImagePublicId, {
              resource_type: "image",
            });
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        await Song.deleteOne({ _id: song._id });
        log.push({
          songId: song._id.toString(),
          title: song.title,
          status: "deleted",
          reason: `duplicate of ${duplicate._id}`,
          timestamp: new Date().toISOString(),
        });
        writeLog(log);
        continue;
      }

      // ── No duplicate - update this song with extracted metadata ──
      const updates: Record<string, any> = {};
      const updatedFields: string[] = [];

      if (extractedArtist && song.artist === "Unknown Artist") {
        updates.artist = extractedArtist;
        updatedFields.push(`artist: ${extractedArtist}`);
      }

      if (metadata.common.picture?.length && !song.coverImageUrl) {
        const buffer = Buffer.from(metadata.common.picture[0].data);
        const coverUploadResult = await uploadFile({
          buffer,
          folder: "coverImages",
          resource_type: "image",
        });

        if (!coverUploadResult || "error" in coverUploadResult) {
          throw new Error("Cover image upload to Cloudinary failed");
        }

        updates.coverImageUrl = coverUploadResult.secure_url;
        updates.coverImagePublicId = coverUploadResult.public_id;
        updatedFields.push(`coverImageUrl: ${coverUploadResult.secure_url}`);
      }

      if (Object.keys(updates).length > 0) {
        await Song.findOneAndUpdate({ _id: song._id }, updates);
        console.log(`  Updated: ${updatedFields.join(", ")}`);
        log.push({
          songId: song._id.toString(),
          title: song.title,
          status: "success",
          updates: updatedFields,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(`  Nothing to update`);
        log.push({
          songId: song._id.toString(),
          title: song.title,
          status: "skipped",
          reason: "nothing to update",
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error(`  Failed:`, err?.message ?? err);
      log.push({
        songId: song._id.toString(),
        title: song.title,
        status: "failed",
        reason: err?.message ?? String(err),
        timestamp: new Date().toISOString(),
      });
    }

    writeLog(log);
  }

  console.log(`\nMigration complete! ${songs.length} songs processed.`);
  console.log(`Full log saved to: ${LOG_PATH}`);
  writeLog(log);
}
