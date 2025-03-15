---
title: Powershell 執行原則簡記
date: 2025-03-13 13:48:11
tags: [Powershell]
---

## `因為這個系統上已停用指令碼執行，所以無法載入 xxx.ps1 檔案`

執行原則問題，有個簡單解決的方法讓該次執行階段可以執行腳本。

```Powershell
powershell -ExecutionPolicy bypass
```

{% note blue %}
再開啟一個 `Powershell` 並加上 `ExecutionPolicy` 參數繞過，也不會像 `Set-ExecutionPolicy` 一樣改到所有執行階段。
{% endnote %}
