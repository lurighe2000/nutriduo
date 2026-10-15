import type { Character, Motion } from "../features/mascots/renderer";
import type { CompanionMood } from "./mascotState";

/** Ordinary play is available before logging food; celebrations still follow progress. */
export function companionGesture(
  character: Character,
  mood: CompanionMood,
  index: number,
): Motion {
  const everyday: Motion[] = ["scratch", "look", "nose", "wave", "look"];
  const joyful: Motion[] = [
    "scratch",
    "nose",
    "dance",
    "look",
    "wave",
    ...(character === "stitch"
      ? ["headstand" as const]
      : ["reference" as const]),
  ];
  const pool =
    mood === "support"
      ? (["look", "scratch"] as const)
      : mood === "neutral"
        ? everyday
        : joyful;
  return pool[index % pool.length];
}
