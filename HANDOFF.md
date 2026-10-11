## Goal

床表示の小phase：TPS本体と視点の分離、地面内移動、2D/3D/4D床タイルの表示確認。

## State

* 完了: TPS mouse orbitを本体姿勢から分離。本体は移動入力時だけ地面内の移動方向へ向く。
* 完了: PlayerはESDFとA/Zでx/z/w移動、yは固定、Spaceは予約。Observer操作は維持。
* 完了: safe青/hazard赤の床専用geometry・clip・Mesh。4Dはy一定の8頂点6面cell、wの異なる2層に6タイル。低次元はsegment/square。
* 検証: npm test（10 files / 100 tests）とnpm run build成功。6つの次元/視点で床投影がTV内に入ることをテスト。
* 制約: 実ブラウザ接続がなく目視・実機touch確認は未実施。buildは約508 kBのchunkサイズ警告あり。深度clip面の蓋・厳密4D遮蔽は未実装。

## Relevant

* `src/ui/inputMapping.ts`
* `src/projection/playerCamera.ts`
* `src/geometry/floorTile.ts`
* `src/projection/projectFloor.ts`
* `tests/floor.test.ts`

## Next

1. 実ブラウザで各Dimension/Viewを選び、Reset Player → Look at floorから表示とTPS orbitを確認する。
2. 今回の範囲で停止。gravity/jump、床・hazard判定、death/restart、goal等は次の明示依頼まで実装しない。
