#!/usr/bin/env bash
set -e

echo "=================================================="
echo "🚀 Memory Copilot 雙引擎記憶系統 - 一鍵安裝 (macOS/Linux)"
echo "=================================================="

# 1. 安裝 headroom-ai
echo -e "\n[1/3] 檢查並安裝 Headroom MCP (headroom-ai)..."
if command -v pip3 &> /dev/null; then
    pip3 install --upgrade headroom-ai
elif command -v pip &> /dev/null; then
    pip install --upgrade headroom-ai
else
    echo "❌ 未偵測到 pip，請先安裝 Python 與 pip。"
fi

# 2. 安裝 codebase-memory-mcp
echo -e "\n[2/3] 檢查並安裝 codebase-memory-mcp..."
if ! command -v codebase-memory-mcp &> /dev/null; then
    curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash
fi

if command -v codebase-memory-mcp &> /dev/null; then
    codebase-memory-mcp install -y
fi

# 3. 部署 SKILL.md
echo -e "\n[3/3] 部署 SKILL.md..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$HOME/.gemini/config/skills/memory_copilot"

if [ -f "$SCRIPT_DIR/SKILL.md" ]; then
    mkdir -p "$TARGET_DIR"
    cp "$SCRIPT_DIR/SKILL.md" "$TARGET_DIR/SKILL.md"
    echo "✅ 技能已複製至: $TARGET_DIR/SKILL.md"
fi

echo -e "\n🎉 安裝完成！請重啟 AI Agent/IDE 並輸入「記憶導航」開始使用！"
