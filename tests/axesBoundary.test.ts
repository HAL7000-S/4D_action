import { expect, it } from 'vitest';
import { basis4D, worldAxes, basisDirections, projectGizmo, projectWorldAxes } from '../src/projection/basisAxes';
import { identity, transform } from '../src/math/matrix4';
import { composeRotation } from '../src/math/rotation4d';
import { defaultState } from '../src/ui/state';
import { advanceCamera, playerCodes } from '../src/ui/inputMapping';
import { constrainCameraPosition, roomHalfExtent, roomMargin } from '../src/ui/roomBoundary';
import type { Vec4 } from '../src/math/vec4';

it('defines four unit world basis vectors and signed axes sharing the origin', () => {
  expect(basis4D).toEqual([[1,0,0,0], [0,1,0,0], [0,0,1,0], [0,0,0,1]]);
  worldAxes().forEach((axis, i) => {
    expect(Math.hypot(...basis4D[i])).toBe(1);
    expect(axis.center).toEqual([0,0,0,0]);
    axis.positive.forEach((v, j) => { expect(v).toBe(basis4D[i][j]); expect((axis.negative[j] + v)).toBe(0); });
  });
});
it('uses R ei for gizmo directions, with finite anchored projections', () => {
  expect(basisDirections(identity())).toEqual(basis4D);
  for (let i = 0; i < 24; i++) {
    const r = composeRotation({ XY: i * .4, XZ: i * -.3, XW: i * .7, YZ: i * .1, YW: i * -.8, ZW: i * .5 });
    expect(basisDirections(r)).toEqual(basis4D.map(e => transform(r, e)));
    for (const axis of projectGizmo(r)) {
      expect(axis).not.toBeNull();
      expect([...axis!.start, ...axis!.end, ...axis!.positive!].every(Number.isFinite)).toBe(true);
    }
  }
  const identityAxes = projectGizmo(identity());
  expect(identityAxes[0]!.end).toEqual([1, 0, 0]);
  expect(identityAxes[3]!.start).toEqual([-0, -0, -0]);
});
it('projects world axes with camera transform and clips arrowhead visibility', () => {
  const camera = { position: [0,0,0,-3] as Vec4, rotation: identity() };
  const settings = { focalLength: 3, near: 1, far: 3.5 };
  const axes = projectWorldAxes(camera, settings);
  expect(axes[0]!.start).toEqual([-1,0,0]);
  expect(axes[0]!.end).toEqual([1,0,0]);
  expect(axes[3]).not.toBeNull(); expect(axes[3]!.positive).toBeNull();
  const rotated = projectWorldAxes({ ...camera, rotation: composeRotation({ XY: 0, XZ: 0, XW: .5, YZ: 0, YW: 0, ZW: 0 }) }, settings);
  expect(rotated).not.toEqual(axes);
});
it('independently clamps both walls on every world component', () => {
  const limit = roomHalfExtent - roomMargin;
  for (const axis of [0,2,3]) for (const sign of [-1, 1]) {
    const state = defaultState();
    const position: [number,number,number,number] = [0,0,0,0]; position[axis] = sign * (limit - .01); state.position = position;
    const keys = [[playerCodes.left,playerCodes.right], [], [playerCodes.back,playerCodes.forward], [playerCodes.negativeW,playerCodes.positiveW]];
    const next = advanceCamera(state, new Set([keys[axis][sign === -1 ? 0 : 1]]), 1, [0,0], 'camera4d');
    expect(next.position[axis]).toBe(sign * limit);
  }
  expect(constrainCameraPosition([10,-10,8,-8])).toEqual([limit,-limit,limit,-limit]);
});
it('slides along walls instead of rejecting the complete diagonal movement', () => {
  const state = defaultState(), limit = roomHalfExtent - roomMargin;
  state.position = [limit,0,0,0];
  const next = advanceCamera(state, new Set([playerCodes.right,playerCodes.forward]), .5, [0,0], 'camera4d');
  expect(next.position[0]).toBe(limit); expect(next.position[2]).toBeGreaterThan(0);
});
it('clamps rotated local movement in world coordinates', () => {
  const state = defaultState(), limit = roomHalfExtent - roomMargin;
  state.position = [limit - .01,0,0,0]; state.angles.XW = Math.PI / 4;
  const next = advanceCamera(state, new Set([playerCodes.positiveW]), 1, [0,0], 'camera4d');
  expect(next.position[0]).toBe(limit); expect(next.position[3]).toBeGreaterThan(0);
  next.position.forEach(v => expect(Math.abs(v)).toBeLessThanOrEqual(limit));
});
