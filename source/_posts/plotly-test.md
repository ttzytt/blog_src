---
title: Plotly 交互图表测试
date: 2026-07-24 12:30:00
alias:
  - "2026/07/plotly_test/index.html"
updated:
tags:
  - Plotly
  - 数据可视化
categories:
  - 测试
description: 使用 Plotly 绘制交互式正弦函数图表，通过滑块实时调整振幅和频率，并演示 Hexo 文章中的图表嵌入与多语言标签。
plotly: true
plotly_mathjax: true
comments: false
skip_multilingual_check: false
---

下面的曲线表示

$$
y=A\sin(\omega x).
$$

拖动滑块可以实时改变振幅 $A$ 和频率 $\omega$。

{% plotly sine-wave source/graph_code/plotly_test/plotly_test.js 500 %}
