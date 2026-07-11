---
title: "[MIT 6.s081] xv6 Lab 7: Multithreading Record"
date: 2022-08-04 00:00:00
updated: 2022-10-15 18:48:32
tags:
- xv6
- 2022
- UNIX
- Operating Systems
- Multithreading
- Coroutines
categories:
- Lab Records
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/08/xv6_lab7_record/).
{% endnote %}

Update (2022/9/14): The lab code is available at <https://github.com/ttzytt/xv6-riscv>.

# Lab 7: Multithreading

## Uthread
![](/img/xv6/lab/lab7_uthread.png)

Implement user-level threads by adapting the kernel scheduler. `thread_switch()` saves and restores the same callee-saved registers as `swtch()`. `thread_create()` sets `ra` to the first instruction of the thread function and `sp` to the top of its stack (the stack grows downward):
```c
t->ctx.ra = (uint64) func;
t->ctx.sp = (uint64)&t->stack + (STACK_SIZE - 1);
```
`thread_schedule()` finds a RUNNABLE thread, exchanges `current_thread` and `next_thread`, and calls:
```c
thread_switch((uint64)&t->ctx, (uint64)&next_thread->ctx);
```
The assembly saves `ra`, `sp`, and `s0`–`s11`, loads the new context, and returns. This implementation is closer to a coroutine: a thread voluntarily yields the processor, and only one core is used.

## Using Threads

The hash-table program loses entries when multiple threads insert into the same bucket concurrently. `insert()`, `put()`, and `get()` access the same linked list, so each bucket needs a mutex. Lock at the start and unlock at the end of `put()` and `get()`; do not lock `insert()` separately because it is called by `put()` and would deadlock.
```c
pthread_mutex_t bkt_lock[NBUCKET];
pthread_mutex_lock(&bkt_lock[i]);
/* search or insert table[i] */
pthread_mutex_unlock(&bkt_lock[i]);
```

## Barrier
![](/img/xv6/lab/lab7_barrier.png)

A barrier makes every thread wait until all threads reach the same point. `nthread` counts arrivals and `round` identifies the barrier round. Protect the count with `barrier_mutex`; threads that arrive early wait on `barrier_cond`, while the final thread resets the count, increments the round, and broadcasts:
```c
static void barrier(){
  pthread_mutex_lock(&bstate.barrier_mutex);
  bstate.nthread++;
  if(bstate.nthread < nthread){
    pthread_cond_wait(&bstate.barrier_cond, &bstate.barrier_mutex);
  }else{
    bstate.nthread = 0;
    bstate.round++;
    pthread_cond_broadcast(&bstate.barrier_cond);
  }
  pthread_mutex_unlock(&bstate.barrier_mutex);
}
```
`broadcast()` wakes every waiting thread, while `signal()` wakes only one; a barrier requires `broadcast()`.

![](/img/xv6/lab/lab7_AC.png)

## Summary

Writing the explanation exposed gaps in my understanding, especially around condition variables. Explaining a concept requires deeper understanding than merely making the code work.

[^1]: <https://blog.miigon.net/posts/s081-lab7-multithreading/>
[^2]: <https://blog.csdn.net/weixin_37822792/article/details/112430570>
