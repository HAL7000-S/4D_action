import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { movement, speeds, type InputState } from '../ui/inputMapping';
import { clampObserver } from '../ui/observerState';

export function resetObserverCamera(observerCamera: THREE.PerspectiveCamera) {
  observerCamera.position.set(8, 5, 11); observerCamera.lookAt(0, 0, 0);
}

export function createObserver(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, input: InputState) {
  const controls = new PointerLockControls(camera, canvas);
  const reset = () => { resetObserverCamera(camera); input.clear(); };
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
    if (input.mode === 'camera4d') {
      input.addMouse(e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX; drag.y = e.clientY; return;
    }
    const rotation = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    rotation.y -= (e.clientX - drag.x) * .003;
    rotation.x = Math.max(-Math.PI / 2 + .01, Math.min(Math.PI / 2 - .01, rotation.x - (e.clientY - drag.y) * .003));
    camera.quaternion.setFromEuler(rotation);
    drag.x = e.clientX; drag.y = e.clientY;
  };
  const up = (e: PointerEvent) => { if (drag?.id === e.pointerId) drag = undefined; };
  const clear = () => { input.clear(); drag = undefined; };
  const unsubscribe = input.subscribe(clear);
  const abort = new AbortController(), options = { signal: abort.signal };
  canvas.tabIndex = 0;
  canvas.addEventListener('pointerdown', down, options);
  canvas.addEventListener('pointermove', move, options);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, up as EventListener, options);
  window.addEventListener('blur', clear, options); document.addEventListener('visibilitychange', clear, options);
  controls.addEventListener('unlock', clear);
  const error = () => { canvas.setAttribute('aria-label', 'Pointer Lockを開始できません。再度クリックしてください。'); };
  document.addEventListener('pointerlockerror', error, options);
  return {
    reset,
    tick(dt: number) {
      const move = movement(input.pressed);
      const enabled = input.mode === 'observer3d';
      const forward = enabled ? move[3] : 0, right = enabled ? move[0] : 0, vertical = enabled ? move[1] : 0;
      const distance = dt * speeds.observer / Math.max(1, Math.hypot(forward, right, vertical));
      controls.moveForward(forward * distance); controls.moveRight(right * distance); camera.position.y += vertical * distance;
      camera.position.set(clampObserver(camera.position.x), clampObserver(camera.position.y), clampObserver(camera.position.z));
    },
    dispose() { unsubscribe(); abort.abort(); controls.removeEventListener('unlock', clear); controls.unlock(); controls.dispose(); input.clear(); },
  };
}
