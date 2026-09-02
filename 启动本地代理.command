#!/bin/bash
# 双击运行：启动本地代理服务器（带缓存，可绕开数据源限流）
# 只用线上站点 https://032002110.github.io/aoe4-hub/ 的话无需运行本脚本。

cd "$(dirname "$0")" || exit 1

if lsof -ti:5173 >/dev/null 2>&1; then
  echo "✅ 端口 5173 已被占用，本地代理应该已经在运行了。"
  echo "   打开 http://localhost:5173"
  open "http://localhost:5173" 2>/dev/null
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 没找到 node。请先安装 Node.js（https://nodejs.org），或直接用线上站点："
  echo "   https://032002110.github.io/aoe4-hub/"
  exit 1
fi

echo "⚔️  启动本地代理（缓存数据，减少限流）…"
echo "   浏览器会自动打开 http://localhost:5173"
echo "   关闭本窗口即可停止服务。"
echo
sleep 1
open "http://localhost:5173" 2>/dev/null
exec node server.js
