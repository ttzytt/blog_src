---
title: 用表达式树实现 valarray 的 mask-selection （遮罩）功能
date:
updated:
tags:
- 整活
- stl
- valarray
- 表达式树
categories:
- 汇编
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
开始之前，先扯两句不相关的，最近这段时间真的感觉整个人都废了，每天都不知道在干啥，做事效率也奇低。4 月份和 5 月份，OI 完全处于一个摆烂的状态，两个月做的题加起来可能就 20 题吧，博客也很久没更了。每天总能给自己找到不刷题的借口。希望五月的最后几天能把状态调整回来吧。


# 整活的起因
现在进入正题，首先介绍下 valarray，这是 stl 里的一个冷门的容器，我第一次了解到是在[这个博客](https://2o181o28.github.io/2018/12/01/%E6%B5%85%E8%B0%88valarray/)上，实在是让我大为震撼。valarray 有很多功能，但这篇文章不会过多的介绍，如果你有兴趣了解，可以看我上面提到的那篇博客。

这众多功能中最令我惊讶的是他的 mask-selection。要理解这个功能，看下面的代码[^1]就够了：

```cpp
a[a % 2 == 1] += b;
```

这句话的意思就是把 a 数组中所有奇数值加上 b 数组中对应的值。我第一次看到这样的东西是非常惊讶的，怎么可能能把这个判断的条件通过方括号传进去呢，这看起来都不像是 C++ 的语法啊？

和[gmq](https://mqcreaple.github.io/)巨佬讨论（实际上是巨佬跟我讲解）过后，我们发现可以在那个括号中传入一个表达式树。在表达式树中，把当前的 valarray 数组当作一个未知数来判断条件是否符合，如果符合，就把对应位置的元素修改了。

# 表达式树
在表达式树是一种为了对表达式进行求值的数据结构。在一个数学表达式中，包含以下几个元素：运算符，常数，以及未知数。建树时，我们把未知数和常数都放在树的叶子节点，这样就可以从上到下的递归求值了。

看着这个描述可能还是比较难理解，可以看下下面的图[^2]：



# 之后的改进
## 直接传回一个 bool 数组。

## 加入对范围的支持（多参数函数）
[^1]: 来源：https://2o181o28.github.io/2018/12/01/%E6%B5%85%E8%B0%88valarray/
[^2]: 来源：https://blog.csdn.net/harryguo2012/article/details/43821255