---
title: A Collection of Notes on Mathematical Algorithms
date: 2022-07-05 17:54:12
updated: 2022-07-10 17:06:54
tags:
- Mathematics
- Number Theory
- Extended Euclidean Algorithm
- Euclidean Algorithm
- Modular Multiplicative Inverses
categories:
- Study Notes
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

{% note danger simple %}
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/07/math_algos_notes/).
{% endnote %}

# Euclidean Algorithm

Find the greatest common divisor $(a,b)$, where $a>b$.

We have:
$$
a \div b = q \ldots r\\
a = bq + r \\
r = a - bq
$$

The Euclidean algorithm states that $\gcd(a,b)=\gcd(b,r)$.

Let $d$ be any common divisor of $a$ and $b$, and let:
$$m = a \div d,\ n = b \div d$$
Then:
$$
a = dm,\ b = dn\\
\begin{align*}
r &= a - bq\\
&= dm - (dn)q\\
&= d(m - nq)
\end{align*}
$$

Since $r=d(m-nq)$, if $a$ and $b$ have any common divisor $d$, then $d$ is also a common divisor of $r$ and $b$ (except when $r=0$; in that case the greatest common divisor is $a$). If $AB$ is the set of common divisors of $a$ and $b$, and $RB$ is the set of common divisors of $r$ and $b$, then $AB \in RB$ when $r\ne0$.

This alone does not prove $\gcd(a,b)=\gcd(b,r)$, because $RB$ might contain a number larger than $\gcd(a,b)$. If we prove $RB\in AB$, then $AB=RB$, so $RB$ cannot contain a number larger than $\gcd(a,b)$.

Let $e$ be any number in $RB$. Then:
$$b=me,\qquad r=ne$$
Substitute $b$ and $r$ back into $a=bq+r$:
$$
\begin{align*}
a &= bq + r\\
a &= (me)q + (ne)r\\
a &= (mq + nr)e
\end{align*}
$$
Thus $e\mid a$, so every $e$ in $RB$ is also in $AB$; that is, $RB\in AB$. Therefore $\gcd(a,b)=\gcd(b,r)$.

The Euclidean algorithm is very concise in code:
```cpp
int gcd(int a, int b){
    if(b)
        return gcd(b, a % b);
    else
        return a;
}
```

References:
1. <https://www.bilibili.com/video/BV19r4y127fu?spm_id_from=333.880.my_history.page.click&vd_source=4de003ee9a3815aedd7d0cb2c7a12d14>
2. <https://www.bilibili.com/video/BV1my4y1z7Zn?spm_id_from=333.1007.top_right_bar_window_history.content.click&vd_source=4de003ee9a3815aedd7d0cb2c7a12d14>'
3. <https://www.cnblogs.com/zjp-shadow/p/9267675.html#%E6%89%A9%E5%B1%95%E6%AC%A7%E5%87%A0%E9%87%8C%E5%BE%97>

# Extended Euclidean Algorithm (exgcd)

The extended Euclidean algorithm finds one solution to:
$$ax+by=\gcd(a,b).$$

For example, the following Euclidean-algorithm calculation computes $\gcd(1180,482)=2$:
$$
\begin{align*}
\gcd(a,b)&=\gcd(b,r)\\
a&=bq+r\\
1180&=482(2)+216\\
482&=216(2)+50\\
216&=50(4)+16\\
50&=16(3)+2\\
16&=2(8)+0
\end{align*}
$$

We can derive a solution to $2=1180x+482y$. Start with the penultimate step, $50=16(3)+2$, and rewrite it as:
$$2=50+16(-3).$$
Applying $a=bq+r\to r=a+b(-q)$ to the preceding steps gives:
$$
\begin{align*}
216=50(4)+16&\to16=216+50(-4)\\
482=216(2)+50&\to50=482+216(-2)\\
1180=482(2)+216&\to216=1180+482(-2)
\end{align*}
$$

Substituting these expressions into $2=50+16(-3)$ repeatedly eventually yields:
$$2=1180x+482y,$$
where $x=-29,y=71$. The extended Euclidean algorithm is essentially the reverse of the Euclidean algorithm: it uses the calculation process to derive a solution to $ax+by=\gcd(a,b)$.

To generalize, since $\gcd(a,b)=\gcd(b,a\bmod b)$, write:
$$\gcd(b,a\bmod b)=bx_2+(a\bmod b)y_2.$$
Then:
$$
\begin{align*}
ax+by&=bx_2+(a\bmod b)y_2\\
&=bx_2+(a-\lfloor a/b\rfloor b)y_2\\
&=ay_2+b(x_2-\lfloor a/b\rfloor y_2).
\end{align*}
$$
Thus, if $(x_2,y_2)$ is the solution for the recursive call, then $x=y_2$ and $y=x_2-\lfloor a/b\rfloor y_2$. The boundary is $b=0$, where $x=1,y=0$.

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
    // Derive x and y from x2 and y2.
    T x = y2;
    T y = x2 - (a / b) * y2;
    return {gcd, x, y};
}
```

References:
1. <https://zhuanlan.zhihu.com/p/86561431>
2. <https://www.cnblogs.com/zjp-shadow/p/9267675.html#%E6%89%A9%E5%B1%95%E6%AC%A7%E5%87%A0%E9%87%8C%E5%BE%97>

# Modular Multiplicative Inverse
> The modular multiplicative inverse of $a\bmod p$ is the solution $x$ of $ax\equiv1\pmod b$.

A modular inverse is somewhat like an additive inverse under a modulus.

## exgcd

When $a$ and $b$ are coprime, exgcd can solve this problem. Since $\gcd(a,b)=1$, extended Euclid solves $ax+by=1$.

Rewrite $ax\equiv1\pmod b$ as:
$$
ax\equiv1\pmod b\\
ax\bmod b=1\\
ax-bk=1.
$$
Setting $y=-k$ gives $ax+by=1$.

One of $x,y$ may be negative. A negative $y$ is harmless, but a negative $x$ is not the smallest positive solution. We can add multiples of $b$ to $x$ while preserving the equation, so normalize it with:
```cpp
x = (x % b + b) % b;
```
The first `% b` brings a negative $x$ to the largest valid negative value, `+b` moves it to the smallest positive value, and the final `% b` also handles an originally positive $x$.

For the modular-inverse [template problem](https://www.luogu.com.cn/problem/P3811):
```cpp
int n, p;
template<typename T>
concept Integral = std::is_integral<T>::value;
template<Integral T>
tuple<T, T, T> ex_gcd(T a, T b){
    if (b == 0) return {a, 1, 0};
    auto[gcd, x2, y2] = ex_gcd(b, a % b);
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
Because the data size is $3e6$ and the time limit is 500 ms, an $n\log p$ algorithm is too slow; use the linear algorithm below.

## Linear Recurrence

The linear recurrence computes the modular inverses of all integers from $1$ to $n$ modulo a prime $p$ in $O(n)$ time. $p$ must be prime to ensure all values in the range are coprime to it.

The inverse of 1 is 1, providing the initial condition. Suppose we have reached $i$. Write $p\div i=k\ldots r$, so $p=ki+r$. Modulo $p$:
$$ki+r\equiv0\pmod p.$$
Multiplying by $i^{-1}r^{-1}$ and expanding gives:
$$kr^{-1}+i^{-1}\equiv0\pmod p,$$
so:
$$i^{-1}\equiv-k r^{-1}\pmod p.$$
Since $k=\lfloor p/i\rfloor$ and $r=p\bmod i$:
$$i^{-1}\equiv-\lfloor p/i\rfloor\times(p\bmod i)^{-1}\pmod p.$$

Normalize the possibly negative value in the same way:
```cpp
x = (x % b + b) % b;
```

The template code is:
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

Reference:
1. <https://zhuanlan.zhihu.com/p/86561431>
