import type { CameraState } from '../ui/state';
import type { Camera4D } from '../math/camera4d';
import { projectWorldAxes, worldAxes } from './basisAxes';
import { projectPlayerWorld } from './playerCamera';
import { projectPoint } from '../math/projection4d';
import { worldToCamera } from '../math/camera4d';
import { imageCoordinates } from './playerCamera';

export function projectPlayerAxes(state: CameraState, playerCamera: Camera4D) {
  if (state.dimension === 4) return projectWorldAxes(playerCamera, state.projection);
  return worldAxes().map((axis, i) => {
    if (i >= state.dimension) return null;
    const geometry = projectPlayerWorld({ vertices: [axis.negative, axis.positive], edges: [[0,1]], faces: [], cells: [] }, state);
    const edge = geometry.edges[0];
    return edge ? { start: edge.start, end: edge.end,
      positive: projectPoint(imageCoordinates(worldToCamera(axis.positive, playerCamera), state.dimension), state.projection) } : null;
  });
}
