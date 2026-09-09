import type { Vec4 } from '../math/vec4';
import type { Cell4D, Edge4D, Face4D, Polytope4D } from './polytope4d';

export function createSimplex4D(): Polytope4D {
  // Unit circumradius, centroid zero: pairwise dot products are -1/4.
  // A regular tetrahedron at w=-1/4 plus the pole w=1 gives equal edges sqrt(5/2).
  const a = Math.sqrt(5) / 4;
  const vertices: Vec4[] = [
    [a, a, a, -.25], [a, -a, -a, -.25],
    [-a, a, -a, -.25], [-a, -a, a, -.25], [0, 0, 0, 1],
  ];
  const edges: Edge4D[] = [];
  const faces: Face4D[] = [];
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
    edges.push([i, j]);
    for (let k = j + 1; k < 5; k++) faces.push([i, j, k]);
  }
  const cells: Cell4D[] = vertices.map((_, omitted) => ({
    vertices: vertices.map((_, i) => i).filter(i => i !== omitted),
    faces: faces.flatMap((face, i) => face.includes(omitted) ? [] : [i]),
  }));
  return { vertices, edges, faces, cells };
}
