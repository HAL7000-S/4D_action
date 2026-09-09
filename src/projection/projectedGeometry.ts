import type { Polytope4D } from '../geometry/polytope4d';
import { worldToCamera, type Camera4D } from '../math/camera4d';
import { projectPoint, type Projection4D } from '../math/projection4d';
import type { Vec3 } from '../math/vec4';
import { clipSegment4D } from './clip4d';

export interface ProjectedVertex { readonly position: Vec3; readonly sourceVertexIndex: number }
export interface ProjectedEdge { readonly start: Vec3; readonly end: Vec3; readonly sourceEdgeIndex: number }
export interface ProjectedGeometry {
  readonly vertices: readonly ProjectedVertex[];
  readonly edges: readonly ProjectedEdge[];
}

export function projectGeometry(geometry: Polytope4D, camera: Camera4D, settings: Projection4D): ProjectedGeometry {
  // Validate even empty geometry using the existing point-projection contract.
  projectPoint([0, 0, 0, 0], settings);
  const cameraVertices = geometry.vertices.map(v => worldToCamera(v, camera));
  const vertices: ProjectedVertex[] = [];
  const edges: ProjectedEdge[] = [];
  cameraVertices.forEach((v, sourceVertexIndex) => {
    const position = projectPoint(v, settings);
    if (position) vertices.push({ position, sourceVertexIndex });
  });
  geometry.edges.forEach(([a, b], sourceEdgeIndex) => {
    const clipped = clipSegment4D(cameraVertices[a], cameraVertices[b], settings.near, settings.far);
    if (!clipped) return;
    const start = projectPoint(clipped[0], settings), end = projectPoint(clipped[1], settings);
    if (start && end) edges.push({ start, end, sourceEdgeIndex });
  });
  return { vertices, edges };
}
