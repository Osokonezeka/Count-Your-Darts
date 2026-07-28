export const IMPOSSIBLE_SCORES = [163, 166, 169, 172, 173, 175, 176, 178, 179];
export const BOGEY_NUMBERS = [169, 168, 166, 165, 163, 162, 159];

export const DOUBLE_ATTEMPT_BOGEY_NUMBERS = [109, 108, 106, 105, 103, 102, 99];

export const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export interface ThrowLike {
  value: number;
  multiplier: number;
}

export const formatThrow = (t: ThrowLike): string => {
  if (t.value === 0) return "0";
  if (t.value === 25) return t.multiplier === 2 ? "D25" : "25";
  const prefix = t.multiplier === 3 ? "T" : t.multiplier === 2 ? "D" : "";
  return `${prefix}${t.value}`;
};
