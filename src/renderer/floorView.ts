import * as THREE from 'three';
import type { ProjectedFloor } from '../projection/projectFloor';

export const floorColors = { safe: 0x2563eb, hazard: 0xef4444, gray: 0x888888 } as const;
/** Floor-only mesh renderer. Receives projected xyz, never 4D coordinates. */
export function createFloorView(scene: THREE.Scene, clippingPlanes: THREE.Plane[]) {
  const group = new THREE.Group(); group.name = 'floorStage'; scene.add(group);
  const entries = (['safe', 'hazard', 'gray'] as const).map(type => {
    const triangles = new THREE.BufferGeometry(), segments = new THREE.BufferGeometry();
    for (const geometry of [triangles, segments]) geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    const meshMaterial = new THREE.MeshBasicMaterial({ color: floorColors[type], side: THREE.DoubleSide, clippingPlanes,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const lineMaterial = new THREE.LineBasicMaterial({ color: floorColors[type], clippingPlanes });
    const mesh = new THREE.Mesh(triangles, meshMaterial), lines = new THREE.LineSegments(segments, lineMaterial);
    mesh.frustumCulled = lines.frustumCulled = false; group.add(mesh, lines);
    return { type, triangles, segments, meshMaterial, lineMaterial };
  });
  const updateBuffer = (geometry: THREE.BufferGeometry, values: number[]) => {
    let attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    if (attribute.count * 3 < values.length) {
      geometry.dispose(); attribute = new THREE.Float32BufferAttribute(new Float32Array(values.length), 3);
      geometry.setAttribute('position', attribute);
    }
    attribute.array.set(values); attribute.needsUpdate = true; geometry.setDrawRange(0, values.length / 3);
  };
  return {
    update(tiles: readonly ProjectedFloor[]) {
      for (const e of entries) {
        const matching = tiles.filter(t => t.type === e.type);
        const values = matching.flatMap(t => t.triangles.flatMap(p => [...p]));
        if(e.type==='gray') for(const tile of matching) for(let i=0;i+1<tile.segments.length;i+=2) {
          // 1D intrinsic floor rendered as a narrow TV-space strip (WebGL line
          // width is platform-dependent). Thickness is visual, not world geometry.
          const a=tile.segments[i],b=tile.segments[i+1],h=.015;
          values.push(a[0],a[1]-h,a[2],b[0],b[1]-h,b[2],b[0],b[1]+h,b[2],a[0],a[1]-h,a[2],b[0],b[1]+h,b[2],a[0],a[1]+h,a[2]);
        }
        updateBuffer(e.triangles, values);
        updateBuffer(e.segments, matching.flatMap(t => t.segments.flatMap(p => [...p])));
      }
    },
    dispose() { scene.remove(group); entries.forEach(e => { e.triangles.dispose(); e.segments.dispose(); e.meshMaterial.dispose(); e.lineMaterial.dispose(); }); },
  };
}
