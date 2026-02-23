import Song from "../models/song.model";
import { getSongPlaybackUrl } from "../config/cloudinary";
export async function updateDbEntries() {
  const songInfo = await getSongPlaybackUrl("songs/yop5jx42izbqevxdcr7k");
  console.log({ songInfo });
  //   const songs = await Song.find();
  //   for (const song of songs) {
  //   }
}

// playbackUrl
// "https://res.cloudinary.com/dqh9frccg/video/upload/sp_auto/v1771836621/…"
// owner
// 6968c8ae65dc9cceeef4375a
// genre
// "unknown"

// tags
// Array (empty)
// playCount
// 0
