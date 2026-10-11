import { expect, it } from 'vitest';
import { cellHyperplanes, isCellVisible, filterBackCells } from '../src/visibility/backCell';
import { createTesseract } from '../src/geometry/tesseract';
import { createSimplex4D } from '../src/geometry/simplex4d';
import { createRoom4D } from '../src/geometry/room4d';
import { defaultState, projectScene, resetCamera } from '../src/ui/state';
import { projectGeometry } from '../src/projection/projectedGeometry';
import { identity, transform } from '../src/math/matrix4';
import { composeRotation } from '../src/math/rotation4d';
import type { Vec4 } from '../src/math/vec4';
const dot = (a: Vec4, b: Vec4) => a.reduce((s, v, i) => s + v * b[i], 0);
const sub = (a: Vec4, b: Vec4) => a.map((v, i) => v - b[i]) as unknown as Vec4;

for (const [name, p] of [['tesseract', createTesseract()], ['simplex', createSimplex4D()]] as const) {
  it(`${name}: unit outward normals define supporting planes`, () => {
    const planes = cellHyperplanes(p);
    planes.forEach((plane, i) => {
      expect(Math.hypot(...plane.normal)).toBeCloseTo(1, 12);
      for (const v of p.cells[i].vertices) expect(dot(plane.normal, p.vertices[v])).toBeCloseTo(plane.d, 12);
      for (const v of p.vertices) expect(dot(plane.normal, v) - plane.d).toBeLessThanOrEqual(1e-12);
      expect(plane.d).toBeGreaterThan(0);
      const front = plane.point.map((v, a) => v + plane.normal[a]) as unknown as Vec4;
      const back = plane.point.map((v, a) => v - plane.normal[a]) as unknown as Vec4;
      expect(isCellVisible(plane, front)).toBe(true); expect(isCellVisible(plane, back)).toBe(false);
      expect(isCellVisible(plane, plane.point)).toBe(false);
    });
    if (name === 'tesseract') for (const plane of planes) {
      expect(plane.normal.filter(v => Math.abs(v) > 1e-12)).toHaveLength(1);
      expect(plane.d).toBeCloseTo(1);
    }
    else planes.forEach((plane, i) => {
      const omitted = p.vertices.find((_, index) => !p.cells[i].vertices.includes(index))!;
      plane.normal.forEach((value, axis) => expect(value).toBeCloseTo(-omitted[axis], 12));
      expect(plane.d).toBeCloseTo(.25, 12);
    });
  });
}
it('preserves side tests under camera rotation and translation', () => {
  const p = createTesseract(2, [1,2,3,4]);
  const r = composeRotation({ XY: .2, XZ: -.7, XW: .8, YZ: -.3, YW: .6, ZW: 1 });
  for (const c of [[4,2,3,4], [-2,2,3,4]] as Vec4[]) for (const plane of cellHyperplanes(p)) {
    const normalCamera = transform(r, plane.normal), pointCamera = transform(r, sub(plane.point, c));
    const cameraSide = -dot(normalCamera, pointCamera);
    expect(cameraSide).toBeCloseTo(dot(plane.normal, sub(c, plane.point)), 12);
    expect(cameraSide > 1e-10).toBe(isCellVisible(plane, c));
  }
});
it('XRay is exactly unchanged; Natural keeps the front cube edges only', () => {
  const p = createTesseract();
  const camera = { position: [0,0,0,-3] as Vec4, rotation: identity() };
  const projection = { focalLength: 3, near: .1, far: 20 };
  const projected = projectGeometry(p, camera, projection);
  expect(filterBackCells(p, projected, camera.position, 'XRay')).toBe(projected);
  const natural = filterBackCells(p, projected, camera.position, 'Natural');
  expect(natural.vertices).toHaveLength(8); expect(natural.edges).toHaveLength(12);
  for (const e of natural.edges) for (const v of p.edges[e.sourceEdgeIndex]) expect(p.vertices[v][3]).toBe(-1);
  const opposite = filterBackCells(p, projected, [0,0,0,3], 'Natural');
  for (const e of opposite.edges) for (const v of p.edges[e.sourceEdgeIndex]) expect(p.vertices[v][3]).toBe(1);
  expect(filterBackCells(p, projected, [0,0,0,0], 'Natural').edges).toHaveLength(0);
});
it('scene toggles visibility without affecting room and preserves mode on reset', () => {
  const state = defaultState(); state.projection.near = .1;
  const objects = [{ id: 'tesseract' as const, polytope: createTesseract() }, { id: 'room' as const, polytope: createRoom4D() }];
  const xray = projectScene(objects, state);
  expect(state.visibilityMode).toBe('XRay'); expect(xray[0].geometry.edges).toHaveLength(32);
  const naturalState = { ...state, visibilityMode: 'Natural' as const };
  const natural = projectScene(objects, naturalState);
  expect(natural[0].geometry.edges).toHaveLength(12); expect(natural[1]).toEqual(xray[1]);
  expect(resetCamera(naturalState).visibilityMode).toBe('Natural');
});

it.each([2,3] as const)('culls intrinsic %iD boundaries and retains room/mode', async dimension => {
  const { dimensionWorld,playerShape } = await import('../src/geometry/playerGeometry');
  const { filterBackBoundaries } = await import('../src/visibility/backCell');
  const { projectPlayerWorld } = await import('../src/projection/playerCamera');
  const { setDimension } = await import('../src/ui/state');
  const shape = playerShape(dimension,2), state = setDimension(defaultState(),dimension);
  const projected = projectPlayerWorld(shape,state);
  const camera: Vec4 = dimension===2 ? [0,-3,0,0] : [0,0,-3,0];
  const result = filterBackBoundaries(shape,projected,camera,'Natural',dimension);
  expect(result.edges.length).toBeLessThanOrEqual(dimension===2 ? 1 : 4);
  expect(filterBackBoundaries(shape,projected,[0,0,0,0],'Natural',dimension).edges).toHaveLength(0);
  const objects = [{id:'room' as const,polytope:shape},{id:'tesseract' as const,polytope:shape},{id:'simplex' as const,polytope:shape}];
  const xray = projectScene(objects,state), culled = projectScene(objects,{...state,visibilityMode:'Natural'});
  expect(culled[0]).toEqual(xray[0]);
  expect(culled[1].geometry.edges.length).toBeLessThan(xray[1].geometry.edges.length);
  expect(culled[2].geometry.edges.length).toBeLessThan(xray[2].geometry.edges.length);
  expect(setDimension({...state,visibilityMode:'Natural'},4).visibilityMode).toBe('Natural');
  expect(dimensionWorld('simplex',dimension).vertices.length).toBe(dimension+1);
});
