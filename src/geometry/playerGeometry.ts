import type { Polytope4D, Edge4D } from './polytope4d';
import { createTesseract } from './tesseract';
import type { Vec4 } from '../math/vec4';
import type { PlayerDimension } from '../projection/playerCamera';
import type { ObjectId } from '../ui/state';
import { roomHalfExtent } from '../ui/roomBoundary';

/** Explicit square/cube/tesseract boundaries. Inactive coordinates are embedding zeros. */
export function playerShape(dimension: PlayerDimension, size = .8): Polytope4D {
  const full = createTesseract(size);
  const count = 1 << dimension;
  const faceIndices = full.faces.flatMap((f, i) => f.every(v => v < count) ? [i] : []);
  return { vertices: full.vertices.slice(0, count).map(p => p.map((v, i) => i < dimension ? v : 0) as unknown as Vec4),
    edges: full.edges.filter(e => e.every(i => i < count)),
    faces: faceIndices.map(i => full.faces[i]),
    cells: full.cells.filter(c => c.vertices.every(i => i < count)).map(c => ({ ...c, faces: c.faces.map(i => faceIndices.indexOf(i)) })) };
}
export function playerBoundaries(dimension: PlayerDimension) {
  const shape = playerShape(dimension);
  return Array.from({ length: 2 * dimension }, (_, index) => {
    const axis = Math.floor(index / 2), positive = index % 2 === 0;
    const vertices = shape.vertices.flatMap((p, i) => (p[axis] > 0) === positive ? [i] : []);
    return { vertices, front: axis === dimension - 1 && positive,
      edges: shape.edges.filter(e => e.every(i => vertices.includes(i))) };
  });
}

const worldCache = new Map<string, Polytope4D>();
export function dimensionWorld(id: ObjectId, dimension: 2 | 3): Polytope4D {
  const key = `${id}:${dimension}`;
  const cached = worldCache.get(key); if (cached) return cached;
  let shape: Polytope4D;
  if (id === 'simplex') {
    const vertices: Vec4[] = Array.from({ length: dimension + 1 }, (_, i) =>
      [i === 1 ? 2.2 : 1, (i === 2 ? 1.2 : 0) + (dimension === 2 ? 2.5 : 0), dimension === 3 ? 2.5 + (i === 3 ? 1.2 : 0) : 0, 0]);
    const edges: Edge4D[] = [];
    for (let i = 0; i < vertices.length; i++) for (let j = i + 1; j < vertices.length; j++) edges.push([i,j]);
    shape = { vertices, edges, faces: [], cells: [] };
  } else {
    shape = playerShape(dimension, id === 'room' ? roomHalfExtent * 2 : 1.8);
    if (id !== 'room') shape = { ...shape, vertices: shape.vertices.map(p => [p[0] - 1.4, p[1] + (dimension === 2 ? 2.5 : 0), p[2] + (dimension === 3 ? 2.5 : 0), 0]) };
  }
  worldCache.set(key, shape); return shape;
}
