export const starterFiles = {
  "index.html": `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>はじめてのWebページ</title>
  <style>
    body {
      padding: 24px;
      background: #f2efff;
      font-family: system-ui, sans-serif;
    }

    button { padding: 8px 12px; }
  </style>
</head>
<body>
  <h1 id="message">こんにちは！</h1>
  <button id="hello" type="button">クリックしてみよう</button>

  <script>
    const button = document.getElementById("hello");
    const message = document.getElementById("message");

    button.addEventListener("click", () => {
      message.textContent = "JavaScriptが動きました！";
      console.log(message.textContent);
    });
  </script>
</body>
</html>
`
};
