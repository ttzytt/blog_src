---
title: "xv6 Lab 2: System Calls"
date: 2022-07-10 23:50:41
updated: 2022-10-15 18:48:15
tags:
- xv6
- 2022
- UNIX
- Operating Systems
- System Calls
- Low-level
categories:
- Lab Records
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/07/xv6_lab2_record/).
{% endnote %}

# Lab 2: system calls

This lab adds system calls to xv6 and implements `trace` and `sysinfo`.

## System-call path

A user function places the system-call number in `a7` and executes `ecall`. The RISC-V trap entry saves user registers in the process trap frame, switches to the kernel page table, and enters `usertrap`. The dispatcher indexes the system-call table, invokes the kernel implementation, and writes the return value to the saved `a0`. `usertrapret` restores user state and `sret` returns to user mode.

## System-call tracing

The new `trace(mask)` call stores a mask in the process structure. Each system call has a number and a name; after dispatch, `syscall()` prints the process id, name, and return value when the corresponding bit is set. The declaration is added to the user header, assembly stubs, syscall-number list, table, and kernel implementation.

## Sysinfo

`sysinfo` copies a small structure back to user space. Its fields include the amount of free memory and the number of processes. The implementation walks xv6’s allocator and process table while holding the required locks, then uses `copyout` to cross the user/kernel boundary.

## Summary

The important lesson is that adding one call requires registration at every layer: user API, assembly entry, numeric constant, kernel dispatch table, and implementation. Trace also shows how process-local state can be carried through the complete trap path.
