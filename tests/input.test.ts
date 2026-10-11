import { expect, it } from 'vitest';
import { advanceCamera, codes, playerCodes, speeds, movement, createInputModel } from '../src/ui/inputMapping';
import { defaultState } from '../src/ui/state';

it('starts in observer3d and toggles once per Slash press', () => {
  const input = createInputModel();
  expect(input.mode).toBe('observer3d');
  input.keyDown('KeyW'); input.keyDown('Slash');
  expect(input.mode).toBe('camera4d'); expect(input.pressed.has('KeyW')).toBe(false);
  input.keyDown('Slash', true); input.keyDown('Slash');
  expect(input.mode).toBe('camera4d');
  input.keyUp('Slash'); input.keyDown('Slash'); expect(input.mode).toBe('observer3d');
});
it('does not toggle while editing', () => {
  const input = createInputModel(); input.keyDown('Slash', false, true);
  expect(input.mode).toBe('observer3d'); expect(input.pressed.size).toBe(0);
});
it('clears keyboard, touch and mouse state on mode switch and safety clear', () => {
  const input = createInputModel(); input.toggle();
  input.keyDown('KeyW'); input.touch(1, 'KeyA'); input.addMouse(5, 6); input.toggle();
  expect(input.pressed.size).toBe(0); expect(input.takeMouse()).toEqual([0, 0]);
  input.toggle(); input.keyDown('KeyW'); input.addMouse(1, 2); input.clear();
  expect(input.mode).toBe('camera4d'); expect(input.pressed.size).toBe(0); expect(input.takeMouse()).toEqual([0, 0]);
});
it('isolates mouse and movement ownership by mode', () => {
  const input = createInputModel(), state = defaultState();
  input.addMouse(30, 40); expect(input.takeMouse()).toEqual([0, 0]);
  expect(advanceCamera(state, new Set([playerCodes.forward]), 1, [30, 40], input.mode)).toBe(state);
  input.toggle(); input.addMouse(30, 40);
  const next = advanceCamera(state, new Set(), .5, input.takeMouse(), input.mode);
  expect(next.angles.XW).toBeCloseTo(30 * speeds.mouse);
  expect(next.angles.YW).toBeCloseTo(-40 * speeds.mouse);
  expect(next.angles.XY).toBe(0); expect(next.angles.XZ).toBe(0); expect(next.angles.YZ).toBe(0);
});
it('integrates movement and mouse look independently of frame rate', () => {
  for (const fps of [30, 60, 144]) {
    let state = defaultState();
    for (let i = 0; i < fps; i++) state = advanceCamera(state, new Set([playerCodes.forward]), 1 / fps, [0, 0], 'camera4d');
    expect(state.position[3]).toBeCloseTo(-3 + speeds.camera4d, 10);
    for (let i = 0; i < fps; i++) state = advanceCamera(state, new Set(), 1 / fps, [100 / fps, 0], 'camera4d');
    expect(state.angles.XW).toBeCloseTo(100 * speeds.mouse, 10);
  }
});
it('maps local displacement through R transpose', () => {
  const state = defaultState(); state.angles.XW = Math.PI / 2;
  const next = advanceCamera(state, new Set([playerCodes.forward]), 1, [0, 0], 'camera4d');
  expect(next.position[0]).toBeCloseTo(2, 12); expect(next.position[3]).toBeCloseTo(-3, 12);
  expect(state.position).toEqual([0, 0, 0, -3]);
});
it('combines local z and w movement without keyboard rotation', () => {
  const next = advanceCamera(defaultState(), new Set([playerCodes.forward, playerCodes.positiveW]), .5, [0, 0], 'camera4d');
  expect(next.position[2]).toBeCloseTo(Math.SQRT1_2); expect(next.position[3]).toBeCloseTo(-3 + Math.SQRT1_2);
  expect(next.angles).toEqual(defaultState().angles);
});
it('both shifts mean down only; opposing movement cancels', () => {
  expect(movement(new Set(['ShiftLeft']))[1]).toBe(-1);
  expect(movement(new Set(['ShiftRight']))[1]).toBe(-1);
  expect(movement(new Set(['ShiftLeft', 'ShiftRight']))[1]).toBe(-1);
  expect(movement(new Set(['KeyS', 'KeyF', 'Space', 'ShiftRight']))).toEqual([0, 0, 0, 0]);
});
it('key repeat never multiplies speed and touch release does not release a held keyboard key', () => {
  const input = createInputModel(); input.toggle();
  input.keyDown(playerCodes.forward); input.keyDown(playerCodes.forward, true); input.touch(1, playerCodes.forward); input.touch(1);
  expect(input.pressed.size).toBe(1);
  const next = advanceCamera(defaultState(), input.pressed, .5, [0, 0], input.mode);
  expect(next.position[3]).toBeCloseTo(-2); input.keyUp(playerCodes.forward); expect(input.pressed.size).toBe(0);
});

it('maps bracket characters ahead of physical codes for JIS and US layouts', async () => {
  const { shortcutCode } = await import('../src/ui/inputMapping');
  expect(shortcutCode('BracketRight','[')).toBe('BracketLeft');
  expect(shortcutCode('Backslash',']')).toBe('BracketRight');
  expect(shortcutCode('BracketLeft','')).toBe('BracketLeft');
});
it('preserves held movement across view and dimension actions', () => {
  const input = createInputModel(); input.toggle(); input.keyDown(playerCodes.forward);
  input.touch(7, playerCodes.right); input.keyDown(codes.toggleView);
  expect(input.pressed.has(playerCodes.forward)).toBe(true);
  expect(input.pressed.has(playerCodes.right)).toBe(true);
});
it('keeps an orthonormal 4D ground frame and optical forward after mixed rotations', async () => {
  const { groundBasis } = await import('../src/ui/inputMapping');
  const { composeRotation } = await import('../src/math/rotation4d');
  const state = defaultState(); state.angles = { XY:.4,XZ:.6,XW:.8,YZ:.3,YW:.9,ZW:1.1 };
  const basis = groundBasis(state,state.angles);
  for (const i of [0,2,3]) for (const j of [0,2,3]) expect(basis[i].reduce((s,v,a) => s+v*basis[j][a],0)).toBeCloseTo(Number(i===j),10);
  const optical = composeRotation(state.angles)[3].map((v,i) => i===1 ? 0 : v);
  basis[3].forEach((v,i) => expect(v).toBeCloseTo(optical[i]/Math.hypot(...optical),10));
  const moved = advanceCamera(state,new Set([playerCodes.forward]),.1,[0,0],'camera4d');
  moved.position.forEach((v,i) => expect(v-state.position[i]).toBeCloseTo(.2*basis[3][i],10));
});
it('retains last horizontal forward at a vertical pole and rejects invalid deltas', () => {
  let state = defaultState(); state.angles.XW=.7;
  state = advanceCamera(state,new Set(),.1,[0,1],'camera4d');
  const last = state.groundForward!; state = {...state, angles:{...state.angles,YW:Math.PI/2}};
  const moved = advanceCamera(state,new Set([playerCodes.forward]),.1,[0,0],'camera4d');
  moved.position.forEach((v,i) => expect(v-state.position[i]).toBeCloseTo(.2*last[i],9));
  expect(advanceCamera(state,new Set(),Infinity,[0,0],'camera4d')).toBe(state);
  expect(advanceCamera(state,new Set(),.1,[NaN,0],'camera4d')).toBe(state);
});
it('TPS facing follows the shortest turn at consistent rates and stops on release', async () => {
  const { setViewMode, setDimension } = await import('../src/ui/state');
  const { playerPose } = await import('../src/projection/playerCamera');
  for (const dimension of [3,4] as const) {
    const results = [30,60,144].map(fps => {
      let state = setViewMode(setDimension(defaultState(),dimension),'tps');
      for (let i=0;i<fps;i++) state=advanceCamera(state,new Set([playerCodes.right]),1/fps,[0,0],'camera4d');
      expect(advanceCamera(state,new Set(),.1,[0,0],'camera4d').angles).toEqual(state.angles);
      return playerPose(state).rotation;
    });
    results[0].forEach((row,i) => row.forEach((v,j) => expect(v).toBeCloseTo(results[2][i][j],9)));
  }
});
