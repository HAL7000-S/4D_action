export type Vec4 = readonly [number, number, number, number];
export type Vec3 = readonly [number, number, number];

export function subtract(a: Vec4, b: Vec4): Vec4 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]];
}

export function length(v: Vec4): number {
  return Math.hypot(...v);
}
