import { roomHalfExtent } from './ui/roomBoundary';
import { floorStage } from './geometry/floorTile';
import { projectFloor } from './projection/projectFloor';
import { playerViewCamera } from './projection/playerCamera';
import { projectAvatar } from './projection/playerAvatar';
import { projectPlayerAxes } from './projection/playerAxes';
import { projectGizmo } from './projection/basisAxes';
import { createInputState } from './ui/inputMapping';
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
  { id: 'room' as ObjectId, color: 0x526888, showVertices: false, polytope: createRoom4D(roomHalfExtent) },
  { id: 'tesseract' as ObjectId, color: 0x63e8d2, showVertices: true, polytope: createTesseract(1.8, [-1.4, 0, 0, 1]) },
  { id: 'simplex' as ObjectId, color: 0xffbb70, showVertices: true, polytope: {
    ...simplex, vertices: simplex.vertices.map((v): Vec4 => [v[0] + 1.4, v[1], v[2], v[3] + 1]),
  } },
];

document.querySelector<HTMLElement>('#app')!.innerHTML = `
  <div id="input-mode" role="status" aria-live="polite"></div>
  <section class="viewport" id="main-view"></section>
  <header><strong>4D SPACE LAB / Observer Room</strong><p>Click: mouse look / Esc: release / ESDF + Space/Shift: 3D move</p><p>Touch: drag to look / ProjectionTV: pale cube</p></header>
  <details class="panel" open><summary>Controls</summary>
  <section class="volume-controls"><h2>ProjectionTV</h2><label>TV Half-Extent (h) <input id="volume-h" type="number" min="0.1" max="15" step="0.1" value="4"></label><p>ProjectionTV half-width on each axis: [-h,h]^3.</p><output id="fov"></output><p>PlayerCamera field of view: FOV = 2 atan(h/f), independent of ObserverCamera3D.</p><p id="volume-error" role="status"></p></section>
  <aside id="controls"></aside><p id="counts"></p></details>
  <div id="touch-controls"></div>`;
if (matchMedia('(pointer: coarse), (max-width: 800px)').matches) document.querySelector('details')!.open = false;
const volume = defaultVolume();
let focalLength = defaultState().projection.focalLength;
const showFov = () => { document.querySelector('#fov')!.textContent = `TV Field of View (FOV): ${(fov4D(volume.h, focalLength) * 180 / Math.PI).toFixed(1)} deg`; };
const initial = projectScene(objects, defaultState());
const viewport = document.querySelector<HTMLElement>('#main-view')!;
const inputState = createInputState(viewport);
let playerLabel = '4D FPS';
const updateModeHud = () => { document.querySelector('#input-mode')!.textContent = `CONTROL : ${inputState.mode === 'observer3d' ? 'OBSERVER' : 'PLAYER'}\nDIMENSION : ${playerLabel.split(' ')[0]}\nVIEW : ${playerLabel.split(' ')[1]}\n\n/ Control: Observer / Player\n[ ] Dimension: 2D / 3D / 4D\nV View: FPS / TPS\n${inputState.mode === 'observer3d' ? 'ESDF: move; Space / Shift: up / down' : playerLabel.startsWith('2D') ? 'E/D: +x / -x; S/F: -x / +x' : playerLabel.startsWith('3D') ? 'E/D: forward / back; S/F: left / right' : 'E/D: forward / back; S/F: left / right; A/Z: -z / +z'}`; };
const unsubscribeMode = inputState.subscribe(updateModeHud); updateModeHud();
const touchControls = createTouchControls(document.querySelector('#touch-controls')!, inputState);
const view = createMainView(viewport, [...objects.map((o, i) => ({ ...o, geometry: initial[i].geometry })), ...[0x3b82f6, 0xef4444].map(color => ({ color, showVertices: false, geometry: { vertices: [], edges: [] } }))], inputState);
let lastDiagnostic = 0;
const controls = createControls(document.querySelector<HTMLElement>('#controls')!, viewport, state => {
  focalLength = state.projection.focalLength;
  touchControls.setDimension(state.dimension);
  const projected = projectScene(objects, state);
  const rotation = playerViewCamera(state).rotation;
  view.updateFloor(floorStage(state.dimension).map(tile => projectFloor(tile, state)));
  view.updateAxes(projectPlayerAxes(state, playerViewCamera(state)), projectGizmo(rotation).map((axis, i) => i < state.dimension ? axis : null));
  view.update([...projected.map(o => o.geometry), ...projectAvatar(state)]);
  const label = `${state.dimension}D ${state.viewMode.toUpperCase()}`;
  if (playerLabel !== label) { playerLabel = label; updateModeHud(); }
  if (performance.now() - lastDiagnostic >= 100) {
  lastDiagnostic = performance.now(); showFov();
  document.querySelector<HTMLElement>('#counts')!.textContent = projected.map(o =>
    `${o.id}: ${o.geometry.vertices.length} projected vertices / ${o.geometry.edges.length} projected edges`).join(' · ');
  }
}, () => view.resetView());
const unsubscribeActions = inputState.subscribeAction(controls.action);
view.setInputUpdate(dt => controls.update(dt, inputState.pressed, inputState.takeMouse(), inputState.mode));
const volumeInput = document.querySelector<HTMLInputElement>('#volume-h')!;
const updateVolume = () => {
  const h = volumeInput.valueAsNumber;
  if (!Number.isFinite(h) || h <= 0 || h >= observerRoomHalfSize - .2) {
    document.querySelector('#volume-error')!.textContent = 'Require 0 < h < 15.8'; return;
  }
  document.querySelector('#volume-error')!.textContent = '';
  volume.h = h; view.setVolume(h); showFov();
};
volumeInput.addEventListener('input', updateVolume);
if (import.meta.hot) import.meta.hot.dispose(() => { volumeInput.removeEventListener('input', updateVolume); touchControls.dispose(); unsubscribeActions(); unsubscribeMode(); inputState.dispose(); controls.dispose(); view.dispose(); });
