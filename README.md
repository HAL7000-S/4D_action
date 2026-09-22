# 4D Space Lab

Vite + TypeScript + Three.js を使用するブラウザ向け4次元空間可視化プロジェクト。
現在は **Phase 3B：4Dカメラ操作** まで実装済みです。

## 実行

Node.js 22.12以上（検証環境24.15）を使用します。

```sh
npm install
npm run dev
npm test
npm run build
```

dev起動後に表示されるローカルURLを開いてください。tesseractは緑、4-simplexは橙の頂点・辺、roomは青灰色の辺で表示します。
ドラッグで3D表示カメラをorbit、ホイールでzoom、右ドラッグでpanできます。4Dカメラは操作パネルまたはキーボードで変更し、OrbitControlsとは独立しています。
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
Faces/Cellsの塗りつぶし、Sliceは未実装です。

## 4Dカメラ操作（Phase 3B）

操作パネルのPosition x/y/z/wは世界座標のカメラ位置です。Rotationの6面はdegree入力で、UI境界でradianへ変換します。数学層の回転定義・合成順は変更していません。
focalLength/near/farも数値入力で変更でき、有効値を入力すると即座にカメラ変換→クリッピング→投影を再計算します。無効な数値や `0 < near < far` を満たさない入力では説明を表示し、直前の有効状態を維持します。
Visibilityでroom/tesseract/simplexを個別に切り替えられます。roomをOFFにすると内部オブジェクトだけを観察できます。投影座標のclampは行いません。

キーボード操作はMain ViewをクリックするかTabでフォーカスしたときだけ有効です。

- `M`：Position / Rotationモード切替。
- `[` / `]`：移動軸または回転面を順番に切替。
- `↑` / `↓`：選択軸を±0.1移動、または選択面を±5°回転。長押しはOSのキーリピートに従います。
- 対象はパネルのMode/Axis/Planeでも選択可能。数値入力中・修飾キー付き操作は捕捉しません。

キー配置は `src/ui/controls.ts` の `keyBindings` に集約しています。XY/XZ/YZとXW/YW/ZWを切り替えて、wを含む回転による遠近変化を比較できます。
パネル下部に有効な4D位置・全回転角、Main View下部に表示対象ごとの可視頂点数・辺数を表示します。roomの頂点数は投影可能な頂点数で、描画は辺のみです。

`Reset 4D Camera`：位置 `(0,0,0,-3)`、6角度0、f=3、near=2、far=12へ戻します。初期値はPhase 3Aから変更していません。Visibilityと3D表示カメラは維持します。
`Reset View`：3D表示カメラの初期orbit/zoom/panだけを戻し、4D状態を維持します。
世界geometryとThree.js scene・camera・materialを再利用し、投影変更時はBufferGeometryの属性・draw rangeを更新します。容量不足時だけGPU属性を再確保します。

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
src/ui/state.ts             4D状態・単位変換・Reset・scene投影
src/ui/controls.ts          操作パネル・フォーカス限定キーボード操作
tests/math.test.ts          数学の単体テスト
tests/geometry.test.ts      幾何・接続関係の単体テスト
tests/projection.test.ts    クリッピング・投影パイプラインのテスト
tests/state.test.ts         状態・単位変換・Reset・投影再計算テスト
AGENTS.md                  恒久仕様・作業方針
```

1. 起動・数学基盤（完了）
2. tesseract / simplex / room の明示的な幾何データとテスト（完了）
3. A：辺クリッピング・投影、Three.js wireframe Main View（完了）。B：4Dカメラ操作・Visibility・独立Reset（完了）。3C以降は明示指示後
4. Projected-volume Sliceと専用2Dビュー
5. 表示階層・スマートフォン操作の仕上げと全体検証

後続phaseは明示的な依頼後に開始します。最終仕様はAGENTS.mdを参照してください。

## Phase 3C：Observer Room（現在の操作）

従来のOrbit操作を一人称観察へ置き換えました。4D数学・4D初期状態は変更していません。
白青のcube frameはProjection Volume（初期h=4）、大きな部屋と床gridはobserverRoom3D（各軸±16）です。4D Roomは従来の投影対象であり、この観察室とは別物です。
hは独立stateとしてpanelで変更可能（0<h<15.8）。FOV4D=2 atan(h/f)をdegree表示します。4D投影後、物体materialに6枚の描画用clip planeを設定し、Volume外の描画を切り取ります。元の投影座標・ProjectedGeometryは変更しません。CPU上の正確な3D幾何切断は未実装で、頂点・辺数はVolume切断前の投影数です。

- Desktop：canvasをクリックしてPointer Lock。Escで解除してpanel操作。W/S前後、A/D左右、Q/E上下、mouse look。前後左右は床面に平行。3D observerだけを部屋境界から0.2内側へ制限し、Volume内部には自由に入れます。
- 4D：J/L=x −/+、I/K=y +/−、U/O=z −/+、N/M=w −/+。[/]で回転面、;/'で−/+5°。移動は1入力0.1。数値panelも即時更新。キー定義はsrc/ui/inputMapping.ts。
- Touch：canvas空き領域dragでlook、左下ボタン長押しで3D移動、右下ボタンtapで4D移動・面変更・回転。Controlsを開くと詳細panelを操作できます。
- ページ全体は100dvhで固定しスクロールしません。panelだけ縦scroll可能です。
- Reset 4D Cameraは4Dパラメータのみ初期化。Reset 3D Observerは位置(8,5,11)と原点を見る向きへ戻します。hはどちらでも維持します。

追加ファイル：renderer/observerCamera.ts、ui/inputMapping.ts、ui/observerState.ts、ui/touchControls.ts、tests/observer.test.ts。
Phase 3C完了後、Faces/Cells・Projected-volume Slice・正確な3D幾何クリッピングなどは次の明示指示まで開始しません。
