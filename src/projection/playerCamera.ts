import { identity } from '../math/matrix4';
import { composeRotation } from '../math/rotation4d';
import { worldToCamera } from '../math/camera4d';
import type { Vec4 } from '../math/vec4';
import type { CameraState } from '../ui/state';
import { projectGeometry } from './projectedGeometry';
import type { Polytope4D } from '../geometry/polytope4d';

export type PlayerDimension = 2 | 3 | 4;
export type ViewMode = 'fps' | 'tps';
export function activeAngles(state: CameraState, a = state.angles) {
  return { XY: a.XY, XZ: state.dimension >= 3 ? a.XZ : 0, YZ: state.dimension >= 3 ? a.YZ : 0,
    XW: state.dimension === 4 ? a.XW : 0, YW: state.dimension === 4 ? a.YW : 0, ZW: state.dimension === 4 ? a.ZW : 0 };
}
export function playerPose(state: CameraState) {
  return { position: state.position, rotation: composeRotation(activeAngles(state)) };
}
export function playerViewCamera(state: CameraState) {
  const pose = { position: state.position, rotation: composeRotation(activeAngles(state, state.viewMode === 'tps' ? state.tpsLookAngles : state.angles)) };
  const distance = state.viewMode === 'tps' ? state.projection.near + 3 : 0;
  return { ...pose, position: pose.position.map((v, i) => v - pose.rotation[state.dimension - 1][i] * distance) as unknown as Vec4 };
}
/** Embed the intrinsic image in TV xyz; reuse the established depth clip/project contract. */
export function imageCoordinates(p: Vec4, dimension: PlayerDimension): Vec4 {
  return dimension === 4 ? p : dimension === 3 ? [p[0], p[1], 0, p[2]] : [p[0], 0, 0, p[1]];
}
export function projectPlayerWorld(geometry: Polytope4D, state: CameraState) {
  const playerCamera = playerViewCamera(state);
  if (state.dimension === 4) return projectGeometry(geometry, playerCamera, state.projection);
  const cameraGeometry = { ...geometry, vertices: geometry.vertices.map(p => imageCoordinates(worldToCamera(p, playerCamera), state.dimension)) };
  return projectGeometry(cameraGeometry, { position: [0,0,0,0], rotation: identity() }, state.projection);
}
