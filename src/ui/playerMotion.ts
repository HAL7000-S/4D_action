import type { CameraState } from './state';
import type { Vec4 } from '../math/vec4';
import { roomHalfExtent } from './roomBoundary';
import { floorY } from '../geometry/grayFloor';

export type MotionMode = 'flight' | 'gravity';
// Player position is its center; feet are center.y - halfExtent.y.
export const playerHalfExtent: Vec4 = [.4, .4, .4, .4];
export const gravityAcceleration = 9;
export const jumpSpeed = 5;
export const physicsStep = 1 / 120;
export const feetHeight = (state: CameraState) => state.position[1] - playerHalfExtent[1];
export function correctPlayerContact(state: CameraState): CameraState {
  if (state.motionMode !== 'gravity') return state;
  const position = state.position.map((v, i) => i < state.dimension
    ? Math.max((i === 1 ? floorY : -roomHalfExtent) + playerHalfExtent[i], Math.min(roomHalfExtent - playerHalfExtent[i], v)) : v) as unknown as Vec4;
  const grounded = position[1] <= floorY + playerHalfExtent[1] + 1e-9;
  const ceiling = position[1] >= roomHalfExtent - playerHalfExtent[1] - 1e-9;
  const verticalVelocity = (grounded && state.verticalVelocity < 0) || (ceiling && state.verticalVelocity > 0) ? 0 : state.verticalVelocity;
  return { ...state, position, grounded, verticalVelocity };
}
export function setMotionMode(state: CameraState, motionMode: MotionMode): CameraState {
  if (motionMode === state.motionMode) return state;
  // Require a release before accepting a jump after a mode change.
  return correctPlayerContact({ ...state, motionMode, verticalVelocity: 0, grounded: false, jumpHeld: true });
}
export function advancePlayerMotion(state: CameraState, dt: number, jump: boolean): CameraState {
  if (!Number.isFinite(dt) || dt <= 0) return state;
  if (state.motionMode !== 'gravity') return state;
  let next = correctPlayerContact(state);
  let velocity = next.verticalVelocity;
  if (jump && !next.jumpHeld && next.grounded) velocity = jumpSpeed;
  next = { ...next, jumpHeld: jump, verticalVelocity: velocity };
  // Bound catch-up time; analytic constant acceleration within small contact steps.
  let remaining = Math.min(dt, .25);
  while (remaining > 1e-10) {
    const step = Math.min(remaining, physicsStep);
    const y = next.position[1] + next.verticalVelocity * step - .5 * gravityAcceleration * step * step;
    next = correctPlayerContact({ ...next, position: [next.position[0], y, next.position[2], next.position[3]],
      verticalVelocity: next.verticalVelocity - gravityAcceleration * step });
    remaining -= step;
  }
  return next;
}
