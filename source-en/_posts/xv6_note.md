---
title: "xv6 Notes: Page Tables and Traps"
date: 2022-07-06 23:09:46
updated: 2022-10-15 18:55:58
tags:
categories:
- Study Notes
keywords:
description:
top_img: "linear-gradient(to right, #2c3e50, #4ca1af)"
comments:
cover: /img/xv6/note/xv6书封面.png
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/07/xv6_note/).
{% endnote %}

# Chapter zero

xv6 is a small teaching operating system for RISC-V. Its compact code exposes the relationship between hardware mechanisms and kernel abstractions.

# Page tables

Page tables translate virtual addresses to physical addresses and attach permission bits. RISC-V Sv39 uses three levels of page-table pages; each level indexes nine virtual-address bits and the leaf PTE contains the physical page number and flags. xv6 creates separate kernel and user mappings. The kernel mapping covers devices, kernel text and data, and each process’s user memory; a user page table contains only user-accessible pages and the trampoline/trapframe mappings needed during traps.

Important routines allocate page-table pages, map ranges, unmap ranges, and free the hierarchy. The `walk` helper descends the three levels and optionally allocates missing intermediate tables.

# Traps

A trap transfers control from user mode to the kernel on a system call, exception, or interrupt. `uservec` saves user registers in the process trap frame, switches to the kernel stack and page table, and jumps to `usertrap`. The latter records the cause, handles system calls or device interrupts, and may yield. `usertrapret` prepares the trap frame and returns through `userret`, which restores registers and executes `sret`.

The trap frame fields such as `kernel_sp`, `kernel_trap`, `kernel_satp`, and `kernel_hartid` preserve the kernel context. Keeping the trampoline mapped at the same virtual address in both page tables allows the transition to complete safely.
