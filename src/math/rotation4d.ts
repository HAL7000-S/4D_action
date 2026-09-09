import { identity, multiply, type Matrix4 } from './matrix4';

export const planes = ['XY', 'XZ', 'XW', 'YZ', 'YW', 'ZW'] as const;
export type RotationPlane = typeof planes[number];
export type RotationAngles = Record<RotationPlane, number>;
const axes: Record<RotationPlane, readonly [number, number]> = {
  XY: [0, 1], XZ: [0, 2], XW: [0, 3], YZ: [1, 2], YW: [1, 3], ZW: [2, 3],
};

export function planeRotation(plane: RotationPlane, angle: number): Matrix4 {
  if (!Number.isFinite(angle)) throw new RangeError('Rotation angle must be finite');
  const [a, b] = axes[plane];
  const m = identity().map(row => [...row]);
  const c = Math.cos(angle), s = Math.sin(angle);
  m[a][a] = c; m[a][b] = -s;
  m[b][a] = s; m[b][b] = c;
  return m as unknown as Matrix4;
}

// Angles are radians. Apply XY, XZ, XW, YZ, YW, ZW in that order.
export function composeRotation(angles: RotationAngles): Matrix4 {
  return planes.reduce((result, plane) => multiply(planeRotation(plane, angles[plane]), result), identity());
}
