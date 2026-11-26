import { parse, parseFragment, serialize } from "./vendor/parse5.js";

const policy = "default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'";
const virtualOrigin = "https://classroom.invalid";

function dataURL(contents, mime) {
  const bytes = new TextEncoder().encode(contents);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return `data:${mime};charset=utf-8;base64,${btoa(binary)}`;
}

export function resolveFile(reference, from) {
  if (!reference || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(reference.trim())) return null;
  try {
    const base = from.split("/").map(encodeURIComponent).join("/");
    const url = new URL(reference, `${virtualOrigin}/${base}`);
    return url.origin === virtualOrigin ? decodeURIComponent(url.pathname.slice(1)) : null;
  } catch {
    return null;
  }
}

function setupConsole(token, sources, diagnostics, entry, inlineRanges) {
  const send = parent.postMessage.bind(parent);
  function report(level, message, file, line, column) {
    send({ type: "classroom-console", token, level, message: String(message).slice(0, 12000), file, line, column }, "*");
  }

  function format(value) {
    if (value === null || typeof value !== "object") return String(value);
    if (value instanceof Error) return value.stack || String(value);
    if (value instanceof Element) return value.outerHTML;
    const seen = new WeakSet();
    return JSON.stringify(value, (_, item) => {
      if (typeof item === "bigint") return String(item) + "n";
      if (item && typeof item === "object") {
        if (seen.has(item)) return "[循環参照]";
        seen.add(item);
      }
      return item;
    });
  }

  for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = console[level].bind(console);
    console[level] = (...values) => {
      const message = values.map(value => {
        try { return format(value); } catch { return "[表示できない値]"; }
      }).join(" ");
      report(level, message);
      original(...values);
    };
  }
  console.clear = () => report("clear", "");

  function sourcePosition(filename, line, column, stack = "") {
    if (typeof stack !== "string") stack = "";
    for (const source of sources) {
      if (filename === source.url || filename === source.label) {
        return [source.path, line + source.offset, column];
      }
      const prefix = source.label + ":";
      const position = stack.indexOf(prefix);
      const match = position >= 0 && /^(\d+):(\d+)/.exec(stack.slice(position + prefix.length));
      if (match) return [source.path, Number(match[1]) + source.offset, Number(match[2])];
    }
    if (filename === "about:srcdoc") {
      const inline = inlineRanges.find(range => line >= range.first && line <= range.last);
      if (inline) return [entry, inline.original + line - inline.first, column];
    }
    return [];
  }

  window.addEventListener("error", event => {
    if (event instanceof ErrorEvent) {
      report("error", event.message, ...sourcePosition(event.filename, event.lineno, event.colno, event.error?.stack));
    } else if (event.target?.dataset?.classroomFile) {
      report("error", "読み込めませんでした：" + event.target.dataset.classroomFile);
    }
  }, true);
  window.addEventListener("unhandledrejection", event => {
    report("error", String(event.reason), ...sourcePosition("", 0, 0, event.reason?.stack));
  });
  window.addEventListener("click", event => {
    const link = event.target instanceof Element && event.target.closest("a, area");
    if (link?.hasAttribute("href") && !link.getAttribute("href").startsWith("#")) event.preventDefault();
  }, true);
  for (const message of diagnostics) report("warn", message);
}

function setAttr(node, name, value) {
  const existing = node.attrs.find(attr => attr.name === name && !attr.namespace);
  if (existing) existing.value = value;
  else node.attrs.push({ name, value });
}

const attribute = (node, name) => node.attrs?.find(attr => attr.name === name && !attr.namespace)?.value;
const isScript = type => !type || /^(module|(?:text|application)\/(?:x-)?(?:java|ecma)script)$/i.test(type.trim());

export function renderPreview(files, entry, token) {
  const document = parse(files.get(entry), { sourceCodeLocationInfo: true });
  const html = document.childNodes.find(node => node.tagName === "html");
  const head = html.childNodes.find(node => node.tagName === "head");
  const diagnostics = [];
  const sources = [];
  const disabledElements = new Set(["base", "iframe", "frame", "frameset", "object", "embed"]);

  function scriptAsset(path, code, offset) {
    const label = `classroom-source-${sources.length + 1}`;
    const url = dataURL(code + "\n//# sourceURL=" + label, "text/javascript");
    sources.push({ path, url, label, offset });
    return url;
  }

  function update(node) {
    if (disabledElements.has(node.tagName)) return false;
    if (node.tagName === "meta" && attribute(node, "http-equiv") !== undefined) return false;

    const isStyle = node.tagName === "link" && (attribute(node, "rel") ?? "").toLowerCase().split(/\s+/).includes("stylesheet");
    if (isStyle || node.tagName === "script" && isScript(attribute(node, "type"))) {
      const key = isStyle ? "href" : "src";
      const ref = attribute(node, key);
      if (ref !== undefined) {
        const path = resolveFile(ref, entry);
        if (!path || !files.has(path)) {
          diagnostics.push(`読み込めませんでした：${ref || "（空のパス）"}（${entry}）`);
          return false;
        }
        setAttr(node, key, isStyle ? dataURL(files.get(path), "text/css") : scriptAsset(path, files.get(path), 0));
        if (!isStyle) setAttr(node, "crossorigin", "anonymous");
        setAttr(node, "data-classroom-file", path);
      } else if (!isStyle && node.sourceCodeLocation?.startTag) {
        const code = node.childNodes.map(child => child.value ?? "").join("");
        setAttr(node, "src", scriptAsset(entry, code, node.sourceCodeLocation.startTag.endLine - 1));
        setAttr(node, "crossorigin", "anonymous");
        node.attrs = node.attrs.filter(attr => !["async", "defer"].includes(attr.name));
        node.childNodes = [];
      }
    }
    if (node.tagName === "link" && !isStyle) return false;
    if (node.childNodes) node.childNodes = node.childNodes.filter(update);
    if (node.content) update(node.content);
    return true;
  }

  update(document);
  // Keep the browser's original quirks-mode choice when no standard doctype exists.
  const metadata = parseFragment(`<meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${policy}"><script></script>`).childNodes;
  const bootstrap = metadata.at(-1);
  const serializeArgument = value => JSON.stringify(value).replaceAll("<", "\\u003c");
  function setBootstrap(inlineRanges = []) {
    const args = [token, sources, diagnostics, entry, inlineRanges].map(serializeArgument).join(",");
    bootstrap.childNodes = [{ nodeName: "#text", value: `(${setupConsole.toString()})(${args});`, parentNode: bootstrap }];
  }
  head.childNodes.unshift(...metadata);
  for (const node of metadata) node.parentNode = head;
  setBootstrap();
  const serialized = serialize(document);
  const originalRanges = inlineEventRanges(document);
  if (!originalRanges.length) return serialized;

  // Serialization inserts the console bridge and may normalize the HTML.
  // Translate locations of handlers such as onclick back to the source HTML.
  const renderedRanges = inlineEventRanges(parse(serialized, { sourceCodeLocationInfo: true }));
  const inlineRanges = renderedRanges.map((range, index) => ({
    first: range.startLine, last: range.endLine, original: originalRanges[index]?.startLine
  })).filter(range => range.original);
  setBootstrap(inlineRanges);
  return serialize(document);
}

function inlineEventRanges(node) {
  const locations = node.sourceCodeLocation?.attrs ?? {};
  const own = Object.entries(locations).filter(([name]) => name.startsWith("on")).map(([, range]) => range);
  return own.concat((node.childNodes ?? []).flatMap(inlineEventRanges), node.content ? inlineEventRanges(node.content) : []);
}
