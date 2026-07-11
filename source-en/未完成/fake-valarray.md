---
title: Implementing valarray Mask Selection with an Expression Tree
date:
updated:
tags:
- Experiments
- stl
- valarray
- Expression Trees
categories:
- Assembly
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments:
cover:
toc:
toc_number:
toc_style_simple:
copyright:
copyright_author:
copyright_author_href:
copyright_url:
copyright_info:
mathjax:
katex: true
aplayer:
highlight_shrink:
aside:
---

{% note danger simple %}
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/未完成/fake-valarray.html).
{% endnote %}

Before we begin, let me digress for a moment. Recently I have really felt that I have become completely unproductive: every day I do not know what I am doing, and my efficiency is extremely low. In April and May, I was completely slacking off in OI; I probably solved only about 20 problems in total over those two months. I have not updated the blog for a long time either. Every day I can always find an excuse not to practice. I hope I can get back into shape during the last few days of May.

# Why this experiment started

Now to the main topic. First, let us introduce `valarray`, a relatively obscure container in the STL. I first learned about it from [this blog](https://2o181o28.github.io/2018/12/01/%E6%B5%85%E8%B0%88valarray/), and it genuinely astonished me. `valarray` has many features, but this article will not introduce them in detail. If you are interested, you can read the blog mentioned above.

The most surprising of these features is its mask selection. To understand it, the following code[^1] is enough:

```cpp
a[a % 2 == 1] += b;
```

This means adding the corresponding values in array `b` to all odd values in array `a`. I was very surprised the first time I saw this. How could the condition be passed through square brackets? It does not even look like C++ syntax.

After discussing it with [gmq](https://mqcreaple.github.io/) (in fact, gmq explained it to me), we found that an expression tree could be passed inside those brackets. In the expression tree, the current `valarray` is treated as an unknown whose condition is evaluated. If the condition is satisfied, the element at the corresponding position is modified.

# Expression trees

An expression tree is a data structure used to evaluate expressions. A mathematical expression contains operators, constants, and unknowns. When building the tree, unknowns and constants are placed at the leaf nodes, so the expression can be evaluated recursively from top to bottom.

This description may still be difficult to understand. Take a look at the following figure[^2]:



# Possible improvements

## Return a Boolean array directly

## Add support for ranges (multi-parameter functions)

[^1]: Source: https://2o181o28.github.io/2018/12/01/%E6%B5%85%E8%B0%88valarray/
[^2]: Source: https://blog.csdn.net/harryguo2012/article/details/43821255
