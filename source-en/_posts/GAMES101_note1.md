---
title: GAMES101 Study Notes 1
date: 2023-06-16 19:30:42
updated: 2023-06-21 15:28:32
tags:
- Computer Graphics
- GAMES101
- Mathematics
- Linear Algebra
categories:
- Study Notes 
keywords:
description:
top_img: /img/GAMES101/games101.png
comments:
cover: /img/GAMES101/games101.png
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2023/06/GAMES101_note1/).
{% endnote %}

Because of schoolwork and exams, more than four months passed since my last blog update, and even longer since my last graphics post. During the summer vacation I completed GAMES101 after previously watching only its ray-tracing part. Many concepts that had been unclear—especially mathematical ones—became easier to understand on a second pass. Some material was not covered in detail, so these are my own notes.

# Three-Dimensional Rotation Matrices

I previously wrote about this in [RT: The Next Week](/2022/10/RTNW_note1/), but that explanation was verbose and did not use coordinate transformations, so I rewrite it here.

The rotation matrices about the three axes are:
$$R_x(\theta)=\begin{bmatrix}1&0&0\\0&\cos\theta&-\sin\theta\\0&\sin\theta&\cos\theta\end{bmatrix}$$
$$R_z(\theta)=\begin{bmatrix}\cos\theta&-\sin\theta&0\\\sin\theta&\cos\theta&0\\0&0&1\end{bmatrix}$$
$$R_y(\theta)=\begin{bmatrix}\cos\theta&0&\sin\theta\\0&1&0\\-\sin\theta&0&\cos\theta\end{bmatrix}.$$

The positions of $\sin\theta$ and $-\sin\theta$ in $R_y$ may look reversed. Coordinate transformations make this easier to understand. For rotation about $z$:
![](/img/GAMES101/rotateAlongZ_ManimCE_v0.17.3.png)

The new unit axes are:
$$\hat i=\begin{bmatrix}\cos\theta\\\sin\theta\\0\end{bmatrix},\qquad
\hat j=\begin{bmatrix}-\sin\theta\\\cos\theta\\0\end{bmatrix},\qquad
\hat k=\begin{bmatrix}0\\0\\1\end{bmatrix}.$$
Thus a point $(x,y,z)$ in the new coordinates is $x\hat i+y\hat j+z\hat k$. The columns of the rotation matrix are precisely the directions of the new axes.

For rotation about $y$:
![](/img/GAMES101/rotateAlongY_ManimCE_v0.17.3.png)
$$\hat k=\begin{bmatrix}\sin\theta\\0\\\cos\theta\end{bmatrix},\quad
\hat i=\begin{bmatrix}\cos\theta\\0\\-\sin\theta\end{bmatrix},\quad
\hat j=\begin{bmatrix}0\\1\\0\end{bmatrix}.$$
Combining these columns gives the stated $R_y$ matrix.

# Barycentric Coordinates

As described in [GAMES101](https://www.bilibili.com/video/BV1X7411F744?t=615.0&p=9), barycentric coordinates are useful in graphics for interpolating information from triangle vertices to its surface. A point is written $p=\alpha A+\beta B+\gamma C$.

## Physical Interpretation

If triangle vertices have masses $M_a,M_b,M_c$, its center of mass is:
$$\text{center} = \frac{M_aA+M_bB+M_cC}{M_a+M_b+M_c}.$$
The coefficients are nonnegative and sum to 1, exactly the barycentric-coordinate requirements. Thus $(\alpha,\beta,\gamma)$ represents the proportions of mass assigned to the three vertices. Nonnegative masses put the center inside the object, and the proportions sum to the total mass.

## Algebraic Interpretation

![](/img/GAMES101/BarycentricTri_ManimCE_v0.17.3.png)

Write the point another way:
$$p=A+u\overrightarrow{AB}+v\overrightarrow{AC}.$$
For a point inside the triangle, $u,v\ge0$. Rearranging:
$$u(B-A)+v(C-A)+A-p=0,$$
so:
$$
(1-u-v)A+uB+vC=p.
$$
Therefore $\alpha=1-u-v$, $\beta=u$, and $\gamma=v$, and their sum is 1.

To remain inside the triangle, the projection of $u\overrightarrow{AB}+v\overrightarrow{AC}$ onto the altitude from $A$ must not exceed that altitude. The projected length is $(u+v)|\overrightarrow{AM}|$, so $u+v\le1$ and consequently $\alpha=1-u-v\ge0$.

This explains why an interior point has nonnegative coefficients summing to 1. Converting Cartesian coordinates to barycentric coordinates still requires some calculation; the first method in [this article](https://davidhsu666.com/archives/barycentric-coordinates/) is relatively intuitive.
