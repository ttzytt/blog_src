---
title: "Derivation and Implementation of a Dense Neural Network on MNIST"
date: 2022-10-31 00:00:00
updated: 2022-11-05 00:00:00
tags:
- Machine Learning
- Neural Networks
- Backpropagation
- 2022
- MNIST
- Handwritten Digit Recognition
categories:
- Study Notes
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

{% note danger simple %}
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/10/dense_neu_net_nmist/).
{% endnote %}

<!-- # Study Notes on the Backpropagation Algorithm (in a Fully Connected Neural Network) -->
upd@2022/11/5: Added the concrete implementation and corrected several notation errors in the derivation.
upd@2024/6/8: Corrected a subscript error in the derivation.

The main purpose of backpropagation is to calculate the partial derivatives of the neural-network error with respect to parameters such as biases and weights, allowing gradient descent to be performed. The first half of this article derives the algorithm; the second half uses a fully connected neural network and the MNIST dataset to implement handwritten-digit recognition.

This algorithm was still very difficult for me to understand, so I wrote these notes to prevent myself from forgetting it. Another reason is that neural-network formulas have so many superscripts and subscripts that it is very easy to write one incorrectly in a physical notebook. If you do not yet have a basic understanding of neural networks, I recommend 3Blue1Brown's [neural-network video series](https://www.bilibili.com/video/BV1bx411M7Zx/?from=search&seid=13277969767348205014&spm_id_from=333.337.0.0).

I must also say that [MqCreaple](https://github.com/MqCreaple) is truly incredible: after watching the videos, he directly derived every formula by hand—~~even more astonishingly, he managed to teach someone like me~~.

# Formula Derivation

## Notation and Language Conventions

- $\sigma()$ denotes the activation function.
- $E$ denotes the final error.
- $\operatorname{err}()$ denotes the error function.
- $\hat y$ denotes the neural network's prediction, while $y$ denotes the actual answer.
- $l$ denotes a neural-network layer; a smaller value means the layer is closer to the input layer.
- $w^{[l]}_{ji}$ denotes an edge from node $j$ in layer $l$ to node $i$ in layer $l-1$.
- $b^{[l]}_i$ denotes the bias of node $i$ in layer $l$.
- $z^{[l]}_i$ denotes the output of node $i$ in layer $l$ before applying the activation function.
- $a^{[l]}_i$ denotes $\sigma(z^{[l]}_i)$, the node's output after applying the activation function.
- $n^l$ denotes the number of nodes in layer $l$.
- An underline beneath a variable indicates that it is treated as a constant, such as $\underline{x}$.
- A layer “before” another layer has a smaller $l$, and a layer “after” it has a larger $l$.

## A Neural Network with One Node per Layer

First consider the simplest fully connected neural network, in which every layer has only one node. The following diagram represents the process of calculating a single node's output $a^{[l]}$. The variable at the starting point of an arrow and the corresponding function produce the variable at the arrow's endpoint.

{% mermaid %}
graph TB
 alm1["a(l-1)"] & w & b --> z --> al["a(l)"] --> Error
 y-->Error
{% endmermaid %}

Written as functions, the process is:

$$
z^{[l]} = wa^{[l-1]} + b \\
a^{[l]} = \sigma(z^{[l]}) \\
E = \operatorname{err}(a^{[l]}, y)
$$

To perform gradient descent on the weight $w^{[l]}$ according to the error, we need the partial derivative of the error with respect to the weight:

$$
\frac{\partial E}{\partial w^{[l]}}
$$

We use a partial derivative because the calculation of $z^{[l]}$ depends on three variables, while we want to know how changing $w^{[l]}$ affects the error.

When taking the partial derivative, assume that the other variables are constants. Only one variable changes, along with the variables directly affected by it—in this case, the chain $w^{[l]}\to z^{[l]}\to a^{[l]}\to E$. Constants are underlined in the following expression:

$$
E = \operatorname{err}(\sigma(w^{[l]}\underline{a^{[l-1]}} + \underline{b}), \underline{y})
$$

We can now apply the chain rule:

$$
\begin{align*}
    E^\prime = \operatorname{err}^\prime(&\sigma(w^{[l]}\underline{a^{[l-1]}} + \underline{b}), \underline{y}) \\
                                   \cdot &\sigma^{\prime}(w^{[l]}\underline{a^{[l-1]}} + \underline{b}) \\
                                                    \cdot &(w^{[l]}\underline{a^{[l-1]}} + \underline{b})^\prime
\end{align*}
$$

In another form, which will be more convenient later:

$$
\frac{\partial E}{\partial w^{[l]}} = \frac{\partial z^{[l]}}{\partial w^{[l]}} \cdot \frac{\partial a^{[l]}}{\partial z^{[l]}} \cdot \frac{\partial E}{\partial a^{[l]}}
$$

The intermediate partial derivatives in the chain rule can then be calculated. Assuming the error function is squared error, the expression becomes:

$$
\begin{align*}
    \frac{\partial z^{[l]}}{\partial w^{[l]}} &= (w^{[l]}\underline{a^{[l-1]}} + \underline{b})^\prime = a^{[l-1]} \\
    \frac{\partial a^{[l]}}{\partial z^{[l]}} &= \sigma^{\prime}(z^{[l]}) \\
    \frac{\partial E}{\partial a^{[l]}} &= 2(a^{[l]} - y)
\end{align*}
$$

Be careful not to reverse $2(a^{[l]}-y)$. For example, when $a^{[l]}$ is too large, we also want the derivative to be large so that the value being adjusted can have the derivative subtracted from it.

The preceding calculation gives the error's partial derivative with respect to the weight. For the bias and the previous layer's output, simply replace $\frac{\partial z^{[l]}}{\partial w^{[l]}}$ in the formula. In other words, let the previous layer's output or this layer's bias affect $z^{[l]}$ instead of the weight.

For $b^{[l]}$, use:

$$
\frac{\partial z^{[l]}}{\partial b^{[l]}} = (\underline{w^{[l]}a^{[l-1]}} + b)^\prime = 1
$$

For $a^{[l-1]}$, use:

$$
\frac{\partial z^{[l]}}{\partial a^{[l-1]}} = (\underline{w^{[l]}}a^{[l-1]} + \underline{b})^\prime = w^{[l]}
$$

Now consider the following network:

{% mermaid %}
graph TB
 al["a(l)"] & wlp["w(l + 1)"] & blp["b(l + 1)"] --> zlp["z(l + 1)"] --> alp["a(l + 1)"] --> ...many other layers
 __["w(l + 2)"] & _["b(l + 2)"]-->...many other layers
{% endmermaid %}

Here, the layer after $a^{[l]}$ does not connect directly to the error function; many layers intervene. We can no longer calculate $\frac{\partial E}{\partial a^{[l]}}$ directly, and therefore cannot directly calculate the partial derivatives for $w^{[l]}$ and $b^{[l]}$, because $E$ lies many layers later. This is where backpropagation is required.

We know:

$$
\frac{\partial E}{\partial a^{[l]}} = \frac{\partial z^{[l+1]}}{\partial a^{[l]}} \cdot \frac{\partial a^{[l+1]}}{\partial z^{[l+1]}} \cdot \frac{\partial E}{\partial a^{[l+1]}}
$$

The expression shows that $\frac{\partial E}{\partial a^{[l]}}$ for an earlier layer can be derived from a later layer. Before calculating partial derivatives for weights and biases, start from the output layer and propagate $\frac{\partial E}{\partial a^{[l]}}$ backward one layer at a time.

## Multiple Nodes per Layer

The backpropagation process in the preceding example is clear and involves no linear algebra. In a real neural network, however, every layer contains multiple nodes:

{% mermaid %}
graph LR
     l1["(l-1)1"] & l2["(l-1)2"] & l3["(l-1)3"] ---> lp1["l1"] & lp2["l2"] & lp3["l3"]
{% endmermaid %}

### Partial Derivative of the Error with Respect to a Weight

$w^{[l]}_{ji}$ denotes an edge connecting node $j$ in layer $l$ to node $i$ in layer $l-1$. How do we calculate $\frac{\partial E}{\partial w^{[l]}_{ji}}$?

We can still use the original formula, because a layer with multiple nodes is fundamentally composed of multiple single-node layers. We must, however, pay attention to the subscripts:

$$
\begin{align*}
    \frac{\partial E}{\partial w^{[l]}_{ji}} &= \frac{\partial z^{[l]}_j}{\partial w^{[l]}_{ji}} \cdot \frac{\partial a^{[l]}_j}{\partial z^{[l]}_j} \cdot \frac{\partial E}{\partial a^{[l]}_j} \\
    &= a^{[l-1]}_i \cdot \sigma^\prime(z^{[l]}_j) \cdot \frac{\partial E}{\partial a^{[l]}_j}
\end{align*}
$$

Every variable related to layer $l-1$ uses subscript $i$, such as $a^{[l-1]}_i$. Intuitively, when a unit of weight changes, a larger input from the previous layer has a larger effect on the final error function. Variables related to layer $l$ use subscript $j$.

Because $\sigma^\prime(z^{[l]}_j)\frac{\partial E}{\partial a^{[l]}_j}$ uses the same subscript throughout, call it $r_j$ to make the matrix-operation formula easier to write.

Rewriting the formula gives:

$$
\frac{\partial E}{\partial w^{[l]}_{ji}} = r_j a^{[l-1]}_i
$$

In the matrix form of $w^{[l]}$, $j$ increases by row and $i$ increases by column. The derivative matrix is:

$$
\frac{\partial E}{\partial w^{[l]}} =
\begin{bmatrix}
      r_1 a^{[l-1]}_1 & r_1 a^{[l-1]}_2 & \cdots & r_1 a^{[l-1]}_{n^{l-1}} \\
      r_2 a^{[l-1]}_1 & r_2 a^{[l-1]}_2 & \cdots & r_2 a^{[l-1]}_{n^{l-1}} \\
      \vdots & \vdots & \ddots & \vdots \\
      r_{n^l}a^{[l-1]}_1 & r_{n^l}a^{[l-1]}_2 & \cdots & r_{n^l}a^{[l-1]}_{n^{l-1}}
\end{bmatrix}
$$

This matrix is equal to:

$$
\begin{bmatrix}
    r_1\\r_2\\\vdots\\r_{n^l}
\end{bmatrix}
\cdot
\begin{bmatrix}
    a^{[l-1]}_1 & a^{[l-1]}_2 & \cdots & a^{[l-1]}_{n^{l-1}}
\end{bmatrix}
$$

We can therefore use a matrix-operation library such as NumPy to accelerate the calculation.

### Partial Derivative of the Error with Respect to a Bias

This is relatively simple because $\frac{\partial z^{[l]}_j}{\partial b^{[l]}_j}=1$, as shown earlier:

$$
\begin{align*}
    \frac{\partial E}{\partial b^{[l]}_j} &= \frac{\partial z^{[l]}_j}{\partial b^{[l]}_j}\cdot\frac{\partial a^{[l]}_j}{\partial z^{[l]}_j}\cdot\frac{\partial E}{\partial a^{[l]}_j}\\
    &=1\cdot\sigma^\prime(z^{[l]}_j)\cdot\frac{\partial E}{\partial a^{[l]}_j}\\
    &=r_j
\end{align*}
$$

The error derivative with respect to the bias equals the $r_j$ used above. Implementations therefore generally calculate this first, then substitute $r_j$ into the weight formula.

### Partial Derivative of the Error with Respect to the Previous Layer's Input

Look again at the multi-node network, now focusing on the effect of a single node in layer $l-1$ on the later nodes:

{% mermaid %}
graph LR
     l1["(l-1)1"]  ===> lp1["l1"] & lp2["l2"] & lp3["l3"]
{% endmermaid %}

$a^{[l-1]}_i$ can affect every $z^{[l]}_j$. If layer $l$ is regarded as a function that receives $n^{l-1}$ values $a^{[l-1]}_i$ and outputs $n^l$ values $z^{[l]}_j$, then every input variable is changing. The result is not a partial differential but a total derivative[^1].

By the definition of a total derivative, add the partial derivative with respect to every parameter. In this example:

$$
\frac{\partial E}{\partial a^{[l]}_i}=\sum_{j=1}^{n^{l+1}}\left(\frac{\partial z^{[l+1]}_j}{\partial a^{[l]}_i}\cdot\frac{\partial a^{[l+1]}_j}{\partial z^{[l+1]}_j}\cdot\frac{\partial E}{\partial a^{[l+1]}_j}\right)
$$

The factor $\frac{\partial z^{[l+1]}_j}{\partial a^{[l]}_i}$ needs careful handling. Remember that $w^{[l+1]}_{ji}$ is the edge connecting node $j$ in layer $l+1$ and node $i$ in layer $l$.

Since

$$
z^{[l+1]}_j=w^{[l+1]}_{ji}a^{[l]}_i+b^{[l+1]}_j,
$$

we obtain

$$
\frac{\partial z^{[l+1]}_j}{\partial a^{[l]}_i}=w^{[l+1]}_{ji}.
$$

The factor $\frac{\partial a^{[l+1]}_j}{\partial z^{[l+1]}_j}\frac{\partial E}{\partial a^{[l+1]}_j}$ was explained earlier: it equals $r_j$, the error derivative with respect to the bias.

Rewriting the complete expression gives:

$$
\frac{\partial E}{\partial a^{[l]}_i}=\sum_{j=1}^{n^{l+1}}\left(r_jw^{[l+1]}_{ji}\right).
$$

Now consider how to obtain $\frac{\partial E}{\partial a^{[l]}_j}$ with matrix operations. One workable method multiplies $r_j$ and $w^{[l+1]}_{ji}$.

We accumulate over subscript $j$. If $w^{[l+1]}$ is placed on the left, its $j$ coordinate must increase with the column number; in matrix multiplication $A\times B$, rows of $A$ are dotted with columns of $B$. If $r$ is placed on the right, its $j$ subscript must increase with the row number.

Because $j$ in $w^{[l+1]}$ originally increases by row, transpose it. The final result is:

$$
\frac{\partial E}{\partial a^{[l]}}=(w^{[l+1]})^T\times r,
$$

where $r$ is a column vector.

# Implementation

This section uses the backpropagation algorithm derived above to implement a simple fully connected neural network, then uses that network to recognize handwritten digits in the MNIST dataset.

## Data Preprocessing

To be honest, the MNIST dataset is rather troublesome. It uses a binary storage format, so reading its contents takes some work.

The code is as follows[^2]:

```python
# Location in the project: ./src/util
def load_mnist(path: str, pref: str = "train"):
    """ 
        path: dataset path
        data_type: dataset-name prefix (train or t10k)
    """
    label_path = os.path.join(path, "{}-labels.idx1-ubyte".format(pref))
    img_path = os.path.join(path, "{}-images.idx3-ubyte".format(pref))
    with open(label_path, 'rb') as lfile: # rb means read binary.
        magic, n = struct.unpack('>II', lfile.read(8))
        labels = np.fromfile(lfile, dtype=np.uint8)
    with open(img_path, 'rb') as ifile: # ifile means image file.
        magic, num, rows, cols = struct.unpack('>IIII', ifile.read(16))
        images = np.fromfile(ifile, dtype=np.uint8).reshape(
            len(labels), 28 * 28)
    label_one_hot = np.zeros((len(labels), 10), dtype=int)
    for i in range(len(labels)):
        label_one_hot[i] = np.eye(10)[labels[i]]
    return label_one_hot, images / 255.0
```

The `struct` package may look confusing. It is simply a class specialized for processing binary data.

```python
struct.unpack('>II', lfile.read(8))
```

This statement reads two four-byte unsigned integers in big-endian byte order from `lfile`. In `>II`, `>` indicates that the file uses big-endian byte order, while `I` indicates a four-byte unsigned integer.

The following `np.fromfile` serves a similar purpose, directly converting the binary file into a NumPy array. No byte order is specified, perhaps because NumPy uses big-endian by default.

Individual pixels in MNIST are integers in $[0,255]$. We want floating-point values in $[0,1]$, so divide by 255 before returning.

Keeping images in $[0,1]$ is important because passing a relatively large number to $sigmoid` can cause overflow. Although each layer's initial weights are randomly generated between -1 and 1, a layer can still sometimes output a large value. Sigmoid is defined as:

$$
\sigma(x)=\frac{1}{1+e^{-x}}.
$$

If $x$ is too small, $e^{-x}$ becomes extremely large. NumPy performs its calculations through C and does not have Python's built-in arbitrary precision, so such a value naturally causes overflow.

The final preprocessing step converts labels into one-hot form, making it convenient to calculate the gradient of the error over the complete network. `np.eye(x)` generates an $x\times x$ identity matrix, so $np.eye(10)[labels[i]]` is naturally the one-hot encoding corresponding to `labels[i]`.

## The `layer` Class

A single neural-network layer is fundamentally a function that receives a vector and outputs a vector. The function depends on many variables, including weights and biases, so we want a class that stores them.

Backpropagation also needs the variables stored in the class. It is best to implement a function that receives the derivative of the error with respect to the current layer's output, along with other necessary data, and returns the derivative of the error with respect to the previous layer's output.

Finally, the layer needs an interface for updating its weights and biases. If other layer types use data other than weights and biases, an abstract class can represent the data of different layers.

These requirements give the following abstract layer class. Every parameter name follows the mathematical formulas above; refer to the derivation if any are unclear.

```python
# Location in the project: ./src/layer.py
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
            Return an output before the activation function is applied to the input.
        """
        pass
    def get_a(self, ipt: NDArray) -> NDArray:
        """ 
            Return an output after the activation function is applied to the input.
        """

        pass
    def get_derivatives(self, prev_a : NDArray, DE_over_cur_a: NDArray, cur_z: NDArray) -> List[NDArray]:
        """ 
            prev_a        : output of the preceding layer after its activation function
            DE_over_cur_a : derivative of the error with respect to the current layer's output
            cur_z         : current layer's output before its activation function
        """
        pass
    def descent(self, w, b):    
        """ 
            w : weight gradient
            b : bias gradient
        """
        pass
```

Here, `util.Dfunc` represents a differentiable function and is defined as follows:

```python
# Location in the project: ./src/util.py
class Dfunc():
    """ 
        Represent a differentiable function: f is the original function and df is its derivative.
        If f is multivariable, df should return a vector of partial derivatives for its inputs.
    """

    def __init__(self, func: Callable, Dfunc: Callable):
        self.f = func
        self.Df = Dfunc

sigmoid = Dfunc(lambda x: 1 / (1 + np.exp(-x)),
                lambda x: np.exp(-x) / ((1 + np.exp(-x)) ** 2))

sq_err = Dfunc(lambda label, predict: np.sum((predict - label) ** 2),
               lambda label, predict: 2 * (predict - label))
```

A fully connected layer can be implemented as follows:

```python
# Location in the project: ./src/layer.py
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
        # Return three variables: partial derivatives of the error with respect to the preceding
        # layer's output and the current layer's weights and biases.
    def descent(self, w : NDArray, b : NDArray) -> None:
        self.wts -= w
        self.bias -= b
```

Except for `get_derivatives`, the functions are relatively easy to understand. The following roughly explains that function.

The formula for the error derivative with respect to the preceding layer is:

$$
\frac{\partial E}{\partial a^{[l-1]}_j}=(w^{[l]})^T\times r.
$$

In the implementation, this corresponds to:

```python
DE_over_prev_a: NDArray = np.matmul(self.wts.T, Dbias)
```

Here, `Dbias` equals $r$:

$$
r_j=\sigma^\prime(z^{[l]}_j)\frac{\partial E}{\partial a^{[l]}_j}.
$$

This corresponds to:

```python
Dbias : NDArray = DE_over_cur_a * self.activ.Df(cur_z)
```

The formula for the derivative of the error with respect to weights is:

$$
\begin{bmatrix}r_1\\r_2\\\vdots\\r_{n^l}\end{bmatrix}
\cdot
\begin{bmatrix}a^{[l-1]}_1&a^{[l-1]}_2&\cdots&a^{[l-1]}_{n^{l-1}}\end{bmatrix}.
$$

It corresponds to:

```python 
Dweight = np.matmul(
            Dbias.reshape(Dbias.size, 1),
            prev_a.reshape(1, prev_a.size)
        )
```

## The `neu_net` Class

The network class connects different layers, passing the output of one layer as the input to the next. It can also backpropagate starting from the error function.

### Initialization Function

```python
    # Location in the project: ./src/net.py

    def __init__(self,  layer_sizes: List[int] | None = None, layers: List[layer.abs_layer] | None = None) -> None:
        """ 
            layer_sizes: the first value is the input size and the last is the output size
        """
        if (layers != None and layer_sizes != None):
            raise Exception(
                "should only provide either layer_sizes or layers",
                self
            )
        if (layers == None):
            layers: List[layer.abs_layer] = []
            for i in range(0, len(layer_sizes) - 1):
                # This layer's input equals the preceding layer's output and the next layer's input.
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

There are two ways to initialize the network. Individual `layer` objects can be supplied directly and combined by the network class, or a list containing the node count of each layer can be supplied so that the initializer automatically creates the corresponding fully connected network.

### Output Function

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

The neural network's first layer is special: it does not connect to the output of a preceding layer, but directly uses `ipt`, so it must be handled separately.

### Backpropagation

```python
    def bp(self, ipt: NDArray, label: NDArray, lrate: float):
        lay_z, lay_a = self.get_predict(ipt)                       # Output of every layer
        lay_Dw: List[NDArray] = [np.zeros(0)] * (self.num_lay)     # Derivatives with respect to weights
        lay_Db: List[NDArray] = [np.zeros(0)] * (self.num_lay)     # Derivatives with respect to biases
        DE_over_a: List[NDArray] = [np.zeros(0)] * (self.num_lay)  # Error derivatives w.r.t. node outputs
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

The main purpose here is to call `get_derivatives` on every layer and obtain the derivatives with respect to the outputs, weights, and biases of different layers.

There are two special cases. First, the error derivative with respect to the final layer must be obtained from the error function and label:

```python
DE_over_a[-1] = self.err.Df(label, lay_a[-1])
```

The error derivatives with respect to the first layer's weights and biases can only be obtained from the input image:

```python
lay_Db[0] = self.lays[0].activ.Df(lay_z[0]) * DE_over_a[0]
        lay_Dw[0] = np.matmul(
            lay_Db[0].reshape(lay_Db[0].size, 1),
            ipt.reshape(1, ipt.size)
        )
```

# Results

{% raw %}
<iframe width=100% height=1000px src=/files/机器学习/img_rec.html></iframe>
{% endraw %}

The accuracy reaches 96%, which is quite good; training took a little over a minute. Of course, the training method still has substantial room for optimization, and I did not tune the parameters very much.

[^1]: <https://zh.wikipedia.org/wiki/%E5%85%A8%E5%BE%AE%E5%88%86>
[^2]: Adapted from <https://zhuanlan.zhihu.com/p/120378080>
