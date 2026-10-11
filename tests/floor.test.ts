import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { floorGeometry, floorStage, type FloorTile4D } from '../src/geometry/floorTile';
import { clipFloorFace, projectFloor } from '../src/projection/projectFloor';
import { createFloorView, floorColors } from '../src/renderer/floorView';
import { defaultState, lookAtFloor, resetCamera, setDimension, setViewMode } from '../src/ui/state';
import { advanceCamera, playerCodes, codes, movement } from '../src/ui/inputMapping';
import { playerPose, playerViewCamera } from '../src/projection/playerCamera';
import { projectAvatar } from '../src/projection/playerAvatar';
import type { Vec4 } from '../src/math/vec4';

const tile: FloorTile4D = { type: 'safe', x: [-1,1], yFloor: -2.5, z: [1,3], w: [0,2] };

describe('floor geometry, projection and mesh data', () => {
  it('builds a constant-y cubic cell with eight vertices, six square faces and twelve edges', () => {
    const g = floorGeometry(tile, 4);
    expect(g.vertices).toHaveLength(8); expect(g.faces).toHaveLength(6);
    expect(new Set(g.vertices.map(p => p.join(','))).size).toBe(8);
    const edges = new Map<string, number>();
    for (const face of g.faces) {
      expect(face).toHaveLength(4);
      face.forEach((v,i) => {
        const key = [v,face[(i+1)%4]].sort((a,b) => a-b).join(',');
        edges.set(key, (edges.get(key) ?? 0) + 1);
      });
    }
    expect(edges.size).toBe(12); expect([...edges.values()].every(n => n === 2)).toBe(true);
    g.vertices.forEach(p => { expect(p[1]).toBe(-2.5); expect(tile.x).toContain(p[0]); expect(tile.z).toContain(p[2]); expect(tile.w).toContain(p[3]); });
    expect(floorGeometry(tile, 3).vertices).toHaveLength(4);
    expect(floorGeometry(tile, 3).faces).toHaveLength(1);
    expect(floorGeometry(tile, 2).vertices).toHaveLength(2);
    expect(floorGeometry(tile, 2).faces).toHaveLength(0);
  });
  it('projects six 4D faces to twelve triangles using the unchanged perspective formula', () => {
    const projected = projectFloor(tile, defaultState());
    expect(projected.triangles).toHaveLength(36);
    expect(projected.triangles[0]).toEqual([-1,-2.5,1]);
    expect(projected.segments).toHaveLength(0);
  });
  it('clips crossing convex faces to open near / closed far without losing the whole face', () => {
    const polygon: Vec4[] = [[-1,0,0,1], [1,0,0,1], [1,1,0,6], [-1,1,0,6]];
    const clipped = clipFloorFace(polygon, 2, 4);
    expect(clipped).toHaveLength(4);
    clipped.forEach(p => { expect(p[3]).toBeGreaterThan(2); expect(p[3]).toBeLessThanOrEqual(4); expect(p.every(Number.isFinite)).toBe(true); });
    expect(clipped.filter(p => p[3] === 4)).toHaveLength(2);
    const state = { ...defaultState(), position: [0,0,0,0] as Vec4, projection: { focalLength: 3, near: 2, far: 4 } };
    const triangles = projectFloor({ ...tile, w: [1,6] }, state).triangles;
    expect(triangles.length).toBeGreaterThan(0);
    expect(triangles.flat().every(Number.isFinite)).toBe(true);
    expect(projectFloor({ ...tile, w: [-2,1] }, state).triangles).toHaveLength(0);
    expect(projectFloor({ ...tile, w: [5,6] }, state).triangles).toHaveLength(0);
  });
  it.each([2,3,4] as const)('provides visible blue/red floor geometry in both %iD views', dimension => {
    for (const mode of ['fps','tps'] as const) {
      const state = lookAtFloor(setViewMode(setDimension(defaultState(), dimension), mode));
      const projected = floorStage(dimension).map(t => projectFloor(t, state));
      for (const type of ['safe','hazard']) {
        const geometry = projected.filter(t => t.type === type).flatMap(t => [...t.triangles, ...t.segments]);
        expect(geometry.length).toBeGreaterThan(0);
        expect(geometry.flat().every(Number.isFinite)).toBe(true);
        // At least part of each color reaches the TV interior with its default h=4.
        expect(geometry.some(p => p.every(v => Math.abs(v) < 4))).toBe(true);
      }
    }
  });
  it('reveals a different tile configuration when translating through w layers', () => {
    const stage = floorStage(4), state = defaultState();
    expect(new Set(stage.map(t => t.w[0])).size).toBeGreaterThan(1);
    expect(stage[0].type).not.toBe(stage[3].type);
    const initial = stage.map(t => projectFloor(t, state));
    const moved = stage.map(t => projectFloor(t, { ...state, position: [0,0,0,1] }));
    expect(initial[0].triangles.length).toBeGreaterThan(0);
    expect(moved[0].triangles).toHaveLength(0);
    expect(moved.slice(3).some(t => t.triangles.length > 0)).toBe(true);
  });
  it('uses dedicated opaque Mesh/Line buffers, TV clip planes and clears stale geometry on dimension changes', () => {
    const scene = new THREE.Scene(), planes = [new THREE.Plane(new THREE.Vector3(1,0,0),4)];
    const view = createFloorView(scene, planes);
    view.update(floorStage(4).map(t => projectFloor(t, defaultState())));
    const group = scene.getObjectByName('floorStage')!;
    const meshes = group.children.filter(o => o instanceof THREE.Mesh) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>[];
    expect(meshes).toHaveLength(2);
    expect(meshes.map(m => m.material.color.getHex())).toEqual([floorColors.safe, floorColors.hazard]);
    meshes.forEach(mesh => { expect(mesh.material.clippingPlanes).toBe(planes); expect(mesh.material.side).toBe(THREE.DoubleSide); expect(mesh.geometry.drawRange.count).toBeGreaterThan(0); });
    const state = lookAtFloor(setDimension(defaultState(), 2));
    view.update(floorStage(2).map(t => projectFloor(t, state)));
    meshes.forEach(mesh => expect(mesh.geometry.drawRange.count).toBe(0));
    const lines = group.children.filter(o => o instanceof THREE.LineSegments) as THREE.LineSegments[];
    expect(lines.every(l => l.geometry.drawRange.count > 0)).toBe(true);
    view.dispose(); expect(scene.getObjectByName('floorStage')).toBeUndefined();
  });
});

describe('ground input and independent TPS orbit', () => {
  it.each([2,3,4] as const)('orbits only the TPS view in %iD, then faces the actual movement direction', dimension => {
    const state = setViewMode(setDimension(defaultState(), dimension), 'tps');
    const looked = advanceCamera(state, new Set(), .1, [180,100], 'camera4d');
    expect(looked.angles).toEqual(state.angles); expect(looked.position).toEqual(state.position);
    expect(playerPose(looked)).toEqual(playerPose(state));
    expect(playerViewCamera(looked)).not.toEqual(playerViewCamera(state));
    expect(projectAvatar(looked)).not.toEqual(projectAvatar(state));
    const moved = advanceCamera(looked, new Set([playerCodes.right]), .1, [0,0], 'camera4d');
    expect(moved.tpsLookAngles).toEqual(looked.tpsLookAngles);
    const displacement = moved.position.map((v,i) => v - looked.position[i]);
    const length = Math.hypot(...displacement), forward = playerPose(moved).rotation[dimension-1];
    forward.forEach((v,i) => expect(v).toBeCloseTo(displacement[i] / length, 12));
    expect(moved.position[1]).toBe(looked.position[1]);
    expect(advanceCamera(moved, new Set(), .1, [20,30], 'camera4d').angles).toEqual(moved.angles);
  });
  it('uses E/D z, S/F x, A/Z w; reserves Space and ignores absent axes', () => {
    expect(playerCodes).toEqual({ forward: 'KeyE', back: 'KeyD', left: 'KeyS', right: 'KeyF', negativeW: 'KeyA', positiveW: 'KeyZ', jump: 'Space' });
    for (const dimension of [2,3,4] as const) {
      const state = setDimension(defaultState(), dimension);
      for (const [key, axis, sign] of [[playerCodes.left,0,-1], [playerCodes.right,0,1], [playerCodes.forward,2,1], [playerCodes.back,2,-1], [playerCodes.negativeW,3,-1], [playerCodes.positiveW,3,1]] as const) {
        const moved = advanceCamera(state, new Set([key]), .25, [0,0], 'camera4d');
        const expected = [...state.position]; if (axis < dimension) expected[axis] += sign * .5;
        expect(moved.position).toEqual(expected);
      }
      expect(advanceCamera(state, new Set([playerCodes.jump, ...codes.down]), .1, [0,0], 'camera4d')).toBe(state);
    }
    expect(movement(new Set([codes.forward, codes.up]))).toEqual([0,1,0,1]);
  });
  it('keeps y fixed despite view pitch and preserves FPS look and TPS reset separation', () => {
    const state = defaultState(); state.angles.YW = .8; state.angles.YZ = .4;
    const moved = advanceCamera(state, new Set([playerCodes.forward, playerCodes.positiveW]), .5, [20,40], 'camera4d');
    expect(moved.position[1]).toBe(state.position[1]);
    expect(moved.angles.XW).toBeCloseTo(.04); expect(moved.angles.YW).toBeCloseTo(.88);
    const tps = setViewMode(moved, 'tps');
    expect(tps.tpsLookAngles).toEqual(moved.angles);
    const preview = lookAtFloor(tps); expect(preview.angles).toEqual(tps.angles);
    expect(resetCamera(preview).tpsLookAngles).toEqual(defaultState().tpsLookAngles);
    expect(resetCamera(preview).viewMode).toBe('tps');
    expect(advanceCamera(tps, new Set([playerCodes.forward]), 1, [99,99], 'observer3d')).toBe(tps);
  });
});
