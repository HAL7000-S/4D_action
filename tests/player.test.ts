import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { defaultState as initialState, resetCamera, setDimension, setViewMode, projectScene } from '../src/ui/state';
import { advanceCamera, codes, playerCodes, createInputModel } from '../src/ui/inputMapping';
import { activeAngles, playerPose, playerViewCamera, projectPlayerWorld } from '../src/projection/playerCamera';
import { dimensionWorld, playerBoundaries, playerShape } from '../src/geometry/playerGeometry';
import { projectAvatar } from '../src/projection/playerAvatar';
import { resetObserverCamera } from '../src/renderer/observerCamera';
import { worldToCamera } from '../src/math/camera4d';
import { projectGeometry } from '../src/projection/projectedGeometry';
import { composeRotation } from '../src/math/rotation4d';

describe('Player dimension and view state', () => {
  it('preserves and restores inactive coordinates and rotation through all dimensions', () => {
    const original = { ...defaultState(), position: [1,2,3,4] as const,
      angles: { XY: .1, XZ: .2, XW: .3, YZ: .4, YW: .5, ZW: .6 } };
    let state = original;
    for (const dimension of [3,2,3,4] as const) {
      state = setDimension(state, dimension) as typeof original;
      expect(state.position).toEqual(original.position);
      expect(state.angles).toEqual(original.angles);
    }
    expect(activeAngles(state)).toEqual(original.angles);
    expect(activeAngles(setDimension(state, 2))).toEqual({ XY: .1, XZ: 0, XW: 0, YZ: 0, YW: 0, ZW: 0 });
  });
  it('keeps all six combinations independent of the input owner', () => {
    const input = createInputModel();
    let state = defaultState();
    for (const dimension of [2,3,4] as const) for (const viewMode of ['fps','tps'] as const) {
      state = setDimension(setViewMode(state, viewMode), dimension);
      expect(state.dimension).toBe(dimension); expect(state.viewMode).toBe(viewMode);
      expect(input.mode).toBe('observer3d');
      expect(setViewMode(state, 'fps').dimension).toBe(dimension);
      expect(setDimension(state, 2).viewMode).toBe(viewMode);
    }
  });
  it('does not move or rotate inactive axes, including under saved 4D rotation', () => {
    for (const dimension of [2,3] as const) {
      const state = { ...setDimension(defaultState(), dimension), position: [0,0,3,4] as const,
        angles: { XY: .3, XZ: .5, XW: 1, YZ: .4, YW: 2, ZW: 3 } };
      const moved = advanceCamera(state, new Set([playerCodes.forward, playerCodes.right, playerCodes.jump, playerCodes.positiveW]), .1, [20,30], 'camera4d');
      expect(moved.position.slice(dimension)).toEqual(state.position.slice(dimension));
      expect(moved.angles.XW).toBe(1); expect(moved.angles.YW).toBe(2); expect(moved.angles.ZW).toBe(3);
      if (dimension === 2) { expect(moved.angles.XZ).toBe(.5); expect(moved.angles.YZ).toBe(.4); }
      expect(advanceCamera(state, new Set([codes.forward]), .1, [20,30], 'observer3d')).toBe(state);
    }
  });
  it('resets Player and Observer independently, preserving dimension/view/visibility', () => {
    const observer = new PerspectiveCamera(); observer.position.set(1,2,3);
    const player = { ...setViewMode(setDimension(defaultState(), 2), 'tps'), position: [1,2,3,4] as const };
    const reset = resetCamera(player);
    expect(reset.dimension).toBe(2); expect(reset.viewMode).toBe('tps');
    expect(observer.position.toArray()).toEqual([1,2,3]);
    resetObserverCamera(observer);
    expect(observer.position.toArray()).toEqual([8,5,11]);
    expect(player.position).toEqual([1,2,3,4]); expect(reset.position).toEqual(defaultState().position);
  });
  it('maps dimension and view shortcuts once per press, suppressing editing/repeat', () => {
    const input = createInputModel(), actions: string[] = [];
    input.subscribeAction(action => actions.push(action));
    input.keyDown(codes.dimensionDown, false, true);
    input.keyDown(codes.dimensionDown); input.keyDown(codes.dimensionDown, true); input.keyDown(codes.dimensionDown);
    input.keyUp(codes.dimensionDown); input.keyDown(codes.dimensionUp);
    input.keyDown(codes.toggleView);
    expect(actions).toEqual(['dimensionDown', 'dimensionUp', 'toggleView']);
    expect(input.mode).toBe('observer3d');
  });
});

describe('Player geometry and camera pipeline', () => {
  it.each([2,3,4] as const)('builds correct %iD shape and a unique positive-forward boundary', dimension => {
    const shape = playerShape(dimension), boundaries = playerBoundaries(dimension);
    expect(shape.vertices).toHaveLength(2 ** dimension);
    expect(shape.edges).toHaveLength(dimension * 2 ** (dimension - 1));
    expect(boundaries).toHaveLength(2 * dimension);
    const front = boundaries.filter(b => b.front); expect(front).toHaveLength(1);
    expect(front[0].vertices).toHaveLength(2 ** (dimension - 1));
    expect(front[0].edges).toHaveLength((dimension - 1) * 2 ** (dimension - 2));
    front[0].vertices.forEach(i => expect(shape.vertices[i][dimension - 1]).toBe(.4));
    shape.cells.forEach(cell => cell.faces.forEach(i => expect(shape.faces[i]).toBeDefined()));
  });
  it.each([2,3,4] as const)('projects a separate %iD avatar only in TPS, with finite red/blue edges', dimension => {
    const state = setDimension(defaultState(), dimension);
    expect(projectAvatar(state).every(g => g.edges.length === 0)).toBe(true);
    const tps = setViewMode(state, 'tps'), [blue, red] = projectAvatar(tps);
    expect(blue.edges.length).toBeGreaterThan(0); expect(red.edges.length).toBeGreaterThan(0);
    expect([...blue.edges, ...red.edges].every(e => [...e.start, ...e.end].every(Number.isFinite))).toBe(true);
    expect(blue.edges.length + red.edges.length).toBe(playerShape(dimension).edges.length);
    const center = worldToCamera(state.position, playerViewCamera(tps));
    expect(center[dimension - 1]).toBeCloseTo(state.projection.near + 3);
    expect(playerPose(tps)).toEqual(playerPose(state));
  });
  it('trails along rotated 4D forward in world space, not the Observer camera', () => {
    const state = setViewMode(defaultState(), 'tps'); state.tpsLookAngles.XW = .6; state.tpsLookAngles.YZ = .4;
    const local = worldToCamera(state.position, playerViewCamera(state));
    expect(local[0]).toBeCloseTo(0); expect(local[1]).toBeCloseTo(0); expect(local[2]).toBeCloseTo(0);
    expect(local[3]).toBeCloseTo(5);
  });
  it('preserves the exact existing 4D FPS projection path', () => {
    const state = defaultState(), shape = playerShape(4, 2);
    expect(projectPlayerWorld(shape, state)).toEqual(projectGeometry(shape, { position: state.position, rotation: composeRotation(state.angles) }, state.projection));
  });
  it.each([2,3] as const)('uses an intrinsic %iD world with image dimension one lower', dimension => {
    const state = setDimension(defaultState(), dimension);
    const shape = dimensionWorld('room', dimension);
    const projected = projectScene([{ id: 'room', polytope: playerShape(4) }], state)[0].geometry;
    expect(shape.vertices).toHaveLength(2 ** dimension);
    expect(projected.edges.length).toBeGreaterThan(0);
    for (const id of ['tesseract', 'simplex'] as const) {
      expect(projectPlayerWorld(dimensionWorld(id, dimension), state).vertices.length).toBeGreaterThan(0);
    }
    projected.edges.forEach(e => { expect(e.start[2]).toBe(0); if (dimension === 2) expect(e.start[1]).toBe(0); });
    expect(projectPlayerWorld(shape, { ...state, position: [0,0,0,4] })).toEqual(projectPlayerWorld(shape, { ...state, position: [0,0,0,-4] }));
  });
  it.each([2,3] as const)('applies perspective and open-near/closed-far clipping in %iD', dimension => {
    const state = { ...setDimension(defaultState(), dimension), position: [0,0,0,0] as const };
    const point = (depth: number) => dimension === 2 ? [1,depth,0,0] as const : [1,2,depth,0] as const;
    const geometry = { vertices: [point(2), point(3), point(12), point(13)], edges: [[0,3] as const], faces: [], cells: [] };
    const projected = projectPlayerWorld(geometry, state);
    expect(projected.vertices.map(v => v.sourceVertexIndex)).toEqual([1,2]);
    expect(projected.vertices[0].position).toEqual(dimension === 2 ? [1,0,0] : [1,2,0]);
    expect(projected.edges).toHaveLength(1);
    expect([...projected.edges[0].start, ...projected.edges[0].end].every(Number.isFinite)).toBe(true);
    expect(projected.edges[0].end[0]).toBeCloseTo(.25);
  });
});

// These existing scenarios explicitly exercise flight/X-Ray, independent of startup defaults.
function defaultState(): ReturnType<typeof initialState> { return { ...initialState(), motionMode: 'flight' as const, visibilityMode: 'XRay' as const }; }
