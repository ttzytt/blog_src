---
title: "How Function Calls Work and What They Enable"
date: 2022-04-20 23:53:01
updated: 2023-12-08 20:51:15
tags:
- Assembly
- Low-level
- Stack Frames
- DFS
- Experiments
- 2022
categories:
- Study Notes
keywords:
description:
top_img: "linear-gradient(to right, #2c3e50, #4ca1af)"
comments:
cover: /img/非递归dfs/cover.png
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/04/function-call/).
{% endnote %}

# 1. How is a function call implemented?

A call saves a return address, passes arguments according to the platform ABI, and transfers control to the callee. The callee creates a stack frame, saves registers that must survive the call, allocates local storage, and returns a value in the ABI-designated register.

## Stack frames

The stack pointer and (when used) frame pointer delimit locals, saved registers, and arguments. On return the frame is dismantled, the saved registers are restored, and the return address is used to resume the caller. The exact layout differs between x86 32-bit and x86-64 calling conventions: registers carry more arguments on x64, while the remaining arguments spill to the stack.

## Calling conventions

Calling conventions define argument order, volatile and non-volatile registers, stack alignment, return-value registers, and who cleans the stack. Mixing conventions or forgetting alignment produces subtle corruption even when the C++ source looks correct.

# 2. Uses of call knowledge

Walking saved frame pointers gives a simple backtrace. Debug information can map instruction addresses to function names. Stack overflows exploit the same layout by overwriting control data; modern systems mitigate this with stack canaries, non-executable stacks, ASLR, and control-flow protection.

# 3. Iterative DFS

Recursive tree traversal can be rewritten with an explicit stack containing a node and the next child to visit. Push the root, repeatedly inspect the top, and push children in reverse desired order. Reusing stack storage and avoiding repeated allocations provides a small optimization while preserving preorder/postorder behavior.
