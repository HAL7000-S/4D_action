import { identity } from './math/matrix4';
import { worldToCamera } from './math/camera4d';
import { projectPoint } from './math/projection4d';
import './style.css';

const cameraPoint = worldToCamera([1, 2, 3, 2], { position: [0, 0, 0, -2], rotation: identity() });
const projected = projectPoint(cameraPoint, { focalLength: 2, near: 0.1, far: 20 });
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <p class="eyebrow">4D SPACE LAB · PHASE 1</p>
  <h1>4次元空間の可視化</h1>
  <p>数学基盤を実装しました。幾何描画・操作UI・断面表示は後続phaseで追加します。</p>
  <section><h2>座標変換のサンプル</h2>
    <p>世界座標 (1, 2, 3, 2) ／ カメラ位置 (0, 0, 0, −2) ／ 回転なし</p>
    <p>カメラ座標：(${cameraPoint.join(', ')})</p>
    <p>焦点距離 2 → 3D投影：(${projected?.join(', ')})</p>
    <code>p_camera = R(p − c) → q = f / w_c · (x_c, y_c, z_c)</code>
  </section>`;
