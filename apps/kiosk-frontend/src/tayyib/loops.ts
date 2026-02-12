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
  home_hero: ["home_hero.webm", "home_hero.mp4", "attract.webm", "attract.mp4"],
  intro_wave: ["attract.webm", "attract.mp4"],
  // All post-attract states intentionally use idle media.
  idle: ["idle.webm", "idle.mp4", "Idle.mp4"],
  listening: ["idle.webm", "idle.mp4", "Idle.mp4"],
  searching: ["idle.webm", "idle.mp4", "Idle.mp4"],
  explaining_a: ["idle.webm", "idle.mp4", "Idle.mp4"],
  explaining_b: ["idle.webm", "idle.mp4", "Idle.mp4"],
  pose_a: ["idle.webm", "idle.mp4", "Idle.mp4"],
  pose_b: ["idle.webm", "idle.mp4", "Idle.mp4"]
};

export function getTayyibBasePath() {
  const fromEnv = import.meta.env.VITE_TAYYIB_BASE_PATH as string | undefined;
  if (!fromEnv || fromEnv.trim().length === 0) return DEFAULT_TAYYIB_BASE_PATH;
  return fromEnv.endsWith("/") ? fromEnv : `${fromEnv}/`;
}

export function buildAssetUrl(filename: string) {
  return `${getTayyibBasePath()}${filename}`;
}
