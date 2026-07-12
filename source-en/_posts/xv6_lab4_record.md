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

Preface: today is 2022/7/25, so first I want to celebrate the blog having operated for 100 days.

Update on 2022/9/14: I recently put the lab code on GitHub. If you need a reference, you can find it here:

<https://github.com/ttzytt/xv6-riscv>

The different branches contain the different labs.

---

# Lab 4: traps

## RISC-V assembly

~~Postponed for now.~~
<!-- Question: Which registers contain arguments to functions? For example, which register holds 13 in main's call to printf?

Answer: According to this line in `call.asm` -->

## Backtrace

> ![](/img/xv6/lab/lab4_backtrace.png)
> Implement a `backtrace()` function. When a program calls it, the function should print that program's “function call order”—that is, all function addresses currently on the stack, in sequence.

The most important prerequisite for this exercise is understanding the process of a function call. For details, refer to [this article](/2022/04/function-call/) that I wrote earlier.

I have placed the most important diagram and video from that article below. This is ~~definitely not padding the word count~~. If you were previously familiar with function calls but have forgotten the details, these should make them easy to recall.

>![](/img/非递归dfs/栈帧结构.png)
> <video src='/video/非递归dfs/detail_func_call.mp4' type='video/mp4' controls='controls' width='100%' height='100%'></video>

The lab asks us to print a chain of function calls.

For example, consider this program:

```c  
int third(int x){
    backtrace();
    return x;
}
int second(int x){
    return third(x); // Assume the address is 114
}
int first(int x){ 
    return second(x); // Assume the address is 514
} 

int main(){
    int test = first(114514); // Assume the address is 1919
}

```

The correct output from `backtrace()` should be:

```
114
514
1919
```

In other words, recursively print the addresses of the calling functions.

Every stack frame stores the current function's return address—the location to which execution should return after that function finishes.

We can therefore print the return address from each frame. We also need a variable storing the current frame pointer. Adding the appropriate offset to this pointer obtains the preceding function's frame pointer, allowing us to print its return address as well.

One detail is that my earlier article used an x86-64 processor, where the frame pointer is named the bp, or base pointer, register. In RISC-V, the fp, or frame pointer, register performs the same job.

The location to which fp points in RISC-V is also slightly different from the x86 location. The following diagram shows the layout.[^1]

```
High addresses

Stack
                   .
                   .
      +->          .
      |   +-----------------+   |
      |   | return address  |   |
      |   |   previous fp ------+
      |   | saved registers |
      |   | local variables |
      |   |       ...       | <-+
      |   +-----------------+   |
      |   | return address  |   |
      +------ previous fp   |   |
          | saved registers |   |
          | local variables |   |
      +-> |       ...       |   |
      |   +-----------------+   |
      |   | return address  |   |
      |   |   previous fp ------+
      |   | saved registers |
      |   | local variables |
      |   |       ...       | <-+
      |   +-----------------+   |
      |   | return address  |   |
      +------ previous fp   |   |
          | saved registers |   |
          | local variables |   |
  $fp --> |       ...       |   | <-- Notice this!!!
          +-----------------+   |
          | return address  |   |  
          |   previous fp ------+ <-- On x86, the bp pointer would point here
          | saved registers |
  $sp --> | local variables |
          +-----------------+

Low addresses (growth direction)
```

In RISC-V, fp points to a location immediately above the current frame's return address, meaning a higher address. In x86, bp points to the saved bp of the preceding stack frame.

This probably results from a difference in how x86 and RISC-V define a stack frame. In RISC-V's definition, the return address is part of the current stack frame, which honestly seems like the more reasonable design to me.

Although fp always lets us find a function's return address, we still need to obtain the current value of fp. This requires inline assembly in C. We can put the following helper in `kernel/riscv.h`:

```c 
static inline uint64
r_fp()
{
  uint64 x;
  asm volatile("mv %0, s0" : "=r" (x) );
  return x;
}
```

The basic format of GCC extended inline assembly is:

```
asm asm-qualifiers ( AssemblerTemplate 
                 : OutputOperands 
                 [ : InputOperands
                 [ : Clobbers ] ])
```

Here, `asm` begins the inline assembly and `asm-qualifiers` describes its properties. The `volatile` qualifier used above tells GCC not to optimize this assembly away.

In `("mv %0, s0" : "=r" (x))`, `mv %0, s0` is an assembly template rather than final assembly, somewhat like a C++ template. During compilation, GCC replaces `%0` with the register that contains the variable selected by the later constraint, `: "=r" (x)`, which is `x` here.

The string `"=r"` is a constraint. The `r` says that `x` may reside in any general-purpose register, while the equals sign says that this operand is written by the assembly.

Many constraints besides `r` exist.[^2] For example, `m` allows the variable to reside in memory. For additional constraints, see the [GCC documentation](https://gcc.gnu.org/onlinedocs/gcc/Simple-Constraints.html#Simple-Constraints).

The [GCC extended-assembly documentation](https://gcc.gnu.org/onlinedocs/gcc/Extended-Asm.html#Extended-Asm) also explains this feature in considerable detail.

Overall, `r_fp()` reads register `s0`, stores the value in `x`, and returns `x`.

But we want the fp register, so why does the function use `s0`? The following table provides the answer.[^3]

<div align=center width=70%>
    <img width=70% src=/img/xv6/lab/riscv_calling.png >
</div>

The ABI Name column shows that s0 is an alias for fp.

With this knowledge, we can write `backtrace()`:

```c 
void 
backtrace(){
  printf("in bt\n");
  // Below the frame pointer is the return address.
  // Below that is the preceding stack frame's frame pointer.
  uint64* cur_frame = (uint64 *)r_fp();
  uint64* top = PGROUNDUP((uint64)cur_frame);
  uint64* bot = PGROUNDDOWN((uint64)cur_frame);
  while(cur_frame < top && cur_frame > bot){
    printf("%p\n", cur_frame[-1]); // First print the current return address
    cur_frame = cur_frame[-2]; // Then move from the current frame to the preceding frame
  }
}
```

Some expressions here look unusual, almost like negative array indices. In fact, `cur_frame[-1]` is equivalent to `*(cur_frame - 1)`. Because `cur_frame` is a pointer to 64-bit values, this reads the data eight bytes before `cur_frame`.

`PGROUNDDOWN` and `PGROUNDUP` are used because a chain of function calls fits within at most one page. If recursive printing goes outside that page's range, we have reached the bottommost function and can stop.

Finally, add `backtrace()` to the `sys_sleep()` system call as requested, and this part is complete.

## Alarm

> ![](/img/xv6/lab/lab4_alarm.png)
> Implement a `sigalarm(interval, handler)` system call that executes `handler` once every `interval` clock ticks. Also implement `sigreturn()`: when the handler calls it, execution of the handler should stop and the normal instruction sequence should resume. Passing zero for both arguments of `sigalarm` disables the handler.

This lab is rather difficult to understand, especially `sigreturn`. Examine `alarmtest.c` carefully. A good understanding of the trap process is also necessary; if unfamiliar, see [this article](/2022/07/xv6_note/).

```c 
void
periodic()
{
  count = count + 1;
  printf("alarm!\n");
  sigreturn();
}

// tests whether the kernel calls
// the alarm handler even a single time.
void
test0()
{
  int i;
  printf("test0 start\n");
  count = 0;
  sigalarm(2, periodic);
  for(i = 0; i < 1000*500000; i++){
    if((i % 1000000) == 0)
      write(2, ".", 1);
    if(count > 0)
      break;
  }
  sigalarm(0, 0);
  if(count > 0){
    printf("test0 passed\n");
  } else {
    printf("\ntest0 failed: the kernel never called the alarm handler\n");
  }
}
```

`sigreturn` means that execution may originally be inside this `for` loop and then abruptly begin executing `periodic()` because the interval elapsed. If `periodic()` calls `sigreturn()`, execution inside `periodic()` should stop and resume in the `for` loop. This [video creator](https://www.bilibili.com/video/BV1wu411d7Kd/?spm_id_from=333.788&vd_source=4de003ee9a3815aedd7d0cb2c7a12d14) explains it clearly.

We can examine the tests in `alarmtest.c` in order and implement the calls according to their requirements.

### test0: invoke handler

> Get started by modifying the kernel to jump to the alarm handler in user space, which will cause test0 to print "alarm!". Don't worry yet what happens after the "alarm!" output; it's OK for now if your program crashes after printing "alarm!". Here are some hints:

In other words, first jump correctly into **user mode** to execute the handler. To preserve isolation, the function cannot simply run in the kernel. A crash after the jump is acceptable for now.

Recall the xv6 trap process. The epc register determines the address to which execution returns after a trap. Changing epc directly makes the return jump to the handler's address.

How do we determine when the interval has elapsed?

RISC-V hardware—I am not entirely sure which hardware component—generates a timer interrupt every clock tick, and `trap.c` handles it.

We can count these interrupts to decide whether to jump. When required, directly replace epc in the trapframe in `trap.c` with the handler's address.

Add the following fields to `struct proc` for every process:

- `uint64 alarm_tks;` stores the handler interval; zero means disabled.
- `void (*alarm_handler)();` stores the handler address.
- `uint64 alarm_tk_elapsed;` stores the time elapsed since the handler last ran.

`sys_sigalarm()` stores its arguments in these fields. For now, `sys_sigreturn()` does nothing and simply returns zero:

```c 
uint64 
sys_sigalarm(void){
  int ticks;
  struct proc* p = myproc();
  uint64 handler;
  try(argint(0, &ticks), return -1);
  try(argaddr(1, &handler), return -1);
  p->alarm_tks = ticks;
  p->alarm_handler = handler;
  p->alarm_tk_elapsed = 0;
  return 0;
}
```

Because these fields have been added, initialize and release them appropriately in the process initialization function `allocproc()` and cleanup function `freeproc()`.

First, the change in `allocproc()`:

```c 
……
  p->alarm_tk_elapsed = 0;
  p->alarm_state = 0;
  p->alarm_tks = 0;
  return p;
}
```

Then `freeproc()`:

```c 
……
  p->alarm_handler = 0;
  p->alarm_tk_elapsed = 0;
  p->alarm_tks = 0;
}
```

We can now implement the jump in `usertrap()` in `trap.c`:

```c 
……
  if(which_dev == 2){ // The timer interrupt number is 2
    if(p->alarm_tks > 0){ 
      p->alarm_tk_elapsed++; // Time elapsed since the handler last ran
      if(p->alarm_tk_elapsed > p->alarm_tks){ // The specified interval has elapsed
        p->alarm_tk_elapsed = 0;
        p->trapframe->epc = p->alarm_handler; // Replace epc so user mode executes the instruction at that address
      }
    }
    yield();
  }
```

This successfully jumps to the handler and passes test0, although it predictably crashes afterward.

The main reason for the crash is that `sys_sigreturn()` has not yet been implemented, so after the handler finishes the process does not know where to return.

Passing test1 and test2 requires solving this problem.

### test1/test2(): resume interrupted code

> Chances are that alarmtest crashes in test0 or test1 after it prints "alarm!", or that alarmtest (eventually) prints "test1 failed", or that alarmtest exits without printing "test1 passed". To fix this, you must ensure that, when the alarm handler is done, control returns to the instruction at which the user program was originally interrupted by the timer interrupt. You must ensure that the register contents are restored to the values they held at the time of the interrupt, so that the user program can continue undisturbed after the alarm. Finally, you should "re-arm" the alarm counter after each time it goes off, so that the handler is called periodically.

In short, execution must return to the correct location after the handler finishes.

Register values change while entering the kernel to handle traps and system calls. Merely restoring epc to the correct address is therefore insufficient: the complete register environment also needs to be backed up.

Add another `struct trapframe` field to `struct proc` to preserve the environment from before the handler:

```c 
……
struct trapframe *trapframe; // data page for trampoline.S
struct trapframe *alarmframe; // Newly added backup trapframe
……
```

Naturally, it must also be allocated and released in `allocproc()` and `freeproc()`.

In `allocproc()`:

```c 
……
if((p->alarmframe = (struct trapframe *)kalloc()) == 0){
  freeproc(p);
  release(&p->lock);
  return 0;
}
……
```

In `freeproc()`:

```c 
if(p->alarmframe)
  kfree((void*)p->alarmframe);
p->alarmframe = 0;
```

`usertrap()` in `trap.c` can populate `alarmframe`. When the handler must run, back up the environment first and then redirect execution:

```c 
  if(which_dev == 2){
    if(p->alarm_tks > 0){
      p->alarm_tk_elapsed++;
      if(p->alarm_tk_elapsed > p->alarm_tks){
        p->alarm_tk_elapsed = 0;
        *p->alarmframe = *p->trapframe; // Notice this line
        p->trapframe->epc = p->alarm_handler;
      }
    }
    yield();
  }
```


`sys_sigreturn()` restores the trapframe from `alarmframe`. This restores epc and all general-purpose registers, naturally leaving the handler and resuming the program's original sequence:

```c 
uint64
sys_sigreturn(void){
  struct proc* p = myproc();
  *p->trapframe = *p->alarmframe;
  return 0;
}
```


Running `alarmtest` again still does not pass every test.

Imagine that a handler executes extremely slowly. The specified number of ticks may pass again before the previous handler invocation finishes. If we replace epc again at that point, the handler restarts from its beginning. This is disastrous: epc keeps being reset and the handler can never finish.

The test program includes exactly this case:

```c 
void
slow_handler()
{
  count++;
  printf("alarm!\n");
  if (count > 1) {
    printf("test2 failed: alarm handler called more than once\n");
    exit(1);
  }
  for (int i = 0; i < 1000*500000; i++) { // An extremely slow handler
    asm volatile("nop"); // avoid compiler optimizing away loop
  }
  sigalarm(0, 0);
  sigreturn();
}
```

We therefore need another field in `struct proc`, named `alarm_state`. A value of one means that the handler is currently executing. Even if another interval elapses, epc must not be changed to run the handler again while this state is active.

Because a new field has been added, `allocproc` and `freeproc` must be updated as well; I will not repeat those straightforward changes.

The more important change is in `usertrap()`:

```c 
  if(which_dev == 2){
    if(p->alarm_tks > 0){
      p->alarm_tk_elapsed++;
      if(p->alarm_tk_elapsed > p->alarm_tks && !p->alarm_state){ // alarm_state must be zero here
        p->alarm_tk_elapsed = 0;
        *p->alarmframe = *p->trapframe;
        p->trapframe->epc = p->alarm_handler;
        p->alarm_state = 1; // Changing epc means execution has begun
      }
    }
    
    yield();
  }
```

`sys_sigreturn()` also needs a change because calling it means that the handler is no longer running:

```c
uint64
sys_sigreturn(void){
  struct proc* p = myproc();
  *p->trapframe = *p->alarmframe;
  p->alarm_state = 0; // Set alarm_state to zero because the handler has stopped
  return 0;
}
```

After these changes, the lab passes. I also wish everyone working on it an early AC:

![](/img/xv6/lab/lab4_AC.png)

## Summary

More important than the exercises themselves is understanding the trap process in xv6. Even without completely understanding it, one can follow the instructions step by step and finish the lab. Understanding the mechanism is genuinely difficult, however, because it involves a great deal of unfamiliar RISC-V assembly and low-level knowledge. Once understood and implemented, it is hard not to admire the ingenuity of operating-system design.

Completing this lab also resolved many of my earlier questions about operating systems, including the principle behind the alarm exercise. At the same time, it revealed how shallow my understanding of assembly still is. See the xv6 notes in [this article](/2022/07/xv6_note/). I could never understand why `userret` and `uservec` exchange the `sscratch` register. After asking someone, I learned that it is a privileged register and cannot be manipulated using instructions such as `ld` and `sd`, although I still do not understand the reason for that design.

[^1]: <https://pdos.csail.mit.edu/6.S081/2020/lec/l-riscv.txt>
[^2]: <https://gcc.gnu.org/onlinedocs/gcc/Simple-Constraints.html#Simple-Constraints>
[^3]: <https://pdos.csail.mit.edu/6.828/2021/readings/riscv-calling.pdf>
