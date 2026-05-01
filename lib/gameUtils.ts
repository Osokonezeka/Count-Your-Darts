export const IMPOSSIBLE_SCORES = [163, 166, 169, 172, 173, 175, 176, 178, 179];
export const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159];

export const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};
