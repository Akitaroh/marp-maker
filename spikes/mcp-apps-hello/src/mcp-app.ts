import { App } from "@modelcontextprotocol/ext-apps";

const statusEl = document.getElementById("status")!;
const resultEl = document.getElementById("result")!;
const callBtn = document.getElementById("call-btn")!;

const app = new App({ name: "Hello Board", version: "0.0.1" });

// Host が tool 結果を push してきたら表示（初回 render 時に届く）
app.ontoolresult = (result) => {
  const text = result.content?.find((c) => c.type === "text")?.text;
  resultEl.textContent = text ?? "[tool result: no text]";
};

// UI からの能動 tool 呼び出し（双方向ブリッジの検証）
callBtn.addEventListener("click", async () => {
  resultEl.textContent = "calling hello_board…";
  try {
    const result = await app.callServerTool({ name: "hello_board", arguments: {} });
    const text = result.content?.find((c) => c.type === "text")?.text;
    resultEl.textContent = text ?? "[tool result: no text]";
  } catch (e) {
    resultEl.textContent = "❌ callServerTool failed: " + String(e);
  }
});

// handshake。これが resolve すれば issue #165 の本丸（app.connect() hang）をクリア
app
  .connect()
  .then(() => {
    statusEl.textContent = "✅ connected to host — bridge OK (issue #165 cleared)";
  })
  .catch((e) => {
    statusEl.textContent = "❌ connect failed: " + String(e);
  });
