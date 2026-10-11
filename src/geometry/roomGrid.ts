import type { Polytope4D } from './polytope4d';
import type { Vec4 } from '../math/vec4';
import type { PlayerDimension } from '../projection/playerCamera';
import { roomHalfExtent } from '../ui/roomBoundary';

export const roomColors = [0x82B69C, 0x5A9BD5, 0xE5BD6B, 0xD59B84, 0xB49ADA] as const;
const cache = new Map<PlayerDimension, Polytope4D[]>();
/** Sparse lines on intrinsic room boundaries, never on Observer Room or TV. */
export function roomGrid(dimension: PlayerDimension): Polytope4D[] {
  const cached = cache.get(dimension); if (cached) return cached;
  const groups = roomColors.map(() => ({ vertices: [] as Vec4[], edges: [] as [number, number][], faces: [], cells: [] }));
  const h = roomHalfExtent;
  for (let axis = 0; axis < dimension; axis++) for (const sign of [-1, 1]) {
    const group = groups[axis === 0 ? 0 : axis === 1 ? (sign < 0 ? 1 : 2) : axis + 1];
    const tangents = Array.from({ length: dimension }, (_, i) => i).filter(i => i !== axis);
    for (const along of tangents) {
      const fixed = tangents.filter(i => i !== along);
      for (let index = 0; index < 3 ** fixed.length; index++) {
        const start = [0,0,0,0], end = [0,0,0,0];
        start[axis] = end[axis] = sign * h;
        start[along] = -h; end[along] = h;
        fixed.forEach((a, i) => { start[a] = end[a] = (Math.floor(index / 3 ** i) % 3 - 1) * h; });
        const offset = group.vertices.length;
        group.vertices.push(start as unknown as Vec4, end as unknown as Vec4);
        group.edges.push([offset, offset + 1]);
      }
    }
  }
  cache.set(dimension, groups); return groups;
}
