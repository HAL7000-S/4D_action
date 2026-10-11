import { playerShape, playerBoundaries } from '../geometry/playerGeometry';
import { playerPose, projectPlayerWorld } from './playerCamera';
import type { CameraState } from '../ui/state';
import type { Vec4 } from '../math/vec4';

export function projectAvatar(state: CameraState) {
  const empty = () => ({ vertices: [], edges: [] });
  if (state.viewMode === 'fps') return [empty(), empty()];
  const shape = playerShape(state.dimension), pose = playerPose(state);
  // Player-local -> world uses R^T, independently of the trailing view camera.
  const vertices = shape.vertices.map(p => state.position.map((v, j) =>
    v + pose.rotation.reduce((sum, row, i) => sum + row[j] * p[i], 0)) as unknown as Vec4);
  const front = playerBoundaries(state.dimension).find(b => b.front)!;
  const frontEdges = new Set(front.edges.map(e => e.join(',')));
  return [false, true].map(red => projectPlayerWorld({ ...shape, vertices,
    edges: shape.edges.filter(e => frontEdges.has(e.join(',')) === red) }, state));
}

