import * as THREE from 'three';
import { createObserver } from './observerCamera';
import { observerRoomHalfSize } from '../ui/observerState';
import type { ProjectedGeometry } from '../projection/projectedGeometry';

export interface ViewObject { geometry: ProjectedGeometry; color: number; showVertices: boolean }

/** Receives only projected 3D coordinates; no 4D camera state. */
export function createMainView(container: HTMLElement, objects: readonly ViewObject[]) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0b1220);
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '4D投影の3D wireframe Main View');
  const scene = new THREE.Scene();
  renderer.localClippingEnabled = true;
  const clipPlanes = [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)].map(n => new THREE.Plane(n, 4));
  const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
  const buffers: { edges: THREE.BufferGeometry; points?: THREE.BufferGeometry }[] = [];
  for (const object of objects) {
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(object.geometry.edges.flatMap(e => [...e.start, ...e.end]), 3));
    const edgeMaterial = new THREE.LineBasicMaterial({ color: object.color, clippingPlanes: clipPlanes });
    scene.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
    resources.push(edgeGeometry, edgeMaterial);
    const entry: { edges: THREE.BufferGeometry; points?: THREE.BufferGeometry } = { edges: edgeGeometry };
    buffers.push(entry);
    if (object.showVertices) {
      const pointGeometry = new THREE.BufferGeometry();
      pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(object.geometry.vertices.flatMap(v => [...v.position]), 3));
      const pointMaterial = new THREE.PointsMaterial({ color: object.color, size: 6, sizeAttenuation: false, clippingPlanes: clipPlanes });
      scene.add(new THREE.Points(pointGeometry, pointMaterial));
      resources.push(pointGeometry, pointMaterial);
      entry.points = pointGeometry;
    }
  }
  const frame = (half: number, color: number) => {
    const box = new THREE.BoxGeometry(2, 2, 2);
    const geometry = new THREE.EdgesGeometry(box); box.dispose();
    const material = new THREE.LineBasicMaterial({ color });
    const lines = new THREE.LineSegments(geometry, material); lines.scale.setScalar(half);
    resources.push(geometry, material); return lines;
  };
  const volumeFrame = frame(4, 0xc4d8ff); volumeFrame.name = 'projectionVolume'; scene.add(volumeFrame);
  const observerRoom3D = new THREE.Group(); observerRoom3D.name = 'observerRoom3D';
  observerRoom3D.add(frame(observerRoomHalfSize, 0x4e6580));
  const grid = new THREE.GridHelper(observerRoomHalfSize * 2, 32, 0x7295ac, 0x293e51);
  grid.position.y = -observerRoomHalfSize; observerRoom3D.add(grid); scene.add(observerRoom3D);
  resources.push(grid.geometry, ...(Array.isArray(grid.material) ? grid.material : [grid.material]));
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
  const controls = createObserver(camera, renderer.domElement);
  const render = () => renderer.render(scene, camera);
  let previous = performance.now();
  renderer.setAnimationLoop((time: number) => { controls.tick(Math.min((time - previous) / 1000, .05)); previous = time; render(); });
  const resize = () => {
    const width = Math.max(container.clientWidth, 1), height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const updateBuffer = (geometry: THREE.BufferGeometry, values: number[]) => {
    let attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    if (attribute.array.length < values.length) {
      // Release the old GPU allocation before replacing an undersized attribute.
      geometry.dispose();
      attribute = new THREE.Float32BufferAttribute(new Float32Array(values.length), 3);
      geometry.setAttribute('position', attribute);
    }
    attribute.array.set(values);
    attribute.needsUpdate = true;
    geometry.setDrawRange(0, values.length / 3);
    // Bounds from stale capacity slots must not cull newly projected geometry.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  };
  return {
    update(geometries: readonly ProjectedGeometry[]) {
      geometries.forEach((geometry, i) => {
        updateBuffer(buffers[i].edges, geometry.edges.flatMap(e => [...e.start, ...e.end]));
        if (buffers[i].points) updateBuffer(buffers[i].points!, geometry.vertices.flatMap(v => [...v.position]));
      });
      render();
    },
    resetView() { controls.reset(); render(); },
    setObserverAction: controls.setAction,
    setVolume(h: number) {
      volumeFrame.scale.setScalar(h); clipPlanes.forEach(p => { p.constant = h; }); render();
    },
    dispose() {
    observer.disconnect();
    renderer.setAnimationLoop(null);
    controls.dispose();
    resources.forEach(resource => resource.dispose());
    renderer.dispose();
    renderer.domElement.remove();
    },
  };
}
