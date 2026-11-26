# Webコード教室

専門学校のHTML・CSS・JavaScript授業向けのブラウザエディターです。エディターはMonaco Editorで、ファイル一覧、タブ、プレビュー、コンソールを1画面に配置しています。

## ソースの構成

| ファイル | 内容 |
| --- | --- |
| `index.html`、`classroom.css` | 画面構成とデザイン |
| `app.js` | Monaco、仮想ファイル、自動保存、ZIP、画面操作 |
| `preview.js` | 相対パスの解決、sandbox付きiframe、コンソールと行番号 |
| `starter.js` | 初回アクセス時に作る教材の3ファイル |
| `vendor/` | バージョンを固定したライブラリとそのライセンス |
| `.nojekyll` | GitHub Pagesでファイルをそのまま配信するための設定 |

ライブラリはMonaco Editor 0.52.2、JSZip 3.10.1、parse5 7.2.1（entities 4.5.0）です。すべて同梱済みで、公開時の依存パッケージのインストールやビルドは不要です。

公開の手順は `github-pages-guide.md`、授業での操作は `user-guide.md`、検証状況は `verification.md` を参照してください。
