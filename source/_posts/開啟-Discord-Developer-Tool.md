---
title: 開啟 Discord Developer Tool
date: 2025-04-12 16:58:04
tags: [JS]
---

## 需求

在 Discord 是 Electron 基底的應用程式（Chromium 運行環境），所以理應要能夠開啟同瀏覽器 F12 的開發者工具。

## 設定

因為開發者工具有隱私洩漏的疑慮，所以預設是無法開啟的，到以下路徑設定檔內新增 parameter：

`%appdata%/discord/settings.json`

{% note purple %}
Windows 版的應用快取路徑，Linux 應該是 `home/.discord`。
{% endnote %}

於該 JSON 設定檔內添加：

```json setting.json
{
  .
  .
  .
  "DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING": true
}
```

## 快捷鍵

Discord 內開啟開發者工具快捷鍵為：

`Ctrl` + `Shift` + `i`
