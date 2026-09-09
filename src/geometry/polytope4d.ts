import type { Vec4 } from '../math/vec4';

export type Edge4D = readonly [number, number];
/** Vertex indices in boundary order; winding is not an outward-normal convention. */
export type Face4D = readonly number[];
export interface Cell4D {
  readonly vertices: readonly number[];
  /** Indices into the polytope's faces array. */
  readonly faces: readonly number[];
}
export interface Polytope4D {
  readonly vertices: readonly Vec4[];
  readonly edges: readonly Edge4D[];
  readonly faces: readonly Face4D[];
  readonly cells: readonly Cell4D[];
}
