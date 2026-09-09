# 4D Space Lab

Vite + TypeScript + Three.js を使用するブラウザ向け4次元空間可視化プロジェクト。
現在は **Phase 3A：頂点・辺のwireframe Main View** まで実装済みです。

## 実行

Node.js 22.12以上（検証環境24.15）を使用します。

```sh
npm install
npm run dev
npm test
npm run build
```

dev起動後に表示されるローカルURLを開いてください。tesseractは緑、4-simplexは橙の頂点・辺、roomは青灰色の辺で表示します。
ドラッグで3D表示カメラをorbit、ホイールでzoom、右ドラッグでpanできます。4Dカメラの位置・姿勢は固定で、OrbitControlsとは独立しています。
buildの出力は `dist/`。相対base設定により静的配信のサブディレクトリに対応します。公開作業は未実施です。

## 数学的規約

- 世界座標は `(x,y,z,w)`、4Dカメラのローカル視線は `+w`。
- `p_camera = R(p-c)`。Rはworld-to-cameraのSO(4)行列で、カメラのローカル軸を世界へ変換する行列ではありません。
- 独自4×4行列は行優先、ベクトルは列ベクトル。同次座標やThree.js Matrix4は使いません。
- 正角は各面の第1軸を第2軸へ回します。角度はラジアン。
- 合成順はXY → XZ → XW → YZ → YW → ZW。列ベクトルに対して後の回転を左から乗算します。
- `q = (f/w_c)(x_c,y_c,z_c)`。有限な `f > 0` と `0 < near < far` を要求します。
- 点の可視範囲は `near < w_c <= far`。範囲外、非有限値、投影結果のオーバーフローは `null`。
- 辺は4Dカメラ座標でnear/farクリッピングしてから点投影します。面・cellのクリッピングは未実装です。
- 3D表示カメラは4Dカメラから独立させます。

## 幾何データ（Phase 2）

geometry層はVec4の型のみ参照し、Three.js・DOM・数学処理に依存しません。
`Polytope4D`はvertices、edges、faces、cellsを保持します。辺は2頂点index、面は周回順の頂点index、cellは頂点indexとpolytope全体の面indexを持ちます。面の周回方向はcell外向きの向きを保証しません。

- `createTesseract(size = 2, center = [0,0,0,0])`：16頂点・32辺・24正方形面・8立方体cell。各座標はcenter ± size/2。
- `createSimplex4D()`：5頂点・10辺・10三角形面・5四面体cell。重心は原点、外接半径1、全辺長√(5/2)の正4単体。
- `createRoom4D(L = 5)`：[-L,L]⁴の境界。8立方体cellそれぞれに `boundary: { axis, sign }` を付与。描画時の色割当にはこのmetadataを利用できます。

sizeとLは正の有限値、centerは有限座標を要求します。通常の浮動小数点精度の範囲で使用してください。

## Wireframe投影（Phase 3A）

`projectGeometry(geometry, camera, settings)`は世界座標→4Dカメラ変換→wによるクリッピング→透視投影の順に処理します。
`ProjectedGeometry`の頂点は `position: Vec3` と `sourceVertexIndex`、辺は `start/end: Vec3` と `sourceEdgeIndex` を保持します。交点は辺の端点として保持し、元の頂点リストには追加しません。

`clipSegment4D(a, b, near, far)`はカメラ座標の線分を受け取り、元の向きを保つ端点ペアまたは `null` を返す純粋関数です。
nearは開境界なので、その直後のIEEE 754浮動小数点値をクリップ面として交点計算します。farは境界を含みます。一定wは除算せず判定し、微小な非ゼロ分母の交差も処理します。非有限入力は `null`、無効なnear/far設定は `RangeError` です。
数値精度を超える極端な座標では形状精度は保証しませんが、非有限な結果は投影データに含めません。

初期4Dカメラはroom内部の `(0,0,0,-3)`、回転なし、f=3、near=2、far=12。Roomのw方向の辺はnearを横切り、クリップされます。
Main Viewは計算済みの3D座標だけを受け取り、Three.jsのPointsとLineSegmentsで描画します。リサイズ時・表示カメラ操作時に再描画し、破棄時はGPUリソースとイベントを解放します。
Faces/Cellsの塗りつぶし、4D操作UI、Sliceは未実装です。

## 構成とphase

```text
src/main.ts                 初期scene・4Dカメラ・Main View接続
src/style.css               基本スタイル
src/math/vec4.ts             ベクトル
src/math/matrix4.ts          独自4×4行列
src/math/rotation4d.ts       6面回転と合成
src/math/camera4d.ts         世界→カメラ座標
src/math/projection4d.ts     カメラ座標→3D点
src/geometry/polytope4d.ts  幾何データ型
src/geometry/tesseract.ts   超立方体生成
src/geometry/simplex4d.ts   正4単体生成
src/geometry/room4d.ts      部屋境界とmetadata
src/projection/clip4d.ts    カメラ座標での4D線分クリッピング
src/projection/projectedGeometry.ts  頂点・辺の投影データと変換
src/renderer/mainView.ts    Three.js wireframe・独立したOrbitControls
src/vite-env.d.ts           Viteクライアント型
tests/math.test.ts          数学の単体テスト
tests/geometry.test.ts      幾何・接続関係の単体テスト
tests/projection.test.ts    クリッピング・投影パイプラインのテスト
AGENTS.md                  恒久仕様・作業方針
```

1. 起動・数学基盤（完了）
2. tesseract / simplex / room の明示的な幾何データとテスト（完了）
3. A：辺クリッピング・投影、Three.js wireframe Main View（完了）。3B以降の内容は次の指示で確定
4. Projected-volume Sliceと専用2Dビュー
5. 表示階層・スマートフォン操作の仕上げと全体検証

後続phaseは明示的な依頼後に開始します。最終仕様はAGENTS.mdを参照してください。
