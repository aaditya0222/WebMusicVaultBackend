// scripts/migrateAllSongsToAuthenticated.ts
import cloudinary from "../config/cloudinary";
import Song from "../models/song.model";
import fs from "fs";
import path from "path";

const DELAY_MS = 400; // pacing between individual rename calls (safe under free-tier limits)
const LOG_DIR = path.join(__dirname, "migration-logs");
const SUCCESS_LOG = path.join(LOG_DIR, "migrated-success.json");
const FAILED_LOG = path.join(LOG_DIR, "migrated-failed.json");
const PROGRESS_LOG = path.join(LOG_DIR, "migration-progress.json");

type LogEntry = {
  publicId: string;
  title: string;
  status: "success" | "failed";
  error?: string;
  timestamp: string;
};

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function loadJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.error(`Failed to parse ${filePath}, starting fresh.`, e);
  }
  return fallback;
}

function appendLog(filePath: string, entry: LogEntry) {
  const existing = loadJsonSafe<LogEntry[]>(filePath, []);
  existing.push(entry);
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function migrateAllSongsToAuthenticated() {
  ensureLogDir();

  // Resume support: skip any publicId already marked successful in a previous run.
  const alreadySucceeded = new Set(
    loadJsonSafe<LogEntry[]>(SUCCESS_LOG, []).map((e) => e.publicId),
  );

  const songs = await Song.find({}, { publicId: 1, title: 1 }).sort({
    createdAt: 1,
  });

  const remaining = songs.filter((s) => !alreadySucceeded.has(s.publicId));

  console.log(`Total songs in DB: ${songs.length}`);
  console.log(`Already migrated (skipping): ${alreadySucceeded.size}`);
  console.log(`Remaining to migrate: ${remaining.length}`);

  if (remaining.length === 0) {
    console.log("Nothing left to migrate. Done.");
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < remaining.length; i++) {
    const s = remaining[i];
    const label = `[${i + 1}/${remaining.length}]`;

    try {
      const result = await cloudinary.uploader.rename(s.publicId, s.publicId, {
        resource_type: "video",
        type: "upload",
        to_type: "authenticated",
        overwrite: true,
      });

      if (result.type !== "authenticated") {
        throw new Error(`Unexpected resulting type: ${result.type}`);
      }

      appendLog(SUCCESS_LOG, {
        publicId: s.publicId,
        title: s.title,
        status: "success",
        timestamp: new Date().toISOString(),
      });
      successCount++;
      console.log(`${label} ✓ ${s.title}`);
    } catch (err: any) {
      const message = err?.message || String(err);
      appendLog(FAILED_LOG, {
        publicId: s.publicId,
        title: s.title,
        status: "failed",
        error: message,
        timestamp: new Date().toISOString(),
      });
      failCount++;
      console.error(`${label} ✗ ${s.title} — ${message}`);
    }

    // Write progress checkpoint every 10 songs, so you can see live status
    // in a file even if the process is killed mid-run.
    if (i % 10 === 0 || i === remaining.length - 1) {
      fs.writeFileSync(
        PROGRESS_LOG,
        JSON.stringify(
          {
            processed: i + 1,
            total: remaining.length,
            successCount,
            failCount,
            lastUpdated: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }

    if (i < remaining.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log("\n=== Migration run complete ===");
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  if (failCount > 0) {
    console.log(
      `See ${FAILED_LOG} for details. Re-run this function to retry failures automatically.`,
    );
  }
}
