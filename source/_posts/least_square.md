---
title: 从微积分和线性代数的角度理解最小二乘法
date: 2023-12-08 20:48:06
updated: 2023-12-24 08:51:10
tags:
- 数学 
- 线性代数
- 微积分
categories:
- 学习笔记
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments: 
cover: '/img/最小二乘法/Linear_regression.svg.png'
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

之前尝试实现图形学一些论文的时候用到过最小二乘法，不过之前是从微积分的角度理解的。今年学了线性代数的课，发现这个东西也可以用线性代数的概念解释，并且更加直观（有几何角度的理解），所以准备用这篇文章记录一下最小二乘法的两种理解方式。

开始之前先吐槽一下这个东西的名字 “最小二乘”。就感觉很奇怪，最小化误差的平方为什么叫二乘呢？嗯。。。[查了一下发现是从日语翻译过来的](https://www.zhihu.com/question/52918263)，那我只能说这个翻译水平是有点高的。。。虽然我很不想用这个迷惑的名字，但是因为都这么用的，那也没办法了。

## 问题的定义

学习最小二乘法之前先得理解这个算法在尝试解决什么。最小二乘法最常见的用途是用一个函数拟合数据，进而用这个函数来预测数据的趋势。为了拟合数据我们就需要用数学的方法来定义怎样的拟合是好的，然后我们尽量一个函数更好的拟合数据。

这里我们假设有 $m$ 个数据点 $(x_i, y_i) \ \ i \in \{0, 1, \cdots, m\}$。然后有一个函数 $f(x)$ 用于拟合这些数据点。我们定义单个点的误差为：

$$
s_i = f(x_i) - y_i
$$

注意这里函数 $f(x_i)$ 的含义是使用 $x_i$ 来预测 $y_i$，你可以把这两个值理解成标量，但实际上最小二乘法也可以用于拟合向量，因为两种情况下公式完全一样，这里简单起见就假设是标量。

那么误差的平方和就是

$$
I = \sum_{i=0}^m s_i^2 = \sum_{i=0}^m (f(x_i) - y_i)^2
$$

我们希望能调整这个函数的参数使得这个值最小。

具体来说，可以把函数 $f(x)$ 表示成如下形式：

$$
f(x) = a_0\varphi_0(x) + a_1\varphi_1(x) + \cdots + a_n\varphi_n(x)
$$

其中, $a_i$ 是我们需要调整的参数，而 $\varphi_i(x)$ 是一些线性无关的函数。

## 微积分角度

这部分内容的来源主要是这个[视频](https://www.bilibili.com/video/BV1Uu411d72H/?spm_id_from=333.337.search-ca+rd.all.click&vd_source=4de003ee9a3815aedd7d0cb2c7a12d14)，讲的内容还是很完整的但是有些快和笔误，我也看了好几遍才搞懂。

我们可以把误差表示成下面这样的形式，然后从微积分的角度最小化这个误差。

$$
\begin{align*}
I(a_0, \cdots, a_n) &= \sum_{i=0}^m w(x_i) (f(x_i) - y_i)^2 \\
I(a_0, \cdots, a_n) &= \sum_{i=0}^m w(x_i)\left(\sum_{j=0}^n [a_j\varphi_j(x_i)] - y_i\right)^2
    
\end{align*}
$$

写成这样的形式可以更加清楚的表示出我们的目的：通过调整 $a_0, \cdots, a_n$ 这些参数使得误差最小化。

注意这里在给每个数据点的误差平方求和的时候多了一个权重 $w(x_i)$，通过这个权重可以更加方便的调整每个数据点的重要性。

通过微积分我们知道，函数在达到其最值的时候导数一定为 0。我们通过这个性质可以从微积分的角度来调整参数使得误差最小。不过这个最值可以是最小值也可以是最大值。在计算误差 $I$ 的时候，一定只存在一个最小值（可以想象把所有的参数设置到 $\infty$ 的情况）。

因为 $I$ 是一个多变量函数，所以要通过上面的方法求最小值，我们需要用偏导数：

$$
\frac{\partial I}{\partial a_k} = 2\sum_{i=0}^m w(x_i)\left(\sum_{j=0}^n[ a_j\varphi_j(x_i)] - f(x_i)\right)\varphi_k(x_i) = 0 \\
$$

在上面的偏导数中，除了 $a_k$ 都可以作为常数处理。因为偏导数的定义就是改变参数 $a_k$，对误差 $I$ 造成的影响。

在 $\frac{\partial I}{\partial a_k} = 0$ 的时候，我们可以说在只调整参数 $a_k$ 的情况，误差已经达到了最小值，但是因为每个参数都是可以调整的，所以我们希望对于每个 $k \in \{0, \cdots, n\} \ \frac{\partial I}{\partial a_k} = 0$。

这样一来，可以得到一个线性方程组。看到线性方程组第一个想到的肯定是用线性代数的方式来表示这个式子，这样在求解的时候可以极大的提升速度。

经过一定的变形，可以得到下面的公式：

$$
\begin{align*}
0 &= 2\sum_{i=0}^m w(x_i)\left(\sum_{j=0}^n[ a_j\varphi_j(x_i)] - f(x_i)\right)\varphi_k(x_i)\\ 

&= 2\sum_{i=0}^m\left(w(x_i)\varphi_k(x_i)\sum_{j=0}^n\left[a_j\varphi_j(x_i)\right] - w(x_i)y_i\varphi_k(x_i) \right) \\ 

&= \sum_{i=0}^m\left(w(x_i)\varphi_k(x_i)\sum_{j=0}^n\left[a_j\varphi_j(x_i)\right]\right) - \sum_{i=0}^m\left[w(x_i)y_i\varphi_k(x_i)\right]

\end{align*}
$$

因为我们希望往线性代数的方向上靠，所以可以把下面这个求和表示成点乘的形式：

$$
\sum_{i=0}^m\left[w(x_i)y_i\varphi_k(x_i)\right] \\

= \vec{w} \cdot \vec{y} \cdot \vec{\varphi_k}

$$

其中，$\vec{w} = w(x_i) \ i \in \{0, \cdots, m\}$，$\vec{y} = y_i \ i \in \{0, \cdots, m\}$，$\vec{\varphi_k} = \varphi_k(x_i) \ i \in \{0, \cdots, m\}$。

同理，式子的另外一部分也可以表示成点乘形式：

$$
\sum_{i=0}^m\left(w(x_i)\varphi_k(x_i)\sum_{j=0}^n\left[a_j\varphi_j(x_i)\right]\right) \\
= \vec{w} \cdot \vec{\varphi_k} \cdot \sum_{j=0}^n  \vec{a_j} \cdot  \vec{\varphi_j} \\
= \sum_{j=0}^n \vec{w} \cdot \vec{\varphi_k} \cdot \vec{\varphi_j}  \cdot  \vec{a_j}
$$

那么如果:

$$
\vec w \cdot \vec y \cdot \vec \varphi_k = \sum_{j=0}^n \vec{w} \cdot \vec{\varphi_k} \cdot \vec{\varphi_j}  \cdot  \vec{a_j}
$$

就符合误差的偏导为 0，也就是 $\frac{\partial I}{\partial a_k} = 0$。


当然，我们最终的目标是把这个式子写成一个矩阵乘法的等式来提升求解速度。仔细观察等式的右边，我们其实可以发现这个求和在本质上也是一个点乘。

$$
\sum_{j=0}^n {\color{red}\vec{w} \cdot \vec{\varphi_k} \cdot \vec{\varphi_j}}  \cdot  \vec{a_j}
$$

为了方便理解，我们把式子中标红的部分记作 $\vec A_k = [\vec{w} \cdot \vec{\varphi_k} \cdot \vec{\varphi_0}, \cdots, \vec{w} \cdot \vec{\varphi_k} \cdot \vec{\varphi_n}]$，其是一个 $n$ 维的向量，那么这个求和就是 $\vec A_k \cdot \vec a$。其中 $a = [a_0, \cdots, a_n]$

同理可以把 $\vec w \cdot \vec y \cdot \vec \varphi_k$ 记作 $B_k$ （标量）。

这样只要解决下面的方程组，就能解决最小二乘问题：

$$
\begin{cases} 
    \vec A_0 \cdot \vec a = B_0 \\ 
    \vec A_1 \cdot \vec a = B_1 \\ 
    \qquad  \vdots \\ 
    \vec A_m \cdot \vec a = B_m
\end{cases}
$$

这个形式就非常的眼熟了，可以直接表示成矩阵形式。

$$
\begin{bmatrix}
    A_{00} & A_{01} & \cdots & A_{0n} \\ 
    A_{10} & A_{11} & \cdots & A_{1n} \\
    \vdots &        & \ddots &        \\
    A_{m0} & A_{m1} & \cdots & A_{mn} \\
\end{bmatrix} \cdot 

\begin{bmatrix}
    a_0 \\ 
    a_1 \\
    \vdots \\
    a_n \\
\end{bmatrix} = 

\begin{bmatrix}

    B_0 \\ 
    B_1 \\
    \vdots \\
    B_m \\
\end{bmatrix}
$$

写的简单点就是 $\bm A \vec a = \vec B$。

## 线性代数角度

待完成
