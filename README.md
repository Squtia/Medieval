# 🚀 Web Token 技能與自製 MCP 工具包 (同事分享版)

## 💡 這是什麼？（一句話簡單形容）
**「把您已付費訂閱的 Gemini Advanced 或 ChatGPT Plus 網頁帳號，直接無縫接上 AI Agent (Antigravity / Gemini CLI) 的超強橋樑！」**

平時用 API 算圖或做深度搜尋非常昂貴，動輒燒掉幾十萬 Token。有了 `web_token`：
1. **免額外 API 費用**：直接調用您網頁端每月固定訂閱的強大額度（0 邊際成本）。
2. **預設最高思維深度（延伸思考）**：預設一律開啟 Gemini Web 的「延伸思考 (Extended Thinking)」或 ChatGPT 深度推理模式，享受頂級長鏈思考。
3. **全模態全功能**：支援**深度搜尋 (Deep Research)**、**高階邏輯推理 (o1/o3-mini/Gemini 2.0 Pro)**、**超高畫質生圖 (Imagen 3/4 或 DALL-E 3)** 與 **帶素材多模態分析**。
4. **多任務多分頁並行**：一口氣派發多個任務時，自動在背景開多個 Chrome 分頁並行運算，完成後自動關閉分頁釋放記憶體。
5. **高密度機械語言協議**：Agent 發出的 Prompt 自動轉為極致精準的結構化標籤，並規範以**繁體中文**輸出高品質結果。

---

## 📦 安裝步驟（超簡單一鍵安裝）

### 步驟 1：執行自動安裝
直接雙擊執行本資料夾中的 **`install.bat`**。
它會自動將技能檔案、橋接工具與 MCP 協議複製到您本機的 `%USERPROFILE%\.gemini\` 目錄，並自動安裝所需之 Node.js 套件。

### 步驟 2：確認 MCP 設定檔
打開您的 `%USERPROFILE%\.gemini\config\mcp_config.json`，確認 `mcpServers` 區塊中包含以下設定（若沒有，將本包附帶的 `mcp_config_snippet.json` 內容貼入即可）：
```json
{
  "mcpServers": {
    "gemini-web-bridge": {
      "command": "node",
      "args": [
        "%USERPROFILE%\\.gemini\\config\\tools\\gemini-web-bridge\\src\\server.mjs"
      ],
      "cwd": "%USERPROFILE%\\.gemini\\config\\tools\\gemini-web-bridge"
    }
  }
}
```

### 步驟 3：啟動專用 Chrome 登入帳號（只需一次）
雙擊執行：
`%USERPROFILE%\.gemini\config\tools\gemini-web-bridge\scripts\launch_gemini_chrome.bat`
（或 `launch_chatgpt_chrome.bat`）
在開啟的專用 Chrome 視窗中登入您的 Google / ChatGPT 帳號（登入後保持開啟或需要時開啟即可）。

---

## 🎯 常用使用範例（在 Agent 對話中直接說）

- **深度搜尋（萬字技術白皮書）**：
  > 「`/web_token 用web額度幫我深度調研 2026 最新 Web 3D 渲染架構`」
- **帶素材提問與審查**：
  > 「`/web_token 分析這張架構圖（附圖），指出效能瓶頸`」
- **網頁版高畫質生圖**：
  > 「`/web_token 用web額度生一張賽博龐克風格招財貓`」
- **切換至 ChatGPT 帳號**：
  > 「`/web_token 用GPT額度幫我優化這段演算法代碼`」
