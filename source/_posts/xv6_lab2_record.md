---
title: "[MIT 6.s081] xv6 Lab2 system calls 实验记录"
date: 2022-07-10 23:50:41
updated: 2022-10-15 18:48:15
tags:
- xv6
- 2022
- UNIX
- 操作系统
- 系统调用
- 底层
categories:
- 实验记录
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
upd@2022/7/14：添加了 sysinfo 这个 lab，至此为止，lab2 已经全部写完。

upd@2022/9/14：最近把实验的代码放到 github 上了，如果需要参考可以查看这里：

<https://github.com/ttzytt/xv6-riscv>

里面不同的分支就是不同的实验。

---

# Lab2: system calls

## 系统调用过程
跟名字一样，这个 lab 需要我们往内核里增加两个系统调用。而要增加这些系统调用，我们首先需要了解系统调用的过程。

首先，用户态的系统调用函数被声明（没有实现）在 `user/user.h` 中。

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

这些函数其实都是由汇编实现的，在 `user/usys.S` 这个文件中（其实语言不是 nasm，是 risc-v 的汇编，但是好像只有我输 nasm 才能比较好的高亮）：

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

注意到
`li a7, SYS_fork` 这个命令。其中 `li` 这个命令（load immediate）的形式是这样的：

> li, rd, imm

它把一个立即数 imm 加载到rd寄存器中。[^1]

那上面的 `li a7, SYS_fork` 中的 `SYS_fork` 就是一个立即数。它被定义在 `kernel/syscall.h` 中，这也是为什么这个汇编的开头要 `#include`。

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

可以看到，这个文件定义了不同系统调用的编号，我们暂且叫他调用号吧。所以 `li a7, SYS_fork` 的意思就是，把 `fork` 的调用号赋值到 a7 寄存器内，这样进入内核之后，我们就知道之前调用的是哪个系统调用。

汇编的下一行是 `ecall`。这是一个 risc-v 架构里比较神奇的指令，我也不是很了解，不过我从网上[^2]查到了一些资料：
> ECALL instruction does an atomic jump to a controlled location (i.e. RISC-V 0x8000 0180)
>- Switches the sp to the kernel stack
>- Saves the old (user) SP value
>- Saves the old (user) PC value (= return address)
>- Saves the old privilege mode
>- Sets the new privilege mode to 1
>- Sets the new PC to the kernel syscall handler

大概是说，ecall 这个指令会让我们跳转到一个特定的地址，而这个地址就是存放内核服务的地方（内核栈）。同时，和普通的函数调用一样，ecall 会保存现场，这样结束系统调用的时候我们就可以顺利的恢复到当前状态。比如，保存栈指针（sp），和程序计数器（pc）的值。

ecall 把我们跳到内核之后，会先进入一个内核的处理函数，`syscall()`。

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
}; // 指向函数的指针的数组

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

这个 `syscall` 会根据 a7 寄存器中存的调用号，去调用相应的服务。那如何去通过调用号来得到相应的函数呢？答案就是一个指向函数指针的数组，

这里的 `[SYS_fork] sys_fork` 是 C 语言数组的一个语法，表示以方括号内的值作为元素下标。比如 `int arr[] = {[3] 2333, [6] 6666}` 代表 arr 的下标 3 的元素为 2333，下标 6 的元素为 6666，其他元素填充 0 的数组。（该语法在 C++ 中已不可用）[^3]

这些系统服务的具体实现都不在这个文件中，在 `kernel/sysproc.c` 中。比如 `get_pid()` 的实现：
```cpp
uint64
sys_getpid(void)
{
  return myproc()->pid;
}
```

调用完成之后，系统调用的返回值会在返回用户态时，被赋到 a0 寄存器上，也就是 ` p->trapframe->a0 = syscalls[num]();` 这句话的用处。

## System call tracing
>![](/img/xv6/lab/lab2_trace.png)
>实现一个追踪特定进程系统调用的系统调用，叫做 trace。比如有个进程调用了这个 trace，那么 trace 就会以特定格式输出这个进程调用过的系统调用。其中，有一个 mask 作为参数，指定有哪些调用需要被追踪。

具体来说，这个 mask 的每一位都代表一个系统调用，如果这个 mask 的第 $i$ 位为 $1$，我们就需要去追踪编号为 $i$ 的系统调用。

在实现之前，我们需要先顺着系统调用的过程，在各种文件中“注册”一遍这个新的系统调用。

### 在各种文件中“注册”系统调用

首先是在用户态的 `user/user.h` 中申明一下，使得用户能通过调用这个接口去调用汇编代码，从而进入内核：
```c
……

int getpid(void);
char* sbrk(int);
int sleep(int);
int uptime(void);

int trace(int)//新加入的调用，有一个 int 的参数是 mask
```

如前文所讲，我们需要使用汇编去实现这个跳转函数。不过，这个汇编是 perl 的脚本自动生成的，所以需要去更改这个脚本（`user/usys.pl`）。

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
entry("trace"); # 加在这里！
```

之后我们 `make qemu` 的时候，在脚本中新加的这个 `entry` 就会在 `user/usys.S` 中输出：

```nasm
.global trace
trace:
 li a7, SYS_trace
 ecall
 ret
```

到此为止已经完成了在用户态的注册。接下来需要在内核中注册。

现在我们需要在 `kernel/syscall.h` 给这个新的调用注册一个调用号，这样才能通过调用号找到函数。

```cpp
// System call numbers
#define SYS_fork    1
#define SYS_exit    2

……

#define SYS_mkdir  20
#define SYS_close  21

#define SYS_trace  22 // 这里 ！
```

然后，就像之前介绍的，内核中的中转函数 `syscall()` 需要通过一个函数指针数组来查找需要调用的函数，所以我们需要去在这个数组中新加一个元素，并且申明一下这个 trace 函数。

`kernel/syscall.c` ：
```c
extern uint64 sys_chdir(void);
extern uint64 sys_close(void);

……

extern uint64 sys_write(void);
extern uint64 sys_uptime(void);

extern uint64 sys_trace(void); // 加在这里！

static uint64 (*syscalls[])(void) = {
    [SYS_fork] sys_fork,   [SYS_exit] sys_exit,     [SYS_wait] sys_wait,
    [SYS_pipe] sys_pipe,   [SYS_read] sys_read,     [SYS_kill] sys_kill,
    [SYS_exec] sys_exec,   [SYS_fstat] sys_fstat,   [SYS_chdir] sys_chdir,
    [SYS_dup] sys_dup,     [SYS_getpid] sys_getpid, [SYS_sbrk] sys_sbrk,
    [SYS_sleep] sys_sleep, [SYS_uptime] sys_uptime, [SYS_open] sys_open,
    [SYS_write] sys_write, [SYS_mknod] sys_mknod,   [SYS_unlink] sys_unlink,
    [SYS_link] sys_link,   [SYS_mkdir] sys_mkdir,   [SYS_close] sys_close,
    [SYS_trace] sys_trace, // 加在这里
}; // 指向函数的指针的数组
```

如前文所讲，像 `extern uint64 sys_trace(void);` 这样的申明是在 `kernel/syscall.c` 中的，而实现在 `kernel/sysproc.c` 中，我们需要到这个文件中随便添加一个实现（具体的实现在下文讲）。

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
sys_trace(){ // 新加的
  printf("hello from trace\n");
  return 0;
}
```

这个时候，我们重新 `make qemu` 一下，然后在 shell 中随便输入一个 trace 命令，比如 `trace 32 grep hello README`。就可以看到 $\texttt{hello from trace}$ 了，说明我们成功注册上了。

### 具体实现

想要了解使用了哪些系统调用，其实可以直接在系统调用的中转函数中做一些手脚，因为用户程序想要使用任何的系统服务都需要经过这个函数。那么就可以直接在这个函数中输出 trace 的信息了。

但是可能同时有很多个进程都在使用系统调用，而直接在 `syscall()` 函数中输出的话，就不只是输出一个进程使用的系统调用了。

而且直接输出的话也不符合 lab 中对 mask 的要求（也就是指定输出哪些系统调用）。

所以我们必须要有一种方法来确定当前的进程是否希望 trace，如果希望，那是希望 trace 哪些系统调用（也就是 mask）。要达到这个要求我们可以直接去给描述进程的结构体加一个 mask 属性。而定义进程的结构体就是 `struct proc`，在 `kernel/proc.h` 这个文件中：

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

  int trace_mask;              // 加在这里！
};
```

这样，在中转函数 `syscall()` 中，我们只需要检测当前进入内核的这个进程的 `trace_mask` 就行了。如果发现这个进程希望追踪现在它调用的这个系统调用，我们就可以直接输出了。这样一来，就不会随便碰到一个进程就输出信息了。

下面是修改过的 `syscall()` 函数，在 `kernel/syscall.c` 中。

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
    struct proc *p = myproc();  // myproc() 会给出当前调用系统调用的进程
    num = p->trapframe->a7;     // 当前进程希望调用的系统调用
    if (num > 0 && num < NELEM(syscalls) && syscalls[num]) {
        p->trapframe->a0 = syscalls[num](); // 通过 num 找到需要调用哪个函数
        // 这个 a0 储存了系统调用的返回值
        int trace_mask = p->trace_mask;     // 检查这个进程的 trace mask
        if ((trace_mask >> num) & 1) {      // 如果当前这个系统调用是进程希望追踪的，那就输出
          // 3: syscall read -> 1023 是 lab 中要求的格式，所以我们也按照这个格式输出
          // 这里的 3 是进程号，read 是调用的系统调用的名字，1023 是调用过后的返回值。
          printf("%d: syscall %s -> %d\n", p->pid, syscall_names[num - 1], p->trapframe->a0);
        }
    } else {
        printf("%d %s: unknown sys call %d\n", p->pid, p->name, num);
        p->trapframe->a0 = -1;
    }
}
```

不过，每个进程的 `trace_mask` 也不是凭空出现的，只有调用了 trace 这个系统调用，我们才会给进程增加一个 `trace_mask`。

所以肯定不能像刚才那样在实现 `sys_trace()` 时，直接输出一个 $\texttt{hello from trace}$。

下面就是修改后的 `sys_trace` 的实现。

```c 
uint64 
sys_trace(){
  int mask;
  if(argint(0, &mask) < 0){
    //从用户态读取第 0 个 32 位的数据
    return - 1;
  }
  struct proc *cur_proc = myproc(); // 进行系统调用的这个进程
  cur_proc->trace_mask = mask;
  return 0;
}
```

本质上很简单，我们在用户态调用 `trace()` 时，会传进去一个 `mask`，而现在这个系统调用实际上就是把传进来的这个 mask 赋值到当前的 `struct proc` 上。这样之后经过中转函数时，就可以知道要追踪哪些系统调用了。

注意这里的 `argint(0, &mask)` 这句话，其用处是读取第一个 $32$ 位的参数。

我们不适用 C 语言的形式传参，而是用这样方式，是因为内核与用户进程的页表不同，所以需要使用 `argaddr()`、`argint()`、`argstr()` 等系列函数[^3]。

这些函数最后都会调用到一个叫做 `argraw()` 的函数，实现如下，其参数 `n` 代表现在希望读取的是第几个参数：

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

可以看到其读取了 `trapframe` 中的数据。其实这个 `trapframe` 就是用来给系统调用保存现场的，它记录了发生系统调用时的寄存器状态，以及当前进程内核栈的位置，内核的页表等数据，在完成系统调用后，我们可以根据这里储存的数据，来恢复到调用之前的状态（和函数调用很像，可以参考我的[这篇文章](https://ttzytt.com/2022/04/function-call/)）。

那为什么我们想要取第几个参数，就返回 `trapframe` 的 a 几呢？虽然我不是很清楚，但大概是因为 risc-v 的函数调用约定（我的[这篇文章](https://ttzytt.com/2022/04/function-call/) 有讲函数调用规则）。

gcc 对于 risc-v 使用的部分函数调用约定有下面几点[^4]：
- 返回值（32 位 int）放在 a0 寄存器中
- 参数（32 位 int）从左到右放在 a0、a1……a7 中。如果还有，则从右往左压栈，第 9 个参数在栈顶。

这样看来，似乎和 `argraw()` 的实现是比较符合的（我们把系统调用的返回值放在 a0 也挺符合这个规则的）。不过。我还是不太清楚为什么不能使用 a6，a7 的话因为要储存系统调用号所以肯定不能放参数，a6 就不知道了，如果你知道，可以在评论区中讨论。

到此为止，如果你再尝试输入 `trace 32 grep hello README` 这个命令，就会看到正确的输出了。

不过，如果你再输入一个 `grep hello README` （不带 trace 命令），你会发现还是输出了 trace 的信息。

仔细一想，这也是合理的，xv6 中会维护一个进程的列表（总共 $64$ 个），我们新开一个进程时，系统给我们分配的是第一个没被使用的进程号。

具体的实现可以看 `kernel/proc.c` 文件中的 `allocproc()` 函数：

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
    if(p->state == UNUSED) { // 可以看到新创建进程时，总是会按顺序找到第一个没被使用的进程号
      goto found;
    } else {
      release(&p->lock);
    }
  }
  return 0;

  // …… 下面还有一堆，就先省略了
}
```

所以说，我们输入 `grep hello README` 时，因为没执行其他的命令，系统给这个命令分配的进程号是之前 `trace 32 grep hello README` 使用的。

那么，因为 `trace 32 grep hello README` 用的进程中的 `trace_mask` 已经被更改过了，并且没有改回来，所以我们 `grep hello README` 时，自然就会输出追踪的信息。

要解决这个问题，我们需要了解，在一个进程结束时，是由哪个函数来释放资源并且清空信息的，如果我们在这个函数中添加一行重置 `trace_mask` 的代码，就可以避免“明明没有 trace，但却输出信息了”的情况。

这个做最后收尾工作的函数（感觉有点像是 C++ 里的析构函数）就是 `freeproc()`，也和 `allocproc()` 一起，在 `kernel/proc.c` 这个文件中：

那么我们直接在最后来一句 `p->trace_mask = 0;` 就可以了。
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

现在再去尝试一下刚刚出 bug 的操作，就会发现没问题了。

到这里，离完成这个 lab 就只剩最后一步了。

> The trace system call should enable tracing for the process that calls it and any children that it subsequently forks, but should not affect other processes.

也就是实现这句话说的功能，如果我们的父进程有 `trace_mask`，子进程也需要有相同的。因为创建子进程都需要用 `fork()`，那直接去改 `fork` 的源码就好了：

`fork()` 的具体实现和上面的两个函数一样，还是在 `kernel/proc.c` 中（毕竟和进程有关）。

可以看到，第一行定义了两个 `struct proc`，一个是 `np`，一个是 `p`。因为代码中的注释，所以很明显可以看出来，这个 `np` 就是新的进程，那我们就完全不用管这里一堆看不懂的东西了，直接在中间来一个 `np->trace_mask = p->trace_mask`。

然后就……结束了，现在去跑提供的单元测试就可以顺利 AC 了！！


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

  // 复制 trace mask
  np->trace_mask = p->trace_mask;
  // 在这 !!!!!!

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
>实现一个系统调用，用于收集当前系统的空闲内存，和运行进程的数量。系统调用接收一个 `struct sysinfo*`，在系统调用中需要把信息写进这个结构体里。

和前面一样，需要先在各种文件中把这个系统调用注册上，然后才能开始实现。因为过程和前面的完全一样，这里就不赘述了，唯一要注意的是需要在 `user/user.h` 申明用户态函数时，加上 `struct sysinfo*` 这个参数，而不是之前 trace 的参数。

内核中并没有提供给我们获取可用内存和当前进程数的函数，所以我们需要自己实现。

首先我们去实现一下获取可用内存的函数。根据 lab 的要求，应该实现在 `kernel/kalloc.c` 这个文件里。

可以看到该文件内定义了一个结构体 `kmem`，如下：

```c
struct run {
  struct run *next;
};

struct {
  struct spinlock lock;
  struct run *freelist;
} kmem;
```

以及一些函数比如 `kalloc()`，如下：

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

通过代码中的注释以及变量命名和这个 `kalloc` 函数等，大概可以推断出这个 `kmem` 是一个链表，而链表中的每一个元素都指向一个可用的内存页（大小为 4KB）。

所以我们就可以遍历这个链表来得到空闲的空间。

```c 
uint64 
get_fremem(){
  // 返回空闲内存，用字节作为单位
  uint64 ret = 0;
  acquire(&kmem.lock); // 先加锁
  struct run *free_pagelist = kmem.freelist;
  while(free_pagelist){ // 遍历这个链表
    free_pagelist = free_pagelist->next;
    ret++;
  }
  release(&kmem.lock);
  return ret * PGSIZE; // 返回时，需要乘以一个页的大小
}
```

接下来我们还需要正在运行的进程数，按照 lab 的要求，要把这个函数实现在 `kernel/proc.c` 中。

观察之前讲过的 `allocproc` 函数：

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
    if(p->state == UNUSED) { // 可以看到新创建进程时，总是会按顺序找到第一个没被使用的进程号
      goto found;
    } else {
      release(&p->lock);
    }
  }
  return 0;

  // …… 下面还有一堆，就先省略了
}
```

然后参考这个遍历的过程，遍历所有的进程，并且计算出哪些的 `state` 不是 `UNUSED`。我们就能得到正在使用的进程了。

```c
uint
get_proc_cnt(){
  struct proc* cur_proc;
  //proc 是一个数组，定义为：struct proc proc[NPROC];
  uint ret = 0;

  for(cur_proc = proc; cur_proc < &proc[NPROC]; cur_proc++){
    acquire(&cur_proc->lock);
    if(cur_proc->state != UNUSED)
      ret++; // 如果这个进程是正在使用的
    release(&cur_proc->lock);
  }
  return ret;
}
```

现在，我们已经能够获得剩余内存和进程的数量了，接下来就可以在 `kernel/sysproc.c` 中实现 `sys_sysinfo` 了。

和 trace 上我们获得参数的方法一样，因为用户态和内核态的页表不一样，我们只能通过记录用户调用系统调用时的寄存器状态，并且存在 `trapframe` 里面，来获取用户传进来的参数。

因为这次需要接收的是一个结构体的指针，所以我们可以使用 `argaddr` 函数。

```c
uint64 
sys_sysinfo(){
  struct sysinfo info;
  struct proc *cur_proc = myproc(); 
  uint64 usr_addr;

  info.freemem = get_fremem(); // 这两行是获取系统信息
  info.nproc = get_proc_cnt();

  try(argaddr(0, &usr_addr), return -1); // 记录用户态的 sysinfo 地址
  try(copyout(cur_proc->pagetable, usr_addr, (char *)&info, sizeof(info)), return -1);
  return 0;
}
```

但是这个指针指向的是基于用户态页表的虚拟地址，所以我们获取了系统信息，也就是 `info` 后，需要用 `copyout` 函数去把我们的 `info` 复制到这个用户页表的地址上。

`copyout` 的申明是：`int copyout(pagetable_t pagetable, uint64 dstva, char *src, uint64 len)`。

根据源码中的注释：
> Copy from kernel to user.
> Copy len bytes from src to virtual address dstva in a given page table.
> Return 0 on success, -1 on error.

可以看出第一个参数是这个虚拟地址 `dstva` 基于的页表，我们这个情况下要填的肯定是用户的页表，也就是 `cur_proc->pagetable`。

下一个参数，`dstva` 是我们拷贝数据的目的地，这是一个基于第一个参数的页表的虚拟地址。我们可以填 `usr_addr`，也就是我们通过 `argaddr` 从用户态获取到的参数。

而 `src` 就添数据来源，也就是 `info`。最后一个参数就很明显了，复制数据的长度，也就是 `sizeof(info)`。

写完这些就可以愉快的 AC 了，也祝在做这个 lab 的人尽快 AC。

![](/img/xv6/lab/lab2_AC.png)

## 总结

做这个 lab 真的让我搞清楚了之前对系统调用的很多疑惑，只能说这个课是真的牛逼。比如之前一直不能理解普通的函数调用和系统调用有什么区别，然后这次因为要实现系统调用，要先顺着系统调用的过程把一个新的系统调用在各种文件中注册一遍。这个过程中就对系统调用清楚了很多。

[^1]: <https://zhuanlan.zhihu.com/p/367085156>
[^2]: <https://www.cs.cornell.edu/courses/cs3410/2019sp/schedule/slides/14-ecf-pre.pdf>
[^3]: <https://blog.miigon.net/posts/s081-lab2-system-calls/#%E5%A6%82%E4%BD%95%E5%88%9B%E5%BB%BA%E6%96%B0%E7%B3%BB%E7%BB%9F%E8%B0%83%E7%94%A8>
[^4]: <https://decaf-lang.github.io/minidecaf-tutorial-deploy/docs/lab9/calling.html>
