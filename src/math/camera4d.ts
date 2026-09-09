import { transform, type Matrix4 } from './matrix4';
import { subtract, type Vec4 } from './vec4';

export interface Camera4D {
  position: Vec4;
  /** World-to-camera SO(4) rotation. Local +w is forward. */
  rotation: Matrix4;
}

export function worldToCamera(point: Vec4, camera: Camera4D): Vec4 {
  return transform(camera.rotation, subtract(point, camera.position));
}
