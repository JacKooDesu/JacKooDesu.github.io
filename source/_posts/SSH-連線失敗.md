---
title: SSH 連線失敗
date: 2025-03-20 15:19:07
tags:
---

## `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`

跟 `ssh-key` 有關，刪除當前的 `key` 解決。

```bash
ssh-keygen -R [host-name]
```
