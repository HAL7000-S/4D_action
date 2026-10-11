import type { Vec4 } from '../math/vec4';
import type { PlayerDimension } from '../projection/playerCamera';

export type FloorType = 'safe' | 'hazard';
export interface FloorTile4D {
  readonly type: FloorType;
  readonly x: readonly [number, number];
  readonly yFloor: number;
  readonly z: readonly [number, number];
  readonly w: readonly [number, number];
}
export interface FloorGeometry {
  vertices: Vec4[];
  faces: readonly (readonly number[])[];
}
/** A segment / square / cubic cell at constant world y, never a tesseract. */
export function floorGeometry(tile: FloorTile4D, dimension: PlayerDimension): FloorGeometry {
  if (!Number.isFinite(tile.yFloor) || [tile.x, tile.z, tile.w].some(([a,b]) => !Number.isFinite(a) || !Number.isFinite(b) || a >= b)) {
    throw new RangeError('Floor bounds must be finite increasing intervals');
  }
  const vertices: Vec4[] = Array.from({ length: 2 ** (dimension - 1) }, (_, i) =>
    [tile.x[i & 1], tile.yFloor, dimension >= 3 ? tile.z[(i >> 1) & 1] : 0, dimension === 4 ? tile.w[(i >> 2) & 1] : 0]);
  const faces = dimension === 4 ? [[0,2,6,4], [1,5,7,3], [0,4,5,1], [2,3,7,6], [0,1,3,2], [4,6,7,5]]
    : dimension === 3 ? [[0,1,3,2]] : [];
  return { vertices, faces };
}

const tile = (type: FloorType, x: readonly [number, number], z: readonly [number, number], w: readonly [number, number]): FloorTile4D =>
  ({ type, x, yFloor: -2.5, z, w });
const stage = [
  tile('safe', [-2.8,-.4], [2,3.8], [-.5,.7]),
  tile('hazard', [.1,2.5], [2,3.8], [-.5,.7]),
  tile('safe', [.1,2.5], [-.4,1.4], [-.5,.7]),
  tile('hazard', [-2.8,-.4], [-.4,1.4], [2,3.2]),
  tile('safe', [.1,2.5], [2,3.8], [2,3.2]),
  tile('safe', [-2.8,-.4], [2,3.8], [2,3.2]),
];
export function floorStage(dimension: PlayerDimension): readonly FloorTile4D[] {
  // Lower-dimensional stages use two distinct tiles, rather than overlapping collapsed layers.
  return dimension === 4 ? stage : stage.slice(0, 2);
}
