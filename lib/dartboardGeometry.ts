export const DARTBOARD_SECTORS = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

export const DARTBOARD_RADII = {
  doubleOut: 0.82,
  doubleIn: 0.74,
  tripleOut: 0.48,
  tripleIn: 0.4,
  outerBull: 0.1,
  innerBull: 0.05,
  label: 0.91,
} as const;

const DEG_TO_RAD = Math.PI / 180;
const HALF_SECTOR_DEG = 9;
const SECTOR_DEG = 18;

export function createWedgePath(
  cx: number,
  cy: number,
  rInnerPct: number,
  rOuterPct: number,
): string {
  const rInner = rInnerPct * cx;
  const rOuter = rOuterPct * cx;
  const a1 = -HALF_SECTOR_DEG * DEG_TO_RAD;
  const a2 = HALF_SECTOR_DEG * DEG_TO_RAD;

  const x1In = cx + rInner * Math.sin(a1);
  const y1In = cy - rInner * Math.cos(a1);
  const x2In = cx + rInner * Math.sin(a2);
  const y2In = cy - rInner * Math.cos(a2);

  const x1Out = cx + rOuter * Math.sin(a1);
  const y1Out = cy - rOuter * Math.cos(a1);
  const x2Out = cx + rOuter * Math.sin(a2);
  const y2Out = cy - rOuter * Math.cos(a2);

  return `M ${x1In} ${y1In} L ${x1Out} ${y1Out} A ${rOuter} ${rOuter} 0 0 1 ${x2Out} ${y2Out} L ${x2In} ${y2In} A ${rInner} ${rInner} 0 0 0 ${x1In} ${y1In} Z`;
}

export function sectorLabelPosition(
  cx: number,
  cy: number,
  index: number,
  radiusPct: number = DARTBOARD_RADII.label,
): { x: number; y: number } {
  const angle = (index * SECTOR_DEG - 90) * DEG_TO_RAD;
  const radius = radiusPct * cx;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function sectorDividerEnd(
  cx: number,
  cy: number,
  index: number,
  rDoubleOut: number,
): { x: number; y: number } {
  const angle = (index * SECTOR_DEG - HALF_SECTOR_DEG) * DEG_TO_RAD;
  return {
    x: cx + rDoubleOut * Math.sin(angle),
    y: cy - rDoubleOut * Math.cos(angle),
  };
}
