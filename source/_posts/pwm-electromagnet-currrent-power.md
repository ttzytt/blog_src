---
title: "PWM 频率对电磁铁电流与功耗的影响"
date: 2026-07-28
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
cover: /img/LR_system_PWM/cover.png
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
plotly_mathjax: true
aplayer:
highlight_shrink:
aside:
skip_multilingual_check: true
published: true
---

## 问题概览

最近在做一个涉及使用 PWM 控制电磁铁的项目，惊讶地发现不同频率下的 PWM 似乎在同样的占空比下，功耗不同。所以简单计算和分析了一下，把结果放在这里。

其中，电阻 R 主要来自漆包线本身的电阻；电感 L 则描述线圈中磁链与电流之间的关系。当电流发生变化时，线圈会产生感应电动势，并根据楞次定律反抗电流及磁通量的变化。

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

拖动下面的滑块，可以观察时间常数 $\tau$、初始电流 $i_0$ 和直流稳态电流 $i_f\,(V_0/R)$ 对电流响应的影响。图中 $t<0$ 的部分保持为初始电流，响应从 $t=0$ 开始。

{% plotly lr-step-response source/graph_code/LR_system_PWM/lr_step_response.js 400 %}

其中第一项是直流稳态电流，第二项是一直在衰减的瞬态电流。

## PWM 下的电流

对于一个周期为 $T$，占空比为 $D$ 的 PWM 信号，其电压可以表示为：

$$
V(t) = \begin{cases}
V_0 & 0 \leq t < DT \\
0 & DT \leq t < T
\end{cases}
$$

下面的图展示了周期重复的 PWM 电压。可以调节占空比 $D$、周期 $T$ 和高电平电压 $V_0$。
{% plotly pwm-voltage source/graph_code/LR_system_PWM/pwm_voltage.js 300 %}

### 周期峰值和谷值电流

记直流稳态电流为 $i_f = V_0/R$，并假设初始电流为 $i_0 = 0$。那么第一次从高电平切换到低电平的时候，电流为：

$$
\begin{aligned}
i_{\text{max1}} &= i_f + (0 - i_f)e^{-\frac{DT}{\tau}}\\
& = i_f(1 - e^{-\frac{DT}{\tau}})

\end{aligned} 
$$

记 $E = 1 - D$，那么第一次从低电平切换到高电平时，电流为：

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

继续列举几次切换方便观察规律，下列是第二次从高电平切换到低电平：

$$
\begin{aligned}
i_\text{max2} &= i_f + (i_\text{min1} - i_f)e^{-\frac{DT}{\tau}} \\
&= i_f + \left(i_f e^{-\frac{ET}{\tau}} - i_f e^{-\frac{DT}{\tau}}e^{-\frac{ET}{\tau}} - i_f\right)e^{-\frac{DT}{\tau}} \\
&= i_f\left(1 + e^{-\frac{T}{\tau}} - e^{-(D + 1)\frac{T}{\tau}} - e^{-\frac{DT}{\tau}}\right) \\
&= i_f\left(1 - e^{-\frac{DT}{\tau}} + e^{-\frac{T}{\tau}} - e^{-(D + 1)\frac{T}{\tau}}\right) \\
\end{aligned}
$$

第二次从低电平切换到高电平：

$$
\begin{aligned}
i_\text{min2} &= i_\text{max2} e^{-\frac{ET}{\tau}} \\
&= i_f\left(e^{-\frac{ET}{\tau}} - e^{-\frac{T}{\tau}} + e^{-(E+1)\frac{T}{\tau}} - e^{-\frac{2T}{\tau}}\right)
\end{aligned}
$$

第三次从高电平切换到低电平：

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
i_\text{max(n)} &= i_f\left(\sum_{j=0}^{n-1}e^{-jk} - \sum_{j=0}^{n-1}e^{-(D+j)k} \right)\\
&= i_f\left(\sum_{j=0}^{n-1} e^{-jk} - e^{-Dk}\sum_{j=0}^{n-1} e^{-jk} \right)\\
&= i_f\left( 1-e^{-Dk} \right)\sum_{j=0}^{n-1} e^{-jk} \\
\end{aligned}
$$

令 $n\to\infty$ 后，使用无限等比级数求和公式 $\frac{a}{1-r}$，其中首项 $a=i_f(1-e^{-Dk})$，公比 $r=e^{-k}$，可得：

$$
\lim_{n \to \infty} i_\text{max(n)} = i_\text{max} = i_f\frac{1 - e^{-Dk}}{1 - e^{-k}}
$$

注意该级数只有在 $|e^{-k}| < 1$ 时才收敛，也就是 $-k < 0 \implies k > 0$，因为 $T, \tau > 0$ 所以这个条件显然总是成立。

根据前面的递推公式可得每次从低电平切换到高电平的电流为：

$$
\begin{aligned}
i_\text{min} &= i_\text{max} e^{-\frac{ET}{\tau}} \\
&= i_f \frac{e^{-Ek}\left(1 - e^{-Dk}\right)}{1 - e^{-k}} \\
&= i_f \frac{e^{-Ek} - e^{-k}}{1 - e^{-k}} \\
&= i_f \frac{e^{-(1-D)k} - e^{-k}}{1 - e^{-k}} \quad \text{分子分母同除} \space e^{-k} \\ 
&= i_f \frac{e^{Dk} - 1}{e^{k} - 1}

\end{aligned}
$$

下面令频率 $f=1/T$，观察进入周期稳态后周期峰值电流 $i_\text{max}$ 和周期谷值电流 $i_\text{min}$ 随 PWM 频率的变化。横轴使用对数刻度，可以调节占空比 $D$、时间常数 $\tau$ 和直流稳态电流 $i_f\,(V_0/R)$。

可以使用图内按钮在对数坐标和线性坐标之间切换。

{% plotly pwm-current-frequency source/graph_code/LR_system_PWM/current_frequency.js 420 %}

观察可以发现，随着频率增加，电流的波动幅度减小，趋近于直流稳态电流与占空比的乘积 $i_f D$。对周期峰值电流 $i_\text{max}$ 和周期谷值电流 $i_\text{min}$ 分别求极限可得。由于两式在 $k\to 0$ 时都是 $\frac{0}{0}$ 型，下面对分子和分母分别关于 $k$ 求导，使用洛必达法：

$$
\begin{aligned}
f \to \infty &\implies k \to 0,\\
\lim_{k \to 0} i_\text{max}
&= i_f\lim_{k \to 0}\frac{1-e^{-Dk}}{1-e^{-k}}\\
&= i_f\lim_{k \to 0}\frac{D e^{-Dk}}{e^{-k}} \\
&= i_f D \\
\end{aligned}
$$

$$
\begin{aligned}
\lim_{k \to 0} i_\text{min}
&= i_f\lim_{k \to 0}\frac{e^{Dk}-1}{e^k-1}\\
&= i_f\lim_{k \to 0}\frac{De^{Dk}}{e^{k}}\\
&= i_f D
\end{aligned}
$$

计算的结果和上图一致。

### 周期平均电流

前面的计算得出了周期峰值电流 $i_\text{max}$ 和周期谷值电流 $i_\text{min}$，那么可以计算出周期平均电流 $\overline{i}$ 和占空比 $D$ 的关系。

一个周期内的平均电流为导通阶段和关断阶段电流积分之和除以周期 $T$：

$$
\overline{i}
=
\frac{1}{T}
\left[
\int_0^{DT} i_\text{on}(t)\,dt
+
\int_0^{(1-D)T} i_\text{off}(t)\,dt
\right].
$$

导通阶段和关断阶段的电流分别为：

$$
\begin{aligned}
i_\text{on}(t)
&=i_f+(i_\text{min}-i_f)e^{-t/\tau},\\
i_\text{off}(t)
&=i_\text{max}e^{-t/\tau}.
\end{aligned}
$$

因此：

$$
\begin{aligned}
\overline{i}
&=
\frac{1}{T}
\left[
\int_0^{DT}
\left(
i_f+(i_\text{min}-i_f)e^{-t/\tau}
\right)dt
+
\int_0^{(1-D)T}
i_\text{max}e^{-t/\tau}dt
\right]\\
&=
\frac{1}{T}
\left[
i_fDT
+
\tau(i_\text{min}-i_f)(1-e^{-Dk})
+
\tau i_\text{max}(1-e^{-(1-D)k})
\right].
\end{aligned}
$$

根据导通阶段的端点关系：

$$
i_\text{max}
=
i_f+(i_\text{min}-i_f)e^{-Dk},
$$

所以：

$$
\begin{aligned}
(i_\text{min}-i_f)(1-e^{-Dk})
&=i_\text{min}-\left[i_f+(i_\text{min}-i_f)e^{-Dk}\right]\\
&=i_\text{min}-i_\text{max}.
\end{aligned}
$$

关断阶段又有：

$$
i_\text{min}=i_\text{max}e^{-(1-D)k},
$$

因此：

$$
i_\text{max}(1-e^{-(1-D)k})
=i_\text{max}-i_\text{min}.
$$

两个指数积分项正好抵消：

$$
(i_\text{min}-i_\text{max})+(i_\text{max}-i_\text{min})=0.
$$

所以：

$$
\begin{aligned}
\overline{i}
&=\frac{i_fDT}{T}\\
&=i_fD.
\end{aligned}
$$

因此，周期平均电流与 PWM 频率无关，等于直流稳态电流 $i_f$ 与占空比 $D$ 的乘积。

对于理想通电螺线管，磁场强度满足 $H=nI$，磁感应强度满足 $B=\mu H=\mu nI$，其中 $\mu$ 是磁导率，$n$ 是单位长度匝数。因此上述关系可以说明，在该理想模型下，电磁铁的平均磁场强度与频率无关，只和占空比成线性关系。

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
\overline{P_L} &= \frac{1}{T}\int_{t_0}^{t_0 + T} P_L(t) dt \\
&= \frac{1}{T}\int_{t_0}^{t_0 + T} L i \frac{di}{dt} dt \\
&= \left. \frac{1}{2T} L i^2 \right|_{t_0}^{t_0 + T} \\
\end{aligned}
$$

其中，因为电流 $i(t)$ 在一个周期内是周期性的，所以 $i^2(t)$ 也是周期性的，周期首尾的取值相等，因此：

$$
i^2(t_0+T)-i^2(t_0)=0.
$$

所以上述边界项为零，电感在一个周期内的平均功率也为零。

因此，在周期平均意义下，整个系统只剩下电阻消耗的功率：

$$
P_R(t) = i^2(t)R
$$

现在考虑进入周期稳态后一个完整周期内的平均输入功率 $\overline{P}$。把 PWM 分为关和开阶段，在关阶段，$V=0$，因此电源输入功率 $V(t)i(t)=0$；但电阻仍以 $i^2(t)R$ 消耗功率，其能量由电感释放。在开阶段，可得以下关系：

$$
\begin{aligned}
\overline{P} &= \frac{1}{T} \int_{t_0}^{t_0 + T} V(t)i(t) dt\\
&= \frac{V_0}{T} \int_0^{DT} i_\text{on}(t) dt \\
\end{aligned}
$$

在开阶段，电流的状态可以理解为从周期谷值电流 $i_\text{min}$ 逐渐以 $\tau$ 的时间常数上升到周期峰值电流 $i_\text{max}$，因此可以写出：

$$
\begin{aligned}
\overline{P} &= \frac{V_0}{T} \int_0^{DT}\left[i_f + (i_\text{min} - i_f)e^\frac{-t}{\tau} \right]dt
\end{aligned}
$$

因为：

$$
\int_0^{DT} e^\frac{-t}{\tau} dt = \tau \left(1 - e^{-\frac{DT}{\tau}} \right)
$$

所以将积分结果代入上式可得：

$$
\begin{aligned}
\overline{P}
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

又因为前面已经定义了：

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
i_f\frac{e^{Dk}-1}{e^k-1},
$$

可以得到：

$$
\begin{aligned}
i_\text{min}-i_f
&=
i_f
\left(
\frac{e^{Dk}-1}{e^k-1}-1
\right) \\
&=
i_f
\frac{e^{Dk}-e^k}{e^k-1} \\
&=
-i_f\frac{e^k-e^{Dk}}{e^k-1} \\
&=
-i_f\frac{1-e^{-(1-D)k}}{1-e^{-k}} \\
&=
-i_f\frac{1-e^{-Ek}}{1-e^{-k}}.
\end{aligned}
$$

代回平均功率的表达式：

$$
\begin{aligned}
\overline{P}
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

定义直流功耗 $P_{\mathrm{ref}}=V_0i_f=\frac{V_0^2}{R}$，从而：

$$
\overline{P}
=
P_{\mathrm{ref}}
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
$$

再代入 $E=1-D$：

$$
\overline{P}
=
P_{\mathrm{ref}}
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
$$

最后使用：

$$
f=\frac{1}{T},
\qquad
k=\frac{T}{\tau}=\frac{1}{f\tau},
\qquad
\frac{1}{k}=f\tau,
$$

将平均功率写成 PWM 频率和占空比的函数：

$$
\overline{P}(f,D)
=
P_{\mathrm{ref}}
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
$$

其中 $f\tau$ 是无量纲量。这里求得的是电源在一个周期内的平均输入功率；由于周期稳态下电感的平均功率为零，所以它也等于电阻在一个周期内消耗的平均功率。

### 图表分析

下面分别观察周期平均功率随占空比 $D$ 和 PWM 频率 $f$ 的变化。这里将 $P_{\mathrm{ref}}=\frac{V_0^2}{R}$ 作为一个整体调节，它表示直流功耗。

#### 周期平均功率随占空比变化

横轴为占空比 $D$，可以调节频率 $f$、时间常数 $\tau$ 和直流功耗 $P_{\mathrm{ref}}$。频率滑块采用对数调节。

图中同时给出线性参考 $P_{\mathrm{ref}}D$ 和平方参考 $P_{\mathrm{ref}}D^2$，用于比较低频与高频时的变化趋势。

{% plotly pwm-average-power-duty source/graph_code/LR_system_PWM/average_power.js 420 %}

#### 周期平均功率随频率变化

横轴为频率 $f$ 并采用对数刻度，可以调节占空比 $D$、时间常数 $\tau$ 和直流功耗 $P_{\mathrm{ref}}$。

可以使用图内按钮切换为线性坐标。

{% plotly pwm-average-power-frequency source/graph_code/LR_system_PWM/average_power.js 420 %}

#### 归一化周期平均功率等高线

等高线图从俯视角度表示同一个函数，横轴为 $D$，纵轴为 $f\tau$，颜色和等高线数值均表示 $\overline P/P_{\mathrm{ref}}$。

{% plotly pwm-average-power-contour source/graph_code/LR_system_PWM/power_landscape.js 500 %}

观察上面的三张图表可以发现，随着频率增加，功率趋近于平方参考 $\overline{P}(D) = P_{\mathrm{ref}} D^2$，而在低频时，功率的变化趋势更接近于线性参考 $\overline{P}(D) = P_{\mathrm{ref}} D$。也就是说，在占空比相同的情况下，因为 $\forall D \in [0, 1] \quad D^2 \le D$，高频 PWM 的功耗总是更小或者相等。

注意到，在 "周期平均电流" 这部分，我们已经得出了电磁铁的平均磁场强度和占空比相关、与频率无关的结论。结合功率分析可以得出，使用更高的 PWM 频率控制电磁铁总是更节能的。

## 从方差理解

从前文可知，周期平均功耗 $\overline{P}$ 只和周期的电阻功耗 $\overline{i^2}R$ 有关，而电感的平均功耗为零。注意到其中的 $\overline{i^2}$ 和方差公式有相似形式，即：

$$
\text{Var}(i) = \langle i^2\rangle - \langle i \rangle^2
$$

其中 $\langle i \rangle$ 表示 $i$ 在一个周期内的平均值，和 $\overline{i}$ 含义相等。变换可得：

$$
\langle i^2\rangle = \text{Var}(i) + \langle i \rangle^2
$$

代回平均功率公式，有：

$$
\overline{P} = \langle i \rangle^2R + \text{Var}(i)R
$$

从 “周期平均电流” 这部分，我们知道 $\langle i \rangle$ 和频率无关。而方差衡量了电流的波动幅度，随着频率增加，电流纹波减小，电流波形趋近于恒定的 $i_fD$，功耗也会逐渐减少。
