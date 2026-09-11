// scripts/auditFolderSongs.ts
// READ-ONLY audit: compares audio files in a folder against songs in the DB.
// 1. Scans top-level files only (no recursion, no subfolders).
// 2. Keeps only files newer than N days (default 30 ≈ 1 month) by mtime.
// 3. Reports duplicate filenames within the folder.
// 4. Reports which folder songs are NOT in the DB (by title).
// It never writes to the DB — console output + a JSON log file only.
//
// Usage (after MongoDB is connected, e.g. from server.ts or a runner):
//   import { auditFolderSongs } from "./scripts/auditFolderSongs";
//   await auditFolderSongs("D:/Music/NewUploads");                       // 30-day default
//   await auditFolderSongs("D:/Music/NewUploads", { newerThanDays: 60 }); // custom window
//   await auditFolderSongs("D:/Music/NewUploads", "D:/audit.json", { newerThanDays: 7 });
import fs from "fs";
import path from "path";
import Song from "../models/song.model";

const AUDIO_EXTENSIONS = new Set([
  ".mp3",
  ".m4a",
  ".wav",
  ".flac",
  ".ogg",
  ".oga",
  ".aac",
  ".wma",
  ".opus",
  ".aiff",
  ".aif",
]);

interface MissingSong {
  file: string;
  title: string;
}

interface DuplicateGroup {
  title: string;
  files: string[];
}

interface AuditResult {
  folder: string;
  scannedAt: string;
  newerThanDays: number;
  cutoff: string;
  totalFiles: number;
  recentEnoughFiles: number;
  tooOldFiles: string[];
  audioFiles: number;
  skippedNonAudio: string[];
  duplicatesInFolder: DuplicateGroup[];
  inDb: string[];
  missingFromDb: MissingSong[];
}

/** Strip the trailing extension (".mp3") for filename <-> DB title comparison. */
function stripExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

/** Normalize for comparison: trim + lowercase. */
function normalize(title: string): string {
  return stripExtension(title).trim().toLowerCase();
}

interface AuditOptions {
  /** Only include files modified within the last N days (age < N days). Default: 30. */
  newerThanDays?: number;
  /** Reference "now" (mainly for tests). Defaults to current time. */
  now?: Date;
}

/** Default: only files from roughly the last month (age < 30 days) are included. */
const DEFAULT_NEWER_THAN_DAYS = 30;

export async function auditFolderSongs(
  folderPath: string,
  logPathOrOptions: string | AuditOptions = path.resolve(
    "folder-audit-log.json",
  ),
  maybeOptions?: AuditOptions,
): Promise<AuditResult> {
  // Allow: auditFolderSongs(dir), auditFolderSongs(dir, logPath),
  //         auditFolderSongs(dir, options), auditFolderSongs(dir, logPath, options)
  const logPath =
    typeof logPathOrOptions === "string"
      ? logPathOrOptions
      : path.resolve("folder-audit-log.json");
  const options: AuditOptions =
    typeof logPathOrOptions === "object" && logPathOrOptions !== null
      ? logPathOrOptions
      : (maybeOptions ?? {});
  const newerThanDays =
    options.newerThanDays ?? DEFAULT_NEWER_THAN_DAYS;
  const now = options.now ?? new Date();
  const cutoff = now.getTime() - newerThanDays * 24 * 60 * 60 * 1000;

  const absFolder = path.resolve(folderPath);
  const stat = fs.statSync(absFolder);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${absFolder}`);
  }

  console.log(`=== Auditing folder: ${absFolder} ===`);
  console.log(
    `Only files newer than ${newerThanDays} day(s) (modified on/after ${new Date(cutoff).toISOString()}) are scanned.\n`,
  );

  // ── Step 1: list top-level files only (skip subfolders) ──
  const entries = fs.readdirSync(absFolder, { withFileTypes: true });
  const allFiles = entries.filter((e) => e.isFile()).map((e) => e.name);
  const skippedDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  if (skippedDirs.length > 0) {
    console.log(`Skipped ${skippedDirs.length} subfolder(s): ${skippedDirs.join(", ")}`);
  }

  // ── Step 2: keep only files newer than the cutoff (by mtime) ──
  const tooOld: string[] = [];
  const files = allFiles.filter((f) => {
    const mtimeMs = fs.statSync(path.join(absFolder, f)).mtimeMs;
    if (mtimeMs < cutoff) {
      tooOld.push(f);
      return false;
    }
    return true;
  });
  console.log(
    `Skipped ${tooOld.length} file(s) older than ${newerThanDays} day(s): ${tooOld.length ? tooOld.slice(0, 10).join(", ") + (tooOld.length > 10 ? ` (+${tooOld.length - 10} more)` : "") : "none"}`,
  );

  const audioFiles = files.filter((f) =>
    AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase()),
  );
  const skippedNonAudio = files.filter(
    (f) => !AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase()),
  );
  console.log(`Found ${files.length} file(s): ${audioFiles.length} audio, ${skippedNonAudio.length} non-audio skipped.`);

  // ── Step 3: duplicates within the folder ──
  const byTitle = new Map<string, string[]>();
  const displayTitle = new Map<string, string>();
  for (const file of audioFiles) {
    const key = normalize(file);
    if (!byTitle.has(key)) {
      byTitle.set(key, []);
      displayTitle.set(key, stripExtension(file).trim());
    }
    byTitle.get(key)!.push(file);
  }
  const duplicatesInFolder: DuplicateGroup[] = [];
  for (const [key, group] of byTitle) {
    if (group.length > 1) {
      duplicatesInFolder.push({ title: displayTitle.get(key)!, files: group });
    }
  }
  console.log(`\n--- Duplicates inside folder: ${duplicatesInFolder.length} ---`);
  for (const dup of duplicatesInFolder) {
    console.log(`  "${dup.title}" appears ${dup.files.length}x:`);
    for (const f of dup.files) console.log(`    - ${f}`);
  }

// ── Step 4: compare against DB (read-only, single query).
// NOTE: filename normalization (extension strip/trim/lowercase) is used ONLY
// for duplicate detection above and for the side-by-side "closest DB match"
// shown next to each result below. The actual missing list contains EVERY
// folder title with no exact (trim/case-insensitive) DB title match — even
// near-misses like "Calm Down" when the DB has "Calm-Down" — because those
// are exactly what you want to upload. ──
  const dbSongs = await Song.find({}).select("title").lean();
  const normToDisplay = new Map<string, string>();
  for (const s of dbSongs) {
    const key = normalize(s.title);
    if (!normToDisplay.has(key)) {
      normToDisplay.set(key, s.title.trim());
    }
  }
  const dbTitles = new Set(normToDisplay.keys());
  console.log(`\nLoaded ${dbSongs.length} song title(s) from DB.`);

  // Compare each unique folder title once (duplicates already reported above)
  const inDb: string[] = [];
  const missingFromDb: MissingSong[] = [];
  const closeMatches = new Map<string, string[]>(); // folder key -> DB title(s) sharing the first 4+ chars
  const seen = new Set<string>();
  for (const file of audioFiles) {
    const key = normalize(file);
    if (seen.has(key)) continue;
    seen.add(key);
    const title = stripExtension(file).trim();
    if (dbTitles.has(key)) {
      inDb.push(title);
    } else {
      missingFromDb.push({ file, title });
      // Find close DB titles sharing a 4+ char prefix/suffix-insensitive stem,
      // purely as context — they do NOT change missing status.
      const stem = key.replace(/[^a-z0-9]+/g, "").slice(0, 6);
      if (stem.length >= 4) {
        const close: string[] = [];
        for (const [dbKey, display] of normToDisplay) {
          const dbStem = dbKey.replace(/[^a-z0-9]+/g, "").slice(0, 6);
          if (
            dbKey !== key &&
            (dbKey.includes(key) ||
              key.includes(dbKey) ||
              (stem.length >= 4 && dbStem.length >= 4 && (dbStem.startsWith(stem) || stem.startsWith(dbStem))))
          ) {
            close.push(display);
            if (close.length >= 3) break;
          }
        }
        if (close.length > 0) closeMatches.set(title, close);
      }
    }
  }

  console.log(`\n--- Already in DB: ${inDb.length} ---`);
  for (const t of inDb) console.log(`  ✓ "${t}"`);

  console.log(`\n--- MISSING from DB: ${missingFromDb.length} ---`);
  console.log(`(Listed if NO exact trim/case-insensitive DB title match. "Closest" is context only — it never removes a song from this list.)`);
  for (const m of missingFromDb) {
    const close = closeMatches.get(m.title);
    console.log(
      `  ✗ "${m.title}"  (file: ${m.file})${close ? `   ~ closest in DB: ${close.map((c) => `"${c}"`).join(" / ")}` : "   ~ no close match in DB"}`,
    );
  }

  // ── Step 5: write JSON log (no DB writes anywhere in this script) ──
  const result: AuditResult = {
    folder: absFolder,
    scannedAt: new Date().toISOString(),
    newerThanDays,
    cutoff: new Date(cutoff).toISOString(),
    totalFiles: allFiles.length,
    recentEnoughFiles: files.length,
    tooOldFiles: tooOld,
    audioFiles: audioFiles.length,
    skippedNonAudio,
    duplicatesInFolder,
    inDb,
    missingFromDb,
  };
  fs.writeFileSync(logPath, JSON.stringify(result, null, 2));
  console.log(`\n=== Audit complete. Log saved to: ${logPath} ===`);

  return result;
}
