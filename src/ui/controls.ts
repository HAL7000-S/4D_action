import { correctPlayerContact, setMotionMode } from './playerMotion';
import { constrainCameraPosition } from './roomBoundary';
import { planes, type RotationPlane } from '../math/rotation4d';
import type { Projection4D } from '../math/projection4d';
import { axes, objectIds, defaultState, resetCamera, toDegrees, toRadians, validState, type CameraState, type ObjectId, setDimension, setViewMode, lookAtFloor } from './state';

import { advanceCamera, type InputMode, type PlayerAction } from './inputMapping';

export function createControls(panel: HTMLElement, viewport: HTMLElement, onChange: (state: CameraState) => void, resetView: () => void) {
  let state = defaultState();
  const field = (group: string, name: string, step: number) => `<label>${name}<input type="number" step="${step}" data-group="${group}" name="${name}"></label>`;
  panel.innerHTML = `<h2>PlayerCamera</h2>
    <fieldset><legend>PlayerDimension</legend>${[2,3,4].map(d => `<button type="button" data-dimension="${d}">${d}D</button>`).join('')}</fieldset>
    <fieldset><legend>ViewMode</legend>${['fps','tps'].map(v => `<button type="button" data-view="${v}">${v.toUpperCase()}</button>`).join('')}<p>TPS: front boundary red / other boundaries blue</p></fieldset>
    <fieldset><legend>Player movement</legend>
    <label>Invert Y<input type="checkbox" name="invertY" data-group="look"></label>
    <label>Free Flight<input type="radio" name="motion-mode" value="flight" data-group="motion"></label>
    <label>Gravity<input type="radio" name="motion-mode" value="gravity" data-group="motion"></label></fieldset>
    <label>Gray world floor<input type="checkbox" name="grayFloorVisible" data-group="floor"></label><p>Player World floor y = -1; hiding its image does not disable ground contact.</p>
    <fieldset><legend>Position（世界座標）</legend>${axes.map(a => field('position', a, .1)).join('')}</fieldset>
    <button type="button" id="floor-preview">Look at floor</button><p>Floor: blue = safe / red = hazard (display only)</p>
    <fieldset><legend>Rotation（degree）</legend>${planes.map(p => field('rotation', p, 1)).join('')}</fieldset>
    <fieldset><legend>Projection</legend>${['focalLength', 'near', 'far'].map(p => field('projection', p, .1)).join('')}</fieldset>
    <fieldset><legend>Visibility</legend>
    <label>X-Ray<input type="radio" name="visibility-mode" value="XRay" data-group="mode"></label>
    <label>Back-face Culling<input type="radio" name="visibility-mode" value="Natural" data-group="mode"></label>
    ${objectIds.map(id => `<label>${id}<input type="checkbox" name="${id}" data-group="visible"></label>`).join('')}</fieldset>
    <p class="error" role="status" id="input-error"></p>
    <button type="button" id="reset-camera">Reset Player</button>
    <button type="button" id="reset-view">Reset Observer</button>
    <p>X-Ray: all wireframe. Back-face Culling: rear edges (2D), faces (3D), cells (4D) removed; no occlusion.</p><fieldset><legend>InputMode / keys</legend><p>Observer3D: ESDF; Space / Shift: up / down</p>
    <p id="player-keys">Slash: Observer / Player; [ / ]: dimension; V: FPS / TPS<br>Player: ESDF, A/Z; Space reserved</p></fieldset>
    <output id="camera-diagnostic"></output>`;
  const inputs = Array.from(panel.querySelectorAll<HTMLInputElement>('input'));
  const error = panel.querySelector<HTMLElement>('#input-error')!;
  let dirty = false, elapsed = 0;
  const sync = () => {
    for (const input of inputs) {
      if (document.activeElement === input) continue;
      const group = input.dataset.group;
      input.disabled = group === 'position' ? axes.indexOf(input.name as typeof axes[number]) >= state.dimension
        : group === 'rotation' ? state.viewMode === 'tps' || [...input.name.toLowerCase()].some(a => axes.indexOf(a as typeof axes[number]) >= state.dimension) : false;
      input.setCustomValidity('');
      if (group === 'floor') input.checked = state.grayFloorVisible;
      else if (group === 'look') input.checked = state.invertY;
      else if (group === 'motion') input.checked = input.value === state.motionMode;
      else if (group === 'mode') input.checked = input.value === state.visibilityMode;
      else if (group === 'visible') input.checked = state.visible[input.name as ObjectId];
      else {
        const value = group === 'position' ? state.position[axes.indexOf(input.name as typeof axes[number])]
          : group === 'rotation' ? toDegrees(state.angles[input.name as RotationPlane]) : state.projection[input.name as keyof Projection4D];
        input.value = String(Number(value.toPrecision(12)));
      }
    }
    panel.querySelectorAll<HTMLButtonElement>('[data-dimension]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.dimension) === state.dimension)));
    panel.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.viewMode)));
    panel.querySelector('#player-keys')!.textContent = `Slash: Observer / Player; [ / ]: dimension; V: FPS / TPS. S/F: left/right; ${state.dimension >= 3 ? 'E/D: camera forward/back; ' : 'E/D: +x/-x; '}${state.dimension === 4 ? 'A/Z: camera local -z/+z; ' : ''}${state.dimension === 4 ? 'Up/Down: +ZW/-ZW; ' : ''}Space: ${state.motionMode === 'gravity' ? 'jump (press while grounded)' : 'up; Shift: down'}. Mouse: ${state.viewMode === 'tps' ? 'TPS orbit only' : 'FPS look'}`;
    error.textContent = '';
    panel.querySelector<HTMLOutputElement>('#camera-diagnostic')!.textContent =
      `Position (${state.position.map(v => v.toFixed(3)).join(', ')})\n` + planes.map(p => `${p}: ${toDegrees(state.angles[p]).toFixed(2)}°`).join(' / ');
  };
  const commit = (next: CameraState) => { state = correctPlayerContact({ ...next, position: constrainCameraPosition(next.position, next.dimension) }); sync(); onChange(state); };
  const input = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const next: CameraState = { ...state, position: [...state.position], angles: { ...state.angles }, projection: { ...state.projection }, visible: { ...state.visible } };
    const group = target.dataset.group, value = target.valueAsNumber;
    if (group === 'floor') next.grayFloorVisible = target.checked;
    else if (group === 'look') next.invertY = target.checked;
    else if (group === 'motion') Object.assign(next, setMotionMode(state, target.value === 'gravity' ? 'gravity' : 'flight'));
    else if (group === 'mode') next.visibilityMode = target.value === 'Natural' ? 'Natural' : 'XRay';
    else if (group === 'visible') next.visible[target.name as ObjectId] = target.checked;
    else if (group === 'position') {
      const position = [...state.position] as [number, number, number, number];
      position[axes.indexOf(target.name as typeof axes[number])] = value; next.position = position;
    } else if (group === 'rotation') next.angles[target.name as RotationPlane] = toRadians(value);
    else if (group === 'projection') next.projection[target.name as keyof Projection4D] = value;
    if (!validState(next)) {
      error.textContent = '有限値、focalLength > 0、0 < near < far を入力してください。直前の有効状態を表示中です。';
      target.setCustomValidity(error.textContent); return;
    }
    // Keep the active input text/caret intact while updating the actual state.
    const draft = target.value;
    commit(next);
    if (group === 'position') target.value = String(state.position[axes.indexOf(target.name as typeof axes[number])]);
    else if (!['visible','mode','motion','look','floor'].includes(group ?? '')) target.value = draft;
  };
  const choose = (event: Event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (button?.dataset.dimension) commit(setDimension(state, Number(button.dataset.dimension) as 2 | 3 | 4));
    if (button?.dataset.view) commit(setViewMode(state, button.dataset.view as 'fps' | 'tps'));
  };
  const floorPreview = () => commit(lookAtFloor(state));
  panel.querySelector('#floor-preview')!.addEventListener('click', floorPreview);
  panel.addEventListener('click', choose);
  const focus = () => viewport.focus({ preventScroll: true });
  const reset = () => commit(resetCamera(state));
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', 'ProjectionTV: Slash = Observer / Player, brackets = dimension, V = FPS / TPS');
  panel.addEventListener('input', input);
  panel.querySelector('#reset-camera')!.addEventListener('click', reset);
  panel.querySelector('#reset-view')!.addEventListener('click', resetView);
  viewport.addEventListener('pointerdown', focus);

  sync(); onChange(state);
  return {
    action(action: PlayerAction) {
      commit(action === 'toggleView' ? setViewMode(state, state.viewMode === 'fps' ? 'tps' : 'fps')
        : setDimension(state, Math.max(2, Math.min(4, state.dimension + (action === 'dimensionUp' ? 1 : -1))) as 2 | 3 | 4));
    },
    update(dt: number, pressed: ReadonlySet<string>, mouse: readonly [number, number], mode: InputMode) {
      const next = advanceCamera(state, pressed, dt, mouse, mode);
      if (next !== state && validState(next)) { state = next; dirty = true; onChange(state); }
      elapsed += dt;
      if (dirty && elapsed >= .1) { sync(); dirty = false; elapsed = 0; }
    }, dispose() {
    panel.removeEventListener('input', input);
    panel.removeEventListener('click', choose);
    panel.querySelector('#floor-preview')!.removeEventListener('click', floorPreview);
    panel.querySelector('#reset-camera')!.removeEventListener('click', reset);
    panel.querySelector('#reset-view')!.removeEventListener('click', resetView);
    viewport.removeEventListener('pointerdown', focus);
  } };
}
