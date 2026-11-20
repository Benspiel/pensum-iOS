import { FONTS, type FontId } from "./protocol";

export const fontSamples = {
  Caveat: { label: "Caveat", source: require("./engine/fonts/Caveat-Regular.ttf") },
  Kalam: { label: "Kalam", source: require("./engine/fonts/Kalam-Regular.ttf") },
  "Patrick Hand": { label: "Patrick", source: require("./engine/fonts/PatrickHand-Regular.ttf") },
  "Indie Flower": { label: "Indie", source: require("./engine/fonts/IndieFlower-Regular.ttf") },
  "Shadows Into Light": { label: "Shadows", source: require("./engine/fonts/ShadowsIntoLight-Regular.ttf") },
  "Gochi Hand": { label: "Gochi", source: require("./engine/fonts/GochiHand-Regular.ttf") },
} satisfies Record<FontId, { label: string; source: number }>;

export const fontSampleSources = Object.fromEntries(FONTS.map((font) => [font, fontSamples[font].source]));
