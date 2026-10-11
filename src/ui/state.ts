import type { Vec4 } from '../math/vec4';
import { type RotationAngles } from '../math/rotation4d';
import type { Projection4D } from '../math/projection4d';
import type { Polytope4D } from '../geometry/polytope4d';
import { projectPlayerWorld, playerViewCamera, type PlayerDimension, type ViewMode } from '../projection/playerCamera';
import { dimensionWorld } from '../geometry/playerGeometry';
import { filterBackCells, type VisibilityMode } from '../visibility/backCell';

export const axes = ['x', 'y', 'z', 'w'] as const;
export const objectIds = ['room', 'tesseract', 'simplex'] as const;
export type ObjectId = typeof objectIds[number];
export interface PlayerCamera {
  dimension: PlayerDimension;
  viewMode: ViewMode;
  position: Vec4;
  angles: RotationAngles;
  tpsLookAngles: RotationAngles;
  projection: Projection4D;
  visible: Record<ObjectId, boolean>;
  visibilityMode: VisibilityMode;
}
export type CameraState = PlayerCamera;
export const setDimension = (state: CameraState, dimension: PlayerDimension): CameraState => ({ ...state, dimension });
export const setViewMode = (state: CameraState, viewMode: ViewMode): CameraState => ({ ...state, viewMode,
  tpsLookAngles: viewMode === 'tps' && state.viewMode !== 'tps' ? { ...state.angles } : state.tpsLookAngles });
export const toRadians = (degrees: number) => degrees * (Math.PI / 180);
export const toDegrees = (radians: number) => radians * (180 / Math.PI);
export function defaultState(): CameraState {
  return { dimension: 4, viewMode: 'fps', position: [0, 0, 0, -3], angles: { XY: 0, XZ: 0, XW: 0, YZ: 0, YW: 0, ZW: 0 },
    tpsLookAngles: { XY: 0, XZ: 0, XW: 0, YZ: 0, YW: 0, ZW: 0 },
    projection: { focalLength: 3, near: 2, far: 12 }, visible: { room: true, tesseract: true, simplex: true }, visibilityMode: 'XRay' };
}
export function resetCamera(state: CameraState): CameraState {
  return { ...defaultState(), dimension: state.dimension, viewMode: state.viewMode, visible: { ...state.visible }, visibilityMode: state.visibilityMode };
}
/** Inspection shortcut; retains saved inactive angles and never rotates the TPS body. */
export function lookAtFloor(state: CameraState): CameraState {
  const look = { ...(state.viewMode === 'tps' ? state.tpsLookAngles : state.angles), XY: 0 };
  if (state.dimension === 2) look.XY = Math.PI;
  if (state.dimension >= 3) { look.XZ = 0; look.YZ = state.dimension === 3 ? -.35 : 0; }
  if (state.dimension === 4) { look.XW = 0; look.YW = -.35; look.ZW = 0; }
  return state.viewMode === 'tps' ? { ...state, tpsLookAngles: look } : { ...state, angles: look };
}
export function validState(state: CameraState): boolean {
  const { focalLength, near, far } = state.projection;
  return [...state.position, ...Object.values(state.angles), ...Object.values(state.tpsLookAngles), focalLength, near, far].every(Number.isFinite)
    && focalLength > 0 && near > 0 && far > near;
}
export function projectScene(objects: readonly { id: ObjectId; polytope: Polytope4D }[], state: CameraState) {
  const playerCamera = playerViewCamera(state);
  return objects.map(object => {
    const polytope = state.dimension === 4 ? object.polytope : dimensionWorld(object.id, state.dimension);
    return { id: object.id, geometry: state.visible[object.id]
      ? filterBackCells(polytope, projectPlayerWorld(polytope, state), playerCamera.position,
        object.id === 'room' || state.dimension !== 4 ? 'XRay' : state.visibilityMode) : { vertices: [], edges: [] } };
  });
}
