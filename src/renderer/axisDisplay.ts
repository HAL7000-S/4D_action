import * as THREE from 'three';
import { axisColors, type ProjectedAxis } from '../projection/basisAxes';

export function createAxisDisplay(parent: THREE.Scene, clippingPlanes: THREE.Plane[] = []) {
  const cone = new THREE.ConeGeometry(.045, .15, 10);
  // Cone tip is at local origin, so it stays at the true positive endpoint.
  cone.translate(0, -.075, 0);
  const entries = axisColors.map(color => {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color, clippingPlanes });
    const line = new THREE.LineSegments(geometry, lineMaterial); line.frustumCulled = false;
    const material = new THREE.MeshBasicMaterial({ color, clippingPlanes });
    const head = new THREE.Mesh(cone, material);
    parent.add(line, head); line.visible = head.visible = false;
    return { geometry, lineMaterial, line, material, head };
  });
  return {
    update(axes: readonly (ProjectedAxis | null)[]) {
      entries.forEach((e, i) => {
        const axis = axes[i]; e.line.visible = !!axis; e.head.visible = false;
        if (!axis) return;
        const attribute = e.geometry.getAttribute('position') as THREE.BufferAttribute;
        attribute.array.set([...axis.start, ...axis.end]); attribute.needsUpdate = true;
        if (axis.positive) {
          const direction = new THREE.Vector3(...axis.positive).sub(new THREE.Vector3(...axis.start));
          const length = direction.length();
          if (length > 1e-8) {
            e.head.visible = true; e.head.position.set(...axis.positive);
            e.head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
            e.head.scale.setScalar(Math.min(1, length / .3));
          }
        }
      });
    },
    dispose() { cone.dispose(); entries.forEach(e => { parent.remove(e.line, e.head); e.geometry.dispose(); e.lineMaterial.dispose(); e.material.dispose(); }); },
  };
}
