---
title: Some Strange Problems Encountered When Changing Fonts in Hexo Butterfly
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

{% note danger simple %}
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/06/hexo_font_update/).
{% endnote %}

After publishing the Treap blog post today, I read through it myself and suddenly felt very annoyed. That Treap post uses pointers and arrow operators extensively. Because the blog's font does not support ligatures, they looked particularly silly. So I decided to change the blog's font to Iosevka.

Here are some websites I referred to:
- https://imbhj.com/25c13146/
- https://zhuanlan.zhihu.com/p/361392320

The basic idea is still to write a CSS file and then inject it into the `head` section of the HTML. Finally, change the font in Hexo's settings to the font you want to use.

After finishing the CSS and uploading the font file, I ran `hexo s` and found no problems. Strangely, however, after deploying to GitHub, the font could not be loaded correctly when accessing the site from a Linux virtual machine or a phone.

So I tried opening the developer tools with F12. After opening the CSS file, I found that it had become this:

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

The `link` before `@font-face` was not added by me, so I tried deleting that line from the CSS, and the font displayed normally. No matter how I wrote this file, `hexo g` would add this line of code, and it would also be uploaded during deployment. Therefore, I simply added this at the beginning of the CSS file:

```css
nothing{

}
```

This way, the `link` would be added before `nothing` and would not affect `@font-face`, so the font could display normally.

However, I still do not know why this line of code is added to the file during generation. If anyone knows, they can contact me. Perhaps it is caused by one of the plugins I added? Later, I searched directly in VS Code and found that this code had been added to many files, which was still quite strange.

Judging only from the blog post, it seems that this problem can be solved very easily. In reality, because there was no ready-made information online, I wasted a great deal of time solving it. I hope I will not encounter this kind of strange problem again next time.
