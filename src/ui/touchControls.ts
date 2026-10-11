import type { MotionMode } from './playerMotion';
import type { PlayerDimension } from '../projection/playerCamera';
import { codes, playerCodes, lookCodes, type InputState } from './inputMapping';

export function createTouchControls(root: HTMLElement, input: InputState) {
  const button = (action: string, label: string) => `<button data-action="${action}">${label}</button>`;
  root.innerHTML = `<div class="pad pad3d"><button id="toggle-mode">Observer / Player</button><strong id="touch-mode"></strong>
    ${button('forward', 'Forward')}${button('back', 'Back')}
    ${button('left', 'Left')}${button('right', 'Right')}
    ${button('up', 'Up')}${button('down', 'Down')}</div>
    <div class="pad pad4d"><strong>Player look: drag canvas</strong>
    ${button('positiveZW', 'ZW +')}${button('negativeZW', 'ZW -')}${button('negativeW', '-z')}${button('positiveW', '+z')}</div>`;
  const abort = new AbortController(), options = { signal: abort.signal };
  let motionMode: MotionMode = 'flight';
  let dimension: PlayerDimension = 4;
  const sync = () => {
    root.querySelector('#touch-mode')!.textContent = input.mode === 'observer3d' ? '3D OBSERVER' : 'PLAYER';
    const player = input.mode === 'camera4d';
    const mapping: Record<string, string> = player ? { ...playerCodes, ...lookCodes, up: playerCodes.jump, down: motionMode === 'flight' ? codes.down[0] : '' }
      : { ...codes, down: codes.down[0], negativeW: '', positiveW: '' };
    root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
      const action = button.dataset.action!;
      button.dataset.code = mapping[action];
      button.disabled = !mapping[action] || (player && dimension !== 4 && ['negativeW','positiveW','positiveZW','negativeZW'].includes(action));
      if (action === 'up') button.textContent = player && motionMode === 'gravity' ? 'Jump' : 'Up';
    });
  };
  const unsubscribe = input.subscribe(sync); sync();
  root.querySelector('#toggle-mode')!.addEventListener('click', input.toggle, options);
  root.addEventListener('pointerdown', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-code]');
    if (!button || button.disabled) return;
    event.preventDefault(); button.setPointerCapture(event.pointerId);
    input.touch(event.pointerId, button.dataset.code);
  }, options);
  const end = (event: PointerEvent) => input.touch(event.pointerId);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(name, end as EventListener, options);
  return {
    setPlayerState(next: PlayerDimension, motion: MotionMode) { if (dimension !== next || motionMode !== motion) { dimension = next; motionMode = motion; sync(); } },
    dispose() { abort.abort(); unsubscribe(); input.clear(); },
  };
}
