import { inputMapping, type ObserverAction } from './inputMapping';

export function createTouchControls(root: HTMLElement, action4D: (key: string) => void, observer: (id: string, action?: ObserverAction) => void) {
  const moves = Object.values(inputMapping.observer);
  root.innerHTML = `<div class="pad pad3d"><strong>3D Move</strong>${moves.map(action => `<button data-move="${action}">${action}</button>`).join('')}</div>
  <div class="pad pad4d"><strong>4D Move / Rotate</strong>${Object.entries(inputMapping.camera4d).map(([key, [axis, sign]]) => `<button data-key="${key}">${'xyzw'[axis]}${sign > 0 ? '+' : '−'}</button>`).join('')}
  <button data-key="${inputMapping.planePrevious}">Plane −</button><button data-key="${inputMapping.planeNext}">Plane +</button>
  <button data-key="${inputMapping.rotateNegative}">Rotate −</button><button data-key="${inputMapping.rotatePositive.replaceAll("'", '&#39;')}">Rotate +</button></div>`;
  const abort = new AbortController(), options = { signal: abort.signal };
  const active = new Set<number>();
  root.addEventListener('pointerdown', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId); active.add(event.pointerId);
    if (button.dataset.move) observer(`touch-${event.pointerId}`, button.dataset.move as ObserverAction);
    else if (button.dataset.key) action4D(button.dataset.key);
  }, options);
  const end = (event: PointerEvent) => { observer(`touch-${event.pointerId}`); active.delete(event.pointerId); };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(name, end as EventListener, options);
  return () => { abort.abort(); for (const id of active) observer(`touch-${id}`); };
}
