import * as THREE from 'three';
import type { ProjectedGeometry } from '../projection/projectedGeometry';

export function createCreativeView(scene: THREE.Scene, clippingPlanes: THREE.Plane[]) {
  const group=new THREE.Group();group.name='creativeObjects';scene.add(group);
  const lineMaterial=new THREE.LineBasicMaterial({color:0xd7e7ff,clippingPlanes});
  const pointMaterial=new THREE.PointsMaterial({color:0xd7e7ff,size:5,sizeAttenuation:false,clippingPlanes});
  const entries=new Map<number,{edges:THREE.BufferGeometry;points:THREE.BufferGeometry;lines:THREE.LineSegments;dots:THREE.Points}>();
  const buffer=(g:THREE.BufferGeometry,values:number[])=> {
    let attribute=g.getAttribute('position') as THREE.BufferAttribute|undefined;
    if(!attribute || attribute.array.length<values.length) {
      if(attribute) g.dispose();attribute=new THREE.Float32BufferAttribute(new Float32Array(values.length),3);g.setAttribute('position',attribute);
    }
    attribute.array.set(values);attribute.needsUpdate=true;g.setDrawRange(0,values.length/3);
  };
  return {
    update(objects:readonly {id:number;geometry:ProjectedGeometry}[]) {
      const ids=new Set(objects.map(o=>o.id));
      for(const [id,e] of entries) if(!ids.has(id)) {group.remove(e.lines,e.dots);e.edges.dispose();e.points.dispose();entries.delete(id);}
      for(const object of objects) {
        let e=entries.get(object.id);
        if(!e) {
          const edges=new THREE.BufferGeometry(),points=new THREE.BufferGeometry();
          const lines=new THREE.LineSegments(edges,lineMaterial),dots=new THREE.Points(points,pointMaterial);
          lines.frustumCulled=dots.frustumCulled=false;group.add(lines,dots);
          e={edges,points,lines,dots};entries.set(object.id,e);
        }
        buffer(e.edges,object.geometry.edges.flatMap(edge=>[...edge.start,...edge.end]));
        buffer(e.points,object.geometry.vertices.flatMap(v=>[...v.position]));
      }
    },
    dispose(){scene.remove(group);entries.forEach(e=>{e.edges.dispose();e.points.dispose();});entries.clear();lineMaterial.dispose();pointMaterial.dispose();},
  };
}
