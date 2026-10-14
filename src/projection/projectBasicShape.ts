import type { BasicShape } from '../geometry/basicShapes';
import type { CameraState } from '../ui/state';
import { playerViewCamera, projectPlayerWorld } from './playerCamera';

/** Curved forms use sample-normal culling, not exact cell tessellation/occlusion. */
export function projectBasicShape(shape: BasicShape, state: CameraState) {
  const projected=projectPlayerWorld(shape.geometry,state);
  // An embedded 3D cube has no full-dimensional 4D cells. Its intrinsic
  // xyz interior is not an inside/outside test for an observer displaced in w.
  // Retain its wireframe instead of incorrectly culling it to nothing.
  if(state.visibilityMode==='XRay' || ['Point','Line Segment','Cube'].includes(shape.spec.kind)) return projected;
  const camera=playerViewCamera(state).position;
  const front=shape.geometry.vertices.map((point,i)=>shape.normals[i].some(n=>
    n.reduce((sum,v,a)=>sum+v*(camera[a]-point[a]),0)>1e-10));
  const edgeVisible=shape.geometry.edges.map(([a,b])=>front[a]&&front[b]);
  return {vertices:projected.vertices.filter(v=>front[v.sourceVertexIndex]),edges:projected.edges.filter(e=>edgeVisible[e.sourceEdgeIndex])};
}
