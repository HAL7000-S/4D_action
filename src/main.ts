import { identity } from './math/matrix4';
import type { Vec4 } from './math/vec4';
import { createTesseract } from './geometry/tesseract';
import { createSimplex4D } from './geometry/simplex4d';
import { createRoom4D } from './geometry/room4d';
import { projectGeometry } from './projection/projectedGeometry';
import { createMainView } from './renderer/mainView';
import './style.css';

const camera4d = { position: [0, 0, 0, -3] as Vec4, rotation: identity() };
const projection = { focalLength: 3, near: 2, far: 12 };
const simplex = createSimplex4D();
const objects = [
  { name: 'Room', color: 0x526888, showVertices: false, polytope: createRoom4D(5) },
  { name: 'Tesseract', color: 0x63e8d2, showVertices: true, polytope: createTesseract(1.8, [-1.4, 0, 0, 1]) },
  { name: '4-simplex', color: 0xffbb70, showVertices: true, polytope: {
    ...simplex, vertices: simplex.vertices.map((v): Vec4 => [v[0] + 1.4, v[1], v[2], v[3] + 1]),
  } },
].map(({ polytope, ...display }) => ({ ...display, geometry: projectGeometry(polytope, camera4d, projection) }));

document.querySelector<HTMLElement>('#app')!.innerHTML = `
  <header><p class="eyebrow">4D SPACE LAB · PHASE 3A</p><h1>4D Projection <span>／ Wireframe</span></h1>
  <p>4D world → camera → near/far clipping → 3D projection</p></header>
  <section class="viewport" id="main-view"></section>
  <footer><div class="legend">${objects.map(o => `<span style="color:#${o.color.toString(16).padStart(6, '0')}">${o.name} · ${o.geometry.vertices.length} projected vertices / ${o.geometry.edges.length} edges${o.showVertices ? '' : '（辺のみ表示）'}</span>`).join('')}</div>
  <p>3D表示カメラ：ドラッグでorbit ／ ホイールでzoom ／ 右ドラッグでpan</p>
  <p>4Dカメラは固定：位置 (0, 0, 0, −3)、回転なし、f = 3、near = 2、far = 12。表示操作は4Dカメラに影響しません。</p></footer>`;
const dispose = createMainView(document.querySelector<HTMLElement>('#main-view')!, objects);
if (import.meta.hot) import.meta.hot.dispose(dispose);
