---
title: "Treap Notes"
date: 2022-06-13 22:56:57
updated: 2022-07-01 00:39:32
tags:
- Data Structures
- Trees
- Balanced Trees
- Treap
categories:
- Study Notes
keywords:
description:
top_img: "linear-gradient(to right, #2c3e50, #4ca1af)"
comments:
cover: /img/treap/rotate.svg
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/06/treap_note/).
{% endnote %}

# Introduction

A treap combines a binary-search-tree key with a random heap priority. Random priorities keep the expected height logarithmic while preserving ordered operations.

# Rotating treap

Each node stores its key, priority, subtree size, and child pointers. A rotation repairs the heap property after insertion or deletion. Insertion follows the BST path and rotates the new node upward; deletion rotates the target downward until it has at most one child, then removes it. Subtree sizes support rank and kth queries, while predecessor and successor searches follow the BST ordering.

# FHQ (non-rotating) treap

`split` divides a tree by key or by rank and returns two roots. `merge` joins two trees when every key in the left tree precedes every key in the right tree, choosing the root with higher priority. Insertion is `split` plus `merge`; deletion splits around the target and merges the remaining parts. Rank, kth, predecessor, and successor are implemented with the same primitives.
