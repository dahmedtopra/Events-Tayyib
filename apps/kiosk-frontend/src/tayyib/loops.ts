export type TayyibState =
  | "home_hero"
  | "intro_wave"
  | "idle"
  | "listening"
  | "searching"
  | "explaining_a"
  | "explaining_b"
  | "pose_a"
  | "pose_b";

export const TAYYIB_STATES: TayyibState[] = [
  "home_hero",
  "intro_wave",
  "idle",
  "listening",
  "searching",
  "explaining_a",
  "explaining_b",
  "pose_a",
  "pose_b"
];

export const DEFAULT_TAYYIB_BASE_PATH = "/assets/tayyib_loops/";

export const TAYYIB_ASSETS: Record<TayyibState, string[]> = {
  home_hero: ["home_hero.webm", "home_hero.mp4"],
  intro_wave: ["attract.webm", "attract.mp4"],
  idle: ["idle.webm", "idle.mp4"],
  listening: ["listening.webm", "listening.mp4"],
  searching: ["searching.webm", "searching.mp4"],
  explaining_a: ["explaining_a.webm", "explaining_a.mp4"],
  explaining_b: ["explaining_b.webm", "explaining_b.mp4"],
  pose_a: ["pose_a.webm", "pose_a.mp4"],
  pose_b: ["pose_b.webm", "pose_b.mp4"]
};

export function getTayyibBasePath() {
  const fromEnv = import.meta.env.VITE_TAYYIB_BASE_PATH as string | undefined;
  if (!fromEnv || fromEnv.trim().length === 0) return DEFAULT_TAYYIB_BASE_PATH;
  return fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`;
}

export function buildAssetUrl(filename: string) {
  return `${getTayyibBasePath()}${filename}`;
}
