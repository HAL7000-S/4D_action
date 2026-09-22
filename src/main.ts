import type { Vec4 } from './math/vec4';
import { createTesseract } from './geometry/tesseract';
import { createSimplex4D } from './geometry/simplex4d';
import { createRoom4D } from './geometry/room4d';
import { createMainView } from './renderer/mainView';
import { createControls } from './ui/controls';
import { defaultState, projectScene, type ObjectId } from './ui/state';
import { defaultVolume, fov4D, observerRoomHalfSize } from './ui/observerState';
import { createTouchControls } from './ui/touchControls';
import './style.css';

const simplex = createSimplex4D();
const objects = [
  { id: 'room' as ObjectId, color: 0x526888, showVertices: false, polytope: createRoom4D(5) },
  { id: 'tesseract' as ObjectId, color: 0x63e8d2, showVertices: true, polytope: createTesseract(1.8, [-1.4, 0, 0, 1]) },
  { id: 'simplex' as ObjectId, color: 0xffbb70, showVertices: true, polytope: {
    ...simplex, vertices: simplex.vertices.map((v): Vec4 => [v[0] + 1.4, v[1], v[2], v[3] + 1]),
  } },
];

document.querySelector<HTMLElement>('#app')!.innerHTML = `
  <section class="viewport" id="main-view"></section>
  <header><strong>4D SPACE LAB ? Observer Room</strong><p>Click: mouse look / Esc: release ? WASD + Q/E: 3D move</p><p>Touch: drag to look ? Projection Volume: pale cube</p></header>
  <details class="panel" open><summary>Controls</summary>
  <section class="volume-controls"><h2>Projection Volume</h2><label>h <input id="volume-h" type="number" min="0.1" max="15" step="0.1" value="4"></label><output id="fov"></output><p id="volume-error" role="status"></p></section>
  <aside id="controls"></aside><p id="counts"></p></details>
  <div id="touch-controls"></div>`;
if (matchMedia('(pointer: coarse), (max-width: 800px)').matches) document.querySelector('details')!.open = false;
const volume = defaultVolume();
let focalLength = defaultState().projection.focalLength;
const showFov = () => { document.querySelector('#fov')!.textContent = `FOV4D: ${(fov4D(volume.h, focalLength) * 180 / Math.PI).toFixed(1)}?`; };
const initial = projectScene(objects, defaultState());
const viewport = document.querySelector<HTMLElement>('#main-view')!;
const view = createMainView(viewport, objects.map((o, i) => ({ ...o, geometry: initial[i].geometry })));
const controls = createControls(document.querySelector<HTMLElement>('#controls')!, viewport, state => {
  focalLength = state.projection.focalLength; showFov();
  const projected = projectScene(objects, state);
  view.update(projected.map(o => o.geometry));
  document.querySelector<HTMLElement>('#counts')!.textContent = projected.map(o =>
    `${o.id}: ${o.geometry.vertices.length} projected vertices / ${o.geometry.edges.length} projected edges`).join(' · ');
}, () => view.resetView());
const volumeInput = document.querySelector<HTMLInputElement>('#volume-h')!;
const updateVolume = () => {
  const h = volumeInput.valueAsNumber;
  if (!Number.isFinite(h) || h <= 0 || h >= observerRoomHalfSize - .2) {
    document.querySelector('#volume-error')!.textContent = '0 < h < 15.8 ??????????'; return;
  }
  document.querySelector('#volume-error')!.textContent = '';
  volume.h = h; view.setVolume(h); showFov();
};
volumeInput.addEventListener('input', updateVolume);
const disposeTouch = createTouchControls(document.querySelector('#touch-controls')!, controls.action, view.setObserverAction);
if (import.meta.hot) import.meta.hot.dispose(() => { volumeInput.removeEventListener('input', updateVolume); disposeTouch(); controls.dispose(); view.dispose(); });
