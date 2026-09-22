export const inputMapping = {
  observer: { w: 'forward', s: 'back', a: 'left', d: 'right', q: 'down', e: 'up' },
  camera4d: { j: [0, -1], l: [0, 1], i: [1, 1], k: [1, -1], u: [2, -1], o: [2, 1], n: [3, -1], m: [3, 1] },
  planePrevious: '[', planeNext: ']', rotateNegative: ';', rotatePositive: "'",
} as const;
export type ObserverAction = typeof inputMapping.observer[keyof typeof inputMapping.observer];
export function acceptsKey(event: KeyboardEvent): boolean {
  return !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && !event.isComposing
    && !(event.target instanceof HTMLElement && event.target.closest('input,select,textarea,button,[contenteditable=true]'));
}
