import type { Vec4 } from '../math/vec4';
export const roomHalfExtent = 5;
export const roomMargin = .1;
export function constrainCameraPosition(position: Vec4, dimension: 2 | 3 | 4 = 4): Vec4 {
  const limit = roomHalfExtent - roomMargin;
  return position.map((v, i) => i < dimension ? Math.max(-limit, Math.min(limit, v)) : v) as unknown as Vec4;
}
