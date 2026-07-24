---
title: Plotly 交互图表测试
date: 2026-07-24 12:30:00
updated:
tags:
  - Plotly
  - 数据可视化
categories:
  - 测试
description: 使用 Plotly 绘制可调节振幅和频率的正弦函数。
plotly: true
comments: false
skip_multilingual_check: true
---

下面的曲线表示

$$
y=A\sin(\omega x).
$$

拖动滑块可以实时改变振幅 $A$ 和频率 $\omega$。

{% plotly sine-wave source/grpah_code/plotly_test.js 500 %}
