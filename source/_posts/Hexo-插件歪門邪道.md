---
title: Hexo 插件歪門邪道
date: 2025-03-15 23:52:06
tags: [Hexo]
excerpt: "本文分享在 Hexo 部落格主題中自訂圖片大小的解決方案，介紹自製插件與 JS 腳本的應用，並探討主題管理與相關技術細節。"
---

## 前情提要

是這樣的，這個站點用的主題是 [Redefine](https://github.com/EvanNotFound/hexo-theme-redefine)，個人非常滿意，但遇到了個問題：***圖片的 `markdown` 語法沒有辦法自訂大小***。正常來說，插入帶有自訂屬性的圖片是這麼寫的：

```markdown
<img src="/path/to/image.png" width="500">
```

對，它是 `html` 標籤，這時候就會想我都用 `markdown` 了，沒有更優雅的方法來自定它的大小嗎？

欸，找了下有個大佬跟我有一樣的問題，並給出了 [很好的答案](https://github.com/bobcn/hexo_resize_image.js)：

```markdown
![alt](/path/to/image.png?500x)
```

沒錯，在 `js` 腳本綁定 `window.onload` 事件之後 `query` `img` 元素然後給他們注入 `width` 跟 `height` 屬性，看看程式碼，你知道我知道獨眼龍也知道。

問題就出在：

{% note red %}
該怎麼魔改主題？
{% endnote %}

有兩個方法：

1. 把主題放專案資料夾的 `themes` 內，跟著專案一起進版控
2. 放其他地方，用 `npm install /path` 的方式內連

兩個方法都可行，但 `1` 就會跟主專案分離；而 `2` 會牽涉到使用 `git submodule` 管理專案，另外我是用 `github action` 自動部屬，有點懶得改配置。

{% note gray %}
說來慚愧，有另一部份原因是我翻看別人專案程式碼的速度實在慢得感人。。。
{% endnote %}

## 自己寫插件

綜合剛剛兩個方法，決定以不破壞主題原始碼，從 `Hexo Plugin` 下手。

先新增了一個名為 [hexo-jackoo-plugins](https://github.com/JacKooDesu/JacKooDesu.github.io/tree/main/hexo-jackoo-plugins) 的插件資料夾，格式照著 [官方文件](https://hexo.io/zh-tw/docs/plugins) 寫的：

```bash
.
├── index.js
└── package.json
```

```json package.json
{
  "name": "hexo-jackoo-plugins",
  "version": "0.0.1",
  "main": "index"
}
```

命名正確 `npm install ./hexo-jackoo-plugins` 內連後，應該就可以愉快玩耍了。

`index.js` 是進入點，插件執行的時機點是生成靜態網頁的階段，所以用 [Generator](https://hexo.io/zh-tw/api/generator) 把上面的 `resize_image.js` 複製進去，然後用 [Injector](https://hexo.io/zh-tw/api/injector) 讓每個頁面都讀取它。

```javascript index.js
var fs = require("hexo-fs");

hexo.extend.generator.register("js", function (locals) {
  return {
    path: "js/resize_image.js",
    data: function () {
      return fs.createReadStream("hexo-jackoo-plugins/js/resize_image.js");
    },
  };
});

hexo.extend.injector.register(
  "body_end",
  '<script src="/js/resize_image.js"></script>',
  "default"
);
```

{% note purple %}
`hexo` 是全域的不用再 `require`。
{% endnote %}

摁，有效果了，但這個主題有用 `IntersectionObserver` 做惰性加載，所以我改了下抓元素的邏輯以及回呼：

```javascript resize_image.js
function hexo_resize_image() {
  let counter = 0;
  const config = {
      attributeFilter: ["lazyload"],
      attributes: true,
    },
    lazyloadObserver = new MutationObserver((ms) => {
      img = ms[0]?.target;
      img.onload = () => update_image_size(img);
      counter--;
      if (counter <= 0) lazyloadObserver.disconnect();
    });

  document.querySelectorAll("img").forEach((img) => {
    if (img.hasAttribute("lazyload")) {
      lazyloadObserver.observe(img, config);
      counter++;
    } else update_image_size(img);
  });
}
```

用 `MutationObserver` 觀察 `lazyload` 屬性，被拔掉代表開始加載，綁定 `img.onload` 回呼等圖片載入完成再計算大小。

摁，又測了測，切頁時圖片大小怪怪的，發現因為有用 [swup.js](https://swup.js.org/) 提升使用者體驗，所以回呼不只要掛在 `window.onload` 事件，還要掛在 `swup` 完成內容置換的事件上，所以又給加上了：

```javascript resize_image.js
// this is for the initial page load
window.addEventListener("load", hexo_resize_image);
// this is for swup.js
swup.hooks.on("content:replace", hexo_resize_image);
```

大功告成，可以繼續優雅得寫 markdown 了。

## 後話

有了這個旁路，感覺能玩出更多花招就是了，也不會被主題綁死做一個堆疊，只能說 js 寫起來還是那麼單純又混亂。

{% note gray %}
`git submodule` 遲早會找機會寫一篇，一直搞不明白。。。
{% endnote %}