import { describe, expect, it } from 'vitest';
import { defaultState, resetCamera, toDegrees, toRadians, validState, projectScene } from '../src/ui/state';
import { createTesseract } from '../src/geometry/tesseract';

describe('4D camera state', () => {
  it('converts UI degrees and internal radians', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 12);
    for (const degrees of [-360, -90, 0, 45, 270]) expect(toDegrees(toRadians(degrees))).toBeCloseTo(degrees, 12);
  });
  it('resets all camera parameters while preserving visibility', () => {
    const state = defaultState();
    state.position = [1, 2, 3, 4];
    state.angles = { XY: 1, XZ: 2, XW: 3, YZ: 4, YW: 5, ZW: 6 };
    state.projection = { focalLength: 7, near: .1, far: 100 };
    state.visible.room = false;
    expect(resetCamera(state)).toEqual({ ...defaultState(), visible: state.visible });
    expect(state.position).toEqual([1, 2, 3, 4]);
    expect(defaultState().visible.room).toBe(true);
  });
  it('validates parameters before accepting UI updates', () => {
    expect(validState(defaultState())).toBe(true);
    for (const projection of [{ focalLength: 0, near: 1, far: 2 }, { focalLength: 2, near: 2, far: 1 }, { focalLength: 2, near: 0, far: 1 }]) {
      expect(validState({ ...defaultState(), projection })).toBe(false);
    }
    expect(validState({ ...defaultState(), position: [NaN, 0, 0, 0] })).toBe(false);
  });
  it('recalculates projection after position, rotation, and focal-length changes', () => {
    const objects = [{ id: 'tesseract' as const, polytope: createTesseract(1, [0, 0, 0, 1]) }];
    const state = defaultState();
    const original = projectScene(objects, state)[0].geometry;
    const moved = projectScene(objects, { ...state, position: [1, 0, 0, -3] })[0].geometry;
    expect(moved.vertices[0].position[0]).not.toBe(original.vertices[0].position[0]);
    const rotated = projectScene(objects, { ...state, angles: { ...state.angles, XW: toRadians(30) } })[0].geometry;
    expect(rotated).not.toEqual(original);
    const zoomed = projectScene(objects, { ...state, projection: { ...state.projection, focalLength: 6 } })[0].geometry;
    expect(zoomed.vertices[0].position[0]).toBeCloseTo(original.vertices[0].position[0] * 2, 12);
    const hidden = projectScene(objects, { ...state, visible: { ...state.visible, tesseract: false } });
    expect(hidden[0].geometry).toEqual({ vertices: [], edges: [] });
    expect(projectScene(objects, resetCamera(state))[0].geometry).toEqual(original);
  });
});
