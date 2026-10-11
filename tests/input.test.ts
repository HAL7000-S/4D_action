import { expect, it } from 'vitest';
import { advanceCamera, playerCodes, speeds, movement, createInputModel } from '../src/ui/inputMapping';
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
  expect(advanceCamera(state, new Set([playerCodes.positiveW]), 1, [30, 40], input.mode)).toBe(state);
  input.toggle(); input.addMouse(30, 40);
  const next = advanceCamera(state, new Set(), .5, input.takeMouse(), input.mode);
  expect(next.angles.XW).toBeCloseTo(30 * speeds.mouse);
  expect(next.angles.YW).toBeCloseTo(40 * speeds.mouse);
  expect(next.angles.XY).toBe(0); expect(next.angles.XZ).toBe(0); expect(next.angles.YZ).toBe(0);
});
it('integrates movement and mouse look independently of frame rate', () => {
  for (const fps of [30, 60, 144]) {
    let state = defaultState();
    for (let i = 0; i < fps; i++) state = advanceCamera(state, new Set([playerCodes.positiveW]), 1 / fps, [0, 0], 'camera4d');
    expect(state.position[3]).toBeCloseTo(-3 + speeds.camera4d, 10);
    for (let i = 0; i < fps; i++) state = advanceCamera(state, new Set(), 1 / fps, [100 / fps, 0], 'camera4d');
    expect(state.angles.XW).toBeCloseTo(100 * speeds.mouse, 10);
  }
});
it('maps local displacement through R transpose', () => {
  const state = defaultState(); state.angles.XW = Math.PI / 2;
  const next = advanceCamera(state, new Set([playerCodes.positiveW]), 1, [0, 0], 'camera4d');
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
  expect(movement(new Set(['KeyA', 'KeyD', 'Space', 'ShiftRight']))).toEqual([0, 0, 0, 0]);
});
it('key repeat never multiplies speed and touch release does not release a held keyboard key', () => {
  const input = createInputModel(); input.toggle();
  input.keyDown(playerCodes.positiveW); input.keyDown(playerCodes.positiveW, true); input.touch(1, playerCodes.positiveW); input.touch(1);
  expect(input.pressed.size).toBe(1);
  const next = advanceCamera(defaultState(), input.pressed, .5, [0, 0], input.mode);
  expect(next.position[3]).toBeCloseTo(-2); input.keyUp(playerCodes.positiveW); expect(input.pressed.size).toBe(0);
});
