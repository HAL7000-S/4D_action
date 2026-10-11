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
| Player: Space | jump用予約、現時点では無動作 |
| Player: mouse | FPSは従来のlook、TPSは本体と独立したorbit |

移動キーはCanvasフォーカスまたはPointer Lock中に使用します。入力先・次元・視点の切替はControlsのボタン操作後も使えます。編集可能な入力欄やCtrl/Alt/Meta併用時は捕捉しません。括弧はJISの文字とUSの物理キーに対応します。位置・角度は直接編集でき、角度はdegreeです。非アクティブな値は保持します。

ControlsのDimension / Viewボタンでも6状態を選択できます。スマートフォンではControlsを開いて切り替え、Canvasのドラッグで視線、ボタン長押しで移動します。左下のObserver / Playerボタンは入力先だけを変更します。使用しない移動ボタンは無効になります。

TPSのPlayerはsquare / cube / tesseractのワイヤーフレームです。前方の境界（edge / face / cubic cell）の辺を赤、残りを青で表示し、共有辺は赤を優先します。FPSではPlayerを表示しません。シーンの緑・橙の物体とは別geometryです。

床確認にはDimension/Viewを選び、Reset Player → Look at floorを押します。青はsafe、赤はhazardで、判定はありません。4Dはw区間が異なる2層の床配置をA/Zで移動して比較できます。2D FPSの初期視線は+yで床は−y側にあるため、Look at floorで下へ向けます。TPS本体の姿勢は移動入力時だけ更新し、mouseやLook at floorでは回転しません（TPS中の本体角度欄は読取専用）。

Reset PlayerとReset Observerは独立しています。VisibilityはX-Ray / Back-face Cullingで、凸物体の前向き境界（2D edge / 3D face / 4D cell）を表示します。Room・床・Playerはカリング対象外です。遮蔽やSolid描画ではありません。選択値は次元変更でも保存します。

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
- Player移動は視点の地面内回転（XZ/XW/ZWのみ）の`R^T`でlocal→worldへ変換します。自由度は2D=x、3D=x/z、4D=x/z/w、yは将来のgravity/jump用に保持します。4Dの光学的前方+wと、E/Dの移動軸±zは別です。各世界成分の`[-4.9,4.9]`制限（RoomのL=5、margin=.1）、数値入力の境界、dtベース入力、blur/unlock時の押下解除は維持します。
- 世界の基底軸は原点の±単位軸（X赤・Y緑・Z青・W紫）。真の正端点が可視かつ非退化のときだけ矢印を描きます。右上HUDは同じrenderer内の独立scene/cameraで、`R e_i`、独立投影anchor `(0,0,0,5)`を使用します。Observerの姿勢・TPS距離には依存しません。
- Back-face Culling retains front-facing convex boundary edges; saved Natural values remain compatible. Room, floor and Player are excluded. This does not perform occlusion.
- 床は`FloorTile4D`の`[x0,x1] × {yFloor} × [z0,z1] × [w0,w1]`で、4D tesseractではなく埋め込まれた3D cubic cellです。2Dはsegment、3Dはsquareとして表示します。床専用の投影処理は既存のcamera/near-far clip/perspectiveを使い、投影した6面を三角形化して専用Meshへ渡します。safe=青、hazard=赤。床はNaturalの対象外で、既存物体のVisibility判定は変更しません。
- 床Mesh以外の汎用solid renderer、厳密な4D occlusion、深度clipで切断した床の蓋、正確なTV境界での幾何切断は未実装です。gravity/jump、床・hazard衝突、death/restart、goal等のgame system、Slice、physics、PVTS、VR、WebGPUへは進みません。
