export type Character = "stitch" | "angel";
export type Motion =
  | "idle"
  | "wave"
  | "look"
  | "scratch"
  | "nose"
  | "point"
  | "celebrate"
  | "sad"
  | "dance"
  | "headstand"
  | "reference";

export const motionDuration: Record<Motion, number> = {
  idle: 0,
  wave: 2600,
  look: 3200,
  scratch: 2800,
  nose: 3000,
  point: 2400,
  celebrate: 3000,
  sad: 3200,
  dance: 3200,
  headstand: 4600,
  reference: 2800,
};
