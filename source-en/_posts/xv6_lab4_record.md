---
title: "[MIT 6.s081] xv6 Lab 4: Traps Record"
date: 2022-07-25 00:00:00
updated: 2022-10-15 18:48:21
tags:
- xv6
- 2022
- UNIX
- Operating Systems
- Traps
- Assembly
- Stack Frames
- Low-level
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/07/xv6_lab4_record/).
{% endnote %}

The lab code is available at <https://github.com/ttzytt/xv6-riscv>.

# Lab 4: Traps
## RISC-V Assembly

The main lesson is how traps save and restore the user register state.

## Backtrace
![](/img/xv6/lab/lab4_backtrace.png)

Implement `backtrace()` to print the return addresses of the current call chain. Every RISC-V stack frame contains its return address and the previous frame pointer. `fp` is register `s0` in the ABI. Read it with:
```c
static inline uint64 r_fp(){
  uint64 x;
  asm volatile("mv %0, s0" : "=r" (x));
  return x;
}
```
Follow `cur_frame[-1]` (the current return address) and `cur_frame[-2]` (the previous frame pointer) until leaving the current page:
```c
void backtrace(){
  uint64 *cur_frame = (uint64*)r_fp();
  uint64 *top = PGROUNDUP((uint64)cur_frame);
  uint64 *bot = PGROUNDDOWN((uint64)cur_frame);
  while(cur_frame < top && cur_frame > bot){
    printf("%p\n", cur_frame[-1]);
    cur_frame = (uint64*)cur_frame[-2];
  }
}
```
Call it from `sys_sleep()` to finish this part.

## Alarm
![](/img/xv6/lab/lab4_alarm.png)

Implement `sigalarm(interval, handler)` to invoke a user handler every interval timer ticks, and `sigreturn()` to stop the handler and resume the interrupted program. `(0,0)` disables alarms.

For test0, store `alarm_tks`, `alarm_handler`, and elapsed ticks in `struct proc`. On timer interrupts, increment elapsed ticks and set `trapframe->epc` to the handler when the interval expires. The handler initially can print `alarm!` and call `sigreturn()`.

To resume interrupted code, allocate an `alarmframe` trapframe. Before jumping to the handler, copy `*trapframe` to `*alarmframe`. In `sys_sigreturn()`, restore the complete trapframe from `alarmframe`; this restores `epc` and every register.

Finally, prevent a slow handler from being restarted by each timer tick. Add `alarm_state`; only redirect `epc` when it is zero, set it to one when entering the handler, and clear it in `sigreturn()`:
```c
if(p->alarm_tks > 0){
  p->alarm_tk_elapsed++;
  if(p->alarm_tk_elapsed > p->alarm_tks && !p->alarm_state){
    p->alarm_tk_elapsed = 0;
    *p->alarmframe = *p->trapframe;
    p->trapframe->epc = p->alarm_handler;
    p->alarm_state = 1;
  }
}
```
```c
uint64 sys_sigreturn(void){
  struct proc *p = myproc();
  *p->trapframe = *p->alarmframe;
  p->alarm_state = 0;
  return 0;
}
```

![](/img/xv6/lab/lab4_AC.png)

## Summary

Understanding xv6's trap path is more important than mechanically following the hints. The lab also showed me how shallow my RISC-V assembly knowledge was, especially the privileged `sscratch` register used by `uservec` and `userret`.

[^1]: <https://pdos.csail.mit.edu/6.S081/2020/lec/l-riscv.txt>
[^2]: <https://gcc.gnu.org/onlinedocs/gcc/Simple-Constraints.html#Simple-Constraints>
[^3]: <https://pdos.csail.mit.edu/6.828/2021/readings/riscv-calling.pdf>
