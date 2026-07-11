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
top_img: "linear-gradient(to right, #2c3e50, #4ca1af)"
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

# Derivation

For one neuron, $z=wx+b$ and $a=\sigma(z)$. With several neurons, vectors and matrices replace the scalars: $z^{(l)}=W^{(l)}a^{(l-1)}+b^{(l)}$. Back-propagation applies the chain rule. The error derivative with respect to a weight is the derivative at the destination neuron multiplied by the source activation; the derivative with respect to a bias is the neuron error itself; and the derivative passed to the previous layer is $W^T\delta$.

## Conventions

Rows represent samples, columns represent features, and every layer keeps its activation, pre-activation, weights, and bias. The loss is evaluated at the output layer and gradients are averaged over a batch.

# Implementation

Input images are normalized and flattened before entering the dense layers. A `layer` class stores parameters and implements forward and backward passes. `neu_net` owns the layers, performs initialization, computes outputs, propagates errors backward, and updates parameters with the chosen learning rate.

The code is organized under `src/util`, `src/layer.py`, and `src/util.py`. During training, each batch runs forward propagation, loss calculation, backward propagation, and a parameter update. Accuracy is measured on a held-out set.

# Results

The dense network learns the MNIST digits after repeated mini-batch updates. Increasing hidden width improves capacity but also increases computation; normalization and a suitable learning rate are important for stable convergence.
