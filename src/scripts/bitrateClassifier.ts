import Song from "../models/song.model";
import { parseWebStream } from "music-metadata";
import fs from "fs";
import path from "path";

interface SongQuality {
  title: string;
  artist: string;
  bitrate: number | null;
  kbps: string;
  category: "excellent" | "good" | "decent" | "poor" | "unknown";
}

interface QualityReport {
  summary: {
    total: number;
    excellent: number; // 320kbps+
    good: number; // 192-319kbps
    decent: number; // 128-191kbps
    poor: number; // below 128kbps
    unknown: number; // no bitrate info
  };
  songs: {
    excellent: SongQuality[];
    good: SongQuality[];
    decent: SongQuality[];
    poor: SongQuality[];
    unknown: SongQuality[];
  };
}

function categorize(bitrate: number | null): SongQuality["category"] {
  if (!bitrate) return "unknown";
  if (bitrate >= 320000) return "excellent";
  if (bitrate >= 192000) return "good";
  if (bitrate >= 128000) return "decent";
  return "poor";
}

export async function checkBitrates() {
  const songs = await Song.find({}).sort({ createdAt: -1 });

  const report: QualityReport = {
    summary: {
      total: songs.length,
      excellent: 0,
      good: 0,
      decent: 0,
      poor: 0,
      unknown: 0,
    },
    songs: { excellent: [], good: [], decent: [], poor: [], unknown: [] },
  };

  console.log(`Checking bitrates for ${songs.length} songs...\n`);

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i];
    console.log(`[${i + 1}/${songs.length}] ${song.title}`);

    try {
      const response = await fetch(song.fileUrl);
      const body = response.body;

      if (!body) {
        console.warn(`  ⚠ Skipping: no response body`);
        continue;
      }

      const metadata = await parseWebStream(body);
      const bitrate = metadata.format.bitrate ?? null;
      const category = categorize(bitrate);

      const entry: SongQuality = {
        title: song.title,
        artist: song.artist!,
        bitrate,
        kbps: bitrate ? `${Math.round(bitrate / 1000)} kbps` : "unknown",
        category,
      };

      report.songs[category].push(entry);
      report.summary[category]++;

      console.log(`  → ${entry.kbps} (${category})`);
    } catch (err: any) {
      console.error(`  ✗ Failed: ${err?.message}`);
    }
  }

  // Save report
  const LOG_PATH = path.resolve("bitrate-report.json");
  fs.writeFileSync(LOG_PATH, JSON.stringify(report, null, 2));

  // Print summary
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BITRATE REPORT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total songs : ${report.summary.total}
✅ Excellent : ${report.summary.excellent} (320kbps+)
🟢 Good      : ${report.summary.good} (192-319kbps)
🟡 Decent    : ${report.summary.decent} (128-191kbps)
🔴 Poor      : ${report.summary.poor} (below 128kbps)
❓ Unknown   : ${report.summary.unknown}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full report saved to: ${LOG_PATH}
  `);
}
