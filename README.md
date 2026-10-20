# BATTLE NOTES
HTMLと共通JavaScriptで動作する階層型プレゼンテーション。記事は`dist/index.html`、実装方法は`dist/implementation.html`に直接記述しています。
公開対象は`dist/`です。サーバー側処理・記事生成・ビルドは不要です。
## 操作
→で文章・画像を次の段階まで表示し、全表示後に次の同階層ページへ。←は逆順。↓で子ページ、↑で親ページへ移り、各ページの表示段階を復元します。→と↓はフェードイン、←と↑は即時表示。Mで目次、Fで全画面、Home/Endで最初/最後の章へ。ページと段階はURL（例：#origin/2）に保存されます。
## 編集
`deck-slide`のネストで階層を宣言し、各要素の直下に`.slide-body`を1つ置きます。後から表示する本文・画像・表を`deck-fragment`で囲みます。同じ`step`番号なら同時に表示できます。`left`・`right`・`up`・`down`属性で移動先を上書きできます。`deck-command`でコマンドを宣言します。具体例は`dist/implementation.html`と`dist/demo.html`を参照してください。`body.talk`と`talk.css`で無地の黒背景・1280×720の固定スライドになります。
## GitHub Pages
リポジトリのSettings → Pages → SourceをGitHub Actionsに設定してください。`.github/workflows/pages.yml`はmainへのpushで検証後にdistを公開します。PRでは検証のみです。ブランチ名が異なる場合はワークフローのbranchesを変更してください。手動公開は既定ブランチから実行します。
## 検証
`node scripts/validate.mjs`でUTF-8、ID、親子構造、方向ジャンプ、相対リンクを検証します。ActionsではPlaywrightのPC・モバイル・GitHub Pages相当のサブパスで操作を確認します。
## 原稿
添付の原稿はmanuscript配下に変更せず保持しています。性能と成果は原稿記載時点の報告で、今回のサイト制作ではROM・性能の再検証はしていません。
