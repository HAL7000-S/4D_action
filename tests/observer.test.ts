import { expect, it } from 'vitest';
import { defaultVolume, fov4D, clampObserver, observerRoomHalfSize } from '../src/ui/observerState';
import { defaultState, resetCamera } from '../src/ui/state';

it('computes the symmetric 4D field of view in radians', () => {
  expect(fov4D(3, 3)).toBeCloseTo(Math.PI / 2, 12);
  expect(fov4D(4, 3)).toBeGreaterThan(fov4D(3, 3));
  expect(() => fov4D(0, 3)).toThrow(RangeError);
  expect(() => fov4D(4, NaN)).toThrow(RangeError);
});
it('constrains only the observer to the room, with no projection-volume collision', () => {
  expect(clampObserver(100)).toBe(observerRoomHalfSize - .2);
  expect(clampObserver(-100)).toBe(-observerRoomHalfSize + .2);
  expect(clampObserver(0)).toBe(0);
  expect(clampObserver(2)).toBe(2);
});
it('keeps projection volume separate from 4D reset', () => {
  const volume = defaultVolume(); volume.h = 8;
  const camera = defaultState(); camera.position = [2, 0, 0, 0];
  expect(resetCamera(camera).position).toEqual([0, 0, 0, -3]);
  expect(volume.h).toBe(8);
});
