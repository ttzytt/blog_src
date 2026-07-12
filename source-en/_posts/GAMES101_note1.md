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

Because of various matters at school, along with reviewing for and taking exams, it has already been more than four months since I last updated the blog, and even longer since I last wrote a computer graphics post.

Summer vacation recently began, and I finally studied the entirety of GAMES101 after previously watching only the ray-tracing section. It was still a very pleasant surprise: after some time had passed, I gained new understandings of many concepts that I had not understood very clearly before, especially the mathematical ones. Because of the course's time constraints, some material was not explained in much detail, so I am recording some of my own understanding here.

# Three-Dimensional Rotation Matrices

I already wrote about this in the earlier [RT: The Next Week article](/2022/10/RTNW_note1/), but the previous explanation was rather... strange and verbose, and it did not explain the subject from the perspective of coordinate-system transformations. I will therefore write it again here (of course, I still have not studied linear algebra systematically, so the following content may still be rather dubious).

The three-dimensional rotation matrices around the three axes can respectively be written in the following forms:

$$
R_x(\theta) = \begin{bmatrix}
1 & 0 & 0 \\
0 & \cos \theta & -\sin \theta \\
0 & \sin \theta & \cos \theta
\end{bmatrix} 
$$ 

$$ 
R_z(\theta) = \begin{bmatrix}
\cos \theta & -\sin \theta & 0 \\
\sin \theta & \cos \theta & 0 \\
0 & 0 & 1
\end{bmatrix}
$$

$$
R_y(\theta) = \begin{bmatrix}
\cos \theta & 0 & \sin \theta \\
0 & 1 & 0 \\
-\sin \theta & 0 & \cos \theta
\end{bmatrix} \\
$$

It is not difficult to notice that, in the matrix for rotation around the y-axis, the positions of $\sin \theta$ and $-\sin \theta$ seem to be reversed, which is very strange. In the original video, the rotation matrix is derived by selecting several special points. I feel that a coordinate-system transformation makes it easier to understand here (~~although Professor Yan thinks this approach is more complicated~~).

First consider rotation around the z-axis. This case is relatively simple and is basically the same as a two-dimensional rotation matrix:

![](/img/GAMES101/rotateAlongZ_ManimCE_v0.17.3.png)

Note that although I did not draw the z-axis here, the right-hand rule tells us that the z-axis points outward through the screen.

We can express the new x-axis ($\hat i$) and the new y-axis ($\hat j$) separately as vectors. Note that both vectors are unit vectors:

$$
\hat i = \begin{bmatrix}
\cos \theta \\
\sin \theta \\
0
\end{bmatrix} \\
$$

Observe that the angle between $\hat j$ and the original y-axis is $\theta$, so we can “reverse” the vector form of $\hat i$. One more point requires attention: the x-component of $\hat j$ is negative:

$$
\hat j = \begin{bmatrix}
-\sin \theta \\
\cos \theta \\
0
\end{bmatrix} \\
$$

In fact, in any coordinate system, every coordinate is obtained by multiplying unit vectors by certain lengths. You can imagine this as moving a point a certain distance in a certain direction. For example, in a Cartesian plane, the coordinate $(1, 2)$ can be understood as moving a point 1 unit in the x direction and 2 units in the y direction.

Therefore, in the rotated coordinate system, the new coordinate of a point $(x, y, z)$ is $(x\hat i, y\hat j, z)$. This is equivalent to moving x units in the $\hat i$ direction, y units in the $\hat j$ direction, and z units in the original z direction. Although that direction was not transformed, we still denote it by $\hat k$ here.

The new coordinate is therefore:

$$
p = x\begin{bmatrix}
\cos \theta \\
\sin \theta \\
0
\end{bmatrix} + y\begin{bmatrix} 
-\sin \theta \\
\cos \theta \\
0
\end{bmatrix}  + z\begin{bmatrix}
0 \\
0 \\
1
\end{bmatrix} 
$$

Looking at the rotation-matrix formula given earlier, we can see that $R_z$ indeed satisfies the expression above:

$$
 \begin{bmatrix}
\textcolor{red}{\cos \theta} & \textcolor{blue}{-\sin \theta} & \textcolor{green}{0} \\
\textcolor{red}{\sin \theta} & \textcolor{blue}{\cos \theta} & \textcolor{green}{0} \\
\textcolor{red}{0} & \textcolor{blue}{0} & \textcolor{green}{1}
\end{bmatrix}\begin{bmatrix}
    x \\
    y \\
    z \\
\end{bmatrix} = x\textcolor{red}{\begin{bmatrix}
\cos \theta \\
\sin \theta \\
0
\end{bmatrix}} + y
\textcolor{blue}{\begin{bmatrix} 
-\sin \theta \\
\cos \theta \\
0
\end{bmatrix} } + z\textcolor{green}{\begin{bmatrix}
0 \\
0 \\
1
\end{bmatrix}}
$$

There is a rather interesting point here, marked with the different colors: the three columns of the rotation matrix correspond respectively to $\hat i$, $\hat j$, and $\hat k$, which are the directions of the three axes in the new coordinate system.

From the perspective of coordinate-system transformations, this makes it very easy to understand why the rotation matrix is written this way. We can directly put the directions of the three transformed axes into the three columns of the matrix, thereby obtaining the rotation matrix.

We can use the same method to analyze rotation around the y-axis—the matrix that appeared to be “reversed.”

![](/img/GAMES101/rotateAlongY_ManimCE_v0.17.3.png)

Although this looks very similar to the preceding figure, notice that the labels in the diagram have changed. Again, the right-hand rule tells us that the y-axis now points outward through the screen.

With the preceding observation, we now need only find $\hat i$, $\hat j$, and $\hat k$ in the current situation to write down the rotation matrix around the y-axis.

First, for the new z-axis, namely $\hat k$, we can draw an analogy with $\hat i$ in the z-axis rotation. Its vector form is:

$$
\hat k = \begin{bmatrix}
\sin \theta \\
0 \\
\cos \theta
\end{bmatrix} \\
$$

The reason the y-component is zero is obvious: we are considering rotation around the y-axis, so y certainly does not change.

Next, by analogy with $\hat j$ in the z-axis rotation, we obtain the vector form of $\hat i$:

$$
\hat i = \begin{bmatrix}
\cos \theta \\
0 \\
-\sin \theta
\end{bmatrix} \\
$$

Because $\hat j$ is unchanged from before, it can simply be written as:

$$
\hat j = \begin{bmatrix}
0 \\
1 \\
0
\end{bmatrix} \\
$$

Combining these vectors that represent the new x, y, and z directions gives:

$$
\left[\hat i \ | \ \hat j \ | \ \hat k\right] = \begin{bmatrix}
\cos \theta & 0 & \sin \theta \\
0 & 1 & 0 \\
-\sin \theta & 0 & \cos \theta
\end{bmatrix} \\
$$

# Barycentric Coordinates

As explained in the [GAMES101 course](https://www.bilibili.com/video/BV1X7411F744?t=615.0&p=9), barycentric coordinates—especially those for triangles—are extremely useful in computer graphics. They make it convenient to interpolate information at a triangle's vertices across the triangle's surface.

When I first listened to the lecture, I still had many questions. For example, why must the three coefficients sum to 1 and all be nonnegative for a point to lie inside the triangle?

After thinking about it for some time, I felt that understanding the concept according to the literal meaning of its name was intuitive: understand it from the perspective of a center of mass.

## Physical Perspective

Suppose there is a triangle whose three vertices have masses $M_a, M_b, M_c$, respectively, while every region other than the vertices has mass 0. According to the definition of a center of mass, the triangle's center of mass is:

$$
\text{center of mass} = \frac{M_aA + M_bB + M_cC}{M_a + M_b + M_c}
$$

Separating these three terms gives:

$$
A\frac{M_a}{M_a + M_b + M_c} + B\frac{M_b}{M_a + M_b + M_c} + C\frac{M_c}{M_a + M_b + M_c}
$$

This form is extraordinarily similar to the barycentric-coordinate expression $\alpha A + \beta B + \gamma C$: every term is a coefficient multiplied by a vertex coordinate.

Looking at a term of the form $\frac{M_a}{M_a + M_b + M_c}$, we find that the coefficients used to calculate the center of mass satisfy the barycentric-coordinate requirements exactly: $\alpha + \beta + \gamma = 1$, and no term is negative.

Thinking in terms of the physical center of mass, what exactly are we converting when we transform ordinary coordinates into barycentric coordinates?

Map the coefficients in the center-of-mass formula to those in barycentric coordinates, namely $\frac{M_a}{M_a + M_b + M_c} \to \alpha$. We can then see that these coefficients are actually the proportions of the triangle's total mass assigned to each vertex.

In other words, during the conversion—suppose we convert point $p$ from Cartesian coordinates to barycentric coordinates—we are really solving this problem: how should weight be distributed among the triangle's three vertices so that the triangle's center of mass lies at point $p$?

The converted coordinate $(\alpha, \beta, \gamma)$ is precisely the proportion of weight assigned to each of the triangle's three vertices.

This makes it easy to understand why the three numbers must sum to 1 and be nonnegative for a point to lie inside the triangle. First, from a physical perspective, if mass is nonnegative, the center of mass must lie inside the object. Second, to satisfy the definition of a center of mass, $\alpha$, $\beta$, and $\gamma$ must sum to 1. Since they represent the proportions of the total mass at the three vertices, the three numbers necessarily sum to 1, corresponding to the total mass.

Of course, barycentric coordinates are a generalization of the physical definition, so a purely algebraic explanation may be more convincing.

## Algebraic Perspective

![](/img/GAMES101/BarycentricTri_ManimCE_v0.17.3.png)

We know that a triangle's barycentric coordinates use a linear combination of its three vertices to represent a coordinate: $p = \alpha A + \beta B + \gamma C$. We can now try to explain algebraically why the three coefficients must sum to 1 and be nonnegative for the point to lie inside the triangle.

First, we can express point $p$ in another form that will help with the later derivation:

$$
p = A + u\overrightarrow{AB} + v\overrightarrow{AC}
$$

Note that $u$ and $v$ have no relation to the three barycentric-coordinate coefficients here. This expression means that, starting from point A, we move $u$ units along the direction AB and then $v$ units along the direction AC to reach point $p$.

First, one thing is certain if the point is to remain inside the triangle: $u$ and $v$ are nonnegative. Starting at A, moving any distance only in the direction $\overrightarrow{BA}$ or $\overrightarrow{CA}$ would immediately leave the triangle.

Rearranging the preceding expression slightly gives:

$$ 
p - A = u\overrightarrow{AB} + v\overrightarrow{AC} \\
\overrightarrow{pA} = u\overrightarrow{AB} + v\overrightarrow{AC} \\
u\overrightarrow{AB} + v\overrightarrow{AC} - \overrightarrow{pA} = {0}
$$

This expression can be understood as follows: we move every point, including point $p$, by $-\overrightarrow{OA}$. At this point, A must lie at the origin.

The expression then becomes intuitive. First, the vector $u\overrightarrow{AB} + v\overrightarrow{AC}$ takes us from the origin to point $p$; then $\overrightarrow{pA}$ takes us from point $p$ back to A, which is the origin.

Because these two parts point in opposite directions and have the same magnitude—one travels from A to $p$, and the other from $p$ to A—the sum of the two vectors must be 0.

Expanding and rearranging the expression gives:

$$
\begin{align*}
u(B - A) + v(C - A) + A - p &= 0 \\
uB - uA + vC - vA + A - p &= 0\\
A(1 - u - v) + uB + vC - p &= 0 \\
(1 - u - v)A + uB + vC &= p
\end{align*}
$$

This form is exactly the same as the barycentric-coordinate expression, so we can determine that $\alpha = 1 - u - v$, $\beta = u$, and $\gamma = v$.

Adding these quantities gives $1 - u - v + u + v = 1$. Indeed, the three barycentric-coordinate coefficients necessarily sum to 1.

We already established that $u$ and $v$ are nonnegative, but if $u + v > 1$, would that not make $\alpha$ negative?

Consider the following figure. $AM$ is a perpendicular from $A$ to $BC$ ($M$ is not the midpoint of $BC$; using a non-equilateral triangle might have made this clearer, ~~but I was lazy~~):

![](/img/GAMES101/BarycentricTriWithM_ManimCE_v0.17.3.png)

Return to the original definition, $p = A + u\overrightarrow{AB} + v\overrightarrow{AC}$. Here, $u$ and $v$ are respectively the distances traveled in the $\overrightarrow{AB}$ and $\overrightarrow{AC}$ directions.

The length of the projection of $u\overrightarrow{AB}$ onto $\overrightarrow{AM}$ is therefore $u\overrightarrow{AB} \cdot \overrightarrow{AM} \over |\overrightarrow{AM}|$.

The figure shows that if $u$ is 1—that is, if $\overrightarrow{AB}$ has its full length—the projection's length must equal $|\overrightarrow{AM}|$. Likewise, if $u$ is 0, the projected length in the $\overrightarrow{AM}$ direction must also be 0.

Because projection, or equivalently the dot product, is a linear operation, if $u$ is 0.5, the projection's length must be half of $|\overrightarrow{AM}|$.

We can therefore say that the length of the projection of $\overrightarrow{AB}$ onto $\overrightarrow{AM}$ is $u|\overrightarrow{AM}|$.

Similarly, the length of the projection of $\overrightarrow{AC}$ in the $\overrightarrow{AM}$ direction follows the same rule.

For point $p$ to remain inside the triangle, the length of the projection of the vector $u\overrightarrow{AB} + v\overrightarrow{AC}$ onto $\overrightarrow{AM}$ must be no greater than the length of $\overrightarrow{AM}$ itself. Otherwise, point $p$ would cross side $BC$ and leave the triangle.

The projected length of $\overrightarrow{AB}$ onto $\overrightarrow{AM}$ is $u|\overrightarrow{AM}|$, while the projected length of $\overrightarrow{AC}$ onto $\overrightarrow{AM}$ is $v|\overrightarrow{AM}|$. Naturally, the projected length of the sum of the two vectors onto $\overrightarrow{AM}$ is $(u + v)|\overrightarrow{AM}|$.

As stated above, for point $p$ to stay inside the triangle, the projection of $u\overrightarrow{AB} + v\overrightarrow{AC}$ onto $\overrightarrow{AM}$ must be no longer than $\overrightarrow{AM}$ itself. That is, $(u + v)|\overrightarrow{AM}| \le |\overrightarrow{AM}|$, so $u + v \le 1$.

Because $\alpha = 1 - u - v$ and $u + v \le 1$, we can show that $\alpha$ must also be nonnegative.

At this point, we have explained why a point inside a triangle must satisfy $\alpha + \beta +\gamma = 1$, with every coefficient nonnegative. Of course, converting a Cartesian coordinate into barycentric coordinates still requires some relatively complicated calculations. For this part, I think the first method described in [this blog post](https://davidhsu666.com/archives/barycentric-coordinates/) is relatively easy to understand and quite ingenious; interested readers can take a look.
