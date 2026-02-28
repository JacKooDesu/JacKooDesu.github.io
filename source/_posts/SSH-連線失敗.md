---
title: SSH 連線失敗
date: 2025-03-20 15:19:07
tags:
excerpt: "本文簡要說明 SSH 連線失敗時遇到 'REMOTE HOST IDENTIFICATION HAS CHANGED!' 的解決方法，主要透過刪除舊有 ssh-key 排除主機識別衝突。"
---

## `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`

跟 `ssh-key` 有關，刪除當前的 `key` 解決。

```bash
ssh-keygen -R [host-name]
```
