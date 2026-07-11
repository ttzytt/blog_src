---
title: 反向传播（backpropagation）算法学习笔记，基于全连接神经网络
date: 2022-10-31 00:00:00
updated: 2022-11-05 00:00:00
tags:
- 机器学习
- 神经网络
- 反向传播
- 2022
- MNIST
- 手写数字识别
categories:
- 学习笔记
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments:
cover: /img/神经网络/bp/mnist_number.png
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
<!-- # 反向传播算法学习笔记（在全连接神经网络中） -->
upd@2022/11/5：添加了具体实现，修正了推导中的一些符号错误
upd@2024/6/8：修正了推导中的一个下标错误

反向传播算法的主要目的是计算出神经网络中误差对于偏置和权重等参数的偏导数，以此来进行梯度下降。本文的上半部分主要是算法的推导，后半部分使用全连接神经网络和 mnist 数据集实现手写数字识别。

这个算法对我来说还是很难理解的，为了防止自己忘掉，就写了这篇笔记（还有就是神经网络里这些公式的上标下标太多了，如果用真的笔记本写，稍微一不小心就写错了）。如果你对神经网络还没有基本的概念，推荐去看 3b1b 的[神经网络系列视频](https://www.bilibili.com/video/BV1bx411M7Zx/?from=search&seid=13277969767348205014&spm_id_from=333.337.0.0)

这里必须说一句 [MqCreaple](https://github.com/MqCreaple) 大佬真的太巨了，看了视频之后直接手推了全部的公式~~更令人震惊的是居然把我这种人教会了~~。

# 公式推导
## 符号和语言约定

- ${\sigma()}$ 表示激活函数
- $E$ 表示最终误差
- $\operatorname{err}()$ 表示误差函数
- $\hat{y}$ 表示神经网络给出的预测值，而 $y$ 表示实际的答案
- $l$ 表示神经网络的层数，值越小代表离输入层越近
- $w^{[l]}_{ji}$ 表示一条从 $l$ 层 $j$ 节点连接到 $l - 1$ 层 $i$ 节点的边
- $b^{[l]}_{i}$ 表示 $l$ 层 $i$ 节点的偏置
- $z^{[l]}_{i}$ 表示 $l$ 层 $i$ 节点不加激活函数的输出
- $a^{[l]}_{i}$ 表示 $\sigma(z^{[l]}_{i})$，即该节点经过激活函数后的输出
- $n^{l}$ 表示 $l$ 层节点的数量。
- 变量下的下划线表示常数，如 $\underline{x}$
- 某个层前面的层指其 $l$ 更小，反之亦然。

## 每层为单节点的神经网络

先考虑一个最简单的全连接神经网络，其每层只有一个节点，那么可以画出下图，代表单个节点的输出值 $a^{[l]}$ 的计算流程（通过箭头起点的变量以及对应的函数可以得到箭头指向的变量）。

{% mermaid %}
graph TB
 alm1["a(l-1)"] & w & b --> z --> al["a(l)"] --> 误差值
 y-->误差值
{% endmermaid %}

如果我们写成函数的形式，是下面这样的：

$$
z^{[l]} = wa^{[l-1]} + b \\
a^{[l]} = \sigma(z^{[l]}) \\
E = \operatorname{err}(a^{[l]}, y)
$$

那如果我们想要根据误差值来对于权值 $w^{[l]}$ 梯度下降，就需要求出误差对权值的偏导数，即：

$$
\frac{\partial E}{\partial w^{[l]}}
$$

使用偏导数是因为 $z^{[l]}$ 的计算依赖于三个变量，而我们希望知道改变 $w^{[l]}$ 后对误差值的影响。

求偏导时，我们假设其他变量都是常数，只有一个变量在变化（以及被这个变量直接影响的其他变量，这种情况下是上图中 $w^{[l]} \to z{[l]} \to a^{[l]} \to E$ 的链），那可以写出如下的式子（常数下有下划线）：

$$
E = \operatorname{err}(\sigma(w^{[l]}\underline{a^{[l-1]}} + \underline{b}), \underline{y})
$$

这个时候可以使用链式求导：

$$
\begin{align*}
    E^\prime = \operatorname{err}^\prime(&\sigma(w^{[l]}\underline{a^{[l-1]}} + \underline{b}), \underline{y}) \\
                                   \cdot &\sigma^{\prime}(w^{[l]}\underline{a^{[l-1]}} + \underline{b}) \\
                                                    \cdot &(w^{[l]}\underline{a^{[l-1]}} + \underline{b})^\prime
\end{align*}
$$

写成另一种形式（更方便之后使用）就是：

$$
\begin{align*}
    \frac{\partial E}{\partial w^{[l]}} = \frac{\partial z^{[l]}}{\partial w^{[l]}} \cdot \frac{\partial a^{[l]}}{\partial z^{[l]}} \cdot \frac{\partial E}{\partial a^{[l]}}
\end{align*}
$$

然后可以求出链式法则的各个中间偏导数，进一步还可以写作下面的形式（假设误差函数是平方误差函数）：

$$
\begin{align*}
    \frac{\partial z^{[l]}}{\partial w^{[l]}} &= (w^{[l]}\underline{a^{[l-1]}} + \underline{b})^\prime = a^{[l-1]} \\
    \frac{\partial a^{[l]}}{\partial z^{[l]}} &= \sigma^{\prime}(z^{[l]}) \\
    \frac{\partial E}{\partial a^{[l]}} &= 2(a^{[l]} - y)
\end{align*}
$$

注意 $2(a^{[l]} - y)$ 这里不能反了（举个例子，$a^{[l]}$ 过大的时候我们希望导数也大，这样可以给要调整的值减去导数）。

上面展示的是误差对于权值的偏导，对于偏置和上一层的输出，只需要替换掉 $\frac{\partial E}{\partial w^{[l]}}$ 公式中的 $\frac{\partial z^{[l]}}{\partial w^{[l]}}$ 即可。或者说让上一层的输出和这一层的偏置来影响 $z^{[l]}$，而不是权值。

对于 $b^{[l]}$，替换成：

$$
\frac{\partial z^{[l]}}{\partial b^{[l]}} = (\underline{w^{[l]}a^{[l-1]}} + b)^\prime = 1
$$

对于 $a^{[l - 1]}$，替换成：

$$
\frac{\partial z^{[l]}}{\partial a^{[l - 1]}} = (\underline{w^{[l]}}a^{[l-1]} + \underline{b})^\prime = w^{[l]}
$$

现在考虑如下一个网络：

{% mermaid %}
graph TB
 al["a(l)"] & wlp["w(l + 1)"] & blp["b(l + 1)"] --> zlp["z(l + 1)"] --> alp["a(l + 1)"] --> ...别的很多层
 __["w(l + 2)"] & _["b(l + 2)"]-->...别的很多层
{% endmermaid %}

也就是 $a^{[l]}$ 的下一层不直接连接误差函数，而是有多层。那 $\frac{\partial E}{\partial a^{[l]}}$ 就不能直接求出了（也就不能直接求出 $w^{[l]}$ 和 $b^{[l]}$ 的偏导），因为 $E$ 在很多层之后。这时候就需要用到反向传播的思想了。

我们知道：

$$
\frac{\partial E}{\partial a^{[l]}} = \frac{\partial z^{[l + 1]}}{\partial a^{[l]}} \cdot \frac{\partial a^{[l + 1]}}{\partial z^{[l + 1]}} \cdot \frac{\partial E}{\partial a^{[l + 1]}}
$$

观察式子可以发现我们能从后层推出前层的 $\frac{\partial E}{\partial a^{[l]}}$，所以在求权值和偏置的偏导前，我们需要先从输出层开始，一点一点的把 $\frac{\partial E}{\partial a^{[l]}}$ 向前传。  

## 每层为多节点的情况

##

在刚刚的例子中，反向传播算法的过程还是很清晰的，没有任何的线性代数。不过在真实的神经网络中，每层有多个节点，如下：

{% mermaid %}
graph LR
     l1["(l-1)1"] & l2["(l-1)2"] & l3["(l-1)3"] ---> lp1["l1"] & lp2["l2"] & lp3["l3"]
{% endmermaid %}

### 误差对权值的偏导

$w^{[l]}_{ji}$ 表示一条从 $l$ 层 $j$ 节点连接到 $l - 1$ 层 $i$ 节点的边。要如何求 $\frac{\partial E}{\partial w^{[l]}_{ji}}$ 呢？

我们其实还是可以把原来的公式带进来，毕竟多节点的层本质上还是由多个单节点的层组成的，不过要注意下标：

$$
\begin{align*}
    \frac{\partial E}{\partial w^{[l]}_{ji}} &= \frac{\partial z^{[l]}_j}{\partial w^{[l]}_{ji}} \cdot \frac{\partial a^{[l]}_j}{\partial z^{[l]}_j} \cdot \frac{\partial E}{\partial a^{[l]}_j} \\
    &= a^{[l-1]}_i \cdot \sigma^\prime (z^{[l]}_j) \cdot \frac{\partial E}{\partial a^{[l]}_j}
\end{align*}
$$

注意这里和 $l-1$ 层有关的变量我们都使用的是 $i$，比如 $a^{[l-1]}_i$ （直观理解的话就是，改变单位权重，上一层的输入越大就对最终的误差函数影响越大），和 $l$ 层有关的使用的都是 $j$。

因为 $\sigma^\prime (z^{[l]}_j) \cdot \frac{\partial E}{\partial a^{[l]}_j}$ 的下标是一样的，我们为方便书写矩阵运算的公式，就叫他 $r_j$。

重写一下刚才的公式：

$$
\frac{\partial E}{\partial w^{[l]}_{ji}} = r_j \cdot a^{[l-1]}_i
$$

$w^{[l]}$ 写成矩阵形式的话，$j$ 随行增长，$i$ 随列增长。那上面的导数就是：

$$
\frac{\partial E}{\partial w^{[l]}} =
\begin{bmatrix}
      r_1 a^{[l-1]}_1 & r_1 a^{[l-1]}_2 & \cdots & r_1 a^{[l-1]}_{n^{l-1}}   \\
      r_2 a^{[l-1]}_1 & r_2 a^{[l-1]}_2 & \cdots & r_2 a^{[l-1]}_{n^{l-1}}   \\
      \vdots          & \vdots          & \ddots & \vdots                     \\
      r_{n^l} a^{[l-1]}_1  & r_{n^l} a^{[l-1]}_2  & \cdots & r_{n^l} a^{[l-1]}_{n^{l-1}}   \\
\end{bmatrix}
$$

观察发现，这个矩阵其实就等于：

$$
\begin{bmatrix}
    r_1    \\
    r_2    \\
    \vdots \\
    r_{n^l}
\end{bmatrix}

\cdot

\begin{bmatrix}
    a^{[l-1]}_1 & a^{[l-1]}_2 & \cdots & a^{[l-1]}_{n^{l-1}}
\end{bmatrix}
$$

这样就可以使用矩阵运算库（如 numpy）来加速了。

### 误差对偏置的偏导

这个就相对简单，因为 $\frac{\partial z^{[l]}_j}{\partial b^{[l]}_j}$ 等于 $1$ （见前文），所以可以很方便的计算。

$$
\begin{align*}
    \frac{\partial E}{\partial b^{[l]}_j} &= \frac{\partial z^{[l]}_j}{\partial b^{[l]}_j} \cdot \frac{\partial a^{[l]}_j}{\partial z^{[l]}_j} \cdot \frac{\partial E}{\partial a^{[l]}_j} \\
    &= 1 \cdot \sigma^\prime (z^{[l]}_j) \cdot \frac{\partial E}{\partial a^{[l]}_j}\\
    &= r_j
\end{align*}
$$

注意这里的误差对偏置的导数就等于前面用到的 $r_j$，所以实现的时候一般先计算这个，然后再把 $r_j$ 带入到前文的式子中。

### 误差对上层输入的偏导

再观察一下前面的多节点神经网络，不过这次主要关注单个 $l - 1$ 节点对后面的影响：

{% mermaid %}
graph LR
     l1["(l-1)1"]  ===> lp1["l1"] & lp2["l2"] & lp3["l3"]
{% endmermaid %}

不难发现，$a^{[l-1]}_i$ 可以对每个 $z^{[l]}_j$ 都产生影响。如果我们把 $l$ 层当成一个接收 $n^{l-1}$ 个 $a^{[l-1]}_i$，输出 $n^l$ 个 $z^{[l]}_j$ 的函数。那么现在每个输入的变量都在变化，求的就不是偏导数了（偏微分），而是全微分[^1]（total derivative）。

根据全微分的定义，应该把每个参数的偏导加起来，在我们的例子中，就是：

$$
\begin{align*}
    \frac{\partial E}{\partial a^{[l]}_i} &= \sum_{j=1}^{n^{l+1}} \left(\frac{\partial z^{[l + 1]}_j}{\partial a^{[l]}_i} \cdot \frac{\partial a^{[l + 1]}_j}{\partial z^{[l + 1]}_j} \cdot \frac{\partial E}{\partial a^{[l + 1]}_j}\right)\\
\end{align*}
$$

其中 $\frac{\partial z^{[l + 1]}_j}{\partial a^{[l]}_i}$ 这个部分需要比较小心的处理。我们需要清楚 $w^{[l+1]}_{ji}$ 是连接 $l + 1$ 层的 $j$ 节点和 $l$ 层 $i$ 节点的边。

那么因为

$$
z^{[l+1]}_j = w^{[l+1]}_{ji}\cdot a^{[l]}_i + b^{[l+1]}_j
$$

可以推出

$$
\frac{\partial z^{[l + 1]}_j}{\partial a^{[l]}_i} = w^{[l+1]}_{ji}
$$

而 

$$
\frac{\partial a^{[l + 1]}_j}{\partial z^{[l + 1]}_j} \cdot \frac{\partial E}{\partial a^{[l + 1]}_j}
$$

在前面已经解释过了，就等于 $r_j$ 和误差对偏置的导数。

重写整个式子，可以得到：

$$
\frac{\partial E}{\partial a^{[l]}_i} = \sum_{j=1}^{n^{l+1}} \left(r_j \cdot w^{[l+1]}_{ji} \right)
$$

现在可以思考如何以矩阵运算的形式得到 $\frac{\partial E}{\partial a^{[l]}_j}$。

一个可行的方法是在 $r_j$ 和 $w^{[l+1]}_{ji}$ 之间做乘法。

注意我们用 $j$ 这个下标来累加，所以如果我们把 $w^{[l+1]}$ 放在左边，其 $j$ 坐标应该随着列数增加而增加（ $A\times B$ 的矩阵乘法中，会对 $A$ 的行和 $B$ 的列做向量的点乘）。 而把 $r$ 放在乘法的右边，就需要让其的 $j$ 下标随行数增长。

因为 $w^{[l+1]}$ 的 $j$ 本来是随行增加的，所以要对其进行转制。

最后可以得到：

$$
\frac{\partial E}{\partial a^{[l]}} = (w^{[l+1]})^T \times r
$$

其中 $r$ 是一个列向量。

# 实现

这个部分中会使用刚刚讲到的反向传播算法来实现一个简单的全连接神经网络，并且使用这个神经网络来识别 mnist 数据集中的手写数字。

## 数据预处理

说实话 mnist 这个数据集挺坑的，用的是二进制储存格式，所以想要读取数据集里的内容还得费点功夫。

代码如下[^2]：

```python
# 在项目中的位置：./src/util
def load_mnist(path: str, pref: str = "train"):
    """ 
        path: 数据集路径
        data_type: 数据集名称前缀（train or t10k）
    """
    label_path = os.path.join(path, "{}-labels.idx1-ubyte".format(pref))
    img_path = os.path.join(path, "{}-images.idx3-ubyte".format(pref))
    with open(label_path, 'rb') as lfile: # rb 表示 read binary
        magic, n = struct.unpack('>II', lfile.read(8))
        labels = np.fromfile(lfile, dtype=np.uint8)
    with open(img_path, 'rb') as ifile: # ifile 为 image file
        magic, num, rows, cols = struct.unpack('>IIII', ifile.read(16))
        images = np.fromfile(ifile, dtype=np.uint8).reshape(
            len(labels), 28 * 28)
    label_one_hot = np.zeros((len(labels), 10), dtype=int)
    for i in range(len(labels)):
        label_one_hot[i] = np.eye(10)[labels[i]]
    return label_one_hot, images / 255.0
```

里面这个 `struct` 的包看起来可能比较迷，实际上他就是一个专门处理二进制数据的类。

```python
struct.unpack('>II', lfile.read(8))
```

这句话的意思是就是从 `lfile` 里读取两个大端字节序的 4 字节无符号整数。`>II` 中的 `>` 表示了文件是以大端字节序储存的，而 `I` 则表示读取的是 4 字节无符号整数。

下面的 `np.fromfile` 也是一个作用，直接把二进制文件转换成了一个 `np.array`，不用指定字节序应该是因为 numpy 默认的就是大端。

要注意 mnist 数据集中图片单个像素的范围是 $[0, 255]$ 的整数。而我们希望其变成 $[0, 1]$ 的浮点数，所以在输出时间除 255。

想要图片在 $[0,1]$ 范围中主要是因为，如果把一个比较大的数字 `sigmoid` 函数就会出现溢出问题（虽然每层权值的初始值是 -1 到 1 之间随机生成的，但是有时候会输出较大值），sigmoid 的定义如下：

$$
\sigma(x) = \frac{1}{1 + e^{-x}}
$$

这里这个 $x$ 过小那 $e^{-x}$ 就会变成一个特别大的数字，因为 numpy 实际上是调用 c 完成计算工作的，所以不像 python 那样自带高精，这样的数字自然就会造成溢出。

预处理的最后一部是把标签转换成 one-hot（中文翻译为独热）形式（方便最后求误差对整个神经网络的梯度），这里可以用 `np.eye(x)` 这个函数，它可以生成一个 $x\timesx$ 的对角线矩阵，那么 `np.eye(10)[labels[i]]` 自然就是 `labels[i]` 的对应独热编码了。

## layer 类

单层神经网路本质上其实是一个函数，其接收一个向量，输出一个向量。不过这个函数是依赖于很多变量的，比如权重和偏置，所以我们希望用一个类将他们存起来。

同时，在反向传播的过程中，也需要用到类中储存的这些变量，所以最好能实现一个函数，其接收误差对当前层的导数，以其他必要的数据，返回误差对前层的导数（反向传播）。

最后，对于本层来说，我们还需要提供一个接口来更新其权重和偏置（如果不同层的数据不是权重和偏置，可以新建一个抽象类专门表示不同层的数据）。

根据这些需求，可以写出层类的抽象类：

注意每个函数的参数名都是符合之前的数学公式的，如果有不明白的可以看前文。

```python
# 在项目中的位置：./src/layer.py
from typing import *
import numpy as np
from nptyping import NDArray, Shape, Float
from . import util

class abs_layer():
    def __init__(self, insize: int, outsize: int, activ: util.Dfunc = util.sigmoid):
        self.insize = insize
        self.outsize = outsize
        self.activ = activ
    def get_z(self, ipt: NDArray) -> NDArray:
        """ 
            根据输入返回一个没有经过激活函数的输出
        """
        pass
    def get_a(self, ipt: NDArray) -> NDArray:
        """ 
            根据输入返回经过激活函数的输出
        """

        pass
    def get_derivatives(self, prev_a : NDArray, DE_over_cur_a: NDArray, cur_z: NDArray) -> List[NDArray]:
        """ 
            prev_a        : 前面一层经过激活函数的输出
            DE_over_cur_a : 误差对当前层输出的导数
            cur_z         : 当前层没经过激活函数的输出
        """
        pass
    def descent(self, w, b):    
        """ 
            w : 权重的梯度
            b : 偏置的梯度
        """
        pass
```

这里的 `util.Dfunc` 表示的是一个可导的函数，定义如下：

```python
# 在项目中的位置：./src/util.py
class Dfunc():
    """ 
        表示一个可导的函数，f 是原函数，df 是导数
        如果 f 是多元函数，则 df 返回的应该是一个向量（不同输入参数的偏导数）
    """

    def __init__(self, func: Callable, Dfunc: Callable):
        self.f = func
        self.Df = Dfunc

sigmoid = Dfunc(lambda x: 1 / (1 + np.exp(-x)),
                lambda x: np.exp(-x) / ((1 + np.exp(-x)) ** 2))

sq_err = Dfunc(lambda label, predict: np.sum((predict - label) ** 2),
               lambda label, predict: 2 * (predict - label))
```

对于一个全连接神经网络，可以有如下的实现：

```python
# 在项目中的位置：./src/layer.py
class dense_layer(abs_layer):
    def __init__(self, insize: int, outsize: int, activ: util.Dfunc = util.sigmoid) -> None:
        super(dense_layer, self).__init__(insize, outsize)
        self.wts = np.random.rand(outsize, insize) * 2 - 1
        self.bias = np.random.rand(outsize) * 2 - 1

    def get_z(self, ipt: NDArray) -> NDArray:
        return np.matmul(self.wts, ipt.reshape(ipt.size, 1)).reshape(self.outsize) + self.bias

    def get_a(self, ipt: NDArray) -> NDArray:
        return self.activ(self.get_z(ipt))

    def get_derivatives(self, prev_a : NDArray,  DE_over_cur_a: NDArray, cur_z: NDArray) -> List[NDArray]:
        if (DE_over_cur_a.size != self.outsize):
            raise Exception("size of DE_over_cur_a ({}) doesn't equal to number of node in this layer ({})".format(DE_over_cur_a.size, self.outsize),
                            DE_over_cur_a
                            )
        Dbias : NDArray = DE_over_cur_a * self.activ.Df(cur_z)
        DE_over_prev_a: NDArray = np.matmul(self.wts.T, Dbias)
        Dweight = np.matmul(
            Dbias.reshape(Dbias.size, 1),
            prev_a.reshape(1, prev_a.size)
        )
        
        return [DE_over_prev_a, Dweight, Dbias]
        # 返回三个变量，误差对上层输出，对当前层权重和偏置的偏导
    def descent(self, w : NDArray, b : NDArray) -> None:
        self.wts -= w
        self.bias -= b
```

除了 `get_derivatives`，其他几个函数都比较好理解，下面大概解释一下。

误差对上层偏导的公式如下：

$$
\frac{\partial E}{\partial a^{[l - 1]}_j} = (w^{[l]})^T \times r
$$

对应到实现中，就是这一行：

```python
DE_over_prev_a: NDArray = np.matmul(self.wts.T, Dbias)
```

这里的 `Dbias` 就等于 $r$，如下：

$$
r_j = \sigma^\prime (z^{[l]}_j) \cdot \frac{\partial E}{\partial a^{[l]}_j}
$$

对应代码中的：

```python
Dbias : NDArray = DE_over_cur_a * self.activ.Df(cur_z)
```

误差对权值导数的公式为：

$$
\begin{bmatrix}
    r_1    \\
    r_2    \\
    \vdots \\
    r_{n^l}
\end{bmatrix}

\cdot

\begin{bmatrix}
    a^{[l-1]}_1 & a^{[l-1]}_2 & \cdots & a^{[l-1]}_{n^{l-1}}
\end{bmatrix}
$$

对应如下代码：

```python 
Dweight = np.matmul(
            Dbias.reshape(Dbias.size, 1),
            prev_a.reshape(1, prev_a.size)
        )
```

## neu_net 类

网络类可以把不同的层连接在一起。把上一层的输出作为下一层的输入传递。也可以从误差函数开始反向传播：

### 初始化函数

```python
    # 在项目中的位置：./src/net.py

    def __init__(self,  layer_sizes: List[int] | None = None, layers: List[layer.abs_layer] | None = None) -> None:
        """ 
            layer_sizes: 第一个是输入大小，最后一个是输出大小
        """
        if (layers != None and layer_sizes != None):
            raise Exception(
                "should only provide either layer_sizes or layers",
                self
            )
        if (layers == None):
            layers: List[layer.abs_layer] = []
            for i in range(0, len(layer_sizes) - 1):
                # 这一层的输入等于上一层的输出，等于下一层的输入
                layers.append(layer.dense_layer(
                    insize=layer_sizes[i], outsize=layer_sizes[i + 1]))
        self.lays = layers
        self.num_lay = len(layers)
        self.err = util.sq_err
        for i in range(1, self.num_lay):
            if (self.lays[i - 1].outsize != self.lays[i].insize):
                raise Exception(
                    "layer {}'s output ({}) not equal to layer {}'s input ({})".format(i-1, self.lays[i-1].outsize, i, self.lays[i].insize), self.lays)
```

这里有两种方法可以初始化，可以直接提供不同的 `layer`，让网络类把它们组合在一起，也可以输入一个表示不同层节点数量的类，让初始化函数自动创建对应的全连接网络。

### 输出函数

```python
    def get_predict(self, ipt : NDArray):
        lay_z: List[NDArray] = []
        lay_a: List[NDArray] = []
        lay_z.append(self.lays[0].get_z(ipt))
        lay_a.append(self.lays[0].activ.f(lay_z[0]))
        for i in range(1, self.num_lay):
            lay_z.append(self.lays[i].get_z(lay_a[i - 1]))
            lay_a.append(self.lays[i].activ.f(lay_z[i]))
        return [lay_z, lay_a]

    def get_simple_predict(self, ipt : NDArray):
        return self.get_predict(ipt)[1][-1]
```

这里神经网络的第一层比较特殊，不和上一层的输出相连，而是直接用的 `ipt`，所以要特殊处理。

### 反向传播

```python
    def bp(self, ipt: NDArray, label: NDArray, lrate: float):
        lay_z, lay_a = self.get_predict(ipt)                       # 每层的输出
        lay_Dw: List[NDArray] = [np.zeros(0)] * (self.num_lay)     # 对权值的导数
        lay_Db: List[NDArray] = [np.zeros(0)] * (self.num_lay)     # 对偏置的导数
        DE_over_a: List[NDArray] = [np.zeros(0)] * (self.num_lay)  # 误差对节点输出的导数
        DE_over_a[-1] = self.err.Df(label, lay_a[-1])

        for i in reversed(range(1, self.num_lay)):
            DE_over_a[i - 1], lay_Dw[i], lay_Db[i] = self.lays[i].get_derivatives(
                prev_a=lay_a[i - 1],
                DE_over_cur_a=DE_over_a[i],
                cur_z=lay_z[i]
            )

        lay_Db[0] = self.lays[0].activ.Df(lay_z[0]) * DE_over_a[0]
        lay_Dw[0] = np.matmul(
            lay_Db[0].reshape(lay_Db[0].size, 1),
            ipt.reshape(1, ipt.size)
        )
        for Dw, Db, lay in zip(lay_Dw, lay_Db, self.lays):
            lay.descent(Dw * lrate, Db * lrate)
```

这里主要的作用就是调用每层的 `get_derivatives` ，得到不同层输出，权值和偏置的导数。

不过有两个特殊的地方，首先误差对最后一层的导数需要通过误差函数和标签得到，如下：

```python
DE_over_a[-1] = self.err.Df(label, lay_a[-1])
```

误差对于第一层权值和偏置的导数也只能通过输入的图片得到：

```python
lay_Db[0] = self.lays[0].activ.Df(lay_z[0]) * DE_over_a[0]
        lay_Dw[0] = np.matmul(
            lay_Db[0].reshape(lay_Db[0].size, 1),
            ipt.reshape(1, ipt.size)
        )
```

# 效果展示

{% raw %}
<iframe width=100% height=1000px src=/files/机器学习/img_rec.html></iframe>
{% endraw %}

可以看到准确率有 96%，还是很不错的（大概跑了一分多钟吧）。当然训练的方式还有很大优化空间，我也没怎么调参。

[^1]: <https://zh.wikipedia.org/wiki/%E5%85%A8%E5%BE%AE%E5%88%86>
[^2]: 改编自 <https://zhuanlan.zhihu.com/p/120378080>
