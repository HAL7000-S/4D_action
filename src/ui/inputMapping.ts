import { constrainCameraPosition } from './roomBoundary';
import { composeRotation } from '../math/rotation4d';
import { activeAngles } from '../projection/playerCamera';
import type { Vec4 } from '../math/vec4';
import type { RotationAngles } from '../math/rotation4d';
import type { CameraState } from './state';

export const speeds = { observer: 5, camera4d: 2, mouse: .002 }; // units/sec, rad/pixel
export const codes = {
  toggle: 'Slash', dimensionDown: 'BracketLeft', dimensionUp: 'BracketRight', toggleView: 'KeyV',
  left: 'KeyA', right: 'KeyD', forward: 'KeyW', back: 'KeyS',
  up: 'Space', down: ['ShiftLeft', 'ShiftRight'], negativeZ: 'KeyQ', positiveZ: 'KeyE',
} as const;
// Player bindings are separate from the unchanged Observer bindings above.
export const playerCodes = {
  forward: 'KeyE', back: 'KeyD', left: 'KeyS', right: 'KeyF',
  negativeW: 'KeyA', positiveW: 'KeyZ', jump: 'Space',
} as const;
export function playerMovement(pressed: ReadonlySet<string>, dimension: 2 | 3 | 4): Vec4 {
  const has = (code: string) => Number(pressed.has(code));
  return [has(playerCodes.right) - has(playerCodes.left), 0,
    dimension >= 3 ? has(playerCodes.forward) - has(playerCodes.back) : 0,
    dimension === 4 ? has(playerCodes.positiveW) - has(playerCodes.negativeW) : 0];
}
/** Minimal facing: align the body's forward row with ground displacement, without smoothing. */
function faceMovement(state: CameraState, direction: Vec4): RotationAngles {
  const [x, , z, w] = direction;
  if (state.dimension === 2) return { ...state.angles, XY: x > 0 ? Math.PI / 2 : -Math.PI / 2 };
  if (state.dimension === 3) return { ...state.angles, XY: 0, YZ: 0, XZ: Math.atan2(x, z) };
  return { XY: 0, XZ: 0, YZ: 0, YW: 0, XW: Math.atan2(x, w), ZW: Math.atan2(z, Math.hypot(x, w)) };
}
export function movement(pressed: ReadonlySet<string>) {
  const has = (code: string) => Number(pressed.has(code));
  return [has(codes.right) - has(codes.left), has(codes.up) - Number(codes.down.some(c => pressed.has(c))),
    has(codes.positiveZ) - has(codes.negativeZ), has(codes.forward) - has(codes.back)] as const;
}
export function advanceCamera(state: CameraState, pressed: ReadonlySet<string>, dt: number, mouse: readonly [number, number], mode: InputMode): CameraState {
  if (mode !== 'camera4d') return state;
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
    // Ground movement uses the view's horizontal orientation only. Pitch/roll cannot move y.
    const horizontal = activeAngles(state, look);
    horizontal.XY = horizontal.YZ = horizontal.YW = 0;
    const r = composeRotation(horizontal);
    const scale = speeds.camera4d * dt / Math.max(1, Math.hypot(...move));
    const direction = [0,1,2,3].map(axis => r.reduce((sum, row, i) => sum + row[axis] * move[i], 0)) as unknown as Vec4;
    position = constrainCameraPosition(state.position.map((v, axis) => v + direction[axis] * scale) as unknown as Vec4);
    if (tps) angles = faceMovement(state, direction);
  }
  const lookChanged = Object.keys(look).some(p => look[p as keyof RotationAngles] !== previousLook[p as keyof RotationAngles]);
  if (position === state.position && !lookChanged) return state;
  return { ...state, position, angles, tpsLookAngles: tps ? look : state.tpsLookAngles };
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
      if (action) { if (!repeat && !keyboard.has(code)) { clear(); keyboard.add(code); actions.forEach(fn => fn(action)); } return; }
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

export function createInputState(viewport: HTMLElement) {
  const state = createInputModel();
  const abort = new AbortController(), options = { signal: abort.signal };
  const editing = (target: EventTarget | null) => target instanceof HTMLElement
    && (target.isContentEditable || !!target.closest('input,select,textarea,button,[contenteditable]:not([contenteditable="false"])'));
  const down = (e: KeyboardEvent) => {
    if (e.isComposing || e.metaKey || editing(e.target)) return;
    const allowed: readonly string[] = [...playerActions.map(a => codes[a]), codes.toggle, codes.left, codes.right, codes.forward, codes.back, codes.up, ...codes.down, codes.negativeZ, codes.positiveZ, ...Object.values(playerCodes)];
    if (!allowed.includes(e.code)) return;
    if (e.code !== codes.toggle && !document.pointerLockElement && !viewport.contains(document.activeElement)) return;
    e.preventDefault(); state.keyDown(e.code, e.repeat);
  };
  window.addEventListener('keydown', down, options);
  window.addEventListener('keyup', e => state.keyUp(e.code), options);
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
