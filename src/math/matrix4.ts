import type { Vec4 } from './vec4';

// Row-major matrix acting on column vectors; no homogeneous coordinates.
export type Matrix4 = readonly [Vec4, Vec4, Vec4, Vec4];

export function identity(): Matrix4 {
  return [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
}

export function transform(m: Matrix4, v: Vec4): Vec4 {
  return m.map(row => row.reduce((sum, value, i) => sum + value * v[i], 0)) as unknown as Vec4;
}

export function multiply(a: Matrix4, b: Matrix4): Matrix4 {
  return a.map(row => [0, 1, 2, 3].map(j =>
    row.reduce((sum, value, k) => sum + value * b[k][j], 0),
  )) as unknown as Matrix4;
}
