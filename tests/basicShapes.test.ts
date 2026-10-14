import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createBasicShape, defaultShapeSpec, shapeKinds, maxShapeVertices } from '../src/geometry/basicShapes';
import { defaultState, resetCamera, setDimension, setViewMode, projectScene } from '../src/ui/state';
import { projectBasicShape } from '../src/projection/projectBasicShape';
import { createTesseract } from '../src/geometry/tesseract';
import { cellHyperplanes, isCellVisible, filterBackCells } from '../src/visibility/backCell';
import { composeRotation } from '../src/math/rotation4d';
import { transform } from '../src/math/matrix4';
import { projectGeometry } from '../src/projection/projectedGeometry';
import { playerViewCamera } from '../src/projection/playerCamera';
import { grayFloor, floorY } from '../src/geometry/grayFloor';
import { floorGeometry } from '../src/geometry/floorTile';
import { projectFloor } from '../src/projection/projectFloor';
import { createFloorView, floorColors } from '../src/renderer/floorView';
import { advanceCamera } from '../src/ui/inputMapping';
import { feetHeight, setMotionMode } from '../src/ui/playerMotion';
import { lookAtFloor } from '../src/ui/state';
import { createCreativeView } from '../src/renderer/creativeView';
import type { Vec4 } from '../src/math/vec4';

it.each(shapeKinds)('generates and projects bounded, finite 4D %s geometry', kind=> {
  const shape=createBasicShape(defaultShapeSpec(kind)), state=defaultState();
  expect(shape.geometry.vertices.length).toBeGreaterThan(0);
  expect(shape.geometry.vertices.length).toBeLessThanOrEqual(maxShapeVertices);
  const geometry=projectBasicShape(shape,state);
  expect(geometry.vertices.length+geometry.edges.length).toBeGreaterThan(0);
  expect(geometry.vertices.every(v=>v.position.every(Number.isFinite))).toBe(true);
  expect(geometry.edges.every(e=>[...e.start,...e.end].every(Number.isFinite))).toBe(true);
  shape.geometry.edges.forEach(([a,b])=> {expect(shape.geometry.vertices[a]).toBeDefined();expect(shape.geometry.vertices[b]).toBeDefined();});
});
it('distinguishes embedded Cube from Tesseract and preserves its six faces', ()=> {
  const cube=createBasicShape({...defaultShapeSpec('Cube'),position:[0,0,0,2]});
  expect(cube.geometry.vertices).toHaveLength(8);expect(cube.geometry.edges).toHaveLength(12);expect(cube.geometry.faces).toHaveLength(6);
  expect(cube.geometry.cells).toHaveLength(0);
  expect(cube.geometry.vertices.every(v=>v[3]===2)).toBe(true);
  const tesseract=createTesseract();expect(tesseract.vertices).toHaveLength(16);expect(tesseract.cells).toHaveLength(8);
});
it('samples the S³ equation and S² × w side plus B³ caps of the spherinder',()=> {
  const hypersphere=createBasicShape({...defaultShapeSpec('Hypersphere'),position:[0,0,0,0],radius:1.2});
  hypersphere.geometry.vertices.forEach(v=>expect(Math.hypot(...v)).toBeCloseTo(1.2,12));
  expect(new Set(hypersphere.geometry.vertices.map(v=>v[3].toFixed(5))).size).toBeGreaterThan(5);
  const spherinder=createBasicShape({...defaultShapeSpec('Spherinder'),position:[0,0,0,0],radius:1.2,length:2});
  spherinder.geometry.vertices.forEach(v=> {
    expect(Math.hypot(v[0],v[1],v[2])).toBeLessThanOrEqual(1.2+1e-12);expect(Math.abs(v[3])).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.hypot(v[0],v[1],v[2])-1.2)<1e-10 || Math.abs(v[3])===1).toBe(true);
  });
  expect(spherinder.geometry.vertices.some(v=>v[0]===0&&v[1]===0&&v[2]===0&&v[3]===1)).toBe(true);
});
it('clips a line crossing near and curved samples near depth limits without oversized or nonfinite output',()=> {
  const state={...defaultState(),position:[0,0,0,0] as Vec4,projection:{focalLength:3,near:2,far:6}};
  const line=createBasicShape({...defaultShapeSpec('Line Segment'),position:[1,0,0,1],end:[0,0,0,3]});
  const projected=projectBasicShape(line,state);expect(projected.edges).toHaveLength(1);
  expect(Math.abs(projected.edges[0].start[0])).toBeLessThanOrEqual(1.5);
  for(const kind of ['Hypersphere','Spherinder'] as const) {
    const shape=createBasicShape({...defaultShapeSpec(kind),position:[0,0,0,2]});
    const p=projectBasicShape(shape,{...state,visibilityMode:'XRay'});
    expect(p.edges.length).toBeLessThanOrEqual(shape.geometry.edges.length);
    expect(p.edges.every(e=>[...e.start,...e.end].every(v=>Number.isFinite(v)&&Math.abs(v)<5))).toBe(true);
  }
  expect(()=>createBasicShape({...defaultShapeSpec('Point'),position:[NaN,0,0,0]})).toThrow();
  expect(()=>createBasicShape({...defaultShapeSpec('Hypersphere'),radius:100})).toThrow();
});
it('transforms object normals with SO(4) and sample culling follows the camera',()=> {
  const spec=defaultShapeSpec('Hypersphere');
  const shape=createBasicShape({...spec,angles:{...spec.angles,XW:.8,ZW:.4}});
  const p=projectBasicShape(shape,defaultState());
  const xray=projectBasicShape(shape,{...defaultState(),visibilityMode:'XRay'});
  expect(p.vertices.length).toBeLessThan(xray.vertices.length);
  const fromOtherSide=projectBasicShape(shape,{...defaultState(),position:[0,0,0,4],angles:{...defaultState().angles,XW:Math.PI}});
  expect(fromOtherSide.vertices.map(v=>v.sourceVertexIndex)).not.toEqual(p.vertices.map(v=>v.sourceVertexIndex));
  shape.normals.flat().forEach(n=>expect(Math.hypot(...n)).toBeCloseTo(1,10));
});
it('tests all eight Tesseract cells after object/camera SO(4) rotation and camera translation',()=> {
  const local=createTesseract(1.8);
  const angles={...defaultState().angles,XY:.3,XW:.5,YW:.2,ZW:.8};
  const rotation=composeRotation(angles);
  const world={...local,vertices:local.vertices.map(v=>transform(rotation,v).map((x,i)=>x+[1,0,0,1][i]) as unknown as Vec4)};
  const planes=cellHyperplanes(world);expect(planes).toHaveLength(8);
  planes.forEach((plane,index)=> {
    const localNormal=cellHyperplanes(local)[index].normal;
    transform(rotation,localNormal).forEach((v,i)=>expect(plane.normal[i]).toBeCloseTo(v,10));
    const outward=plane.point.map((v,i)=>v+plane.normal[i]*2) as unknown as Vec4;
    expect(isCellVisible(plane,outward)).toBe(true);
  });
  for(const position of [[0,0,0,-3],[3,1,0,-2]] as Vec4[]) {
    const state={...defaultState(),position,angles,projection:{focalLength:3,near:.1,far:20}};
    const camera=playerViewCamera(state),projected=projectGeometry(world,camera,state.projection);
    const culled=filterBackCells(world,projected,camera.position,'Natural');
    culled.edges.forEach(e=>expect(world.cells.some((cell,i)=>isCellVisible(planes[i],camera.position)&&world.edges[e.sourceEdgeIndex].every(v=>cell.vertices.includes(v)))).toBe(true));
    expect(filterBackCells(world,projected,camera.position,'XRay')).toBe(projected);
  }
  const scene=[{id:'tesseract' as const,polytope:world}];
  expect(projectScene(scene,defaultState())[0].geometry).not.toEqual(projectScene(scene,{...defaultState(),angles})[0].geometry);
});
it('starts with Gravity/Culling ON and retains explicit OFF selections across reset and dimension/view changes',()=> {
  const state=defaultState();expect(state.motionMode).toBe('gravity');expect(state.visibilityMode).toBe('Natural');
  const explicit={...state,motionMode:'flight' as const,visibilityMode:'XRay' as const,grayFloorVisible:false};
  const reset=setDimension(setViewMode(resetCamera(explicit),'tps'),2);
  expect(reset.motionMode).toBe('flight');expect(reset.visibilityMode).toBe('XRay');expect(reset.grayFloorVisible).toBe(false);
  const flight=advanceCamera(setMotionMode(state,'flight'),new Set(['Space']),.1,[0,0],'camera4d');expect(flight.position[1]).toBeCloseTo(.2);
});
it.each([2,3,4] as const)('builds intrinsic %iD gray floor and lands Player on the same world height',dimension=> {
  const geometry=floorGeometry(grayFloor,dimension);expect(geometry.vertices).toHaveLength(2**(dimension-1));
  expect(geometry.faces).toHaveLength(dimension===2?0:dimension===3?1:6);
  geometry.vertices.forEach(v=> {expect(v[1]).toBe(floorY);expect(v.slice(dimension).every(x=>x===0)).toBe(true);});
  let state=setDimension(defaultState(),dimension);
  for(let i=0;i<180;i++) state=advanceCamera(state,new Set(),1/60,[0,0],'observer3d');
  expect(feetHeight(state)).toBeCloseTo(floorY);expect(state.verticalVelocity).toBe(0);expect(state.grounded).toBe(true);
  const projected=projectFloor(grayFloor,lookAtFloor(setViewMode(state,'tps')));
  expect(projected.triangles.length+projected.segments.length).toBeGreaterThan(0);
  expect([...projected.triangles,...projected.segments].flat().every(Number.isFinite)).toBe(true);
});
it('uses opaque gray floor material and a visible 2D thickness; clears removed creative objects',()=> {
  const scene=new THREE.Scene(),planes=[new THREE.Plane(new THREE.Vector3(1,0,0),4)];
  const floor=createFloorView(scene,planes);
  floor.update([projectFloor(grayFloor,lookAtFloor(setViewMode(setDimension(defaultState(),2),'tps')))]);
  const group=scene.getObjectByName('floorStage')!;
  const mesh=group.children.find(o=>o instanceof THREE.Mesh && o.material.color.getHex()===floorColors.gray) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  expect(mesh.material.transparent).toBe(false);expect(mesh.material.opacity).toBe(1);expect(mesh.geometry.drawRange.count).toBeGreaterThan(0);
  const creative=createCreativeView(scene,planes);
  creative.update([{id:1,geometry:projectBasicShape(createBasicShape(defaultShapeSpec('Point')),defaultState())}]);
  expect(scene.getObjectByName('creativeObjects')!.children).toHaveLength(2);
  creative.update([]);expect(scene.getObjectByName('creativeObjects')!.children).toHaveLength(0);
  floor.dispose();creative.dispose();
});
