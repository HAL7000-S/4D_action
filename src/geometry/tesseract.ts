import type { Vec4 } from '../math/vec4';
import type { Cell4D, Edge4D, Face4D, Polytope4D } from './polytope4d';

export function createTesseract(size = 2, center: Vec4 = [0, 0, 0, 0]): Polytope4D {
  if (!Number.isFinite(size) || size <= 0 || !center.every(Number.isFinite)) {
    throw new RangeError('Require finite size > 0 and finite center');
  }
  const half = size / 2;
  // Each bit of the vertex index selects the sign of x, y, z, w respectively.
  const coordinate = (v: number, axis: number) => center[axis] + ((v & (1 << axis)) ? half : -half);
  const vertices: Vec4[] = Array.from({ length: 16 }, (_, v) =>
    [coordinate(v, 0), coordinate(v, 1), coordinate(v, 2), coordinate(v, 3)]);
  const edges: Edge4D[] = [];
  const faces: Face4D[] = [];
  const cells: Cell4D[] = [];
  for (let v = 0; v < 16; v++) {
    for (let a = 0; a < 4; a++) {
      if ((v & (1 << a)) === 0) edges.push([v, v | (1 << a)]);
      for (let b = a + 1; b < 4; b++) {
        if ((v & ((1 << a) | (1 << b))) === 0) {
          faces.push([v, v | (1 << a), v | (1 << a) | (1 << b), v | (1 << b)]);
        }
      }
    }
  }
  // Fix one coordinate; the other three span a cubic boundary cell.
  for (let axis = 0; axis < 4; axis++) for (const bit of [1, 0]) {
    const indices = vertices.map((_, i) => i).filter(i => ((i >> axis) & 1) === bit);
    cells.push({ vertices: indices, faces: faces.flatMap((face, i) => face.every(v => indices.includes(v)) ? [i] : []) });
  }
  return { vertices, edges, faces, cells };
}
