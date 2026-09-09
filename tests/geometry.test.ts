import { describe, expect, it } from 'vitest';
import type { Polytope4D } from '../src/geometry/polytope4d';
import { createTesseract } from '../src/geometry/tesseract';
import { createSimplex4D } from '../src/geometry/simplex4d';
import { createRoom4D } from '../src/geometry/room4d';

function checkIndices(indices: readonly number[], limit: number) {
  expect(new Set(indices).size).toBe(indices.length);
  for (const i of indices) {
    expect(Number.isInteger(i)).toBe(true);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(limit);
  }
}
const key = (indices: readonly number[]) => [...indices].sort((a, b) => a - b).join(',');
function checkTopology(p: Polytope4D, counts: number[], faceSize: number, cellSize: number, cellFaces: number) {
  expect([p.vertices.length, p.edges.length, p.faces.length, p.cells.length]).toEqual(counts);
  for (const group of [p.edges, p.faces, p.cells.map(c => c.vertices)]) {
    expect(new Set(group.map(key)).size).toBe(group.length);
    for (const indices of group) checkIndices(indices, p.vertices.length);
  }
  const edgeKeys = new Set(p.edges.map(key));
  for (const edge of p.edges) expect(edge).toHaveLength(2);
  for (const face of p.faces) {
    expect(face).toHaveLength(faceSize);
    // Consecutive vertices must follow real edges, including the closing edge.
    face.forEach((v, i) => expect(edgeKeys.has(key([v, face[(i + 1) % face.length]]))).toBe(true));
  }
  for (const cell of p.cells) {
    expect(cell.vertices).toHaveLength(cellSize);
    expect(cell.faces).toHaveLength(cellFaces);
    checkIndices(cell.faces, p.faces.length);
    const boundaryVertices = new Set(cell.faces.flatMap(i => [...p.faces[i]]));
    expect([...boundaryVertices].sort()).toEqual([...cell.vertices].sort());
    const boundaryEdges = new Map<string, number>();
    for (const f of cell.faces) {
      const face = p.faces[f];
      face.forEach((v, i) => {
        const e = key([v, face[(i + 1) % face.length]]);
        boundaryEdges.set(e, (boundaryEdges.get(e) ?? 0) + 1);
      });
    }
    expect(boundaryEdges.size).toBe(cellSize === 8 ? 12 : 6);
    for (const incidence of boundaryEdges.values()) expect(incidence).toBe(2);
  }
  // A closed 4-polytope has exactly two boundary cells incident to each face.
  p.faces.forEach((_, i) => expect(p.cells.filter(c => c.faces.includes(i))).toHaveLength(2));
}

describe('tesseract', () => {
  it('has complete cubic boundary topology and valid indices', () => {
    checkTopology(createTesseract(), [16, 32, 24, 8], 4, 8, 6);
  });
  it('places vertices at center ± size/2 and connects along one axis', () => {
    const center = [1, -2, 3, -4] as const;
    const p = createTesseract(6, center);
    expect(new Set(p.vertices.map(v => v.join(','))).size).toBe(16);
    for (const v of p.vertices) v.forEach((value, axis) => expect(Math.abs(value - center[axis])).toBe(3));
    for (const [a, b] of p.edges) {
      const differences = p.vertices[a].map((value, axis) => Math.abs(value - p.vertices[b][axis]));
      expect(differences.filter(d => d !== 0)).toEqual([6]);
    }
    for (const cell of p.cells) {
      const distinct = [0, 1, 2, 3].map(axis => new Set(cell.vertices.map(i => p.vertices[i][axis])).size);
      expect(distinct.sort()).toEqual([1, 2, 2, 2]);
    }
  });
  it('rejects invalid size and center', () => {
    for (const size of [0, -1, NaN, Infinity]) expect(() => createTesseract(size)).toThrow(RangeError);
    expect(() => createTesseract(2, [NaN, 0, 0, 0])).toThrow(RangeError);
  });
});

describe('4-simplex', () => {
  it('has complete tetrahedral boundary topology and valid indices', () => {
    checkTopology(createSimplex4D(), [5, 10, 10, 5], 3, 4, 4);
  });
  it('has centroid zero, unit radius, and equal pairwise distances', () => {
    const p = createSimplex4D();
    for (let axis = 0; axis < 4; axis++) expect(p.vertices.reduce((sum, v) => sum + v[axis], 0)).toBeCloseTo(0, 12);
    for (const v of p.vertices) expect(Math.hypot(...v)).toBeCloseTo(1, 12);
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      expect(Math.hypot(...p.vertices[i].map((v, a) => v - p.vertices[j][a]))).toBeCloseTo(Math.sqrt(2.5), 12);
    }
  });
});

describe('4D room', () => {
  it('has eight cubic boundary cells with valid topology', () => {
    checkTopology(createRoom4D(), [16, 32, 24, 8], 4, 8, 6);
  });
  it('labels each ±axis once and fixes every cell vertex to ±L', () => {
    const L = 3.5;
    const room = createRoom4D(L);
    expect(room.cells.map(c => `${c.boundary.axis}:${c.boundary.sign}`).sort()).toEqual(
      ['x:-1', 'x:1', 'y:-1', 'y:1', 'z:-1', 'z:1', 'w:-1', 'w:1'].sort());
    for (const cell of room.cells) {
      const axis = ['x', 'y', 'z', 'w'].indexOf(cell.boundary.axis);
      for (const i of cell.vertices) expect(room.vertices[i][axis]).toBe(cell.boundary.sign * L);
    }
    for (const v of room.vertices) for (const coordinate of v) expect(Math.abs(coordinate)).toBe(L);
  });
  it('rejects invalid room extent', () => {
    for (const L of [0, -1, NaN, Infinity]) expect(() => createRoom4D(L)).toThrow(RangeError);
  });
});
