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

Update on 2022/7/14: I added the sysinfo lab. Lab 2 is now completely documented.

Update on 2022/9/14: I recently put the lab code on GitHub. If you need a reference, you can find it here:

<https://github.com/ttzytt/xv6-riscv>

The different branches contain the different labs.

---

# Lab 2: system calls

## The system-call process

As its name suggests, this lab asks us to add two system calls to the kernel. Before adding them, we need to understand the path taken by a system call.

First, the user-mode system-call functions are declared, but not implemented, in `user/user.h`.

```c
// system calls
int fork(void);
int exit(int) __attribute__((noreturn));
int wait(int*);
int pipe(int*);
int write(int, const void*, int);
int read(int, void*, int);
int close(int);
int kill(int);
int exec(char*, char**);
int open(const char*, int);
int mknod(const char*, short, short);
int unlink(const char*);
int fstat(int fd, struct stat*);
int link(const char*, const char*);
int mkdir(const char*);
int chdir(const char*);
int dup(int);
int getpid(void);
char* sbrk(int);
int sleep(int);
int uptime(void);
```

These functions are actually implemented in assembly in `user/usys.S`. The language is RISC-V assembly rather than NASM, but NASM is the only language mode that gives me satisfactory syntax highlighting:

```nasm
fork:
#include "kernel/syscall.h"
.global fork
 li a7, SYS_fork
 ecall
 ret
.global exit
exit:
 li a7, SYS_exit
 ecall
 ret
.global wait
wait:
 li a7, SYS_wait
 ecall
 ret
.global pipe
pipe:
 li a7, SYS_pipe
 ecall
 ret
.global read
read:
 li a7, SYS_read
 ecall
 ret

……
```

Notice the instruction `li a7, SYS_fork`. The form of `li`, meaning load immediate, is:

> li, rd, imm

It loads the immediate value `imm` into the `rd` register.[^1]

In `li a7, SYS_fork`, `SYS_fork` is therefore an immediate value. It is defined in `kernel/syscall.h`, which is why the assembly file begins with an `#include`.

```c
// System call numbers
#define SYS_fork    1
#define SYS_exit    2
#define SYS_wait    3
#define SYS_pipe    4
#define SYS_read    5
#define SYS_kill    6
#define SYS_exec    7
#define SYS_fstat   8
#define SYS_chdir   9
#define SYS_dup    10
#define SYS_getpid 11
#define SYS_sbrk   12
#define SYS_sleep  13
#define SYS_uptime 14
#define SYS_open   15
#define SYS_write  16
#define SYS_mknod  17
#define SYS_unlink 18
#define SYS_link   19
#define SYS_mkdir  20
#define SYS_close  21
```

This file assigns numbers to the different system calls; for now, call them syscall numbers. Thus, `li a7, SYS_fork` places the syscall number for `fork` in register a7. After entering the kernel, that value tells us which system call was requested.

The next assembly instruction is `ecall`. It is a rather remarkable RISC-V instruction that I do not fully understand, but I found some information online.[^2]

> The ECALL instruction atomically jumps to a controlled location, switches `sp` to the kernel stack, saves the old user `sp` and `pc`, saves the old privilege mode, selects the new privilege mode, and sets the new `pc` to the kernel syscall handler.

Roughly speaking, `ecall` jumps to a particular address at which kernel services are located. Like an ordinary function call, it also preserves the execution state so that the system can later return to the current state after completing the call. For example, it saves the stack pointer, `sp`, and program counter, `pc`.

After `ecall` transfers control into the kernel, execution first reaches the kernel handler `syscall()`.

```c
static uint64 (*syscalls[])(void) = {
    [SYS_fork] sys_fork,   [SYS_exit] sys_exit,     [SYS_wait] sys_wait,
    [SYS_pipe] sys_pipe,   [SYS_read] sys_read,     [SYS_kill] sys_kill,
    [SYS_exec] sys_exec,   [SYS_fstat] sys_fstat,   [SYS_chdir] sys_chdir,
    [SYS_dup] sys_dup,     [SYS_getpid] sys_getpid, [SYS_sbrk] sys_sbrk,
    [SYS_sleep] sys_sleep, [SYS_uptime] sys_uptime, [SYS_open] sys_open,
    [SYS_write] sys_write, [SYS_mknod] sys_mknod,   [SYS_unlink] sys_unlink,
    [SYS_link] sys_link,   [SYS_mkdir] sys_mkdir,   [SYS_close] sys_close,
    [SYS_trace] sys_trace, [SYS_sysinfo] sys_sysinfo,
}; // Array of pointers to functions

void
syscall(void)
{
    int num;
    struct proc *p = myproc();
    num = p->trapframe->a7;
    if (num > 0 && num < NELEM(syscalls) && syscalls[num]) {
        p->trapframe->a0 = syscalls[num]();
    } else {
        printf("%d %s: unknown sys call %d\n", p->pid, p->name, num);
        p->trapframe->a0 = -1;
    }
}
```

`syscall()` uses the number stored in a7 to invoke the corresponding service. How can it obtain a function from a syscall number? The answer is an array of function pointers.

The syntax `[SYS_fork] sys_fork` is a C designated initializer in which the value in brackets is used as the element index. For example, `int arr[] = {[3] 2333, [6] 6666}` creates an array whose element at index 3 is 2333, whose element at index 6 is 6666, and whose other elements are initialized to zero. This syntax is unavailable in C++.[^3]

The actual implementations of these kernel services are not in this file; they are in `kernel/sysproc.c`. For example, `get_pid()` is implemented as:

```cpp
uint64
sys_getpid(void)
{
  return myproc()->pid;
}
```

After the call completes, its return value is placed in register a0 when control returns to user mode. That is the purpose of `p->trapframe->a0 = syscalls[num]();`.

## System call tracing

>![](/img/xv6/lab/lab2_trace.png)
>Implement a system call named `trace` that traces system calls made by a particular process. After a process invokes `trace`, it prints the system calls made by that process in a specified format. A mask argument selects which calls are traced.

More precisely, every bit of the mask represents one system call. If bit $i$ is one, syscall number $i$ must be traced.

Before implementing the behavior, we must follow the complete system-call path and “register” the new call in several files.

### Registering the system call in the different files

First, declare it in the user-mode header `user/user.h`, allowing a user to invoke the assembly interface that enters the kernel:

```c
……

int getpid(void);
char* sbrk(int);
int sleep(int);
int uptime(void);

int trace(int)// Newly added call with one int argument, the mask
```

As explained earlier, an assembly function performs the transition. This assembly is generated automatically by the Perl script `user/usys.pl`, so that script must be changed.

```perl
print "# generated by usys.pl - do not edit\n";

print "#include \"kernel/syscall.h\"\n";

sub entry {
    my $name = shift;
    print ".global $name\n";
    print "${name}:\n";
    print " li a7, SYS_${name}\n";
    print " ecall\n";
    print " ret\n";
}

entry("fork");
entry("exit");

……

entry("sleep");
entry("uptime");
entry("trace"); # Add it here!
```

The next `make qemu` causes the added `entry` to produce the following in `user/usys.S`:

```nasm
.global trace
trace:
 li a7, SYS_trace
 ecall
 ret
```

User-mode registration is now complete. Next, register the call in the kernel.

Assign the call a number in `kernel/syscall.h`, so that the corresponding function can be located from that number.

```cpp
// System call numbers
#define SYS_fork    1
#define SYS_exit    2

……

#define SYS_mkdir  20
#define SYS_close  21

#define SYS_trace  22 // Here!
```

As introduced earlier, the kernel dispatcher `syscall()` uses an array of function pointers to find the required function. We must add an element to that array and declare the trace function.

In `kernel/syscall.c`:

```c
extern uint64 sys_chdir(void);
extern uint64 sys_close(void);

……

extern uint64 sys_write(void);
extern uint64 sys_uptime(void);

extern uint64 sys_trace(void); // Add it here!

static uint64 (*syscalls[])(void) = {
    [SYS_fork] sys_fork,   [SYS_exit] sys_exit,     [SYS_wait] sys_wait,
    [SYS_pipe] sys_pipe,   [SYS_read] sys_read,     [SYS_kill] sys_kill,
    [SYS_exec] sys_exec,   [SYS_fstat] sys_fstat,   [SYS_chdir] sys_chdir,
    [SYS_dup] sys_dup,     [SYS_getpid] sys_getpid, [SYS_sbrk] sys_sbrk,
    [SYS_sleep] sys_sleep, [SYS_uptime] sys_uptime, [SYS_open] sys_open,
    [SYS_write] sys_write, [SYS_mknod] sys_mknod,   [SYS_unlink] sys_unlink,
    [SYS_link] sys_link,   [SYS_mkdir] sys_mkdir,   [SYS_close] sys_close,
    [SYS_trace] sys_trace, // Add it here
}; // Array of pointers to functions
```

A declaration such as `extern uint64 sys_trace(void);` belongs in `kernel/syscall.c`, while the implementation belongs in `kernel/sysproc.c`. For now, add any implementation there; the real implementation is discussed later.

```c

……

uint64
sys_uptime(void)
{
  uint xticks;
  acquire(&tickslock);
  xticks = ticks;
  release(&tickslock);
  return xticks;
}

uint64 
sys_trace(){ // Newly added
  printf("hello from trace\n");
  return 0;
}
```

At this point, run `make qemu` again and enter a trace command in the shell, such as `trace 32 grep hello README`. Seeing `hello from trace` confirms that the call has been registered successfully.

### Implementation

To learn which system calls are used, we can modify the dispatcher itself because every user program must pass through it to request any kernel service. The trace information can therefore be printed directly inside this function.

However, many processes may be making system calls simultaneously. Printing unconditionally inside `syscall()` would report calls from every process rather than from only one.

Unconditional output would also violate the mask requirement, which specifies exactly which calls to print.

We therefore need a way to determine whether the current process wants tracing and, if it does, which system calls its mask selects. The simplest approach is to add a mask field to the structure describing a process, namely `struct proc` in `kernel/proc.h`.

```c
struct proc {
  struct spinlock lock;

  // p->lock must be held when using these:
  enum procstate state;        // Process state
  struct proc *parent;         // Parent process
  void *chan;                  // If non-zero, sleeping on chan
  int killed;                  // If non-zero, have been killed
  int xstate;                  // Exit status to be returned to parent's wait
  int pid;                     // Process ID

  // these are private to the process, so p->lock need not be held.
  uint64 kstack;               // Virtual address of kernel stack
  uint64 sz;                   // Size of process memory (bytes)
  pagetable_t pagetable;       // User page table
  struct trapframe *trapframe; // data page for trampoline.S
  struct context context;      // swtch() here to run process
  struct file *ofile[NOFILE];  // Open files
  struct inode *cwd;           // Current directory
  char name[16];               // Process name (debugging)

  int trace_mask;              // Add it here!
};
```

The dispatcher now only needs to inspect the `trace_mask` of the process currently entering the kernel. If the process wants to trace the call it is making, the dispatcher prints the information. It will no longer print merely because some unrelated process made a call.

The modified `syscall()` in `kernel/syscall.c` follows.

```c
const static *syscall_names[] = {
  "fork", "exit", "wait", "pipe", "read", "kill", "exec", "fstat", "chdir", "dup",
  "getpid", "sbrk", "sleep", "uptime", "open", "write", "mknod", "unlink", "link",
  "mkdir", "close", "trace", "sysinfo"
};

void
syscall(void)
{
    int num;
    struct proc *p = myproc();  // myproc() returns the process currently making the system call
    num = p->trapframe->a7;     // The system call requested by the current process
    if (num > 0 && num < NELEM(syscalls) && syscalls[num]) {
        p->trapframe->a0 = syscalls[num](); // Use num to find the function to call
        // a0 stores the return value of the system call
        int trace_mask = p->trace_mask;     // Inspect this process's trace mask
        if ((trace_mask >> num) & 1) {      // Print if the process requested tracing for this call
          // 3: syscall read -> 1023 is the format required by the lab, so use it here.
          // 3 is the process ID, read is the call name, and 1023 is its return value.
          printf("%d: syscall %s -> %d\n", p->pid, syscall_names[num - 1], p->trapframe->a0);
        }
    } else {
        printf("%d %s: unknown sys call %d\n", p->pid, p->name, num);
        p->trapframe->a0 = -1;
    }
}
```

A process's `trace_mask` does not appear from nowhere. It is assigned only when that process invokes the `trace` system call.

Consequently, `sys_trace()` cannot merely print `hello from trace` as it did in the temporary implementation. Its revised implementation is:

```c 
uint64 
sys_trace(){
  int mask;
  if(argint(0, &mask) < 0){
    // Read the zeroth 32-bit value from user mode
    return - 1;
  }
  struct proc *cur_proc = myproc(); // The process making this system call
  cur_proc->trace_mask = mask;
  return 0;
}
```

The idea is simple. User mode passes a `mask` to `trace()`, and the system call copies that mask into the current `struct proc`. Later, when the process passes through the dispatcher, the kernel knows which calls to trace.

The expression `argint(0, &mask)` reads the first 32-bit argument.

We do not receive arguments using the ordinary C calling form because the kernel and user process have different page tables. Instead, system calls use the family of functions `argaddr()`, `argint()`, and `argstr()`.[^3]

These helpers ultimately call `argraw()`, shown below. Its argument `n` identifies which argument should be read.

```c 
static uint64 argraw(int n) {
    struct proc *p = myproc();
    switch (n) {
        case 0:
            return p->trapframe->a0;
        case 1:
            return p->trapframe->a1;
        case 2:
            return p->trapframe->a2;
        case 3:
            return p->trapframe->a3;
        case 4:
            return p->trapframe->a4;
        case 5:
            return p->trapframe->a5;
    }
    panic("argraw");
    return -1;
}
```

It reads data from the `trapframe`. The trapframe preserves the context for a system call: register state at the moment of the call, the current process's kernel-stack location, the kernel page table, and other information. After finishing the call, the kernel restores the previous state from these values. This resembles a function call; see [this article](https://ttzytt.com/2022/04/function-call/) for comparison.

Why does requesting argument number $n$ return the corresponding `a` register? I am not completely certain, but it is probably a consequence of the RISC-V calling convention, which is also discussed in [this article](https://ttzytt.com/2022/04/function-call/).

Some relevant parts of GCC's RISC-V calling convention are:[^4]

- A 32-bit integer return value is placed in register a0.
- 32-bit integer arguments are placed from left to right in a0, a1, through a7. Additional arguments are pushed on the stack from right to left, with the ninth argument at the top.

This agrees quite well with `argraw()` and also with placing the system-call result in a0. I still do not understand why a6 cannot be used. a7 clearly cannot hold an argument because it stores the syscall number. If you know the reason for a6, please discuss it in the comments.

Entering `trace 32 grep hello README` now produces the correct output.

However, if you next enter `grep hello README` without `trace`, trace output still appears.

This makes sense after some thought. xv6 maintains a table containing a total of 64 processes. When a new process is created, the system assigns the first unused process slot.

The implementation appears in `allocproc()` in `kernel/proc.c`:

```c 
// Look in the process table for an UNUSED proc.
// If found, initialize state required to run in the kernel,
// and return with p->lock held.
// If there are no free procs, or a memory allocation fails, return 0.
static struct proc*
allocproc(void)
{
  struct proc *p;

  for(p = proc; p < &proc[NPROC]; p++) {
    acquire(&p->lock);
    if(p->state == UNUSED) { // A new process always receives the first unused slot in order
      goto found;
    } else {
      release(&p->lock);
    }
  }
  return 0;

  // ... Much more code follows; omit it for now
}
```

If no intervening command has run, `grep hello README` receives the same process slot previously used by `trace 32 grep hello README`.

The old process's `trace_mask` was changed and never reset. The later `grep hello README` therefore naturally continues to print trace information.

To fix this, we need to know which function releases resources and clears information when a process ends. Adding one line there to reset `trace_mask` prevents tracing output from leaking into a process that never requested it.

The function that performs this final cleanup, somewhat like a C++ destructor, is `freeproc()`. It is located alongside `allocproc()` in `kernel/proc.c`.

Simply add `p->trace_mask = 0;` at the end:

```c 
// free a proc structure and the data hanging from it,
// including user pages.
// p->lock must be held.
static void
freeproc(struct proc *p)
{
  if(p->trapframe)
    kfree((void*)p->trapframe);
  p->trapframe = 0;
  if(p->pagetable)
    proc_freepagetable(p->pagetable, p->sz);
  p->pagetable = 0;
  p->sz = 0;
  p->pid = 0;
  p->parent = 0;
  p->name[0] = 0;
  p->chan = 0;
  p->killed = 0;
  p->xstate = 0;
  p->state = UNUSED;

  p->trace_mask = 0;
}
```

Repeating the previously failing sequence now works correctly.

Only one final step remains in this part of the lab.

> The trace system call should enable tracing for the process that calls it and any children that it subsequently forks, but should not affect other processes.

In other words, if a parent process has a `trace_mask`, its child must inherit the same value. Every child is created by `fork()`, so we can modify the implementation of `fork` directly.

Like the preceding two process-related functions, `fork()` is implemented in `kernel/proc.c`.

The first lines define two `struct proc` pointers, `np` and `p`. The comments make it clear that `np` is the new process. We do not need to understand all the surrounding machinery; simply add `np->trace_mask = p->trace_mask` in the appropriate place.

That completes the feature. The supplied unit tests should now pass.

```c 
fork(void)
{
  int i, pid;
  struct proc *np; // new process
  struct proc *p = myproc();

  // Allocate process.
  if((np = allocproc()) == 0){
    return -1;
  }

  // Copy user memory from parent to child.
  if(uvmcopy(p->pagetable, np->pagetable, p->sz) < 0){
    freeproc(np);
    release(&np->lock);
    return -1;
  }
  np->sz = p->sz;

  np->parent = p;

  // copy saved user registers.
  *(np->trapframe) = *(p->trapframe);

  // Cause fork to return 0 in the child.
  np->trapframe->a0 = 0;

  // Copy the trace mask
  np->trace_mask = p->trace_mask;
  // Here!!!!!!

  // increment reference counts on open file descriptors.
  for(i = 0; i < NOFILE; i++)
    if(p->ofile[i])
      np->ofile[i] = filedup(p->ofile[i]);
  np->cwd = idup(p->cwd);

  safestrcpy(np->name, p->name, sizeof(p->name));

  pid = np->pid;

  np->state = RUNNABLE;

  release(&np->lock);

  return pid;
}
```

## Sysinfo

>![](/img/xv6/lab/lab2_sysinfo.png)
>Implement a system call that collects the system's currently free memory and number of active processes. It accepts a `struct sysinfo*`, and the system call writes the information into that structure.

As before, register this call in all of the necessary files before implementing it. The procedure is identical to the one above, so I will not repeat it. The only detail is that the user-mode declaration in `user/user.h` must take a `struct sysinfo*`, rather than the integer argument used by trace.

The kernel does not provide functions that report free memory or the current process count, so we must implement them.

First, implement the free-memory function in `kernel/kalloc.c`, as required by the lab.

That file defines a `kmem` structure:

```c
struct run {
  struct run *next;
};

struct {
  struct spinlock lock;
  struct run *freelist;
} kmem;
```

It also contains functions such as `kalloc()`:

```c
// Allocate one 4096-byte page of physical memory.
// Returns a pointer that the kernel can use.
// Returns 0 if the memory cannot be allocated.
void *
kalloc(void)
{
  struct run *r;

  acquire(&kmem.lock);
  r = kmem.freelist;
  if(r)
    kmem.freelist = r->next;
  release(&kmem.lock);

  if(r)
    memset((char*)r, 5, PGSIZE); // fill with junk
  return (void*)r;
}
```

From the comments, variable names, and behavior of `kalloc`, we can infer that `kmem` maintains a linked list in which every element represents an available 4 KB memory page.

We can traverse that list to calculate the free space.

```c 
uint64 
get_fremem(){
  // Return the amount of free memory in bytes
  uint64 ret = 0;
  acquire(&kmem.lock); // Acquire the lock first
  struct run *free_pagelist = kmem.freelist;
  while(free_pagelist){ // Traverse the linked list
    free_pagelist = free_pagelist->next;
    ret++;
  }
  release(&kmem.lock);
  return ret * PGSIZE; // Multiply by the size of one page before returning
}
```

We also need the number of active processes. The lab requires this function to be implemented in `kernel/proc.c`.

Consider the previously discussed `allocproc`:

```c
// Look in the process table for an UNUSED proc.
// If found, initialize state required to run in the kernel,
// and return with p->lock held.
// If there are no free procs, or a memory allocation fails, return 0.
static struct proc*
allocproc(void)
{
  struct proc *p;

  for(p = proc; p < &proc[NPROC]; p++) {
    acquire(&p->lock);
    if(p->state == UNUSED) { // A new process always receives the first unused slot in order
      goto found;
    } else {
      release(&p->lock);
    }
  }
  return 0;

  // ... Much more code follows; omit it for now
}
```

Following that traversal pattern, inspect every process and count those whose `state` is not `UNUSED`. This gives the number of process slots currently in use.

```c
uint
get_proc_cnt(){
  struct proc* cur_proc;
  // proc is an array declared as: struct proc proc[NPROC];
  uint ret = 0;

  for(cur_proc = proc; cur_proc < &proc[NPROC]; cur_proc++){
    acquire(&cur_proc->lock);
    if(cur_proc->state != UNUSED)
      ret++; // This process is in use
    release(&cur_proc->lock);
  }
  return ret;
}
```

Now that both the remaining memory and process count are available, `sys_sysinfo` can be implemented in `kernel/sysproc.c`.

As in trace, the user-mode and kernel-mode page tables differ. We obtain user arguments by consulting the register state saved in the trapframe when the user invoked the call.

This call receives a pointer to a structure, so use `argaddr`.

```c
uint64 
sys_sysinfo(){
  struct sysinfo info;
  struct proc *cur_proc = myproc(); 
  uint64 usr_addr;

  info.freemem = get_fremem(); // These two lines collect the system information
  info.nproc = get_proc_cnt();

  try(argaddr(0, &usr_addr), return -1); // Record the user-mode sysinfo address
  try(copyout(cur_proc->pagetable, usr_addr, (char *)&info, sizeof(info)), return -1);
  return 0;
}
```

The pointer is a virtual address interpreted using the user page table. After collecting the system information in `info`, we must use `copyout` to copy that structure to the address in the user's page table.

The declaration of `copyout` is `int copyout(pagetable_t pagetable, uint64 dstva, char *src, uint64 len)`.

Its source comment says:

> Copy from kernel to user. Copy `len` bytes from `src` to virtual address `dstva` in a given page table. Return 0 on success and -1 on error.

The first argument is the page table in which virtual address `dstva` must be interpreted. Here it is the user page table, `cur_proc->pagetable`.

The next argument, `dstva`, is the copy destination. We pass `usr_addr`, the argument obtained from user mode through `argaddr`.

`src` is the source data, namely `info`, and the final argument is plainly the amount of data to copy, `sizeof(info)`.

With these changes, the tests pass. I also wish everyone working on this lab an early AC.

![](/img/xv6/lab/lab2_AC.png)

## Summary

This lab genuinely resolved many of my earlier questions about system calls. This course is excellent. Beforehand, I could not understand the difference between an ordinary function call and a system call. Implementing a system call required tracing its complete route and registering a new call in all the relevant files, and that process made the mechanism much clearer.

[^1]: <https://zhuanlan.zhihu.com/p/367085156>
[^2]: <https://www.cs.cornell.edu/courses/cs3410/2019sp/schedule/slides/14-ecf-pre.pdf>
[^3]: <https://blog.miigon.net/posts/s081-lab2-system-calls/#%E5%A6%82%E4%BD%95%E5%88%9B%E5%BB%BA%E6%96%B0%E7%B3%BB%E7%BB%9F%E8%B0%83%E7%94%A8>
[^4]: <https://decaf-lang.github.io/minidecaf-tutorial-deploy/docs/lab9/calling.html>
