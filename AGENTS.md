## Rules

* 既存動作・作業中の変更を不要に変更しない。変更・依存追加は必要最小限にする。
* secrets、token、credentialをコミットしない。
* コードから確認できることは文書に重複して書かない。READMEを過去phaseの履歴にしない。
* 設計判断が必要な場合だけREADMEのDesignを読む。引継ぎ作業の場合だけHANDOFF.mdを読む。
* PlayerCamera、ProjectionTV、ObserverCameraを混同しない。Dimension・FPS/TPS・入力所有者は独立させる。
* 4D数学定義・回転順・clipをUI都合で変更しない。数学・投影層をThree.js・DOMから分離する。
* 非アクティブ軸・角度を破棄しない。Player resetとObserver resetの責務を分ける。
* キー定義はinputMapping.tsに集約する。desktop/mobileの連続入力を維持する。
* 無関係なrefactor、generic n次元化、Slice、physics、VR、backend等へ進まない。指定範囲の完了で停止する。
* 変更に関係するtargeted testを優先し、完了時にfull test/buildを実行する。理由なく繰り返さない。
* モデル設定を変更できない場合、変更したと報告しない。数学的正しさ・既存機能維持・単純さ・利用量抑制を優先する。

## Check

```bash
npm test
npm run build
```

lint scriptは存在しない。結果・主な変更ファイル・検証・残る制約を簡潔に報告する。
