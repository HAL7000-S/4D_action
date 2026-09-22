export interface ProjectionVolumeState { h: number }
export const defaultVolume = (): ProjectionVolumeState => ({ h: 4 });
export function fov4D(h: number, focalLength: number): number {
  if (![h, focalLength].every(Number.isFinite) || h <= 0 || focalLength <= 0) throw new RangeError('Require finite h, f > 0');
  return 2 * Math.atan(h / focalLength);
}
export const observerRoomHalfSize = 16;
export function clampObserver(value: number): number {
  return Math.max(-observerRoomHalfSize + .2, Math.min(observerRoomHalfSize - .2, value));
}
