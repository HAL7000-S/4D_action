import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ProjectedGeometry } from '../projection/projectedGeometry';

export interface ViewObject { geometry: ProjectedGeometry; color: number; showVertices: boolean }

/** Receives only projected 3D coordinates; no 4D camera state. */
export function createMainView(container: HTMLElement, objects: readonly ViewObject[]): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0b1220);
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '4D投影の3D wireframe Main View');
  const scene = new THREE.Scene();
  const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
  for (const object of objects) {
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(object.geometry.edges.flatMap(e => [...e.start, ...e.end]), 3));
    const edgeMaterial = new THREE.LineBasicMaterial({ color: object.color });
    scene.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
    resources.push(edgeGeometry, edgeMaterial);
    if (object.showVertices) {
      const pointGeometry = new THREE.BufferGeometry();
      pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(object.geometry.vertices.flatMap(v => [...v.position]), 3));
      const pointMaterial = new THREE.PointsMaterial({ color: object.color, size: 6, sizeAttenuation: false });
      scene.add(new THREE.Points(pointGeometry, pointMaterial));
      resources.push(pointGeometry, pointMaterial);
    }
  }
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 1000);
  camera.position.set(11, 8, 15);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.update();
  const render = () => renderer.render(scene, camera);
  controls.addEventListener('change', render);
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
  return () => {
    observer.disconnect();
    controls.removeEventListener('change', render);
    controls.dispose();
    resources.forEach(resource => resource.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  };
}
