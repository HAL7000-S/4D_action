import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { inputMapping, acceptsKey, type ObserverAction } from '../ui/inputMapping';
import { clampObserver } from '../ui/observerState';

export function createObserver(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
  const controls = new PointerLockControls(camera, canvas);
  const held = new Map<string, ObserverAction>();
  const reset = () => { camera.position.set(8, 5, 11); camera.lookAt(0, 0, 0); held.clear(); };
  reset();
  let drag: { id: number; x: number; y: number } | undefined;
  const down = (e: PointerEvent) => {
    canvas.focus();
    if (e.pointerType === 'mouse') {
      if (!controls.isLocked && e.button === 0) controls.lock();
    } else if (!drag) { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); }
  };
  const move = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const rotation = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    rotation.y -= (e.clientX - drag.x) * .003;
    rotation.x = Math.max(-Math.PI / 2 + .01, Math.min(Math.PI / 2 - .01, rotation.x - (e.clientY - drag.y) * .003));
    camera.quaternion.setFromEuler(rotation);
    drag.x = e.clientX; drag.y = e.clientY;
  };
  const up = (e: PointerEvent) => { if (drag?.id === e.pointerId) drag = undefined; };
  const keydown = (e: KeyboardEvent) => {
    if (!acceptsKey(e) || (!controls.isLocked && document.activeElement !== canvas)) return;
    const action = inputMapping.observer[e.key.toLowerCase() as keyof typeof inputMapping.observer];
    if (action) { e.preventDefault(); held.set(e.code, action); }
  };
  const keyup = (e: KeyboardEvent) => { held.delete(e.code); };
  const clear = () => { held.clear(); drag = undefined; };
  const abort = new AbortController(), options = { signal: abort.signal };
  canvas.tabIndex = 0;
  canvas.addEventListener('pointerdown', down, options);
  canvas.addEventListener('pointermove', move, options);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, up as EventListener, options);
  window.addEventListener('keydown', keydown, options); window.addEventListener('keyup', keyup, options);
  window.addEventListener('blur', clear, options); document.addEventListener('visibilitychange', clear, options);
  controls.addEventListener('unlock', clear);
  const error = () => { canvas.setAttribute('aria-label', 'Pointer Lockを開始できません。再度クリックしてください。'); };
  document.addEventListener('pointerlockerror', error, options);
  return {
    reset,
    setAction(id: string, action?: ObserverAction) { if (action) held.set(id, action); else held.delete(id); },
    tick(dt: number) {
      let forward = 0, right = 0, vertical = 0;
      for (const action of new Set(held.values())) {
        if (action === 'forward') forward++; if (action === 'back') forward--;
        if (action === 'right') right++; if (action === 'left') right--;
        if (action === 'up') vertical++; if (action === 'down') vertical--;
      }
      const distance = dt * 5 / Math.max(1, Math.hypot(forward, right, vertical));
      controls.moveForward(forward * distance); controls.moveRight(right * distance); camera.position.y += vertical * distance;
      camera.position.set(clampObserver(camera.position.x), clampObserver(camera.position.y), clampObserver(camera.position.z));
    },
    dispose() { abort.abort(); controls.removeEventListener('unlock', clear); controls.unlock(); controls.dispose(); held.clear(); },
  };
}
