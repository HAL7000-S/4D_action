import type { Vec4 } from '../math/vec4';
import { composeRotation, type RotationAngles } from '../math/rotation4d';
import type { Projection4D } from '../math/projection4d';
import type { Polytope4D } from '../geometry/polytope4d';
import { projectGeometry } from '../projection/projectedGeometry';

export const axes = ['x', 'y', 'z', 'w'] as const;
export const objectIds = ['room', 'tesseract', 'simplex'] as const;
export type ObjectId = typeof objectIds[number];
export interface CameraState {
  position: Vec4;
  angles: RotationAngles;
  projection: Projection4D;
  visible: Record<ObjectId, boolean>;
}
export const toRadians = (degrees: number) => degrees * (Math.PI / 180);
export const toDegrees = (radians: number) => radians * (180 / Math.PI);
export function defaultState(): CameraState {
  return { position: [0, 0, 0, -3], angles: { XY: 0, XZ: 0, XW: 0, YZ: 0, YW: 0, ZW: 0 },
    projection: { focalLength: 3, near: 2, far: 12 }, visible: { room: true, tesseract: true, simplex: true } };
}
export function resetCamera(state: CameraState): CameraState {
  return { ...defaultState(), visible: { ...state.visible } };
}
export function validState(state: CameraState): boolean {
  const { focalLength, near, far } = state.projection;
  return [...state.position, ...Object.values(state.angles), focalLength, near, far].every(Number.isFinite)
    && focalLength > 0 && near > 0 && far > near;
}
export function projectScene(objects: readonly { id: ObjectId; polytope: Polytope4D }[], state: CameraState) {
  const camera = { position: state.position, rotation: composeRotation(state.angles) };
  return objects.map(object => ({ id: object.id, geometry: state.visible[object.id]
    ? projectGeometry(object.polytope, camera, state.projection) : { vertices: [], edges: [] } }));
}
