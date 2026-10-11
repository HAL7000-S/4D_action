import type { Vec3, Vec4 } from '../math/vec4';
import { transform, type Matrix4 } from '../math/matrix4';
import { worldToCamera, type Camera4D } from '../math/camera4d';
import { projectPoint, type Projection4D } from '../math/projection4d';
import { clipSegment4D } from './clip4d';

export const axisLength = 1;
export const basis4D: readonly Vec4[] = [[1,0,0,0], [0,1,0,0], [0,0,1,0], [0,0,0,1]];
export const axisColors = [0xef4444, 0x22c55e, 0x3b82f6, 0xa855f7] as const;
export function worldAxes(length = axisLength) {
  return basis4D.map(b => ({ negative: b.map(v => -length * v) as unknown as Vec4,
    center: [0,0,0,0] as Vec4, positive: b.map(v => length * v) as unknown as Vec4 }));
}
export interface ProjectedAxis { start: Vec3; end: Vec3; positive: Vec3 | null }
function projectAxis(a: Vec4, b: Vec4, settings: Projection4D): ProjectedAxis | null {
  const clipped = clipSegment4D(a, b, settings.near, settings.far);
  if (!clipped) return null;
  const start = projectPoint(clipped[0], settings), end = projectPoint(clipped[1], settings);
  return start && end ? { start, end, positive: projectPoint(b, settings) } : null;
}
export function projectWorldAxes(camera: Camera4D, settings: Projection4D) {
  return worldAxes().map(axis => projectAxis(worldToCamera(axis.negative, camera), worldToCamera(axis.positive, camera), settings));
}
export const gizmoDepth = 5, gizmoLength = 1;
export function basisDirections(rotation: Matrix4) { return basis4D.map(b => transform(rotation, b)); }
export function projectGizmo(rotation: Matrix4) {
  const settings = { focalLength: 5, near: .1, far: 10 };
  return basisDirections(rotation).map(d => {
    const endpoint = (sign: number): Vec4 => [sign * d[0], sign * d[1], sign * d[2], gizmoDepth + sign * d[3]];
    return projectAxis(endpoint(-gizmoLength), endpoint(gizmoLength), settings);
  });
}
