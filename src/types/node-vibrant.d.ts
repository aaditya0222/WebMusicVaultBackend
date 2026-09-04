declare module "node-vibrant" {
  interface Swatch {
    hex: string;
    rgb: [number, number, number];
    hsl: [number, number, number];
    population: number;
    bodyTextColor?: string;
    titleTextColor?: string;
  }

  interface Palette {
    Vibrant?: Swatch;
    Muted?: Swatch;
    DarkVibrant?: Swatch;
    DarkMuted?: Swatch;
    LightVibrant?: Swatch;
    LightMuted?: Swatch;
  }

  interface Builder {
    getPalette(): Promise<Palette>;
    quality(quality: number): Builder;
    maxColorCount(count: number): Builder;
  }

  class Vibrant {
    static from(image: string): Builder;
  }

  export default Vibrant;
}
