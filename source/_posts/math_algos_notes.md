---
title: 数学算法学习笔记集合
date: 2022-07-05 17:54:12
updated: 2022-07-10 17:06:54
tags:
- 数学
- 数论
- 扩展欧几里得算法
- 辗转相除法
- 乘法逆元
categories:
- 学习笔记
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments:
cover: false 
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

# 辗转相除法（欧几里得算法）：

求最大公约数 $(a, b), a > b$。

有：
$$
a \div b = q \ldots r\\
a = bq + r \\
r = a - bq
$$

辗转相除法指出： $\gcd(a, b) = \gcd(b, r)$

我们设 

$d$ 为 $a$ 和 $b$ 的任意一个公约数。

以及

$$
m = a \div d,\ n = b \div d
$$

那么：

$$
a = dm,\ b = dn\\
\begin{align*}
r &= a - bq\\
&= dm - (dn)q\\
&= d(m - nq)
\end{align*}
$$

因为 $r = d(m - nq)$。

所以我们可以得出，如果 $a$ 和 $b$ 有任意一个公因数 $d$，这个公因数就一定会是 $r$ 和 $b$ 的公因数（$r=0$ 的情况除外，如果 $r=0$，那么最大公约数就是 $a$ 了）。

也就是如果我们设 $AB$ 为 $a$ 和 $b$ 的公约数集合， $RB$ 为 $r$ 和 $b$ 的公因数集合，那么 $AB \in RB \ \operatorname{if} \ r \ne 0$。 

但是这还不足以证明 $\gcd(a, b) = \gcd(b, r)$，因为有可能 $RB$ 中有比 $\gcd(a, b)$ 更大的数字。

但如果我们证明了 $RB \in AB$，我们就可以证明 $AB = RB$，这样 $RB$ 中就绝对没有比 $\gcd(a, b)$ 更大的数了。

我们设 $e$ 为 $RB$ 中的任意一个数字。

那么有

$$
b = me\\
r = ne
$$

再回到这个式子上，带入 $b$ 和 $r$。

$$
\begin{align*}
a &= bq + r\\
a &= (me)q + (ne)r\\
a &= (mq + nr)e
\end{align*}
$$

说明，$e \mid a$，或者说 $RB$ 中的任意一个数字 $e$ 也在 $AB$ 中。也就是 $RB \in AB$。

所以 $\gcd(a, b) = \gcd(b, r)$。

把辗转相除法写成程序的话就是下面这样，非常的简洁：

```cpp
int gcd(int a, int b){
    if(b)
        return gcd(b, a % b);
    else
        return a;
}
```

参考资料：
1. <https://www.bilibili.com/video/BV19r4y127fu?spm_id_from=333.880.my_history.page.click&vd_source=4de003ee9a3815aedd7d0cb2c7a12d14>
2. <https://www.bilibili.com/video/BV1my4y1z7Zn?spm_id_from=333.1007.top_right_bar_window_history.content.click&vd_source=4de003ee9a3815aedd7d0cb2c7a12d14>'
3. <https://www.cnblogs.com/zjp-shadow/p/9267675.html#%E6%89%A9%E5%B1%95%E6%AC%A7%E5%87%A0%E9%87%8C%E5%BE%97>

# 扩展欧几里得 （exgcd）

在扩展欧几里得算法中，我们尝试找出方程：

$$
ax + by = \gcd(a, b)
$$

的一个解。

下面是一个辗转相除法计算过程的例子，它计算的是 $\gcd(1180, 482)$，最后的结果是 $2$：

$$
\begin{align*}
\gcd(a, b) &= \gcd(b, r)\\
a &= bq + r\\
1180 &= 482(2) + 216\\
482 &= 216(2) + 50\\
216 &= 50(4) + 16\\
50 &= 16(3) + 2 \\
16 &= 2(8) + 0\\
\end{align*}
$$

我们可以从这个过程中推出 $2 = 1180x + 482y$ 的一组解。

首先从过程的倒数第二步，也就是 $50 = 16(3) + 2$ 开始看。把这个式子变换一下，变成：

$$
2 = 50 + 16(-3)
$$

按照相同的方法，也就是 $a = bq + r \to r = a + b(-q)$ 变换辗转相除法的前面几个步骤，可以得到：

$$
\begin{align*}
216 = 50(4) + 16 \ &\to \ 16 = 216 + 50(-4)\\
482 = 216(2) + 50 \ &\to \ 50 = 482 + 216(-2)\\
1180 = 482(2) + 216 \ &\to \ 216 = 1180 + 482(-2)
\end{align*}
$$

再把这些式子带到 $2 = 50 + 16(-3)$ 中，可以发现，我们能把式中的 $16$ 替换成 $216$ 和 $50(-4)$ 的和。

现在这个式子就变成 $2 = 216x + 50y$ 了，其中 $x=-3,\ y=13$。

进一步替换式中的 $50$ 为 $482$ 和 $216(-2)$ 的和，式子也就成了 $2 = 482x + 216y$。

而这个 $216$ 被替换为 $1180$ 和 $482(-2)$ 的和，最终的式子就成为了。

$$
2 = 1180x + 482y
$$

其中 $x=-29,\ y=71$

这正是我们想要的答案。

看的出来 exgcd 有点像是辗转相除法的逆向过程。它利用辗转相除法的计算过程，推出了 $ax + by = \gcd(a, b)$ 的一个解。

现在我们来尝试来推广一下刚刚观察到的规律。首先我们想求的是：

$$
ax + by = \gcd(a, b)\\
$$

因为 $\gcd(a, b) = \gcd(b, a \bmod b)$。而 $\gcd(b, a \bmod b)$ 也可以被写成 $ax + by$ 的形式，就是。

$$
\begin{align*}
\gcd(b, a \bmod b) = bx_2 + (a \bmod b)y_2 
\end{align*}
$$

注意虽然这里的 $\gcd(b, a \bmod b)$ 是和 $\gcd(a, b)$ 一样的。也就是。

$$
ax + by = bx_2 + (a \bmod b)y_2
$$

这两个式子的形式是一样的，都是 $ax + by = \gcd(a, b)$，但是它们中的 $a$ 和 $b$ 不一样，所以解出来的 $x$ 和 $y$ 是不一样的。假设我们已经知道了。解出来的 $x_2$ 和 $y_2$，那么只要知道如何从 $x_2$ 和 $y_2$ 中计算出来 $x$ 和 $y$，就能递归的求解 $x$ 和 $y$ 了，


而我们可以化简 $bx_2 + (a \bmod b)y_2$。

$$
\begin{align*}
ax + by &= bx_2 + (a \bmod b)y_2\\
&= bx_2 + (a - \lfloor{\frac{a}{b}}\rfloor b)y_2 \\
&= ay_2 + bx_2 - \lfloor{\frac{a}{b}}\rfloor by_2  \\
&= ay_2 + b(x_2 - \lfloor{\frac{a}{b}}\rfloor y_2) 
\end{align*}
$$

可以发现，假设我们已经求出了 $bx_2 + (a \bmod b)y_2 = \gcd(b, a \bmod b)$ 的解 $(x_2, y_2)$，那么原式 $ax + by = \gcd(a, b)$ 中的 $x = y_2$，而 $y = (x_2 - \lfloor{\frac{a}{b}}\rfloor y_2)$。这样我们就可以递归的求解了。

而边界条件和普通辗转相除法相似，是 $b = 0$。那么。

$$
\begin{align*}
    ax + by &= \gcd(a, b)\\
    ax + (0)y &= a\\
    x &= 1\\
\end{align*}
$$

虽然这里的 $y$ 随便怎么搞都可以，但是我们一般返回的是 $0$。


下面是代码（用的是 c++20 的标准）：

```cpp
template<typename T>
concept Integral = std::is_integral<T>::value;
// gcd, x, y
template<Integral T>
tuple<T, T, T> ex_gcd(T a, T b){
    if (b == 0) {
        return {a, 1, 0};
    }
    auto [gcd, x2, y2] = ex_gcd(b, a % b);
    //从 x2, y2 推出 x 和 y
    T x = y2;
    T y = x2 - (a / b) * y2;
    return {gcd, x, y};
}
```
参考资料：
1. <https://zhuanlan.zhihu.com/p/86561431>
2. <https://www.cnblogs.com/zjp-shadow/p/9267675.html#%E6%89%A9%E5%B1%95%E6%AC%A7%E5%87%A0%E9%87%8C%E5%BE%97>

# 乘法逆元
> $a\bmod p$ 的乘法逆元定义为 $ax \equiv 1 \pmod b$ 的解 $x$。

乘法逆元有点像是模意义下的相反数。

## exgcd

在 $a$ 和 $b$ 互质的情况下，我们可以使用 exgcd 解决这个问题。

因为 $a$ 和 $b$ 互质，所以：

$$
\gcd(a, b) = 1
$$

那么扩展欧几里得可以解决：

$$
ax + by = 1
$$

我们稍微把 $ax \equiv 1 \pmod b$ 变一下形：

$$
\begin{align*}
ax &\equiv 1 \pmod b\\
ax \bmod b &= 1\\
ax - bk &= 1 \\
\end{align*}
$$

如果我们让 $y = -k$，那么就得到了。

$$
ax + by = 1
$$

但是 $ax + by = 1$ 中的 $x$ 和 $y$ 中可能有一个是负数，如果 $y$ 是负数，那没问题，但如果 $x$ 是负数，我们得到的答案就不是所有可行的 $x$ 中最小的正整数了。

观察 $ax + by = 1$ 这个式子，我们可以给 $x$ 加 $b$ 的倍数，让式子变成 $a(x + bn) + b(y + an) = 1$（注意 $b$ 是负数，$abn$ 会被抵消掉）。这样就可以在不改变 $ax + by = 1$ 的情况下把 $x$ 变成正数。

所以我们可以这么写：
```cpp
x = (x % b + b) % b;
```

我们假设 $x$ 是一个负数。

注意这里第一个的 `x % b` 的作用是先给 $x$ 加上一些 $b$，让它变成符合条件的最大的负数。比如 $b$ 是 $13$，$x$ 是 $-25$。我们让 `x = x % b`，$x$ 就变成了 $-12$，相当于把 $x$ 加上了 $13$。

后面的 `+b` 就是让这个符合条件的最大负数变成符合条件的最小正数。比如 $x + b = -12 + 12 = 1$。那么最后的这个 `% b` 有什么用呢？

这个是为了应对 $x$ 为正数的情况，我们可以通过给 $x$ 减去一些 $b$，让其变成符合条件的最小正数。

然后对于乘法逆元的[模板题](https://www.luogu.com.cn/problem/P3811)，可以写出如下的代码：
```cpp
int n, p;
template<typename T>
concept Integral = std::is_integral<T>::value;
// gcd, x, y
template<Integral T>
tuple<T, T, T> ex_gcd(T a, T b){
    if (b == 0) {
        return {a, 1, 0};
    }
    auto [gcd, x2, y2] = ex_gcd(b, a % b);
    T x = y2;
    T y = x2 - (a / b) * y2;
    return {gcd, x, y};
}

int main() { 
    cin>>n>>p;
    for(int i = 1; i <= n; i++){
        auto[gcd, x, y] = ex_gcd(i, p);
        x = (x % p + p) % p;
        cout<<x<<endl;
    }
}
```
需要注意的是，因为 $3e6$ 的数据规模和 $500ms$ 的时限，用 $n\log p$ 的算法是过不了的，需要用下面讲的线性算法。

参考资料：
1. <https://www.cnblogs.com/zjp-shadow/p/7773566.html>
2. <https://zhuanlan.zhihu.com/p/86561431>


## 线性递推
线性递推的方法可以让我们在 $\operatorname{O}(n)$ 的时间内求出 $1\sim n$ 中所有整数在模质数 $p$ 下的乘法逆元。

注意如果要求出 $1 \sim n$ 的范围中的所有整数，$p$ 必须是质数，因为 $1\sin n$ 的这个区间中可能有很多非质数，要保证 $1\sim n$ 中的数和 $p$ 互质，只能确保 $p$ 为质数。

因为这是一个递推算法，所以需要有初始条件。

不难发现 $1$ 在模任何整数意义下的逆元都是 $1$ 本身（因为 $1 \times 1 = 1$）。所以我们有了初始条件。

假设我们现在已经递推到了数字 $i$。

设 $p \div i = k \ldots r$，那么:

$$
p = ki + r
$$

转化为同余方程可以得到：

$$
ki + r \bmod p = 0\\
ki + r \equiv 0 \pmod p
$$

记 $i^{-1},\ r^{-1}$ 分别为 $i,\ r$ 在模 $p$ 意义下的乘法逆元。把 $i^{-1},\ r^{-1}$ 同时乘到同余式，可得：

$$
i^{-1}r^{-1}(ki + r) \equiv 0\ \cancel{i^{-1}r^{-1}} \pmod p \\
\footnotesize{注：i^{-1}r^{-1} 因为 \times 0 被化简了}
$$

展开，得：

$$
\begin{align*}
i^{-1}r^{-1}(ki + r) &\equiv 0 \pmod p\\
i^{-1}r^{-1}ki + i^{-1}r^{-1}r &\equiv 0 \pmod p\\
kr^{-1} + i^{-1} &\equiv 0 \pmod p\\
\footnotesize 注： 因 i^{-1} 是 i 在模 p 意义下的逆元，i^{-1}\times i &\equiv 1 \footnotesize {\pmod p\ 对于 r 和 r^{-1} 也是}
\end{align*}
$$

移项，得：

$$
i^{-1} \equiv -kr^{-1} \pmod p
$$

因为 $p \div i = k \ldots r$，所以 $k = \lfloor \frac{p}{i} \rfloor$。而 $r = p \bmod i$。

带入 $i^{-1} \equiv -kr^{-1} \pmod p$ 后，得：

$$
i^{-1} \equiv -\lfloor \frac{p}{i} \rfloor \times (p \bmod i)^{-1} \pmod p
$$

考虑前面用 exgcd 解的时候提到的 $ax - bk = 1$，其中的 $x$ 可能是负数。所以我们用了这个方法让他变成最小的正整数解。
```cpp
x = (x % b + b) % b;
```

现在的 $i^{-1}$ 也是一样的，我们可以将其写成 $ai - pk = 1$ 的形式。并且这个 $i^{-1}$ 也是负数，于是就可以用相同的方法确保我们得到的 $i^{-1}$ 是最小的正整数解。然后就可以写出如下的模板题代码：

```cpp
ll inv[MAXN];
template <typename T>
concept Int_t = is_integral<T>::value;
template <Int_t T>
inline T mod_norm(T val, T m) {
    return (val % m + m) % m;
}

int main() {
    ios::sync_with_stdio(0);
    cin.tie(0);
    ll n, p;
    cin >> n >> p;
    inv[1] = 1;
    cout << inv[1] <<'\n';
    for (int i = 2; i <= n; i++) {
        inv[i] = mod_norm(-p / i * inv[p % i] % p, p);
        cout << inv[i] <<'\n';
    }
}
```

参考资料：
1. <https://zhuanlan.zhihu.com/p/86561431>
