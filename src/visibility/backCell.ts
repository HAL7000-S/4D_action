import type { Polytope4D } from '../geometry/polytope4d';
import type { Vec4 } from '../math/vec4';
import type { ProjectedGeometry } from '../projection/projectedGeometry';

export type VisibilityMode = 'XRay' | 'Natural';
export interface SupportingHyperplane { readonly normal: Vec4; readonly point: Vec4; readonly d: number }
const dot = (a: Vec4, b: Vec4) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const sub = (a: Vec4, b: Vec4) => a.map((v, i) => v - b[i]) as unknown as Vec4;
function det3(m: number[][]): number {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}
/** For full-dimensional convex polytopes. Normals and d are in world coordinates. */
export function cellHyperplanes(polytope: Polytope4D): SupportingHyperplane[] {
  const center = [0, 1, 2, 3].map(a => polytope.vertices.reduce((sum, v) => sum + v[a] / polytope.vertices.length, 0)) as unknown as Vec4;
  return polytope.cells.map(cell => {
    const point = polytope.vertices[cell.vertices[0]];
    const offsets = cell.vertices.slice(1).map(i => sub(polytope.vertices[i], point));
    const scale = Math.max(...offsets.map(v => Math.hypot(...v)));
    if (!(scale > 0) || !Number.isFinite(scale)) throw new RangeError('Degenerate cell');
    const directions = offsets.map(v => v.map(x => x / scale));
    let best: number[] = [], norm = 0;
    // Choose the largest 3-volume, avoiding dependent/coplanar vertex triples.
    for (let i = 0; i < directions.length; i++) for (let j = i + 1; j < directions.length; j++) for (let k = j + 1; k < directions.length; k++) {
      const rows = [directions[i], directions[j], directions[k]];
      const n = [0, 1, 2, 3].map(a => (-1) ** a * det3(rows.map(row => row.filter((_, b) => b !== a))));
      const length = Math.hypot(...n);
      if (length > norm) { norm = length; best = n; }
    }
    if (norm < 1e-12) throw new RangeError('Cell must span three dimensions');
    let normal = best.map(v => v / norm) as unknown as Vec4;
    // The convex polytope centroid is interior: outward points away from it.
    if (dot(normal, sub(center, point)) > 0) normal = normal.map(v => -v) as unknown as Vec4;
    return { normal, point, d: dot(normal, point) };
  });
}
export function isCellVisible(plane: SupportingHyperplane, cameraPosition: Vec4): boolean {
  return dot(plane.normal, sub(cameraPosition, plane.point)) > 1e-10;
}

// Scene geometry is static: avoid rebuilding planes and memberships every frame.
const cache = new WeakMap<Polytope4D, ReturnType<typeof prepare>>();
function prepare(polytope: Polytope4D) {
  return cellHyperplanes(polytope).map((plane, i) => {
    const vertices = new Set(polytope.cells[i].vertices);
    const edges = polytope.edges.flatMap(([a, b], e) => vertices.has(a) && vertices.has(b) ? [e] : []);
    return { plane, vertices, edges };
  });
}
export function filterBackCells(polytope: Polytope4D, projected: ProjectedGeometry, cameraPosition: Vec4, mode: VisibilityMode): ProjectedGeometry {
  if (mode === 'XRay') return projected;
  let cells = cache.get(polytope);
  if (!cells) { cells = prepare(polytope); cache.set(polytope, cells); }
  const vertices = new Set<number>(), edges = new Set<number>();
  for (const cell of cells) if (isCellVisible(cell.plane, cameraPosition)) {
    cell.vertices.forEach(v => vertices.add(v)); cell.edges.forEach(e => edges.add(e));
  }
  return { vertices: projected.vertices.filter(v => vertices.has(v.sourceVertexIndex)),
    edges: projected.edges.filter(e => edges.has(e.sourceEdgeIndex)) };
}

/** Intrinsic convex edge/face culling; Room, floor and avatar retain their own policies. */
export function filterBackBoundaries(polytope: Polytope4D, projected: ProjectedGeometry, camera: Vec4, mode: VisibilityMode, dimension: 2 | 3 | 4): ProjectedGeometry {
  if (dimension === 4) return filterBackCells(polytope, projected, camera, mode);
  if (mode === 'XRay') return projected;
  const center = [0,1,2,3].map(a => polytope.vertices.reduce((sum,v) => sum+v[a]/polytope.vertices.length,0)) as unknown as Vec4;
  const boundaries = dimension === 2 ? polytope.edges : polytope.faces;
  const vertices = new Set<number>(), edges = new Set<number>();
  for (const boundary of boundaries) {
    const point = polytope.vertices[boundary[0]], u = sub(polytope.vertices[boundary[1]],point);
    let normal: Vec4;
    if (dimension === 2) normal = [u[1],-u[0],0,0];
    else {
      const v = sub(polytope.vertices[boundary[2]],point);
      normal = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0],0];
    }
    const length = Math.hypot(...normal);
    if (!(length > 1e-12) || !Number.isFinite(length)) continue;
    normal = normal.map(x => x/length) as unknown as Vec4;
    if (dot(normal,sub(center,point)) > 0) normal = normal.map(x => -x) as unknown as Vec4;
    if (!isCellVisible({ normal,point,d: dot(normal,point) },camera)) continue;
    boundary.forEach(v => vertices.add(v));
    polytope.edges.forEach(([a,b],i) => { if (boundary.includes(a) && boundary.includes(b)) edges.add(i); });
  }
  return { vertices: projected.vertices.filter(v => vertices.has(v.sourceVertexIndex)), edges: projected.edges.filter(e => edges.has(e.sourceEdgeIndex)) };
}
