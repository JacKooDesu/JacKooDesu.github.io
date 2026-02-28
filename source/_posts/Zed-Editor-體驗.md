---
title: Zed Editor 體驗
date: 2025-09-26 17:18:44
tags: [雜談]
excerpt: "本文分享 Zed Editor 的使用體驗，評析其效能、設計、AI 輔助及與 VS Code 的差異，並提出優缺點與改進建議。"
---

## 啥東西

眾所周知，雖然我是開發 `Unity` 的，但鮮少會開 `Visual Studio`，都用 `VS Code` 做為代碼撰寫的工具。
一方面是 `Visual Studio` 龜速啟動與記憶體占用（儘管現在已經快多了）；另一方面就是已經被快捷鍵養壞了，`VS Code` 進 `Zen Mode`，寫程式滑鼠幾本是不碰了。

這個 `Zed Editor` 也是觀望一段時間了，最近有點閒，剛好 `VS Code` 的插件又出了問題不工作，狠下心鬼轉試用看看。

畢竟 `Zed` 團隊之前也是做過 `Atom` 這種精美的編輯器，大可放心。

那以下就是使用大約兩周的心得。

{% note purple %}

因為我自己建置總失敗（非常有可能是中文系統問題），反正也有人寫了自動拉取部屬的 [repo](https://github.com/deevus/zed-windows-builds)，直接載下來用就行了。

對了，想自己建置先有心理準備，`Rust` 專案，Word 的很大你要忍一下。

{% endnote %}

{% folding red::PowerShell 自動下載 %}

因為很懶，所以有寫個 `ps1` 來更新，好奇可以到 [這裡](https://github.com/JacKooDesu/JacKooDesu.github.io/blob/main/source/_posts/Zed-Editor-體驗/zed-updater.ps1) 看源碼。

```PowerShell
irm 'https://raw.githubusercontent.com/JacKooDesu/JacKooDesu.github.io/refs/heads/main/source/_posts/Zed-Editor-體驗/zed-updater.ps1' | iex
```

{% endfolding %}

## 優點

### 效能

***真的很快。***

並不是看到 `Rust` 基底就高潮，而是真的體驗下來很快。

有人可能會疑惑，欸，官方的 `Trailer` 給大家看 `Zed` 高刷有個屌用。
真別說，還真的有點屌用。

除了高刷外，無論是啟動或是 `Language Server` 的分析、補齊。

尤其是以前 `VS Code` 會卡半天的某些代碼補齊或是重構，甚至 `AI` 預測，都是飛快。

只能說還得是 `Rust`。

{% note purple %}

順帶一提，寫 `C#` 專案時，無論是在 `VS Code` 還是 `Zed`，我都改用 [DotRush](https://github.com/JaneySprings/DotRush) 作為代碼分析與補齊，輕量夠用，推推。

{% endnote %}

### 設計簡潔

雖然這是變相的在說它陽春，不過如果可以把所有專注力放在寫程式上面，也不是甚麼糟糕的事情。
畢竟也有整合 `Git`，所以說完全夠用。

{% note purple %}

社群當然希望內建 `Git Graph`，有的話那一定是加大分嘛。

{% endnote %}

### AI Coding

畢竟是主打 `AI Coding` 的，`Zed` 也放了不少心思在這上面。
有的人覺得 `Cursor` 還是屌打，我不玩 `Vibe Coding`，但至少在程式碼預測上，`Zed` 目前是屌打 `VS Code` 的。

對我這種 `Anti AI` 的人來說，目前 `AI` 輔助就只是更強一點的代碼補齊而已。

但是我敢保證，`Zed` 的 `AI` 拓展性非常高，加上 `Rust` 的速度，體驗上肯定會非常舒服。
這確實開闢出另一條路，可以給另外一些競品做彎道超車。

{% note purple %}

官方說 `Zed` 有強化版的 `Claude` 體驗卡，我也不知道那是個啥。

{% endnote %}

### 其他零碎優點

- 不是 `Electron`
- 一些語言內建支持，所以算是種開箱即用吧
- 某些快捷鍵指令非常實用，例如切換分支
- 內建群聊，我是沒用過，但好色喔
- 沒有微軟爸爸

## 缺點

### 查找

全局搜尋功能邏輯跟 `VS Code` 差很多，或許對 `AI` 理解程式碼有幫助，但對於開發就見仁見智了。

尤其習慣 `VS Code` 的 `Inline Reference` 應該會覺得超級不喜歡。

### 顯卡問題

偶而會有 `Zed` 開在背景導致閃屏的情況發生，不知道要怪誰。

要知道，`Zed` 主打的就是把 `Text Editor` 當遊戲在開發，`GPU` 加速渲染當然是必備的，我猜是因為用 `Vulkan` 的關係？

### 中文輸入

當然，程式碼裡面出現中文的情況少之又少。
但這篇文章正是用 `Zed` 寫的，問題就出現了。

> 中文標點符號並不能正確輸入。

我想跟底層代碼有關吧，全部都是讀取鍵盤輸入的情況，當我想透過 `Ctrl` + `,` 輸入全形逗號時，會自動被導引到設定（預設的快捷鍵，跟 `VS Code` 一樣）。

其他的標點符號也有同樣的問題，不是變成快捷鍵，就是沒辦法輸入。
所以只能先鍵入 `` ` `` 來輸入全形標點。

真要說，這也不算是個大問題，畢竟有時候在 `VS Code` 還需要特別切輸入法的情況，在 `Zed` 裡面就完全沒問題。

### 其他零碎問題

- 自訂 `snippet` 只能放在 `Zed` 的設定目錄下，不能根據專案撰寫 `snippet`
- 儘管預設已經適配大多數 `VS Code` 的快捷鍵，有很大部分的操作邏輯是完全不同的
- `Extension` 太少而且社群不大，自訂性也沒 `VS Code` 高
- `Console` 沒有完美適配，期待後續 `Extension` 支援
- `Windows` 還沒官方支援，呃，但這應該也不是啥大問題
- 沒有本地化（好像也不是啥大問題）
- 沒有微軟爸爸

## 一些血淚史

回想起最早學程式，那時候寫 `Java`。
畢竟是入門，也沒分啥模組，每次上課就是個 `.java` 跑 `javac`。
那時候也很硬核，講師讓大家用 `NotePad++` 超級變色龍寫代碼，自然也沒有甚麼自動補齊的功能。

當然，後來有其他講師讓大家用 `Eclipse` 或是 `NetBeans`，但那時候還小，甚麼全英文介面完全不知道在幹啥。

之後寫其他語言也用過 `Dev C++`、`Arduino IDE` 之類的。

到高中時做專題寫 `Unity` 遊戲，也很神奇，開發環境是 `Ubuntu`（應該是硬體過舊只好遷就裝 `Linux`）。
那個年代 `Visual Studio` 並不支援 `Linux`，所以用的是 `MonoDevelop`。
畢竟還是小菜，能夠寫代碼，東西最後跑得出來就夠了，

一直到後來，成 `Unity` 的狗了，我也已經變成 `VS Code` 的形狀了。

一路走來，就得出了個結論，工具能提升工作效率沒錯，但其實最核心的東西不變，搞得花禮胡哨並不一定好。
如果一個編輯器包了很多我不需要的功能，那它再怎麼好用也沒用。

{% note gray %}

`Zed` 的話，接下來我應該還會再使用一段時間，希望它不要走偏或忘了初心，過度向錢看。

{% endnote %}
