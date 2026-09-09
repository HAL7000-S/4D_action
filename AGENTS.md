Vite + TypeScript + Three.js を使用して、ブラウザ上で動作する4次元空間可視化アプリケーションを新規実装してください。

# 目的

最終目標は、人間が4次元空間の幾何構造を直感的に知覚・操作できる実験環境を作ることである。

将来的には以下へ拡張する。

* 4次元空間中の紐・結び目
* 4次元空間中の帯・曲面
* PVTS熱力学状態空間
* 5次元以上への一般化
* VR表示

ただし今回はこれらを実装しない。

v0.1では「4D空間を移動するカメラから、4D世界を3D透視投影して観察する基盤」を完成させる。

# 技術構成

* TypeScript
* Vite
* Three.js
* HTML/CSS
* WebGLRenderer
* backendなし
* React/Vue/Svelte等のUI frameworkは使用しない
* 将来的にGitHub Pagesへ静的サイトとして公開可能にする

4D数学処理とThree.js描画処理を明確に分離すること。

Three.jsのMatrix4を4D数学処理には使用しない。

# 基本パイプライン

必ず以下の構造とする。

4D Scene
↓
4D Camera Transform
↓
4D Perspective Projection
↓
3D Projected Geometry
↓
Three.js
↓
2D Display

4D世界そのものを3D超平面で切る「4D Slice」は実装しない。

# 座標系

4次元世界座標を

p = (x, y, z, w)

とする。

4Dカメラ位置を

c = (cx, cy, cz, cw)

とする。

カメラ姿勢は

R ∈ SO(4)

で表す。

SO(4)とは、

R^T R = I
det(R) = 1

を満たす4×4回転行列とする。

カメラローカル座標では +w 軸を視線方向とする。

残りの

x
y
z

の3軸が4Dカメラの3次元画像空間を張る。

# 4D回転

4Dには以下6種類の基本回転面を実装する。

XY
XZ
XW
YZ
YW
ZW

各回転について独立した角度を保持する。

rotation4d.ts に数学処理をまとめる。

# 4Dカメラ変換

world point p に対して、

p_camera = R (p - c)

を計算する。

同次座標を利用してもよいが、数学的意味がコードから読める構造を優先する。

# 4D Perspective Projection

4Dカメラ座標

p_camera = (x_c, y_c, z_c, w_c)

を3次元へ透視投影する。

基本式は

q =
f / w_c *
(x_c, y_c, z_c)

とする。

ここで、

f > 0

は4Dカメラの焦点距離である。

必要に応じてnear / far clippingを行う。

w_c <= near の点をそのまま射影してNaNや発散を発生させないこと。

このprojectionは「4D ray tracing」ではない。

最前面だけを求める光学的レンダリングは行わず、選択されているすべての幾何要素を3Dへ射影する。

# 重要な設計

4DカメラとThree.jsの表示カメラを混同しないこと。

4Dカメラは

4D world → 3D projected geometry

を生成する数学的カメラである。

Three.js cameraは

3D projected geometry → ordinary 2D monitor

を表示するためだけに存在する。

Three.js cameraを使用して4Dカメラ自身をTPS視点で表示してはいけない。

4Dカメラ位置・姿勢は数値UIで表示する。

# 4D Room

大きな4次元超立方体を「部屋」として用意する。

範囲を

-L <= x <= L
-L <= y <= L
-L <= z <= L
-L <= w <= L

とする。

その境界は以下8個の3次元立方体cellから構成する。

x = +L
x = -L
y = +L
y = -L
z = +L
z = -L
w = +L
w = -L

8 cellを識別できるよう、それぞれ異なる固定色を割り当てる。

4Dカメラ初期位置はこの部屋の内部とする。

# Scene objects

部屋内部に以下を配置する。

1. 小さい4次元超立方体 tesseract
2. 小さい4次元単体 4-simplex

tesseract:

16 vertices
32 edges
24 square faces
8 cubic cells

4-simplex:

5 vertices
10 edges
10 triangular faces
5 tetrahedral cells

これらの幾何構造を明示的なデータ構造として生成すること。

# 表示階層

以下を独立してON/OFF可能にする。

Vertices
Edges
Faces
Cells

RoomについてもON/OFF可能にする。

透明化は補助的機能として実装してよいが、内部観察の主要機能にはしない。

Cell OFF
Face OFF
Wireframe
Projected-volume Slice

を主要な内部観察手段とする。

# Projected-volume Slice

4D Sliceではない。

必ず以下の順序で処理する。

4D geometry
↓
4D camera transform
↓
4D perspective projection
↓
3D projected geometry
↓
3D slicing plane
↓
2D cross section

3D slicing planeを

n · x = s

とする。

n ∈ R^3 は単位法線ベクトル、
s ∈ R は平面位置とする。

初期実装ではXY方向等の軸整列sliceでもよいが、
後から任意法線へ拡張可能なAPIにすること。

単にThree.js clipping planeで片側を非表示にするだけではなく、
可能な範囲で実際の幾何学的断面を計算する。

Projected 3D cellとslice planeの交差から断面polygonを生成する設計とする。

断面表示専用の2D viewportを用意する。

# UI layout

デスクトップでは最低限以下を表示する。

Main View:
4D Projectionによって生成された3D像

Slice View:
Projected-volume Sliceの2D断面

Control Panel:

* 4D camera position x
* 4D camera position y
* 4D camera position z
* 4D camera position w
* XY rotation
* XZ rotation
* XW rotation
* YZ rotation
* YW rotation
* ZW rotation
* focal length
* near
* far
* slice position
* vertex ON/OFF
* edge ON/OFF
* face ON/OFF
* cell ON/OFF
* room ON/OFF
* reset

スマートフォンではUIを簡略化する。

最低限、

* 4D camera movement
* rotation plane selection
* +/- rotation
* slice position
  -表示切替
* reset

が操作できるようにする。

# 3D display camera

Main Viewの3D projected geometryを通常の2Dモニタへ描画するためにThree.js Cameraを使用する。

これは4Dカメラの位置を見るTPS cameraではない。

Main Viewに表示される対象はあくまで

4D cameraが生成した3D projection

だけである。

表示用カメラのorbit / zoomは実装してよいが、
4D camera rotationとは状態を完全に分離する。

UI上でも区別すること。

# 初期段階で実装しないもの

以下は実装しない。

* gravity
* physics engine
* collision
* string
* knot
* ribbon
* PVTS
* VR
* WebXR
* WebGPU
* backend
* database
* 4D ray tracing
* 4D slice

# ファイル構成

責務を分離し、少なくとも以下程度に分ける。

src/
main.ts

math/
vec4.ts
matrix4.ts
rotation4d.ts
camera4d.ts
projection4d.ts

geometry/
polytope4d.ts
tesseract.ts
simplex4d.ts
room4d.ts

projection/
projectedGeometry.ts
slice3d.ts

renderer/
mainView.ts
sliceView.ts

ui/
controls.ts
state.ts

数学コードはrendererやDOMに依存させないこと。

# テスト

少なくとも数学部分について単体テストを書く。

確認項目:

* 4D回転後もベクトル長が保存される
* rotation matrixが直交行列になっている
* determinantが約1
* angle=0でidentity
* perspective projectionが期待値になる
* near plane付近でNaN / Infinityを生成しない
* tesseractが16頂点32辺を持つ
* simplexが5頂点10辺を持つ

# 実装方針

まず過剰な抽象化をせず、数学的定義がコードから追跡できる実装にする。

巨大な1ファイルにまとめない。

将来、

5D → 4D → 3D

へ拡張可能な責務分離を意識するが、
今回は不要なgeneric n-dimensional frameworkまで作らない。

最初にプロジェクト全体を確認し、
実装方針を短く説明してから実装する。

実装後は

npm install
npm run dev
npm run build
npm test

が成功することを確認する。

README.mdに、

* 数学的座標系
* 4D camera
* projection formula
* 操作方法
* directory structure

を記述する。

# 作業・利用量方針
- 通常の新規実装: GPT-6 Astra / Light
- 数学・計算幾何など難しい問題: 必要な場合のみ Astra / Medium または GPT-5.6 Sol / Medium
- CSS、README、lint、単純修正などの軽作業: より軽量なモデルを使用してよい
- モデル設定をCodex自身で変更できない場合、変更したとは報告しない
- 不必要にreasoningを上げない
必要なファイルだけ読み、不要な依存・大規模リファクタリング・将来機能を追加しない。変更に関連するtargeted testを優先し、phase完了時にfull test/buildを行う。同じ検証を理由なく繰り返さない。
一度にv0.1全体を実装せず、指定phase完了で停止する。結果・変更ファイル・テスト・残課題を簡潔に報告する。
数学仕様が曖昧なら曖昧な点・採用案・代替案を短く提示し、4D camera/projection/sliceの定義を勝手に変更しない。
恒久仕様は本ファイルに保存し、新しい設計判断が与えられたときだけ更新する。
優先順位：数学的正しさ、既存機能維持、コードの単純さ、利用量抑制、過剰な一般化の回避。

# 初期実装の規約と範囲
Phase 1はVite起動基盤、独自4D数学、点投影、数学テスト。後続phaseはREADME参照。ユーザーの明示指示まで開始しない。
合成順の未指定部分には、XY→XZ→XW→YZ→YW→ZWを順に適用する初期規約を採用した。行優先行列・列ベクトル・ラジアンとし、正角は各面の第1軸を第2軸へ回す。

# Phase 3Aの設計範囲
頂点・辺のみをworld→4D camera coordinates→camera-space wによるnear/far clipping→4D perspective projection→Three.js Main Viewの順に処理する。可視範囲はnear < w <= farを維持する。
projection層はrendererから独立した純粋関数と独自Vec3の投影データを使用する。Three.jsへ渡すのは計算済み3D座標のみ。
OrbitControlsは3D表示カメラ専用であり、4Dカメラの状態を変更しない。Roomは辺表示、tesseractとsimplexは頂点・辺表示とする。
Faces/Cells塗りつぶし、操作UI、Projected-volume Sliceは後続phase。Phase 3B以降は明示指示まで開始しない。
