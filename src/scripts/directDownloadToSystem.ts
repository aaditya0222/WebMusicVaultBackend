import { isAbsolute, resolve, join } from "path";
import { readdir } from "fs/promises";
import { createWriteStream, unlink } from "fs";
import Song from "../models/song.model";
import https from "https";

const downloadSong = (url: string, outputPath: string) => {
  return new Promise<void>((resolve, reject) => {
    const file = createWriteStream(outputPath);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log("Downloaded song :", outputPath);
          resolve();
        });

        file.on("error", (err) => {
          file.close();
          unlink(outputPath, () => reject(err));
        });

        response.on("error", (err) => {
          file.close();
          unlink(outputPath, () => reject(err));
        });
      })
      .on("error", (err) => {
        unlink(outputPath, () => reject(err));
      });
  });
};
const sanitizeFilename = (filename: string): string => {
  // Replace invalid Windows filename characters with alternatives
  return filename
    .replace(/"/g, "\u201D") // Replace straight double quote with curly quote "
    .replace(/\//g, "-") // Replace forward slash with dash
    .replace(/\\/g, "-") // Replace backslash with dash
    .replace(/</g, "«")
    .replace(/>/g, "»")
    .replace(/:/g, "·")
    .replace(/\|/g, "•")
    .replace(/\?/g, "¿")
    .replace(/\*/g, "✱")
    .trim();
};

const directDownloader = async (songFolderPath: string) => {
  try {
    const folderPath = isAbsolute(songFolderPath)
      ? songFolderPath
      : resolve(songFolderPath);
    const songsInFolder = await readdir(folderPath);
    const allSongs = await Song.find({});
    const folderSongsSet = new Set(songsInFolder);
    const songsToDownload = allSongs.filter(
      (song) => !folderSongsSet.has(sanitizeFilename(song.title)),
    );
    console.log(songsToDownload.length);
    for (const song of songsToDownload) {
      const sanitizedTitle = sanitizeFilename(song.title);
      const outputPath = join(folderPath, sanitizedTitle);

      await downloadSong(song.fileUrl, outputPath);
    }
  } catch (error) {
    console.log("Error::", error);
  }
};
export default directDownloader;
