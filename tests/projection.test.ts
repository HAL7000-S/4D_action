import { describe, expect, it } from 'vitest';
import { clipSegment4D } from '../src/projection/clip4d';
import { projectGeometry } from '../src/projection/projectedGeometry';
import { projectPoint } from '../src/math/projection4d';
import { identity } from '../src/math/matrix4';
import { planeRotation } from '../src/math/rotation4d';
import type { Vec4 } from '../src/math/vec4';
import { createTesseract } from '../src/geometry/tesseract';
import { createSimplex4D } from '../src/geometry/simplex4d';
import { createRoom4D } from '../src/geometry/room4d';

const settings = { near: 1, far: 4, focalLength: 2 };
const point = (w: number): Vec4 => [2 * w, -w, 3, w];
describe('camera-space segment clipping', () => {
  it.each([
    ['inside', 2, 3, 2, 3], ['near', 0, 3, 1, 3], ['far', 2, 6, 2, 4],
    ['both', -2, 6, 1, 4], ['reversed', 6, -2, 4, 1],
    ['constant w', 2, 2, 2, 2], ['at far', 4, 4, 4, 4],
    ['near endpoint', 1, 3, 1, 3], ['far contact', 4, 5, 4, 4],
  ])('%s', (_, a, b, start, end) => {
    const clipped = clipSegment4D(point(a), point(b), 1, 4)!;
    expect(clipped).not.toBeNull();
    expect(clipped[0][3]).toBeCloseTo(start, 12);
    expect(clipped[1][3]).toBeCloseTo(end, 12);
    for (const p of clipped) {
      expect(p[3]).toBeGreaterThan(1);
      expect(p[3]).toBeLessThanOrEqual(4);
      expect(p[0]).toBeCloseTo(2 * p[3], 12);
      expect(p[1]).toBeCloseTo(-p[3], 12);
      expect(p[2]).toBeCloseTo(3, 12);
      const q = projectPoint(p, settings);
      expect(q).not.toBeNull();
      expect(q!.every(Number.isFinite)).toBe(true);
    }
  });
  it.each([[-2, 0], [0, 1], [1, 1], [5, 6], [5, 5]])('rejects invisible %s to %s', (a, b) => {
    expect(clipSegment4D(point(a), point(b), 1, 4)).toBeNull();
  });
  it('keeps original endpoints when fully inside', () => {
    const a = point(2), b = point(3);
    expect(clipSegment4D(a, b, 1, 4)).toEqual([a, b]);
  });
  it('handles a tiny denominator crossing near', () => {
    const result = clipSegment4D([0, 0, 0, 1 - 1e-14], [1, 0, 0, 1 + 1e-14], 1, 4)!;
    expect(result[0][3]).toBeGreaterThan(1);
    expect(result[0][0]).toBeGreaterThan(.49);
    expect(result[0][0]).toBeLessThan(.53);
  });
  it('handles finite extreme w without subtraction overflow', () => {
    const result = clipSegment4D([0, 0, 0, -Number.MAX_VALUE], [2, 0, 0, Number.MAX_VALUE], 1, 4)!;
    expect(result).not.toBeNull();
    expect(result.flat().every(Number.isFinite)).toBe(true);
  });
  it('rejects non-finite input coordinates', () => {
    for (const value of [NaN, Infinity, -Infinity]) for (let axis = 0; axis < 4; axis++) {
      const bad: [number, number, number, number] = [0, 0, 0, 2];
      bad[axis] = value;
      expect(clipSegment4D(bad, point(3), 1, 4)).toBeNull();
      expect(clipSegment4D(point(3), bad, 1, 4)).toBeNull();
    }
  });
  it('rejects invalid clipping parameters', () => {
    for (const [near, far] of [[0, 4], [2, 2], [3, 2], [NaN, 4], [1, Infinity]]) {
      expect(() => clipSegment4D(point(2), point(3), near, far)).toThrow(RangeError);
    }
  });
});

describe('geometry projection pipeline', () => {
  it('transforms before clipping and keeps an edge with both source vertices invisible', () => {
    // XW rotation maps world x to camera w, so clipping world w would be wrong.
    const geometry = { vertices: [[-1, 2, 0, 0], [7, 2, 0, 0]] as Vec4[], edges: [[0, 1] as const], faces: [], cells: [] };
    const before = JSON.stringify(geometry);
    const result = projectGeometry(geometry, { position: [1, 0, 0, 0], rotation: planeRotation('XW', Math.PI / 2) }, settings);
    expect(result.vertices).toHaveLength(0);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].sourceEdgeIndex).toBe(0);
    expect(result.edges[0].start[1]).toBeCloseTo(4, 12);
    expect(result.edges[0].end[1]).toBeCloseTo(1, 12);
    expect(JSON.stringify(geometry)).toBe(before);
  });
  it('preserves source vertex metadata', () => {
    const result = projectGeometry(createSimplex4D(), { position: [0, 0, 0, -2], rotation: identity() }, settings);
    expect(result.vertices.map(v => v.sourceVertexIndex)).toEqual([0, 1, 2, 3, 4]);
  });
  it('projects all initial scene types to finite vertices and clipped edges', () => {
    const camera = { position: [0, 0, 0, -3] as Vec4, rotation: identity() };
    for (const geometry of [createTesseract(1.8, [-1.4, 0, 0, 1]), createSimplex4D(), createRoom4D(5)]) {
      const projected = projectGeometry(geometry, camera, { focalLength: 3, near: 2, far: 12 });
      expect(projected.vertices.length).toBeGreaterThan(0);
      expect(projected.edges.length).toBeGreaterThan(0);
      expect(projected.vertices.flatMap(v => [...v.position]).every(Number.isFinite)).toBe(true);
      expect(projected.edges.flatMap(e => [...e.start, ...e.end]).every(Number.isFinite)).toBe(true);
    }
  });
});
