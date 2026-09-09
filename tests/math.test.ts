import { describe, expect, it } from 'vitest';
import { identity, transform, type Matrix4 } from '../src/math/matrix4';
import { composeRotation, planeRotation, planes } from '../src/math/rotation4d';
import { length } from '../src/math/vec4';
import { worldToCamera } from '../src/math/camera4d';
import { projectPoint } from '../src/math/projection4d';

// Independent cofactor expansion to check orientation as well as orthogonality.
function determinant(m: readonly (readonly number[])[]): number {
  if (m.length === 1) return m[0][0];
  return m[0].reduce((sum, value, j) => sum + (-1) ** j * value *
    determinant(m.slice(1).map(row => row.filter((_, k) => k !== j))), 0);
}
function expectSO4(m: Matrix4) {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    expect(m.reduce((sum, row) => sum + row[i] * row[j], 0)).toBeCloseTo(i === j ? 1 : 0, 12);
  }
  expect(determinant(m)).toBeCloseTo(1, 12);
  expect(length(transform(m, [2, -3, 5, 7]))).toBeCloseTo(length([2, -3, 5, 7]), 12);
}
describe('SO(4) rotations', () => {
  for (const plane of planes) it(plane, () => {
    expectSO4(planeRotation(plane, 0.713));
    expect(transform(planeRotation(plane, 0), [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });
  it('composes independent angles in the documented order', () => {
    const m = composeRotation({ XY: Math.PI / 2, XZ: 0, XW: Math.PI / 2, YZ: 0, YW: 0, ZW: 0 });
    const result = transform(m, [0, 1, 0, 0]);
    result.forEach((value, i) => expect(value).toBeCloseTo([0, 0, 0, -1][i], 12));
    expectSO4(composeRotation({ XY: .2, XZ: -.3, XW: .7, YZ: 1.1, YW: -.8, ZW: .9 }));
  });
  it('rejects non-finite angles', () => expect(() => planeRotation('XY', NaN)).toThrow(RangeError));
});
it('camera subtracts position before world-to-camera rotation', () => {
  expect(worldToCamera([1, 2, 3, 2], { position: [0, 0, 0, -2], rotation: identity() })).toEqual([1, 2, 3, 4]);
  const p = worldToCamera([2, 2, 3, 4], { position: [1, 2, 3, 4], rotation: planeRotation('XW', Math.PI / 2) });
  p.forEach((value, i) => expect(value).toBeCloseTo([0, 0, 0, 1][i], 12));
});
describe('perspective projection', () => {
  const settings = { focalLength: 2, near: .1, far: 20 };
  it('uses f / w', () => expect(projectPoint([1, 2, 3, 4], settings)).toEqual([.5, 1, 1.5]));
  it('rejects points at/before near and beyond far', () => {
    for (const w of [-1, 0, .099, .1, 21, NaN, Infinity]) expect(projectPoint([1, 2, 3, w], settings)).toBeNull();
    expect(projectPoint([1, 2, 3, .100001], settings)?.every(Number.isFinite)).toBe(true);
    expect(projectPoint([1, 2, 3, 20], settings)).not.toBeNull();
  });
  it('rejects overflow and non-finite coordinates', () => {
    expect(projectPoint([Number.MAX_VALUE, 0, 0, .2], settings)).toBeNull();
    expect(projectPoint([NaN, 0, 0, 1], settings)).toBeNull();
  });
  it('validates projection parameters', () => {
    for (const override of [{ near: 0 }, { near: -1 }, { far: .1 }, { far: Infinity }, { focalLength: 0 }, { focalLength: NaN }]) {
      expect(() => projectPoint([1, 2, 3, 4], { ...settings, ...override })).toThrow(RangeError);
    }
  });
});
