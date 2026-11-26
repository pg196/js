# Webコード教室をGitHub Pagesで公開する

準備するものは、公開設定を管理できるGitHubアカウントと `web-code-classroom-github-pages.zip` です。学生は公開URLを開くだけで利用できます。

## 1. ZIPを展開する

ZIPを右クリックして「すべて展開」を選びます。展開したフォルダの直下に `index.html`、`app.js`、`vendor` フォルダなどがあることを確認します。

## 2. GitHubにファイルを置く

1. GitHubでパブリックリポジトリを作成します。リポジトリ名の例は `web-code-classroom` です。作成時に **Add a README file** を選んで `main` ブランチを用意します。
2. **Code → HTTPS** でリポジトリのURLをコピーします。Gitが入っているPCでターミナルを開き、下のURLを実際のURLに置き換えて実行します。

   ```sh
   git clone https://github.com/YOUR-NAME/web-code-classroom.git
   cd web-code-classroom
   ```

3. ZIPを展開したフォルダの**中身**を、クローンでできたフォルダにコピーします。既存の `README.md` はZIP内のものに置き換えられます。クローンしたフォルダ直下に `index.html`、`vendor/`、`.nojekyll` があることを確認します。
4. クローンしたフォルダで次を実行します。GitHubから認証を求められた場合は、画面の指示に従います。

   ```sh
   git add .
   git commit -m "Add web code classroom"
   git push origin main
   ```

GitHub Desktopを使う場合は、リポジトリをクローンして同じようにファイルをコピーし、**Commit to main → Push origin** を押します。ライブラリを含めて100ファイル以上あるため、一括転送にはGitかGitHub Desktopを使うとフォルダ構成を保てます。

## 3. Pagesを有効にする

1. リポジトリの **Settings → Pages** を開きます。
2. **Build and deployment** の **Source** で **Deploy from a branch** を選びます。
3. ブランチを **main**、フォルダを **/(root)** にして **Save** を押します。
4. 公開処理が終わったら **Settings → Pages** に表示されるURLを開きます。URLの形式は `https://ユーザー名.github.io/リポジトリ名/` です。
5. 「こんにちは！」が表示され、右のボタンを押すと見出しが「JavaScriptが動きました！」に変わることを確かめます。学生にはここで確認したURLを配布します。

公開設定が終わってもURLが出ない場合は、リポジトリの **Actions** で `pages build and deployment` の結果を確認してください。画面だけ表示されてエディターが開かない場合は、`vendor/` の中のファイルまでアップロードされているか確認してください。

[GitHub公式の公開元設定手順](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## 手元のPCで確認する

Pythonがインストール済みの場合は、ZIPを展開したフォルダでターミナルを開き、次を実行します。Windowsで `python` が使えない場合は、`py -m http.server 8000 --bind 127.0.0.1` を試してください。

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Chromeで `http://localhost:8000/` を開きます。アプリ本体はモジュールやワーカーを使うため、公開URLまたはローカルのHTTPサーバー経由で開いてください。学生が書き出した**教材ファイル**は通常のHTML、CSS、JavaScriptとして、VSCodeでも編集できます。
