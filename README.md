# BATTLE NOTES
HTMLと共通JavaScriptで動作する階層型プレゼンテーション。トップの`dist/index.html`は発表一覧、本文は`dist/16c10/index.html`、共通JS・CSSは`dist/engine/`に分離しています。発表を追加してもエンジンの変更は不要です。
公開対象は`dist/`です。サーバー側処理・記事生成・ビルドは不要です。
## 操作
→で文章・画像を次の段階まで表示し、全表示後に次の同階層ページへ。←は逆順。↓で子ページ、↑で親ページへ移り、各ページの表示段階を復元します。→と↓はフェードイン、←と↑は即時表示。Mで目次、Fで全画面、Home/Endで最初/最後の章へ。ページと段階はURL（例：#origin/2）に保存されます。
## 編集
`deck-slide`のネストで階層を宣言し、各要素の直下に`.slide-body`を1つ置きます。後から表示する本文・画像・表を`deck-fragment`で囲みます。同じ`step`番号なら同時に表示できます。`left`・`right`・`up`・`down`属性で移動先を上書きできます。`deck-command`でコマンドを宣言します。具体例は`dist/implementation.html`と`dist/demo.html`を参照してください。`body.talk`と`engine/talk.css`で無地の黒背景・1280×720の固定スライドになります。
## 発表の追加
`dist/example/`を新しい発表IDのディレクトリへ複製し、HTMLへ本文を記述します。画像はその発表の`assets/`、固有CSSは`deck.css`へ置き、トップの一覧へ通常のリンクを追加します。命名例は`dist/example/index.html`のHTMLコメントに記載しています。指定された2026年10月の発表は`16c10/`です。すべて相対リンクで、GitHub Pagesの`/presentation/`配下でも同じ構成を使えます。
## GitHub Pages
リポジトリのSettings → Pages → SourceをGitHub Actionsに設定してください。`.github/workflows/pages.yml`はmainへのpushで検証後にdistを公開します。PRでは検証のみです。ブランチ名が異なる場合はワークフローのbranchesを変更してください。手動公開は既定ブランチから実行します。
## 検証
`node scripts/validate.mjs`でUTF-8、ID、親子構造、方向ジャンプ、相対リンクを検証します。ActionsではPlaywrightのPC・モバイル・GitHub Pages相当のサブパスで操作を確認します。
## 原稿
添付の原稿はmanuscript配下に変更せず保持しています。性能と成果は原稿記載時点の報告で、今回のサイト制作ではROM・性能の再検証はしていません。
