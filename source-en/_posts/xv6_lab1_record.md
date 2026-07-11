---
title: "[MIT 6.s081] xv6 Lab 1: Utilities Record"
date: 2022-07-09 19:04:29
updated: 2022-10-15 18:48:12
tags:
- xv6
- 2022
- UNIX
- Operating Systems
categories:
- Lab Records
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments:
cover: /img/xv6/lab/lab1_primes_pipeline_transfer.svg
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/07/xv6_lab1_record/).
{% endnote %}

# Lab 1: Utilities

## `sleep`
![](/img/xv6/lab/lab1_sleep.png)

Implement `sleep`, whose only argument is the number of ticks. Parse the argument and call the supplied `sleep()` system call.

## `pingpong`
![](/img/xv6/lab/lab1_pingpong.png)

Create a child and use two pipes for bidirectional communication. The parent sends one byte and prints `ping` after receiving the child's response; the child prints `pong` after receiving the parent's byte. A pipe is a FIFO backed by a buffer with read and write positions; the pointers cannot pass one another, so a writer or reader sleeps until space/data is available.

## `primes`
![](/img/xv6/lab/lab1_primes.png)

Create a process pipeline implementing the Sieve of Eratosthenes. Each process reads the first number as a prime, prints it, filters out multiples, and sends the remaining numbers to the next child. xv6's performance means printing only the first 35 primes is sufficient.

The important resource rule is to close unused pipe ends in every process; otherwise a reader never observes EOF.

## `find`
![](/img/xv6/lab/lab1_find.png)

Implement `find`, recursively traversing directories and printing the absolute path of every file whose name equals the requested name. Use `open`, `fstat`, and `read`, and distinguish directories from regular files. When descending into a directory, skip `.` and `..` and construct child paths with a slash.

## `xargs`
![](/img/xv6/lab/lab1_xargs.png)

Implement the UNIX `xargs` command. Read arguments line by line from standard input, append each line to the fixed command arguments, fork, execute with `exec`, and wait. The final partial line must also be executed. Respect the xv6 argument-count and argument-length limits.

## Summary

The utilities are simple individually, but they exercise process creation, pipes, file descriptors, directory traversal, and argument passing. Closing descriptors correctly is particularly important.
