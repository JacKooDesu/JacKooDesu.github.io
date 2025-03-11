---
title: Unity Dll 版本衝突
date: 2025-03-11 20:58:16
tags: [Unity,C#]
---

### `The type 'TypeName' exists in both 'Dll-A, Version=x.x.x, Culture=neutral, PublicKeyToken=null' and 'Dll-B, Version=x.x.x, Culture=neutral, PublicKeyToken=null'`

這個報錯困擾了我好一段時間，因為我沒辦法手動管理 Unity 的相依（尤其是 `UPM` 跟 `NuGet` 下載的包），但後來發現可以用 `Assembly Definition` 的 `Override Reference` 來解相依。

![image](/images/Unity-Dll-版本衝突/assembly-override-reference.png)