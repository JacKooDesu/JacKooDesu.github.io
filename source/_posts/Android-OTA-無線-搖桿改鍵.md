---
title: Android OTA/無線 搖桿改鍵
date: 2026-02-11 17:20:47
tags: [Android, Root, 雜談]
excerpt: "本文介紹在 Android 裝置上修改搖桿按鍵映射的方法，包含系統層級 keylayout 調整與第三方工具的應用經驗。"
---

## 前情提要

最近肝終末地（PC 端），遇到年假家族出遊，想說為了方便這幾天能收菜，就載了手機版。

打開來試著跑跑看，發現操作相當憋扭，所以老辦法，用 OTG 接搖桿。

{% note purple %}

現在二遊說是有手機端，死要賺手遊玩家的錢，但根本就不適合在手機上遊玩。

{% endnote %}

以前只用手機接搖桿跑模擬器玩過，問題點在於：Android 預設將 `Select` 以及 `Home` 鍵分別綁定到 `Back`（返回）和 `Home`（回主畫面）。
終末地的開啟地圖按鈕剛好就是使用 `Select` 鍵，所以沒辦法正常開地圖。

## 方案一 - 修改 keylayout

畢竟也是刷了面具，要改個核心文件不是甚麼困難的事情。

{% note purple %}

按鍵鏡射相關路徑在 `/system/usr/keylayout` 內。
你還需要知道自己的搖桿對應到哪個 `.kl` 檔，例如我的 Logitech F310 就是 `Vendor_046d_Product_c21d.kl`。

羅技的搖桿開頭似乎都是 `Vendor_046d_Product_`。

{% endnote %}

預設如果可以修改，把對應的按鍵改調就可以了：

```diff
  # Logitech F310

  key 304 BUTTON_A
  .
  .
  .
  key 315 BUTTON_START
+ key 314 BUTTON_SELECT
- key 314 BACK
  key 316 HOME
```

這種系統檔案預設是 `read-only`，所以需要先將其改為 `read-write`。
以前用 adb 執行 `adb shell mount -o remount,rw /system` 就可以把 `/system` 改為 `RW` 了，但我就是卡在這一步。

高版本的 Android 系統，運行 `mount` 後你會發現：
`/dev/block/dm-17 on / type erofs`

由於是採用 `EROFS` 格式，所以不能像 `ext4` 那樣直接修改 `RW`。

### 用 OverlayFS 解決（安全的作法）

[magic_overlayfs](https://github.com/agreenbhm/magic_overlayfs) 提供了頂層的 OverlayFS，當然可以將 `/system` 改為 `RW`。

面具刷上模組，重啟就可以了。

優點是可復原，修改幅度小；缺點，我猜應該是有的系統文件沒有完整進入 `OverlayFS` 內，就會讓一些系統 app 崩潰，例如我 op13 原廠相機開了就會閃退，報錯會是某個路徑讀取失敗。

### 直接重新刷入 img（具有風險的作法）

> 我怕失敗刷成磚了，所以沒有實踐。

這個方法的基本原理是修改 `system.img`，在 fastbootd 內刷入 `system` 分區。

當然，既然都做到這步了，更可以選擇把 `system` 分區改成 `ext4` 格式，刷入以後就跟以前一樣下 `mount -o remount,rw` 指令就行了。

{% note purple %}

需要注意，現在大多都是採用 VAB 分區，所以會有 `system_a` 跟 `system_b`，需要先確認當前使用的分區再刷入。

另外，修改過的鏡像需要將驗證關閉：
```bash
fastboot --disable-verity --disable-verification flash vbmeta vbmeta.img
```

{% endnote %}

如果後續有時間用淘汰的機子試試，成功的話再更新。

## 方案二 - 使用 Key Mapper

[KeyMapper](https://github.com/keymapperorg/KeyMapper) 是一個可以調整按鍵綁定的工具，設定方式也很簡單，就是錄製跟選擇目標按鍵而已。

條件相對寬鬆，不用 `root`，但有幾個缺點：

1. 背景運行，很容易被系統當作閒置應用清除掉
2. 並不完全適配所有裝置
3. 因為也能綁定輸入法使用，所以會被當作一個輸入法
