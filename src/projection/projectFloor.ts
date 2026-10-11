import { floorGeometry, type FloorTile4D, type FloorType } from '../geometry/floorTile';
import { worldToCamera } from '../math/camera4d';
import { projectPoint } from '../math/projection4d';
import type { Vec3, Vec4 } from '../math/vec4';
import type { CameraState } from '../ui/state';
import { imageCoordinates, playerViewCamera } from './playerCamera';
import { clipSegment4D } from './clip4d';

export interface ProjectedFloor {
  type: FloorType;
  triangles: Vec3[];
  segments: Vec3[];
}
/** Convex face clipped to the existing depth slab. Gaps join on near/far boundaries. */
export function clipFloorFace(vertices: readonly Vec4[], near: number, far: number): Vec4[] {
  const result: Vec4[] = [];
  const same = (a: Vec4, b: Vec4) => a.every((v, i) => v === b[i]);
  for (let i = 0; i < vertices.length; i++) {
    const segment = clipSegment4D(vertices[i], vertices[(i + 1) % vertices.length], near, far);
    if (!segment) continue;
    for (const p of segment) if (!result.length || !same(result[result.length - 1], p)) result.push(p);
  }
  if (result.length > 1 && same(result[0], result[result.length - 1])) result.pop();
  return result;
}
export function projectFloor(tile: FloorTile4D, state: CameraState): ProjectedFloor {
  const geometry = floorGeometry(tile, state.dimension), playerCamera = playerViewCamera(state);
  const vertices = geometry.vertices.map(p => imageCoordinates(worldToCamera(p, playerCamera), state.dimension));
  const settings = state.projection;
  const result: ProjectedFloor = { type: tile.type, triangles: [], segments: [] };
  if (state.dimension === 2) {
    const clipped = clipSegment4D(vertices[0], vertices[1], settings.near, settings.far);
    if (clipped) {
      const points = clipped.map(p => projectPoint(p, settings));
      if (points.every(p => p !== null)) result.segments.push(...points as Vec3[]);
    }
    return result;
  }
  for (const face of geometry.faces) {
    const polygon = clipFloorFace(face.map(i => vertices[i]), settings.near, settings.far);
    const points = polygon.map(p => projectPoint(p, settings));
    if (points.some(p => p === null)) continue;
    // Project first, triangulate the resulting convex 3D polygon second.
    for (let i = 1; i + 1 < points.length; i++) result.triangles.push(points[0]!, points[i]!, points[i + 1]!);
  }
  return result;
}
