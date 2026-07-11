---
title: hexo butterfly 更换字体时遇到的一些奇怪的问题
date: 2022-06-14 19:18:55
updated: 2022-06-16 23:55:49
tags:
- Hexo
- css
- 2022
categories:
- Hexo
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments:
cover: img/Hexo_blog_logo.svg
toc:
toc_number:
toc_style_simple:
copyright:
copyright_author:
copyright_author_href:
copyright_url:
copyright_info:
mathjax:
katex: false
aplayer:
highlight_shrink:
aside:
---

今天发完 Treap 的博客之后自己看了一遍，突然感觉很不爽。Treap 的这篇博客大量的用到了指针和箭头运算符，因为博客的字体没有连字（ligature）的功能，所以看着特别傻。于是我决定把博客的字体换成 Iosevka。

以下是一些我参考的网站
- https://imbhj.com/25c13146/
- https://zhuanlan.zhihu.com/p/361392320

基本的思路还是写一个 css 文件，然后在 html 的 head 部分注入进去。最后再在 hexo 的设置中把字体改成你想用的字体。

我改完写完 css 然后上传了字体文件之后 `hexo s` 了一下，发现没问题。不过很奇怪的是部署到 github 之后如果开 linux 的虚拟机访问，或是用手机访问，都不能正确的加载字体。

于是我就尝试 f12 了一下，打开 css 文件之后发现 css 文件变成了这样：

```css
<link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/hint.css/2.4.1/hint.min.css">@font-face{
    font-family: 'Iosevka';
    font-display: swap;
    src: url('/font/iosevka-regular.ttf') format('truetype');
}

body {
    font-family: 'Iosevka';
}
```

其中，`@font-face` 前面的 `link` 不是我自己添加的，于是我就尝试在 css 中把这一行删掉，字体也能正常显示了。因为这个文件我不管怎么写，`hexo g` 的时候都会加入这一行代码，部署的时候也会一起传上去，所以我干脆直接在这个 css 文件前面加了这个：

```css
nothing{

}
```

这样这个 `link` 就会加到 `nothing` 的前面，不会影响 `@font-face` ，字体也就能正常显示了。

不过我还是不清楚为什么在生成的时候会在这个文件中加入这行代码，如果有知道的可以联系我，也许是我加的一些插件？后面我又直接在 vscode 中搜索了一下，发现很多文件都被添加了这个代码，还是挺奇怪的。

只通过博客看的话好像可以很方便的解决这个问题，实际上因为网上没有现成的资料，我浪费了大量的时间去解决它，希望下次不会再遇到这种奇怪的问题了。
