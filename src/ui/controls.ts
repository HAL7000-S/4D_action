import { planes, type RotationPlane } from '../math/rotation4d';
import type { Projection4D } from '../math/projection4d';
import { axes, objectIds, defaultState, resetCamera, toDegrees, toRadians, validState, type CameraState, type ObjectId } from './state';

import { inputMapping, acceptsKey } from './inputMapping';

export function createControls(panel: HTMLElement, viewport: HTMLElement, onChange: (state: CameraState) => void, resetView: () => void) {
  let state = defaultState();
  let plane: RotationPlane = 'XW';
  const field = (group: string, name: string, step: number) => `<label>${name}<input type="number" step="${step}" data-group="${group}" name="${name}"></label>`;
  panel.innerHTML = `<h2>4D Camera</h2>
    <fieldset><legend>Position（世界座標）</legend>${axes.map(a => field('position', a, .1)).join('')}</fieldset>
    <fieldset><legend>Rotation（degree）</legend>${planes.map(p => field('rotation', p, 1)).join('')}</fieldset>
    <fieldset><legend>Projection</legend>${['focalLength', 'near', 'far'].map(p => field('projection', p, .1)).join('')}</fieldset>
    <fieldset><legend>Visibility</legend>${objectIds.map(id => `<label>${id}<input type="checkbox" name="${id}" data-group="visible"></label>`).join('')}</fieldset>
    <p class="error" role="status" id="input-error"></p>
    <button type="button" id="reset-camera">Reset 4D Camera</button>
    <button type="button" id="reset-view">Reset 3D Observer</button>
    <fieldset><legend>4D keys</legend>
    <label>Plane<select id="key-plane">${planes.map(p => `<option>${p}</option>`).join('')}</select></label>
    <p>J/L: x ?/+ ? I/K: y +/? ? U/O: z ?/+ ? N/M: w ?/+<br>[ / ]: plane ? ; / ': rotation ?/+</p></fieldset>
    <output id="camera-diagnostic"></output>`;
  const inputs = Array.from(panel.querySelectorAll<HTMLInputElement>('input'));
  const error = panel.querySelector<HTMLElement>('#input-error')!;
  const planeSelect = panel.querySelector<HTMLSelectElement>('#key-plane')!;
  const sync = () => {
    for (const input of inputs) {
      const group = input.dataset.group;
      input.setCustomValidity('');
      if (group === 'visible') input.checked = state.visible[input.name as ObjectId];
      else {
        const value = group === 'position' ? state.position[axes.indexOf(input.name as typeof axes[number])]
          : group === 'rotation' ? toDegrees(state.angles[input.name as RotationPlane]) : state.projection[input.name as keyof Projection4D];
        input.value = String(Number(value.toPrecision(12)));
      }
    }
    error.textContent = '';
    planeSelect.value = plane;
    panel.querySelector<HTMLOutputElement>('#camera-diagnostic')!.textContent =
      `Position (${state.position.map(v => v.toFixed(3)).join(', ')})\n` + planes.map(p => `${p}: ${toDegrees(state.angles[p]).toFixed(2)}°`).join(' / ');
  };
  const commit = (next: CameraState) => { state = next; sync(); onChange(state); };
  const input = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const next: CameraState = { ...state, position: [...state.position], angles: { ...state.angles }, projection: { ...state.projection }, visible: { ...state.visible } };
    const group = target.dataset.group, value = target.valueAsNumber;
    if (group === 'visible') next.visible[target.name as ObjectId] = target.checked;
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
    if (group !== 'visible') target.value = draft;
  };
  const select = () => { plane = planeSelect.value as RotationPlane; };
  const action = (key: string) => {
    if (key === inputMapping.planeNext || key === inputMapping.planePrevious) {
      plane = planes[(planes.indexOf(plane) + (key === inputMapping.planeNext ? 1 : 5)) % 6]; sync(); return;
    }
    const next = { ...state, angles: { ...state.angles } };
    const movement = inputMapping.camera4d[key as keyof typeof inputMapping.camera4d];
    if (movement) {
      const position = [...state.position] as [number, number, number, number];
      position[movement[0]] += movement[1] * .1; next.position = position;
    } else if (key === inputMapping.rotateNegative || key === inputMapping.rotatePositive) {
      next.angles[plane] += toRadians(key === inputMapping.rotatePositive ? 5 : -5);
    } else return;
    if (validState(next)) commit(next);
  };
  const keyboard = (event: KeyboardEvent) => {
    if (!acceptsKey(event) || (!document.pointerLockElement && !viewport.contains(document.activeElement))) return;
    const key = event.key.toLowerCase();
    if (!(key in inputMapping.camera4d) && ![inputMapping.planeNext, inputMapping.planePrevious, inputMapping.rotateNegative, inputMapping.rotatePositive].some(k => k === key)) return;
    event.preventDefault(); action(key);
  };
  const focus = () => viewport.focus({ preventScroll: true });
  const reset = () => commit(resetCamera(state));
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', 'Main View。Mで移動・回転切替、角括弧で対象切替、上下矢印で4Dカメラ操作');
  panel.addEventListener('input', input);
  panel.addEventListener('change', select);
  panel.querySelector('#reset-camera')!.addEventListener('click', reset);
  panel.querySelector('#reset-view')!.addEventListener('click', resetView);
  viewport.addEventListener('pointerdown', focus);
  window.addEventListener('keydown', keyboard);
  sync(); onChange(state);
  return { action, dispose() {
    panel.removeEventListener('input', input); panel.removeEventListener('change', select);
    panel.querySelector('#reset-camera')!.removeEventListener('click', reset);
    panel.querySelector('#reset-view')!.removeEventListener('click', resetView);
    viewport.removeEventListener('pointerdown', focus); window.removeEventListener('keydown', keyboard);
  } };
}
