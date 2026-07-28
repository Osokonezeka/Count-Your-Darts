export const getStandardSeeding = (bracketSize: number): number[] => {
  const rounds = Math.log2(bracketSize);
  let pls = [1, 2];
  for (let i = 1; i < rounds; i++) {
    const out: number[] = [];
    const length = pls.length * 2 + 1;
    pls.forEach((d) => {
      out.push(d);
      out.push(length - d);
    });
    pls = out;
  }
  return pls;
};

export function usesExplicitSeedOrder(bracketOrder?: string): boolean {
  return (
    bracketOrder === "top_to_bottom" ||
    bracketOrder === "bottom_to_top" ||
    bracketOrder === "custom"
  );
}

export function orderPlayersBySeed<T>(players: T[], bracketOrder?: string): T[] {
  if (bracketOrder === "bottom_to_top") return [...players].reverse();
  if (usesExplicitSeedOrder(bracketOrder)) return [...players];
  return [...players].sort(() => 0.5 - Math.random());
}
