import { constrainCameraPosition } from './roomBoundary';
import { composeRotation } from '../math/rotation4d';
import { activeAngles } from '../projection/playerCamera';
import type { Vec4 } from '../math/vec4';
import type { RotationAngles } from '../math/rotation4d';
import type { CameraState } from './state';

export const speeds = { observer: 5, camera4d: 2, mouse: .002 }; // units/sec, rad/pixel
export const codes = {
  toggle: 'Slash', dimensionDown: 'BracketLeft', dimensionUp: 'BracketRight', toggleView: 'KeyV',
  left: 'KeyS', right: 'KeyF', forward: 'KeyE', back: 'KeyD',
  up: 'Space', down: ['ShiftLeft', 'ShiftRight'],
} as const;
// Input owner selects Observer or Player behavior for the shared ESDF keys.
export const playerCodes = {
  forward: 'KeyE', back: 'KeyD', left: 'KeyS', right: 'KeyF',
  negativeW: 'KeyA', positiveW: 'KeyZ', jump: 'Space',
} as const;
export function playerMovement(pressed: ReadonlySet<string>, dimension: 2 | 3 | 4): Vec4 {
  const has = (code: string) => Number(pressed.has(code));
  const forward = has(playerCodes.forward) - has(playerCodes.back);
  return [has(playerCodes.right) - has(playerCodes.left) + (dimension === 2 ? forward : 0), 0,
    dimension === 3 ? forward : dimension === 4 ? has(playerCodes.positiveW) - has(playerCodes.negativeW) : 0,
    dimension === 4 ? forward : 0];
}
export const facingResponse = 10;
const dot = (a: Vec4, b: Vec4) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const unit = (v: Vec4): Vec4 => v.map(x => x / Math.hypot(...v)) as unknown as Vec4;
/** Optical forward projected onto the ground, with a saved pole fallback. */
export function groundBasis(state: CameraState, look: RotationAngles): Vec4[] {
  const r = composeRotation(activeAngles(state, look));
  const ground = (v: readonly number[]): Vec4 => [v[0], 0, state.dimension >= 3 ? v[2] : 0, state.dimension === 4 ? v[3] : 0];
  let forward = ground(r[state.dimension - 1]);
  if (Math.hypot(...forward) < 1e-8) forward = ground(state.groundForward ?? [0,0,0,0]);
  if (Math.hypot(...forward) < 1e-8) forward = state.dimension === 3 ? [0,0,1,0] : [0,0,0,1];
  forward = unit(forward);
  const orthogonal = (v: Vec4, basis: Vec4[]) => basis.reduce((out, b) => out.map((x,i) => x - dot(out,b)*b[i]) as unknown as Vec4, v);
  let right = orthogonal(ground(r[0]), [forward]);
  if (Math.hypot(...right) < 1e-8) {
    right = [0,2,3].map(i => orthogonal(ground([0,1,2,3].map(a => Number(a === i))), [forward])).sort((a,b) => Math.hypot(...b)-Math.hypot(...a))[0];
  }
  right = unit(right);
  if (state.dimension === 3) return [right, [0,0,0,0], forward, [0,0,0,0]];
  // Complete the oriented horizontal frame in (x,z,w).
  const third: Vec4 = [forward[2]*right[3]-forward[3]*right[2], 0,
    forward[3]*right[0]-forward[0]*right[3], forward[0]*right[2]-forward[2]*right[0]];
  return [right, [0,0,0,0], third, forward];
}
function faceMovement(state: CameraState, direction: Vec4, dt: number): RotationAngles {
  const target = unit(direction), alpha = -Math.expm1(-facingResponse * dt);
  if (state.dimension === 2) return { ...state.angles, XY: target[0] > 0 ? Math.PI / 2 : -Math.PI / 2 };
  if (state.dimension === 3) {
    const yaw = Math.atan2(target[0], target[2]);
    const delta = Math.atan2(Math.sin(yaw-state.angles.XZ), Math.cos(yaw-state.angles.XZ));
    return { ...state.angles, XY: 0, YZ: 0, XZ: state.angles.XZ + alpha*delta };
  }
  const angles = { ...state.angles, XY: 0, YZ: 0, YW: 0 };
  const r = composeRotation(angles), from = r[3];
  let axis: Vec4 = [from[2]*target[3]-from[3]*target[2],0,from[3]*target[0]-from[0]*target[3],from[0]*target[2]-from[2]*target[0]];
  const cosine = Math.max(-1, Math.min(1, dot(from,target)));
  if (Math.hypot(...axis) < 1e-8) {
    if (cosine > 0) return angles;
    axis = r[0]; // deterministic minimal half-turn at the antipode
  }
  axis = unit(axis);
  const theta = Math.acos(cosine)*alpha, c = Math.cos(theta), sn = Math.sin(theta);
  const rows = r.map(v => {
    const cross = [axis[2]*v[3]-axis[3]*v[2],0,axis[3]*v[0]-axis[0]*v[3],axis[0]*v[2]-axis[2]*v[0]];
    return v.map((x,i) => x*c + cross[i]*sn + axis[i]*dot(axis,v)*(1-c));
  });
  const b = Math.asin(Math.max(-1, Math.min(1, -rows[0][3])));
  const pole = Math.abs(Math.cos(b)) < 1e-8;
  return { ...angles, XW: b, XZ: pole ? 0 : Math.atan2(-rows[0][2],rows[0][0]),
    ZW: pole ? Math.atan2(rows[3][2],rows[2][2]) : Math.atan2(-rows[2][3],rows[3][3]) };
}
export function movement(pressed: ReadonlySet<string>) {
  const has = (code: string) => Number(pressed.has(code));
  return [has(codes.right) - has(codes.left), has(codes.up) - Number(codes.down.some(c => pressed.has(c))),
    0, has(codes.forward) - has(codes.back)] as const;
}
export function advanceCamera(state: CameraState, pressed: ReadonlySet<string>, dt: number, mouse: readonly [number, number], mode: InputMode): CameraState {
  if (mode !== 'camera4d' || !Number.isFinite(dt) || !mouse.every(Number.isFinite) || !Object.values(state.viewMode === 'tps' ? state.tpsLookAngles : state.angles).every(Number.isFinite)) return state;
  const tps = state.viewMode === 'tps';
  const previousLook = tps ? state.tpsLookAngles : state.angles;
  const look = { ...previousLook };
  if (state.dimension === 2) look.XY += mouse[0] * speeds.mouse;
  else if (state.dimension === 3) { look.XZ += mouse[0] * speeds.mouse; look.YZ += mouse[1] * speeds.mouse; }
  else { look.XW += mouse[0] * speeds.mouse; look.YW += mouse[1] * speeds.mouse; }
  let angles = tps ? state.angles : look;
  let position = state.position;
  const move = playerMovement(pressed, state.dimension);
  if (dt > 0 && move.some(v => v !== 0)) {
    const basis = state.dimension === 2 ? [[1,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]] : groundBasis(state, look);
    const scale = speeds.camera4d * dt / Math.max(1, Math.hypot(...move));
    const direction = [0,1,2,3].map(axis => basis.reduce((sum, row, i) => sum + row[axis] * move[i], 0)) as unknown as Vec4;
    position = constrainCameraPosition(state.position.map((v, axis) => v + direction[axis] * scale) as unknown as Vec4);
    if (tps) angles = faceMovement(state, direction, dt);
  }
  const lookChanged = Object.keys(look).some(p => look[p as keyof RotationAngles] !== previousLook[p as keyof RotationAngles]);
  if (position === state.position && !lookChanged) return state;
  return { ...state, position, angles, tpsLookAngles: tps ? look : state.tpsLookAngles, groundForward: state.dimension >= 3 ? groundBasis(state, look)[state.dimension - 1] : state.groundForward };
}

export type PlayerAction = 'dimensionDown' | 'dimensionUp' | 'toggleView';
const playerActions: readonly PlayerAction[] = ['dimensionDown', 'dimensionUp', 'toggleView'];
export type InputMode = 'observer3d' | 'camera4d';

/** DOM-independent state shared by keyboard, touch and the animation loop. */
export function createInputModel() {
  let mode: InputMode = 'observer3d';
  const keyboard = new Set<string>();
  const touches = new Map<number, string>();
  let dx = 0, dy = 0;
  const actions = new Set<(action: PlayerAction) => void>();
  const listeners = new Set<() => void>();
  const clear = () => { keyboard.clear(); touches.clear(); dx = dy = 0; };
  const toggle = () => { clear(); mode = mode === 'observer3d' ? 'camera4d' : 'observer3d'; listeners.forEach(fn => fn()); };
  return {
    get mode() { return mode; },
    get pressed(): ReadonlySet<string> { return new Set([...keyboard, ...touches.values()]); },
    clear, toggle,
    subscribeAction(fn: (action: PlayerAction) => void) { actions.add(fn); return () => { actions.delete(fn); }; },
    keyDown(code: string, repeat = false, editing = false) {
      if (editing) return;
      const action = playerActions.find(a => codes[a] === code);
      if (action) { if (!repeat && !keyboard.has(code)) { keyboard.add(code); actions.forEach(fn => fn(action)); } return; }
      if (code === codes.toggle) { if (!repeat && !keyboard.has(code)) { toggle(); keyboard.add(code); } }
      else keyboard.add(code);
    },
    keyUp(code: string) { keyboard.delete(code); },
    touch(id: number, code?: string) { if (code) touches.set(id, code); else touches.delete(id); },
    addMouse(x: number, y: number) { if (mode === 'camera4d') { dx += x; dy += y; } },
    takeMouse(): [number, number] { const delta: [number, number] = [dx, dy]; dx = dy = 0; return delta; },
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
}
export type InputState = ReturnType<typeof createInputModel>;

export function shortcutCode(code: string, key: string): string {
  if (key === '[') return codes.dimensionDown;
  if (key === ']') return codes.dimensionUp;
  return code;
}
export function createInputState(viewport: HTMLElement) {
  const state = createInputModel();
  const abort = new AbortController(), options = { signal: abort.signal };
  const editing = (target: EventTarget | null) => target instanceof HTMLElement
    && (target.isContentEditable || !!target.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])'));
  const down = (e: KeyboardEvent) => {
    if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || editing(e.target)) return;
    const code = shortcutCode(e.code, e.key);
    const allowed: readonly string[] = [...playerActions.map(a => codes[a]), codes.toggle, codes.left, codes.right, codes.forward, codes.back, codes.up, ...codes.down, ...Object.values(playerCodes)];
    if (!allowed.includes(code)) return;
    if (![codes.toggle, ...playerActions.map(a => codes[a])].includes(code as typeof codes.toggle) && !document.pointerLockElement && !viewport.contains(document.activeElement)) return;
    e.preventDefault(); state.keyDown(code, e.repeat);
  };
  window.addEventListener('keydown', down, options);
  window.addEventListener('keyup', e => state.keyUp(shortcutCode(e.code, e.key)), options);
  window.addEventListener('blur', state.clear, options);
  document.addEventListener('visibilitychange', state.clear, options);
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) state.clear(); }, options);
  document.addEventListener('focusin', e => { if (editing(e.target)) state.clear(); }, options);
  // Capture before PointerLockControls: current mode alone selects mouse ownership.
  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement && state.mode === 'camera4d') {
      state.addMouse(e.movementX, e.movementY); e.stopImmediatePropagation();
    }
  }, { ...options, capture: true });
  return Object.assign(state, { dispose() { state.clear(); abort.abort(); } });
}
