import type { Cell4D, Polytope4D } from './polytope4d';
import { createTesseract } from './tesseract';

export type RoomAxis = 'x' | 'y' | 'z' | 'w';
export interface RoomCell4D extends Cell4D {
  readonly boundary: { readonly axis: RoomAxis; readonly sign: -1 | 1 };
}
export interface Room4D extends Polytope4D {
  readonly cells: readonly RoomCell4D[];
}

export function createRoom4D(L = 5): Room4D {
  if (!Number.isFinite(L) || L <= 0) throw new RangeError('Require finite L > 0');
  const polytope = createTesseract(2 * L);
  const axes: readonly RoomAxis[] = ['x', 'y', 'z', 'w'];
  return {
    ...polytope,
    // Derive metadata from the fixed coordinate rather than relying on cell order.
    cells: polytope.cells.map(cell => {
      const axis = axes.findIndex((_, a) => cell.vertices.every(i =>
        polytope.vertices[i][a] === polytope.vertices[cell.vertices[0]][a]));
      return { ...cell, boundary: { axis: axes[axis], sign: polytope.vertices[cell.vertices[0]][axis] > 0 ? 1 : -1 } };
    }),
  };
}
