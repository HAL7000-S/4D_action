import type { Vec3, Vec4 } from './vec4';

export interface Projection4D { focalLength: number; near: number; far: number }

/** Point projection only; primitive clipping belongs to a later phase. */
export function projectPoint(point: Vec4, settings: Projection4D): Vec3 | null {
  const { focalLength, near, far } = settings;
  if (![focalLength, near, far].every(Number.isFinite) || focalLength <= 0 || near <= 0 || far <= near) {
    throw new RangeError('Require finite focalLength > 0 and 0 < near < far');
  }
  if (!point.every(Number.isFinite) || point[3] <= near || point[3] > far) return null;
  const scale = focalLength / point[3];
  const result: Vec3 = [point[0] * scale, point[1] * scale, point[2] * scale];
  return result.every(Number.isFinite) ? result : null;
}
