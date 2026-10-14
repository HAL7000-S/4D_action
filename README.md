# 4D Space Lab

2D / 3D / 4Dの世界をPlayerCameraで移動・観察し、その透視像を3DのProjectionTVに表示する実験環境です。TVを見るObserverは独立した3Dカメラです。Vite + TypeScript + Three.jsを使用し、バックエンドはありません。

## Setup

Node.js 22.12以上を使用します。

```bash
npm install
```

## Usage

```bash
npm run dev
```

表示されたローカルURLを開きます。初期状態は4D FPS、入力先はObserverです。HUDはCONTROL、DIMENSION、VIEWを独立して示します。

| 操作 | 内容 |
| --- | --- |
| Canvasクリック / Esc | Pointer Lock開始 / 解除 |
| `/` (`Slash`) | 入力先Observer / Player切替 |
| `[` / `]` | Player次元を下げる / 上げる（2〜4） |
| `V` | PlayerのFPS / TPS切替 |
| Observer: ESDF、Space / Shift | 前後左右、上 / 下 |
| Player: S / F | 左 / 右（local −x / +x、全次元） |
| Player: E / D | 2D: +x / −x。3D: カメラ+z / −z。4D: カメラ+w / −w（水平前後） |
| Player: A / Z | カメラ−z / +z（4Dのみ、前後と独立） |
| Player: Space / Shift | 自由飛行: 上昇 / 下降。重力: Spaceで接地中にジャンプ（長押し連続ジャンプなし） |
| Player: ↑ / ↓ | 4DのみZW正 / 逆回転。Zは移動のまま |
| Player: mouse | FPSは従来のlook、TPSは本体と独立したorbit |

移動キーはCanvasフォーカスまたはPointer Lock中に使用します。入力先・次元・視点の切替はControlsのボタン操作後も使えます。編集可能な入力欄やCtrl/Alt/Meta併用時は捕捉しません。括弧はJISの文字とUSの物理キーに対応します。位置・角度は直接編集でき、角度はdegreeです。非アクティブな値は保持します。

ControlsのDimension / Viewボタンでも6状態を選択できます。スマートフォンではControlsを開いて切り替え、Canvasのドラッグで視線、ボタン長押しで移動します。左下のObserver / Playerボタンは入力先だけを変更します。使用しない移動ボタンは無効になります。

ControlsのPlayer movementでGravity（初期値）/ Free FlightとInvert Y（初期OFF）を選びます。マウス下方向は下向き、反転ONでは上向きです。2DはXY回転に上下ドラッグを反映します。Observerのマウス操作は変更しません。重力はPlayerだけに世界−yへ働き、足元は灰色床のPlayer World y＝−1に接地します。既存のジャンプ・外壁接触と青赤タイルの表示は維持します。Gray world floorは描画のON/OFFで、接地は維持します。近接した床はnearによりclipされるため、2Dで床を見る場合はTPS / Look at floor、またはnearを調整します。

Controlsの4D objectsでPoint、Line Segment、Cube、Spherinder、Hypersphereを選び、位置・寸法・6面の回転を設定してAdd objectを押します。Object欄から選択して編集・表示切替・削除できます（最大24個）。生成物は静的な4Dオブジェクトで、2D/3D表示中は保持したまま非表示です。Cubeはw一定の3D立方体、球柱は3D球体×w区間、HypersphereはS³の境界です。球柱・超球は点と線の有限サンプルで、連続境界面・内部・厳密遮蔽を省略します。

Player世界の境界は、床が薄青、天井が薄黄、x壁が薄緑、z壁が薄橙、w壁が薄紫です。2Dは境界線、3Dは面上の粗い格子、4Dは超面上の粗い格子を透視投影します。Roomチェックで表示を切り替えます。

TPSのPlayerはsquare / cube / tesseractのワイヤーフレームです。前方の境界（edge / face / cubic cell）の辺を赤、残りを青で表示し、共有辺は赤を優先します。FPSではPlayerを表示しません。シーンの緑・橙の物体とは別geometryです。

床タイル確認にはDimension/Viewを選び、Reset Player → Look at floorを押します。青はsafe、赤はhazardで、タイルの接触判定はありません。4Dのw区間が異なる2層は初期姿勢のE/Dで移動して比較できます。2D FPSの初期視線は+yなので、Look at floorで下へ向けます。TPS本体の姿勢は水平移動入力時だけ更新し、mouseやLook at floorでは回転しません（本体角度欄は読取専用）。

Reset PlayerとReset Observerは独立しています。VisibilityはX-Ray / Back-face Culling（初期ON）で、既存Tesseractを含む凸物体の前向き境界（2D edge / 3D face / 4D cell）を表示します。球柱・超球は4Dサンプル法線で近似判定し、Point・Line・埋め込みCubeはワイヤーフレームを維持します。Room・床・Playerはカリング対象外です。遮蔽や汎用Solid描画ではありません。設定は次元・視点切替とPlayer resetで保持します。永続保存はありません。

TV Half-Extent (h) is the half-width on each ProjectionTV axis. TV Field of View (FOV) = 2 atan(h/f) belongs to PlayerCamera, independently of ObserverCamera3D.

## Development

```bash
# Test
npm test
# Production build
npm run build
# Debug / Run
npm run dev
```

lint scriptはありません。ビルド出力は`dist/`です。相対base設定によりGitHub Pages等のサブディレクトリで静的配信できます。

## Structure

```text
src/math/                    独自4D数学（Three.js・DOM非依存）
src/geometry/                世界・Player形状の頂点と境界
src/projection/              カメラ変換、深度clip、透視像、TPS像、基底軸
src/visibility/              convex back-face / back-cell culling
src/ui/state.ts              PlayerCamera状態とscene投影
src/ui/inputMapping.ts       入力所有者・キー定義・連続移動
src/ui/observerState.ts      ProjectionTVとObserverの設定
src/renderer/               計算済み3D像、Observer、独立HUDの描画
tests/                      数学・投影・状態・入力のテスト
```

## Design

```text
Player world → PlayerCamera → ProjectionTV
→ Observer3D → ObserverCamera3D → 2D monitor
```

- `PlayerDimension = 2 | 3 | 4`、`ViewMode = "fps" | "tps"`、入力所有者`InputMode`は独立です。互換名`camera4d`は低次元でもPlayer入力を意味します。次元変更は末尾の世界軸を非アクティブ化し、保存位置・使用しない角度を上書きしません。
- 4D座標は`(x,y,z,w)`、前方は`+w`、`p_camera = R(p-c)`、`R ∈ SO(4)`。独自行優先行列・列ベクトル・radianを使い、正角は各面の第1軸を第2軸へ回します。合成順はXY → XZ → XW → YZ → YW → ZWです。
- 4D透視投影は`q = (f/w_c)(x_c,y_c,z_c)`、`f > 0`、`0 < near < far`。辺をカメラ座標でclipしてから投影し、可視範囲は`near < w_c <= far`。開境界・非有限値の扱いは既存数学を維持します。
- 低次元は独立したsquare/cube roomとcube・simplex相当のワイヤーフレーム世界です。2Dは`(x,y)`、前方`+y`、像は`(f*x_c/y_c,0,0)`。3Dは`(x,y,z)`、前方`+z`、像は`(f*x_c/z_c,f*y_c/z_c,0)`。深度を既存clip/projectへ渡すアダプタで処理します。4D世界のsliceではありません。2Dの透視像が線になるのは意図した仕様です。
- TPS camera orbit and body orientation are independent. Moving turns the body with exponential time-based smoothing: shortest yaw in 3D, minimal rotation within (x,z,w) in 4D. Release holds the current pose. All world/avatar/floor projections share PlayerCamera.
- Reset Playerは全保存位置・角度・投影設定を初期化し、Dimension / ViewMode / Visibilityを維持します。ObserverとTVサイズは変更しません。
- ProjectionTVは原点中心`[-h,h]^3`、`FOV = 2 atan(h/f)`。投影座標はclampせず、6枚の描画clip面で表示領域を制限します。Observer Roomは別の3D部屋で、Observerだけを境界内へ制限します。TVとのcollisionはありません。
- 水平移動は視点の光学的前方からyを除き、直交正規化した基底を使います。4DのE/Dは+w/−w、A/Zは−z/+zです。自由飛行は従来の中心位置制限、重力は身体サイズを考慮した境界を使います。接触判定は投影像やObserverではなくPlayer世界で行います。非アクティブな座標は保持します。
- 世界の基底軸は原点の±単位軸（X赤・Y緑・Z青・W紫）。真の正端点が可視かつ非退化のときだけ矢印を描きます。右上HUDは同じrenderer内の独立scene/cameraで、`R e_i`、独立投影anchor `(0,0,0,5)`を使用します。Observerの姿勢・TPS距離には依存しません。
- Back-face Culling retains front-facing convex boundary edges; saved Natural values remain compatible. Room, floor and Player are excluded. This does not perform occlusion.
- 灰色床はPlayer Worldのy＝−1、x/z/wの有効な各軸はRoomの有限範囲です。2Dはsegment、3Dはsquare、4Dは埋め込まれた3D cubic cellで、既存の深度clipと透視投影で表示します。灰色床の面描画は不透明ですが、厳密な4D遮蔽ではありません。青赤タイルは別の表示専用geometryです。
- 床Mesh以外の汎用solid renderer、厳密な4D occlusion、深度clipで切断した床の蓋、正確なTV境界での幾何切断は未実装です。床タイル・hazard衝突、death/restart、goal等のgame system、Slice、汎用physics、PVTS、VR、WebGPUへは進みません。
