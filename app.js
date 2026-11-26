import { renderPreview } from "./preview.js";
import { starterFiles } from "./starter.js";

const byId = id => document.getElementById(id);
const workspace = byId("workspace");
const storageKey = "web-code-classroom:v1:" + new URL(".", location.href).pathname;
const htmlFile = path => /\.html?$/i.test(path);
const languages = { html: "html", htm: "html", css: "css", js: "javascript", mjs: "javascript", json: "json", txt: "plaintext", md: "markdown" };
const fileLanguage = path => languages[path.split(".").pop()?.toLowerCase()] ?? "plaintext";
const validPath = path => typeof path === "string" && path.length <= 240
  && path.split("/").every(part => part && part.trim() === part && part !== "." && part !== ".."
    && !/[\\<>:"|?*#%\u0000-\u001f]/.test(part) && !/[. ]$/.test(part)
    && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));

let files = new Map(Object.entries(starterFiles));
let active = "index.html";
let entry = "index.html";
let live = false;
let fontSize = 15;
let stored = null;
let unreadableStorage = false;
let dirty = false;
let hasConflict = false;
let editor;
let monaco;
let previewTimer;
let saveTimer;
let runToken;
let frame;
let errorCount = 0;
const models = new Map();
const views = new Map();

try {
  stored = localStorage.getItem(storageKey);
  if (stored !== null) {
    const saved = JSON.parse(stored);
    if (saved.version !== 1 || !Array.isArray(saved.files)
      || !saved.files.every(pair => Array.isArray(pair) && validPath(pair[0]) && typeof pair[1] === "string")) {
      throw new Error("Invalid saved project");
    }
    files = new Map(saved.files);
    active = files.has(saved.active) ? saved.active : files.keys().next().value;
    entry = htmlFile(saved.entry ?? "") && files.has(saved.entry) ? saved.entry : undefined;
    live = saved.live === true;
    if (Number.isInteger(saved.fontSize)) fontSize = Math.min(30, Math.max(11, saved.fontSize));
  }
} catch {
  unreadableStorage = true;
}

function status(message) {
  byId("save-status").textContent = message;
}

function save(manual = false, overwrite = false) {
  clearTimeout(saveTimer);
  if (!dirty && !manual) return;
  if (unreadableStorage && !overwrite) {
    status("保存データを読めませんでした。ZIPを保存できます");
    return;
  }
  try {
    if (!overwrite && localStorage.getItem(storageKey) !== stored) {
      hasConflict = true;
      status("別のタブで更新されました。ZIPを保存できます");
      return;
    }
    const payload = JSON.stringify({ version: 1, files: [...files], active, entry, live, fontSize });
    localStorage.setItem(storageKey, payload);
    stored = payload;
    dirty = false;
    hasConflict = false;
    unreadableStorage = false;
    status("このブラウザに保存済み");
  } catch {
    status("ブラウザに保存できません。ZIPを保存してください");
  }
}

function changed({ preview = false } = {}) {
  dirty = true;
  if (!hasConflict && !unreadableStorage) status("変更を保存中…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 180);
  if (preview && live) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(run, 650);
  }
}

window.addEventListener("pagehide", () => save());
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });

function clearConsole() {
  errorCount = 0;
  byId("error-count").hidden = true;
  const hint = document.createElement("p");
  hint.className = "empty-log";
  hint.textContent = "console.log() の出力やエラーがここに表示されます。";
  byId("console").replaceChildren(hint);
}

function consoleLine(level, message, file, line, column) {
  const output = byId("console");
  const link = files.has(file) && Number.isInteger(line) && line > 0;
  const row = document.createElement(link ? "button" : "div");
  row.className = "log-row " + level;
  row.textContent = link ? `${file}:${line}${column > 0 ? ":" + column : ""}  ${message}` : message;
  if (link) row.addEventListener("click", () => {
    setExpanded(false);
    selectFile(file);
    if (!editor) return;
    const model = editor.getModel();
    const position = model.validatePosition({ lineNumber: line, column: column || 1 });
    editor.setPosition(position);
    editor.revealPositionInCenter(position);
    editor.focus();
  });
  output.querySelector(".empty-log")?.remove();
  output.append(row);
  if (output.childElementCount > 250) output.firstElementChild.remove();
  output.scrollTop = output.scrollHeight;
  if (level === "error") {
    const badge = byId("error-count");
    badge.textContent = `エラー ${++errorCount}`;
    badge.hidden = false;
  }
}

window.addEventListener("message", event => {
  const data = event.data;
  if (event.source !== frame?.contentWindow || event.origin !== "null"
    || data?.type !== "classroom-console" || data.token !== runToken) return;
  if (data.level === "clear") clearConsole();
  else if (["log", "info", "warn", "error", "debug"].includes(data.level) && typeof data.message === "string") {
    consoleLine(data.level, data.message.slice(0, 12000), data.file, data.line, data.column);
  }
});

function run() {
  clearTimeout(previewTimer);
  save();
  clearConsole();
  const host = byId("frame-host");
  frame = undefined;
  if (!files.has(entry)) {
    const hint = document.createElement("p");
    hint.textContent = "HTMLファイルを作ると、ここに表示されます。";
    host.replaceChildren(hint);
    return;
  }
  runToken = crypto.randomUUID();
  try {
    const next = document.createElement("iframe");
    next.setAttribute("sandbox", "allow-scripts allow-modals");
    next.setAttribute("referrerpolicy", "no-referrer");
    next.title = "実行結果";
    next.srcdoc = renderPreview(files, entry, runToken);
    frame = next;
    host.replaceChildren(frame);
  } catch (error) {
    const hint = document.createElement("p");
    hint.textContent = "プレビューを表示できませんでした。";
    host.replaceChildren(hint);
    consoleLine("error", String(error));
  }
}

function fileIcon(path) {
  const icon = document.createElement("span");
  const type = fileLanguage(path);
  icon.className = "file-icon " + type;
  icon.textContent = { html: "<>", css: "#", javascript: "JS", json: "{}" }[type] ?? "·";
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function fileButton(path, tab) {
  const button = document.createElement("button");
  button.className = tab ? "tab" : "file";
  button.title = path;
  const label = document.createElement("span");
  label.textContent = path;
  button.append(fileIcon(path), label);
  if (tab) {
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", "editor");
    button.setAttribute("aria-selected", String(path === active));
    button.tabIndex = path === active ? 0 : -1;
    button.addEventListener("keydown", event => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const paths = [...files.keys()];
      const index = paths.indexOf(path);
      const next = { ArrowLeft: (index + paths.length - 1) % paths.length,
        ArrowRight: (index + 1) % paths.length, Home: 0, End: paths.length - 1 }[event.key];
      selectFile(paths[next]);
      byId("tabs").querySelector('[aria-selected="true"]')?.focus();
    });
  } else {
    button.classList.toggle("selected", path === active);
    button.setAttribute("aria-current", path === active ? "true" : "false");
  }
  button.addEventListener("click", () => { selectFile(path); editor?.focus(); });
  return button;
}

function renderFiles() {
  const paths = [...files.keys()];
  byId("files").replaceChildren(...paths.map(path => fileButton(path, false)));
  byId("tabs").replaceChildren(...paths.map(path => fileButton(path, true)));
  const selected = byId("tabs").querySelector('[aria-selected="true"]');
  selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
  byId("active-name").textContent = active ?? "ファイルなし";
  byId("active-name").title = active ?? "";
  for (const id of ["rename", "remove", "download", "find"]) byId(id).disabled = !active;
  byId("zip").disabled = paths.length === 0;
  const pages = paths.filter(htmlFile);
  if (!pages.includes(entry)) entry = pages.find(path => path === "index.html") ?? pages[0];
  byId("entry").replaceChildren(...pages.map(path => new Option(path, path, false, path === entry)));
  byId("entry").disabled = pages.length === 0;
}

function getModel(path) {
  if (!models.has(path)) {
    const model = monaco.editor.createModel(files.get(path), fileLanguage(path), monaco.Uri.from({ scheme: "file", path: "/" + path }));
    model.updateOptions({ tabSize: 2, insertSpaces: true, trimAutoWhitespace: true });
    model.onDidChangeContent(() => {
      files.set(path, model.getValue());
      changed({ preview: true });
    });
    models.set(path, model);
  }
  return models.get(path);
}

function showModel() {
  if (!editor) return;
  editor.setModel(active ? getModel(active) : null);
  if (views.has(active)) editor.restoreViewState(views.get(active));
  updateCursor();
}

function selectFile(path) {
  if (!files.has(path) || active === path) return;
  if (editor?.getModel()) views.set(active, editor.saveViewState());
  active = path;
  showModel();
  renderFiles();
  changed();
}

const actionDialog = byId("action-dialog");
const fileInput = byId("filename");
let dialogAction;

function ask({ title, text = "", filename, accept = "決定", action }) {
  byId("action-title").textContent = title;
  byId("action-text").textContent = text;
  byId("action-text").hidden = !text;
  byId("action-error").textContent = "";
  byId("accept").textContent = accept;
  for (const node of [fileInput, byId("filename-label")]) node.hidden = filename === undefined;
  fileInput.value = filename ?? "";
  dialogAction = action;
  actionDialog.showModal();
  if (filename === undefined) byId("cancel").focus();
  else { fileInput.focus(); fileInput.select(); }
}

byId("cancel").onclick = () => actionDialog.close();
actionDialog.querySelector("form").onsubmit = event => {
  event.preventDefault();
  const issue = dialogAction?.(fileInput.value.trim());
  if (issue) byId("action-error").textContent = issue;
  else actionDialog.close();
};
actionDialog.addEventListener("close", () => { dialogAction = undefined; });

function validateName(path, previous) {
  if (!validPath(path)) return "使えない名前です。例：lesson.js、pages/about.html";
  const normalized = path.toLowerCase();
  const remaining = [...files.keys()].filter(name => name !== previous).map(name => name.toLowerCase());
  if (remaining.some(name => name === normalized || name.startsWith(normalized + "/") || normalized.startsWith(name + "/"))) {
    return "同じ名前のファイルまたはフォルダがあります。";
  }
  return "";
}

function disposeModel(path) {
  if (active === path) editor?.setModel(null);
  models.get(path)?.dispose();
  models.delete(path);
  views.delete(path);
}

function refreshAfterFilesChanged() {
  renderFiles();
  showModel();
  changed();
  run();
}

byId("add").onclick = () => ask({
  title: "ファイルを作成", filename: "", text: "拡張子まで入力してください。例：lesson.js",
  accept: "作成", action: path => {
    const issue = validateName(path);
    if (issue) return issue;
    if (editor?.getModel()) views.set(active, editor.saveViewState());
    files.set(path, "");
    active = path;
    refreshAfterFilesChanged();
  }
});

byId("rename").onclick = () => {
  const oldPath = active;
  ask({ title: "ファイル名を変更", filename: oldPath, accept: "変更",
    text: "ほかのファイルから参照している場合は、そのパスも変更してください。",
    action: path => {
      if (path === oldPath) return;
      const issue = validateName(path, oldPath);
      if (issue) return issue;
      const view = editor?.saveViewState();
      disposeModel(oldPath);
      files = new Map([...files].map(([name, value]) => [name === oldPath ? path : name, value]));
      active = path;
      if (view) views.set(path, view);
      if (entry === oldPath) entry = path;
      refreshAfterFilesChanged();
    }
  });
};

byId("remove").onclick = () => {
  const path = active;
  ask({ title: "ファイルを削除", text: `「${path}」を削除しますか？`, accept: "削除",
    action: () => {
      disposeModel(path);
      files.delete(path);
      active = files.keys().next().value;
      refreshAfterFilesChanged();
    }
  });
};

byId("reset").onclick = () => ask({
  title: "教材を初期状態に戻す", text: "入力したコードを消して、見本の index.html だけに戻します。必要なコードは先にZIPで保存してください。",
  accept: "初期化する", action: () => {
    for (const path of models.keys()) disposeModel(path);
    editor?.setModel(null);
    views.clear();
    files = new Map(Object.entries(starterFiles));
    active = entry = "index.html";
    refreshAfterFilesChanged();
  }
});

function download(blob, filename) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

byId("download").onclick = () => {
  download(new Blob([files.get(active)], { type: "text/plain;charset=utf-8" }), active.split("/").at(-1));
};
byId("zip").onclick = async () => {
  const button = byId("zip");
  button.disabled = true;
  try {
    const archive = new window.JSZip();
    for (const [path, contents] of files) archive.file(path, contents);
    download(await archive.generateAsync({ type: "blob", compression: "DEFLATE" }), "web-code-project.zip");
  } catch {
    status("ZIPを作成できませんでした。個別に保存できます");
  } finally {
    button.disabled = files.size === 0;
  }
};

function manualSave() {
  save(true);
  if (hasConflict || unreadableStorage) ask({
    title: "このタブの内容で保存する",
    text: "ブラウザにある別の保存内容を上書きします。残しておきたい場合はキャンセルし、このタブのコードをZIPで保存してください。",
    accept: "上書きして保存", action: () => { save(true, true); }
  });
}
byId("save").onclick = manualSave;
byId("run").onclick = run;
byId("clear").onclick = clearConsole;
byId("entry").onchange = event => {
  entry = event.target.value;
  changed();
  run();
};
byId("live").checked = live;
byId("live").onchange = event => {
  live = event.target.checked;
  changed();
  if (live) run();
  else clearTimeout(previewTimer);
};

function setExpanded(expanded) {
  workspace.classList.toggle("expanded", expanded);
  byId("expand").textContent = expanded ? "元に戻す" : "拡大";
  byId("expand").setAttribute("aria-pressed", String(expanded));
}
byId("expand").onclick = () => setExpanded(!workspace.classList.contains("expanded"));

document.addEventListener("keydown", event => {
  if (actionDialog.open) return;
  if (event.key === "Escape" && workspace.classList.contains("expanded")) setExpanded(false);
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  if (event.key.toLowerCase() === "s" || event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Enter") run();
    else manualSave();
  }
}, true);

function updateCursor() {
  const position = editor?.getModel() && editor.getPosition();
  byId("cursor-status").textContent = position ? `${position.lineNumber} 行 ${position.column} 列 · UTF-8` : "";
}

function updateFont(delta) {
  fontSize = Math.min(30, Math.max(11, fontSize + delta));
  editor?.updateOptions({ fontSize });
  changed();
}
byId("font-minus").onclick = () => updateFont(-1);
byId("font-plus").onclick = () => updateFont(1);
byId("find").onclick = () => {
  editor?.focus();
  editor?.getAction("editor.action.startFindReplaceAction")?.run();
};

function configureSplitter(id, name, paneId, side) {
  const splitter = byId(id);
  const pane = byId(paneId);
  const vertical = side !== "bottom";
  function resize(size) {
    const bounds = workspace.getBoundingClientRect();
    const max = side === "bottom" ? bounds.height - 160 : bounds.width - 215
      - byId(side === "left" ? "preview-pane" : "explorer").getBoundingClientRect().width;
    const min = { left: 140, right: 255, bottom: 85 }[side];
    workspace.style.setProperty(name, Math.max(min, Math.min(max, size)) + "px");
  }
  splitter.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    splitter.setPointerCapture(event.pointerId);
    splitter.classList.add("dragging");
    document.body.classList.add("resizing");
  });
  splitter.addEventListener("pointermove", event => {
    if (!splitter.hasPointerCapture(event.pointerId)) return;
    const bounds = workspace.getBoundingClientRect();
    resize({ left: event.clientX - bounds.left, right: bounds.right - event.clientX,
      bottom: bounds.bottom - event.clientY }[side]);
  });
  splitter.addEventListener("lostpointercapture", () => {
    splitter.classList.remove("dragging");
    document.body.classList.remove("resizing");
  });
  splitter.addEventListener("keydown", event => {
    const keys = vertical ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const direction = (event.key === keys[1] ? 1 : -1) * (side === "left" ? 1 : -1);
    const rect = pane.getBoundingClientRect();
    resize((vertical ? rect.width : rect.height) + direction * 16);
  });
}
configureSplitter("left-split", "--left", "explorer", "left");
configureSplitter("right-split", "--preview", "preview-pane", "right");
configureSplitter("bottom-split", "--console", "console-pane", "bottom");
window.addEventListener("resize", () => {
  for (const name of ["--left", "--preview", "--console"]) workspace.style.removeProperty(name);
});

renderFiles();
if (new URLSearchParams(location.search).get("safe") === "1") {
  live = false;
  byId("live").checked = false;
  const hint = document.createElement("p");
  hint.textContent = "プレビューを一時停止しています。「実行」を押すと再開します。";
  byId("frame-host").replaceChildren(hint);
} else {
  run();
}
if (unreadableStorage) status("保存データを読めませんでした。ZIPを保存できます");
else status(stored ? "このブラウザに保存済み" : "変更はこのブラウザに自動保存されます");

const loader = window.require;
if (loader) {
  loader.config({ paths: { vs: new URL("./vendor/monaco/min/vs", import.meta.url).href }, "vs/nls": { availableLanguages: { "*": "ja" } } });
  loader(["vs/editor/editor.main"], () => {
    monaco = window.monaco;
    monaco.editor.defineTheme("classroom-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#171a2b", "editor.foreground": "#e7eaf5", "editor.lineHighlightBackground": "#24273d",
        "editorLineNumber.foreground": "#969ab8", "editorLineNumber.activeForeground": "#efeaff",
        "editor.selectionBackground": "#534788", "editorCursor.foreground": "#d8ccff",
        "editorWidget.background": "#23263a", "editorSuggestWidget.background": "#23263a"
      }
    });
    byId("loading").remove();
    editor = monaco.editor.create(byId("editor"), {
      model: null, theme: "classroom-dark", fontSize,
      fontFamily: 'Consolas, "Cascadia Mono", Menlo, monospace',
      fontLigatures: false, automaticLayout: true, minimap: { enabled: false },
      lineNumbers: "on", scrollBeyondLastLine: false, roundedSelection: false,
      autoIndent: "full", autoClosingBrackets: "languageDefined", autoClosingQuotes: "languageDefined",
      tabSize: 2, insertSpaces: true, padding: { top: 12 }, ariaLabel: "コードの編集"
    });
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      ...monaco.languages.typescript.javascriptDefaults.getCompilerOptions(),
      target: monaco.languages.typescript.ScriptTarget.ES2020
    });
    for (const path of files.keys()) getModel(path);
    editor.onDidChangeCursorPosition(updateCursor);
    showModel();
  }, editorFailed);
} else editorFailed();

function editorFailed() {
  byId("loading").textContent = "エディターを読み込めませんでした。ページを再読み込みしてください。";
}
