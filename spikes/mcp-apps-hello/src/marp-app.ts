import { App } from "@modelcontextprotocol/ext-apps";
import { Marp } from "@marp-team/marp-core";

const statusEl = document.getElementById("status")!;
const slideEl = document.getElementById("slide")!;
const prevBtn = document.getElementById("prev") as HTMLButtonElement;
const nextBtn = document.getElementById("next") as HTMLButtonElement;
const pageInfo = document.getElementById("pageinfo")!;

const DEFAULT_MD = `# Marp Board

marp-core が **sandboxed iframe の中で複数ページを描画**できれば board は実用レベル。

---

## ページ送りの実証

◀▶ ボタンでスライドを進める。これは iframe 内 JS が marp-core の出力を 1 枚ずつ出し分けているだけ。

- ページ番号も出る
- board は完全な HTML/JS アプリ

---

## v2 board でできること

- ライブ編集（textarea → 再描画）
- PDF 出力ボタン（\`render_marp\` を server tool として呼ぶ）
- 編集を AI に同期（\`updateModelContext\`）= 共有キャンバス
`;

let slides: HTMLElement[] = [];
let idx = 0;

function show(i: number): void {
  if (!slides.length) return;
  idx = Math.max(0, Math.min(i, slides.length - 1));
  slides.forEach((s, n) => {
    s.style.display = n === idx ? "block" : "none";
  });
  pageInfo.textContent = `${idx + 1} / ${slides.length}`;
  prevBtn.disabled = idx === 0;
  nextBtn.disabled = idx === slides.length - 1;
}

// marp-core で描画。eval/CSP に当たればここで例外（= #652 を踏む）
function renderMarp(markdown: string): boolean {
  try {
    const marp = new Marp();
    const { html, css } = marp.render(markdown);
    slideEl.innerHTML = `<style>${css}</style>${html}`;
    slides = Array.from(
      slideEl.querySelectorAll<HTMLElement>("svg[data-marpit-svg]"),
    );
    show(0);
    return true;
  } catch (e) {
    statusEl.textContent = "❌ marp-core 描画失敗（#652 を踏んだ可能性）: " + String(e);
    return false;
  }
}

prevBtn.addEventListener("click", () => show(idx - 1));
nextBtn.addEventListener("click", () => show(idx + 1));

const app = new App({ name: "Marp Board", version: "0.0.2" });

// Host が markdown を push してきたらそれを描画
app.ontoolresult = (result) => {
  const md = result.content?.find((c) => c.type === "text")?.text;
  if (md && renderMarp(md)) {
    statusEl.textContent = `✅ marp-core で ${slides.length} ページ描画（◀▶ で送れる）`;
  }
};

// handshake → 既定の複数ページサンプルを描画
app
  .connect()
  .then(() => {
    if (renderMarp(DEFAULT_MD)) {
      statusEl.textContent = `✅ connected + marp-core が ${slides.length} ページ描画（◀▶ で送れる）`;
    }
  })
  .catch((e) => {
    statusEl.textContent = "❌ connect failed: " + String(e);
  });
