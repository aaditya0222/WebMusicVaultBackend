import { Schema, model, Types } from "mongoose";

// ----------------------
// GENRES
// ----------------------
export const GENRES = [
  "bollywood", // popular hindi film songs
  "punjabi", // punjabi songs, often energetic or dance-oriented
  "nepali", // nepali songs, local music
  "western", // western pop, rock, r&b, etc.
  "classics", // timeless older songs, classical or vintage hits
  "lyric/cover/mashup", // songs that are lyrical versions, covers, or mashups
  "rap/hiphop", // rap and hip-hop tracks
  "edm/remix", // electronic dance music and remixes
  "soundtrack/ost", // movie or game original soundtracks
  "independent", // independent artists or indie music
  "unknown", // songs that don't fit into the above genres
] as const;

export type Genre = (typeof GENRES)[number];

// ----------------------
// TAG CATEGORIES
// ----------------------
export const TAG_CATEGORIES = {
  language: [
    "hindi",
    "punjabi",
    "nepali",
    "english",
    "korean", // for K-pop
    "japanese", // for anime / J-pop
    "spanish", // reggaeton or Spanish pop
    "mixed", // songs with multiple languages
  ] as const,

  mood: [
    "emotional", // love, heartbreak, intense feelings
    "calm", // slow, peaceful, relaxing
    "energetic", // dance, workout, upbeat
    "happy", // cheerful, celebratory
    "sad", // explicitly sad, melancholic
    "chill", // lofi, relaxed vibes
    "romantic", // love-focused
    "party", // dance or celebration tracks
    "motivational", // inspirational or hype
  ] as const,

  instruments: [
    "guitar",
    "piano",
    "electronic",
    "violin",
    "drums",
    "synth",
    "orchestra", // for OST or classical songs
  ] as const,

  // optional extra categories
  tempo: ["slow", "medium", "fast"] as const,

  vocal: ["male", "female", "duet", "group", "instrumental"] as const,

  theme: [
    "love",
    "friendship",
    "nature",
    "festive",
    "life",
    "party",
    "spiritual",
  ] as const,
};

export type LanguageTag = (typeof TAG_CATEGORIES.language)[number];
export type MoodTag = (typeof TAG_CATEGORIES.mood)[number];
export type InstrumentsTag = (typeof TAG_CATEGORIES.instruments)[number];
export type TempoTag = (typeof TAG_CATEGORIES.tempo)[number];
export type VocalTag = (typeof TAG_CATEGORIES.vocal)[number];
export type ThemeTag = (typeof TAG_CATEGORIES.theme)[number];

type Tags =
  | LanguageTag
  | MoodTag
  | InstrumentsTag
  | TempoTag
  | VocalTag
  | ThemeTag;

export const TAGS = [
  ...TAG_CATEGORIES.language,
  ...TAG_CATEGORIES.mood,
  ...TAG_CATEGORIES.instruments,
  ...TAG_CATEGORIES.tempo,
  ...TAG_CATEGORIES.theme,
  ...TAG_CATEGORIES.vocal,
];

export interface SongI {
  title: string;
  duration: number;
  artist?: string;
  publicId: string;
  fileUrl: string;
  owner: Types.ObjectId;
  genre?: Genre;
  tags?: Tags[];
  playCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const songSchema = new Schema<SongI>(
  {
    title: { type: String, required: true, trim: true, unique: true },
    duration: { type: Number, required: true, min: 1 },
    artist: { type: String, default: "unknown", trim: true },
    publicId: { type: String, required: true },
    fileUrl: { type: String, required: true },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    genre: {
      type: String,
      enum: GENRES,
      default: "unknown",
      index: true,
    },
    tags: {
      type: [String],
      enum: TAGS,
      default: [],
      index: true,
    },
    playCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

songSchema.index({
  title: "text",
  artist: "text",
  tags: "text",
  genre: "text",
});

songSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete (ret as any).__v;
  },
});
const Song = model<SongI>("Song", songSchema);
export default Song;
