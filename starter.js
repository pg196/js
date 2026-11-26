export const starterFiles = {
  "index.html": `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>はじめてのWebページ</title>
  <link rel="stylesheet" href="./style.css">
  <script src="./script.js" defer></script>
</head>
<body>
  <main>
    <h1 id="message">こんにちは！</h1>
    <button id="hello" type="button">クリックしてみよう</button>
  </main>
</body>
</html>
`,
  "style.css": `body {
  margin: 0;
  padding: 32px 24px;
  background: #f2efff;
  color: #282044;
  font-family: system-ui, sans-serif;
}

main {
  max-width: 440px;
  margin: 0 auto;
  padding: 28px;
  border: 1px solid #ded6f6;
  border-radius: 12px;
  background: white;
}

h1 {
  margin: 0 0 20px;
  font-size: 28px;
}

button {
  padding: 10px 16px;
  border: 0;
  border-radius: 6px;
  background: #5b3bb5;
  color: white;
  font: inherit;
  cursor: pointer;
}

[data-clicked="yes"] {
  color: #5b3bb5;
}
`,
  "script.js": `const button = document.getElementById("hello");
const message = document.querySelector("#message");

button.addEventListener("click", () => {
  message.textContent = "JavaScriptが動きました！";
  message.setAttribute("data-clicked", "yes");
  console.log(message.textContent);
});
`
};
