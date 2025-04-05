---
title: Swup 之拿石頭砸自己腳
date: 2025-04-05 18:52:00
tags: [JS]
---

## 前言

到 Hexo 寫點東西也已經十篇了，對，我又不滿足了。

雖然當初是為了利用 `markdown` 快速編輯的特性，但偶而還是想在文章中穿插點瀏覽器交互的東西，沒錯，我說的就是 `<script>`。

照理說應該會很順利的，畢竟 `markdown` 本就支援穿插 `html`，Hexo 渲染時也能把 `<script>` 標籤給放進去，但我測試的時候就發現問題了，這個主題有使用 `Swup.js` 做使用者體驗優化。

{% note purple %}
接下來就是我在寫 {% post_link 純律小實驗 %} 時發生的事情了。。。
{% endnote %}

## 問題在哪

`Swup.js` 基本上是是透過抽換 `html` 內的元素來達到絲滑切頁的效果，其他元素可能都沒問題，但 `<script>` 這個 [不重新整理就不會觸發](https://swup.js.org/getting-started/common-issues/#scripts-on-the-next-page-are-not-executed)。

官方也提供了一些解決方案：

- 使用 Hooks 觸發自定義程式碼
- 使用 Head Plugin 在 `head` 中插入新的腳本
- 使用 Scripts Plugin 來執行新的或已存在的腳本（無論是在 head 或 body 中）

那我不可能把腳本塞到 `head` 裡面（到下頁也不會清掉，雖然本來就不會清掉），也不可能寫 Scripts Plugin（等於我自己寫 Hexo 主題了），所以看來只能用之前的 {% post_link Hexo-插件歪門邪道 %} 來做點小魔改了。

## 寫 Injector

跟之前一樣，寫個 injector 注入在頁尾，主要呼叫腳本綁定重新整理的時候要把 `Swup` 的頁面內的 `<script>` 觸發：

```JS index.js
// inject swup script loader
hexo.extend.generator.register("script_loader", function (locals) {
  return {
    path: "js/script_loader.js",
    data: function () {
      return fs.createReadStream("hexo-jackoo-plugins/js/script_loader.js");
    },
  };
});

hexo.extend.injector.register(
  "body_end",
  "<script src=/js/script_loader.js></script>",
  "default"
);
```

## 寫載入腳本

要怎麼主動呼叫腳本元素，最簡單的方式就是動態建立元素，所以先找到抽換的父元素，再找 `<script>` 子元素，重新建立抽換掉。

到這裡似乎一切都很完美，直到測試時才發現，有些 `<script>` 元素並不是我寫在 `markdown` 內的，例如文章底下的留言區。

所以最後折衷的作法是，我自訂一個名為 `<xscript>` 的元素，以後需要使用腳本的時候就只能用這個元素來替代。

於是實際邏輯的 `script_loader.js` 如下：

```JS script_loader.js
function loadScript() {
  let swupContent = document.getElementById("swup");

  [...swupContent.getElementsByTagName("xscript")].forEach((e) => {
    let script = document.createElement("script");
    script.src = e.getAttribute("src");
    script.innerHTML = e.innerHTML;

    e.parentNode.replaceChild(script, e);
  });
}

// 綁定再換頁後
swup.hooks.on("page:view", loadScript);
// 第一次載入不會觸發 swup hook，所以用 DOMContentLoaded
document.addEventListener('DOMContentLoaded', loadScript);

console.log("swup script loader");
```

{% note purple %}
諸如 `getElementsByTagName` 這種回傳 `HTMLCollection` 要能當成 Array 來操作，最簡單的寫法就是 `[...HTMLColletion]`。
{% endnote %}

## 後續使用

因為 `swup` 不會重新整理，所以都得要把東西封裝進方法裡，就像下面這樣：

```JS
(function(){
  let a = 'a';
  let b = 123;

  console.log(a);
  console.log(b);
})();
```

同理，載入的腳本會持續存在快取內，直到重新整理，這點之後再看看要不要優化了。

{% note purple %}
也是 JS 給太多自由的代價了。。。
{% endnote %}
