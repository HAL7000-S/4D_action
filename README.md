# 4D Space Lab

Vite + TypeScript + Three.js を使用するブラウザ向け4次元空間可視化プロジェクト。
現在は **Phase 1：起動・数学基盤** まで実装済みです。Three.jsは依存として導入済みですが、描画は後続phaseです。

## 実行

Node.js 22.12以上（検証環境24.15）を使用します。

```sh
npm install
npm run dev
npm test
npm run build
```

dev起動後に表示されるローカルURLを開いてください。現時点の画面は座標変換サンプルで、操作UIは未実装です。
buildの出力は `dist/`。相対base設定により静的配信のサブディレクトリに対応します。公開作業は未実施です。

## 数学的規約

- 世界座標は `(x,y,z,w)`、4Dカメラのローカル視線は `+w`。
- `p_camera = R(p-c)`。Rはworld-to-cameraのSO(4)行列で、カメラのローカル軸を世界へ変換する行列ではありません。
- 独自4×4行列は行優先、ベクトルは列ベクトル。同次座標やThree.js Matrix4は使いません。
- 正角は各面の第1軸を第2軸へ回します。角度はラジアン。
- 合成順はXY → XZ → XW → YZ → YW → ZW。列ベクトルに対して後の回転を左から乗算します。
- `q = (f/w_c)(x_c,y_c,z_c)`。有限な `f > 0` と `0 < near < far` を要求します。
- 点の可視範囲は `near < w_c <= far`。範囲外、非有限値、投影結果のオーバーフローは `null`。
- 現在のAPIは点投影のみ。辺・面・cellがnear/farを横切る場合のクリッピングは後続phaseで実装します。
- 3D表示カメラは4Dカメラから独立させます。

## 構成とphase

```text
src/main.ts                 起動画面・サンプル
src/style.css               基本スタイル
src/math/vec4.ts             ベクトル
src/math/matrix4.ts          独自4×4行列
src/math/rotation4d.ts       6面回転と合成
src/math/camera4d.ts         世界→カメラ座標
src/math/projection4d.ts     カメラ座標→3D点
tests/math.test.ts          数学の単体テスト
AGENTS.md                  恒久仕様・作業方針
```

1. 起動・数学基盤（今回）
2. tesseract / simplex / room の明示的な幾何データとテスト
3. 幾何クリッピング・投影、Three.js Main View、4D操作UI
4. Projected-volume Sliceと専用2Dビュー
5. 表示階層・スマートフォン操作の仕上げと全体検証

後続phaseは明示的な依頼後に開始します。最終仕様はAGENTS.mdを参照してください。
