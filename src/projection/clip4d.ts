import type { Vec4 } from '../math/vec4';

export type ClippedSegment4D = readonly [Vec4, Vec4];

// Smallest representable number strictly greater than a positive finite near.
function nextUp(value: number): number {
  const data = new DataView(new ArrayBuffer(8));
  data.setFloat64(0, value);
  data.setBigUint64(0, data.getBigUint64(0) + 1n);
  return data.getFloat64(0);
}

/** Clip a camera-space segment to near < w <= far, preserving endpoint order. */
export function clipSegment4D(a: Vec4, b: Vec4, near: number, far: number): ClippedSegment4D | null {
  if (!Number.isFinite(near) || !Number.isFinite(far) || near <= 0 || far <= near) {
    throw new RangeError('Require finite 0 < near < far');
  }
  if (!a.every(Number.isFinite) || !b.every(Number.isFinite)) return null;
  const low = nextUp(near);
  if (Math.max(a[3], b[3]) < low || Math.min(a[3], b[3]) > far) return null;
  // Do not discard tiny but genuine crossings using an arbitrary epsilon.
  if (a[3] === b[3]) return [a, b];
  const intersection = (w: number): Vec4 => {
    const dw = b[3] - a[3];
    const scale = Math.max(Math.abs(a[3]), Math.abs(b[3]), Math.abs(w));
    const t = Number.isFinite(dw) ? (w - a[3]) / dw
      : (w / scale - a[3] / scale) / (b[3] / scale - a[3] / scale);
    const mix = (i: number) => (1 - t) * a[i] + t * b[i];
    return [mix(0), mix(1), mix(2), w];
  };
  const start = a[3] < low ? intersection(low) : a[3] > far ? intersection(far) : a;
  const end = b[3] < low ? intersection(low) : b[3] > far ? intersection(far) : b;
  return start.every(Number.isFinite) && end.every(Number.isFinite) ? [start, end] : null;
}
