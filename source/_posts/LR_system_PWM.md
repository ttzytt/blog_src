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
plotly: true
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

## 恒定电压下的电流

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

拖动下面的滑块，可以观察时间常数 $\tau$、初始电流 $i_0$ 和最终电流 $i_f\,(V_0/R)$ 对电流响应的影响。图中 $t<0$ 的部分保持为初始电流，响应从 $t=0$ 开始。

{% plotly lr-step-response source/graph_code/LR_system_PWM/lr_step_response.js 400 %}

其中第一项是稳态电流，第二项是一直在衰减的瞬态电流。

## PWM 下的电流

对于一个周期为 $T$, 占空比为 $D$ 的 PWM 信号，其电压可以表示为：

$$
V(t) = \begin{cases}
V_0 & 0 \leq t < DT \\
0 & DT \leq t < T
\end{cases}
$$

下面的图展示了周期重复的 PWM 电压。可以调节占空比 $D$、周期 $T$ 和高电平电压 $V_0$。
{% plotly pwm-voltage source/graph_code/LR_system_PWM/pwm_voltage.js 300 %}

记稳态电流为 $i_f = V_0/R$，并假设初始电流为 $i_0 = 0$。那么第一次从高电平切换到低电平的时候，电流为：

$$
\begin{aligned}
i_{\text{max1}} &= i_f + (0 - i_f)e^{-\frac{DT}{\tau}}\\
& = i_f(1 - e^{-\frac{DT}{\tau}})

\end{aligned} 
$$

记 $E = 1 - D$，那么第一次从高电平切换到低电平时，电流为：

$$
\begin{aligned}
i_\text{min1} &= i_{\text{max1}} e^{-\frac{ET}{\tau}} \\
&= i_f\left(1 - e^{-\frac{DT}{\tau}}\right) e^{-\frac{ET}{\tau}} 
\end{aligned}
$$

观察可以发现，每个状态的电流都可以由上一个状态的电流和时间常数 $\tau$ 计算出来，那么可以写出如下递推关系：

$$
\begin{aligned}
i_\text{max(n)} &= i_f + (i_\text{min(n-1)} - i_f)e^{-\frac{DT}{\tau}} \\
i_\text{min(n)} &= i_\text{max(n)} e^{-\frac{ET}{\tau}}
\end{aligned}
$$

继续列举几次切换方便观察规律，下列是第二次从低电平切换到高电平：

$$
\begin{aligned}
i_\text{max2} &= i_f + (i_\text{min1} - i_f)e^{-\frac{DT}{\tau}} \\
&= i_f + \left(i_f e^{-\frac{ET}{\tau}} - i_f e^{-\frac{DT}{\tau}}e^{-\frac{ET}{\tau}} - i_f\right)e^{-\frac{DT}{\tau}} \\
&= i_f\left(1 + e^\frac{T}{\tau} - e^{-(D + 1)\frac{T}{\tau}} - e^{-\frac{DT}{\tau}}\right) \\
&= i_f\left(1 - e^{-\frac{DT}{\tau}} + e^{-\frac{T}{\tau}} - e^{-(D + 1)\frac{T}{\tau}}\right) \\
\end{aligned}
$$

第二次从高电平到低电平：

$$
\begin{aligned}
i_\text{min2} &= i_\text{max2} e^{-\frac{ET}{\tau}} \\
&= i_f\left(e^{-\frac{ET}{\tau}} - e^{-\frac{T}{\tau}} + e^{-(E+1)\frac{T}{\tau}} - e^{-\frac{2T}{\tau}}\right)
\end{aligned}
$$

第三次从低电平到高电平：

$$
\begin{aligned}
i_\text{max3} &= i_f + (i_\text{min2} - i_f)e^{-\frac{DT}{\tau}} \\
&= i_f\left(1 + e^{-\frac{T}{\tau}} - e^{-(D+1)\frac{T}{\tau}} + e^{-\frac{2T}{\tau}} - e^{-(D+2)\frac{T}{\tau}} - e^{-\frac{DT}{\tau}}\right) \\
&= i_f\left(\textcolor{red}{1} - \textcolor{blue}{e^{-\frac{DT}{\tau}}} + \textcolor{red}{e^{-\frac{T}{\tau}}} - \textcolor{blue}{e^{-(D + 1)\frac{T}{\tau}}} + \textcolor{red}{e^{-\frac{2T}{\tau}}} - \textcolor{blue}{e^{-(D + 2)\frac{T}{\tau}}}\right)
\end{aligned}
$$

注意到上式的奇数项（红色）和偶数项（蓝色）分别可以归纳为等比数列，两者的公比都是 $e^{-\frac{T}{\tau}}$，但是首项不同，记 $k = \frac{T}{\tau}$，可以写成如下通项公式：

$$
\begin{aligned}
i_\text{max(n)} &= i_f\left(\sum_{j=0}^{n}e^{-jk} - \sum_{j=0}^{n}e^{-(D+j)k} \right)\\
&= i_f\left(\sum_{j=0}^n e^{-jk} - e^{-Dk}\sum_{j=0}^n e^{-jk} \right)\\
&= i_f\left( 1-e^{-Dk} \right)\sum_{j=0}^n e^{-jk} \\
\end{aligned}
$$

使用等比数列求和公式 $\frac{a}{1 - r}$，其中首项 $a = i_f(1 - e^{-Dk})$，公比 $r = e^{-k}$，可得：

$$
\lim_{n \to \infty} i_\text{max(n)} = i_\text{max} = i_f\frac{1 - e^{-Dk}}{1 - e^{-k}}
$$

注意该级数只有在 $|e^{-k}| < 1$ 时才收敛，也就是 $-k < 0 \implies k > 0$，因为 $T, \tau > 0$ 所以这个条件显然总是成立。

根据前面的递推公式可得每次从高电平切换到低电平的电流为：

$$
\begin{aligned}
i_\text{min} &= i_\text{max} e^{-\frac{ET}{\tau}} \\
&= i_f \frac{e^{-Ek}\left(1 - e^{-Dk}\right)}{1 - e^{-k}} \\
&= i_f \frac{e^{-Ek} - e^{-k}}{1 - e^{-k}} \\
&= i_f \frac{e^{-(1-D)k} - e^{-k}}{1 - e^{-k}} \quad \text{分子分母同除} \space e^{-k} \\ 
&= i_f \frac{e^{Dk} - 1}{e^{k} - 1}

\end{aligned}
$$

下面令频率 $f=1/T$，观察进入周期稳态后 $i_\text{max}$ 和 $i_\text{min}$ 随 PWM 频率的变化。横轴使用对数刻度，可以调节占空比 $D$、时间常数 $\tau$ 和最终电流 $i_f\,(V_0/R)$。

{% plotly pwm-current-frequency source/graph_code/LR_system_PWM/current_frequency.js 420 %}

观察可以发现，随着频率增加，电流的波动幅度减小，趋近于稳态电流 $i_f$。对 $i_\text{max}$ 和 $i_\text{min}$ 分别求极限可得：

$$
\begin{aligned}
\lim_{f \to \infty} &\implies lim_{k \to 0}\\
\lim_{k \to 0} i_\text{max} &= \lim_{k \to 0} i_f\frac{\mathrm{d}\left(1 -e^{-Dk}\right)}{\mathrm{d}\left(1 - e^{-k}\right)} \\ 
&= \lim_{k \to 0} i_f\frac{D e^{-Dk}}{e^{-k}} \\
&= i_f D \\
\end{aligned}
$$

$$
\begin{aligned}
\lim_{k \to 0} i_\text{min} &= \lim_{k \to 0} i_f \frac{\mathrm{d}\left(e^{Dk} - 1\right)}{\mathrm{d}\left(e^{k} - 1\right)} \\
&= \lim_{k \to 0} i_f \frac{De^{Dk}}{e^{k}}\\
&= i_f D
\end{aligned}
$$

计算的结果和上图一致。

## PWM 下的功率

对于 LR 系统，电感的平均功率为 0，可以通过如下过程得出。

电感电压满足：

$$
V_L(t) = L \frac{di}{dt}
$$

代入 $P = VI$ 可得：

$$
P_L(t) = L i \frac{di}{dt}
$$

对于一个周期为 $T$ 的 PWM 信号，电感的平均功率为：

$$
\begin{aligned}
\bar{P_L} &= \frac{1}{T}\int_{t+0}^{t_0 + T} P_L(t) dt \\ 
&= \frac{1}{T}\int_{t+0}^{t_0 + T} L i \frac{di}{dt} dt \\
&= \left. \frac{1}{2T} L i^2 \right|_{t_0}^{t_0 + T} \\
\end{aligned}
$$

其中，因为电流 $i(t)$ 在一个周期内是周期性的，所以 $i^2(t)$ 也是周期性的，因此平均值为零。

因此整个系统就只剩下电阻的功率：

$$
P = i^2 R
$$

现在考虑进入稳态后一个完整周期内的平均功率 $\bar{P}$。把 PWM 分为关和开阶段，在关阶段，$V = 0$，因此瞬时功耗为 0，在开阶段，可得以下关系：

$$
\begin{aligned}
\bar{P} &= \frac{1}{T} \int_{t_0}^{t_0 + T} \\
&= \frac{V_0}{T} \int_{t_0}^{t_0 + DT} i_\text{on}(t) dt \\
\end{aligned}
$$

在开阶段，电流的状态可以理解为从稳态的 $i_\text{min}$ 逐渐以 $\tau$ 的时间常数上升到 $i_\text{max}$，因此可以写出：

$$
\begin{aligned}
\bar{P} &= \frac{V_0}{T} \int_{t_0}^{t_0 + DT}\left[i_f + (i_\text{min} - i_f)e^\frac{-t}{\tau} \right]dt
\end{aligned}
$$

因为：

$$
\int_{t_0}^{t_0 + DT} e^\frac{-t}{\tau} dt = \tau \left(1 - e^{-\frac{D}{\tau}} \right)
$$

所以代入积分结果到上式可得：

$$
\begin{aligned}
\bar{P}
&= \frac{V_0}{T}
\left[
i_fDT
+ \tau(i_\text{min}-i_f)
\left(1-e^{-\frac{DT}{\tau}}\right)
\right] \\
&= V_0i_fD
+ V_0\frac{\tau}{T}(i_\text{min}-i_f)
\left(1-e^{-Dk}\right)
\end{aligned}
$$

这里把开阶段的时间原点平移到了 $t_0$，即令 $u=t-t_0$，所以指数项积分后的上限为 $\frac{DT}{\tau}=Dk$。又因为前面已经定义了：

$$
k=\frac{T}{\tau}, \qquad E=1-D,
$$

所以：

$$
\frac{\tau}{T}=\frac{1}{k}.
$$

接下来化简 $i_\text{min}-i_f$。根据前面得到的 $i_\text{min}$：

$$
i_\text{min}
=
i_f\frac{e^{-Ek}-e^{-k}}{1-e^{-k}},
$$

可以得到：

$$
\begin{aligned}
i_\text{min}-i_f
&=
i_f
\left(
\frac{e^{-Ek}-e^{-k}}{1-e^{-k}}-1
\right) \\
&=
i_f
\frac{e^{-Ek}-e^{-k}-1+e^{-k}}{1-e^{-k}} \\
&=
i_f\frac{e^{-Ek}-1}{1-e^{-k}} \\
&=
-i_f\frac{1-e^{-Ek}}{1-e^{-k}}.
\end{aligned}
$$

代回平均功率的表达式：

$$
\begin{aligned}
\bar{P}
&=
V_0i_fD
-
V_0\frac{\tau}{T}
i_f
\frac{1-e^{-Ek}}{1-e^{-k}}
\left(1-e^{-Dk}\right) \\
&=
V_0i_f
\left[
D
-
\frac{1}{k}
\frac{
\left(1-e^{-Dk}\right)
\left(1-e^{-Ek}\right)
}{
1-e^{-k}
}
\right].
\end{aligned}
$$

因为：

$$
i_f=\frac{V_0}{R},
$$

所以 $V_0i_f=\frac{V_0^2}{R}$，从而：

$$
\boxed{
\bar{P}
=
\frac{V_0^2}{R}
\left[
D
-
\frac{1}{k}
\frac{
\left(1-e^{-Dk}\right)
\left(1-e^{-Ek}\right)
}{
1-e^{-k}
}
\right]
}
$$

再代入 $E=1-D$：

$$
\boxed{
\bar{P}
=
\frac{V_0^2}{R}
\left[
D
-
\frac{1}{k}
\frac{
\left(1-e^{-Dk}\right)
\left(1-e^{-(1-D)k}\right)
}{
1-e^{-k}
}
\right]
}
$$

最后使用：

$$
f=\frac{1}{T},
\qquad
k=\frac{T}{\tau}=\frac{1}{f\tau},
\qquad
\frac{1}{k}=f\tau,
$$

将平均功率写成 PWM 频率的函数：

$$
\boxed{
\bar{P}(f)
=
\frac{V_0^2}{R}
\left[
D
-
f\tau
\frac{
\left(1-e^{-\frac{D}{f\tau}}\right)
\left(1-e^{-\frac{1-D}{f\tau}}\right)
}{
1-e^{-\frac{1}{f\tau}}
}
\right]
}
$$

其中 $f\tau$ 是无量纲量。这里求得的是电源在一个周期内的平均输入功率；由于周期稳态下电感的平均功率为零，所以它也等于电阻在一个周期内消耗的平均功率。
