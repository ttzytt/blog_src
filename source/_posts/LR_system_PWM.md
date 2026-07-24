---
title: "LR 系统的 PWM 控制分析"
date: 2024-06-08 00:00:00
updated:
tags:
- 数学
- 电路
- 硬件
categories:
- 学习笔记
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments:
cover: 'linear-gradient(to right, #2c3e50, #4ca1af)'
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
skip_multilingual_check: true
published: false
---

## 问题概览

最近在做一个涉及使用 PWM 控制电磁铁的项目，惊讶的发现不同频率下的 PWM 似乎在同样的占空比下，功耗不同。所以简单计算和分析了一下，把结果放在这里。

电磁铁可以看作是一个如下图的串联的电阻（R）和电感（L）。其中的 L 来自于线圈产生的磁通量，以及楞次定律阻碍磁通量的作用，R 则来自于漆包线的电阻。

![](/img/LR_system_PWM/LR_schematics.drawio.png){ width=50% }

## 恒定电压下的解

因为 PWM 可以看作是一个周期性的分段函数，所以可以考虑最简单的恒定电压下的情况，随后再考虑 PWM 的分段函数。对于 $V(t) = V_0$，LR 系统的微分方程为：

$$
    L \frac{di}{dt} + Ri = V_0
$$

对于齐次解，写出对应的特征方程：

$$
\begin{aligned}
L r + R &= 0 \\
      r  &= - \frac{R}{L} 
\end{aligned}
$$

所以齐次解是：

$$
i_h(t) = C e^{-\frac{R}{L} t} 
$$

其中时间常数可以定义为：

$$
\tau = \frac{L}{R}
$$

那么齐次解可以写成：

$$
i_h(t) = C e^{-\frac{t}{\tau}}
$$

因为输入电压为常数，可以猜测特解为常数 $i_p(t) = A$，代入微分方程得到：

$$
RA = V_0 \quad \text{因为} \space \frac{di_p}{dt} = 0
$$

所以

$$
i_p = \frac{V_0}{R}
$$

合并齐次解和特解，得到通解：

$$
i(t) = C e^{-\frac{t}{\tau}} + \frac{V_0}{R}
$$

再根据初始条件确定常数 $C$，假设初始电流为 $i(0) = i_0$，代入后可得：

$$
\begin{aligned}
i_0 &= C + \frac{V_0}{R} \\
C &= i_0 - \frac{V_0}{R}
\end{aligned}
$$

最终可得：

$$
i(t) = \frac{V_0}{R} + \left(i_0 - \frac{V_0}{R}\right) e^{-\frac{t}{\tau}}
$$

<!-- 加入交互式图表 -->

其中第一项是稳态电流，第二项是一直在衰减的瞬态电
流。

## PWM 下的解

