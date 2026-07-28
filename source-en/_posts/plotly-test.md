---
title: Plotly Interactive Chart Test
date: 2026-07-24 12:30:00
alias:
  - "2026/07/plotly_test/index.html"
updated:
tags:
  - Plotly
  - Data Visualization
categories:
  - Testing
description: Demonstrates an interactive Plotly sine-wave chart with sliders for amplitude and frequency, including Hexo embedding and localized chart labels.
plotly: true
plotly_mathjax: true
comments: false
skip_multilingual_check: false
---

{% note danger simple %}
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2026/07/plotly-test/).
{% endnote %}

The curve below represents

$$
y=A\sin(\omega x).
$$

Drag the sliders to change the amplitude $A$ and frequency $\omega$ in real time.

{% plotly sine-wave source/graph_code/plotly_test/plotly_test.js 500 %}
