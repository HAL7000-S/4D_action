import type { Edge4D, Polytope4D } from './polytope4d';
import type { Vec4 } from '../math/vec4';
import { transform } from '../math/matrix4';
import { composeRotation, type RotationAngles } from '../math/rotation4d';
import { playerShape } from './playerGeometry';

export const shapeKinds = ['Point', 'Line Segment', 'Cube', 'Spherinder', 'Hypersphere'] as const;
export type ShapeKind = typeof shapeKinds[number];
export interface ShapeSpec {
  kind: ShapeKind;
  position: Vec4;
  end: Vec4; // Line's local endpoint; position is its world start.
  radius: number;
  length: number;
  angles: RotationAngles; // Local-to-world SO(4), distinct from camera world-to-camera.
}
export interface BasicShape {
  spec: ShapeSpec;
  geometry: Polytope4D;
  normals: readonly (readonly Vec4[])[];
}
export const maxShapeVertices = 600;
export const maxCreativeObjects = 24;
export function defaultShapeSpec(kind: ShapeKind): ShapeSpec {
  return { kind, position: [0, .4, 0, 1], end: [1,0,0,1], radius: .7, length: 1.4,
    angles: { XY:0, XZ:0, XW:0, YZ:0, YW:0, ZW:0 } };
}
/** Fixed-resolution S² lattice; no Three.js geometry or renderer dependency. */
function sphereSamples() {
  const vertices: Vec4[] = [[0,1,0,0]], edges: Edge4D[] = [];
  const rings = 5, sides = 12;
  for (let ring=1; ring<=rings; ring++) for(let side=0;side<sides;side++) {
    const theta=Math.PI*ring/(rings+1), phi=2*Math.PI*side/sides;
    vertices.push([Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi),0]);
  }
  const bottom=vertices.length; vertices.push([0,-1,0,0]);
  for(let ring=0;ring<rings;ring++) for(let side=0;side<sides;side++) {
    const i=1+ring*sides+side;
    edges.push([i,1+ring*sides+(side+1)%sides]);
    if(ring===0) edges.push([0,i]);
    if(ring<rings-1) edges.push([i,i+sides]); else edges.push([i,bottom]);
  }
  return {vertices,edges};
}
export function createBasicShape(spec: ShapeSpec): BasicShape {
  if (!shapeKinds.includes(spec.kind) || ![...spec.position,...spec.end,...Object.values(spec.angles),spec.radius,spec.length].every(Number.isFinite)
    || spec.radius < .05 || spec.radius > 3 || spec.length < .05 || spec.length > 6
    || [...spec.position,...spec.end].some(v=>Math.abs(v)>10)) throw new RangeError('Finite position/end ±10, radius .05–3, length .05–6 required');
  let vertices: Vec4[] = [], edges: Edge4D[] = [], faces: readonly (readonly number[])[] = [];
  let normals: Vec4[][] = [];
  const add = (p: Vec4, n: Vec4[] = []) => { vertices.push(p); normals.push(n); return vertices.length-1; };
  if(spec.kind==='Point') add([0,0,0,0]);
  else if(spec.kind==='Line Segment') { add([0,0,0,0]); add(spec.end); edges.push([0,1]); }
  else if(spec.kind==='Cube') {
    const cube=playerShape(3,2*spec.radius);
    vertices=[...cube.vertices]; edges=[...cube.edges]; faces=cube.faces;
    normals=vertices.map(p=>[0,1,2].map(a=>[0,1,2,3].map(i=>i===a?Math.sign(p[a]):0) as unknown as Vec4));
  } else {
    const sphere=sphereSamples(), count=sphere.vertices.length;
    if(spec.kind==='Hypersphere') {
      // Samples of S³ only, not a tessellation of the B⁴ interior.
      const top=add([0,0,0,spec.radius],[[0,0,0,1]]);
      for(let ring=1;ring<8;ring++) {
        const chi=Math.PI*ring/8, start=vertices.length;
        sphere.vertices.forEach(v=> {
          const n: Vec4=[v[0]*Math.sin(chi),v[1]*Math.sin(chi),v[2]*Math.sin(chi),Math.cos(chi)];
          add(n.map(x=>x*spec.radius) as unknown as Vec4,[n]);
        });
        sphere.edges.forEach(([a,b])=>edges.push([start+a,start+b]));
        for(let j=0;j<count;j++) edges.push([ring===1?top:start-count+j,start+j]);
      }
      const bottom=add([0,0,0,-spec.radius],[[0,0,0,-1]]);
      for(let j=0;j<count;j++) edges.push([bottom-count+j,bottom]);
    } else {
      // S² × interval side samples, with radial spokes sampling the two B³ caps.
      // Wire lattice omits continuous curved patches and cap volume interiors.
      for(let layer=0;layer<=4;layer++) {
        const start=vertices.length, w=spec.length*(layer/4-.5);
        sphere.vertices.forEach(v=>add([v[0]*spec.radius,v[1]*spec.radius,v[2]*spec.radius,w],
          layer===0 || layer===4 ? [v,[0,0,0,layer===0?-1:1]] : [v]));
        sphere.edges.forEach(([a,b])=>edges.push([start+a,start+b]));
        if(layer>0) for(let j=0;j<count;j++) edges.push([start-count+j,start+j]);
      }
      for(const layer of [0,4]) {
        const w=spec.length*(layer/4-.5), center=add([0,0,0,w],[[0,0,0,layer===0?-1:1]]);
        for(let j=0;j<count;j++) edges.push([center,layer*count+j]);
      }
    }
  }
  if(vertices.length>maxShapeVertices) throw new RangeError('Sample budget exceeded');
  const rotation=composeRotation(spec.angles);
  return { spec, geometry: { vertices: vertices.map(p=>transform(rotation,p).map((v,i)=>v+spec.position[i]) as unknown as Vec4), edges,faces,cells:[] },
    normals: normals.map(list=>list.map(n=>transform(rotation,n))) };
}
