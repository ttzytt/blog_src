---
title: "[MIT 6.s081] xv6 Lab3 (2021) page tables 实验记录"
date: 2022-07-14 22:57:45
updated: 2022-10-15 18:48:19
tags:
- xv6
- 2022
- UNIX
- 操作系统
- 页表
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

upd@2022/9/14：最近把实验的代码放到 github 上了，如果需要参考可以查看这里：

<https://github.com/ttzytt/xv6-riscv>

里面不同的分支就是不同的实验。

---

注：和页表相关的基础知识在[这篇文章](/2022/07/xv6_note/)中有说，可以参考。

# Lab3: page tables
## Speed up system calls
>![](/img/xv6/lab/lab3_speed_up_syscalls.png)
>为了加速系统调用，很多操作系统都会在用户空间内开辟一些只读的虚拟内存，内核会把一些数据分享在这里。这样就可以减少来回在用户态和内核态中切换的操作。我们需要用这个方法给 `getpid()` 加速。

这个 lab 的大概思路是，在创建进程时，就直接把进程的 pid 放入共享空间中，然后用户查询 pid 时，就不必通过 ecall 跳转到内核了，省去了保存现场等开销。

首先我们需要在用户态的虚拟内存中多添加一页，专门用于储存和内核共享的数据。

创建一个新的虚拟内存到物理内存的映射需要用到 `mappages()` 函数，这个函数在 `kernel/vm.c` 中实现：

```c 
// Create PTEs for virtual addresses starting at va that refer to
// physical addresses starting at pa. va and size might not
// be page-aligned. Returns 0 on success, -1 if walk() couldn't
// allocate a needed page-table page.
int
mappages(pagetable_t pagetable, uint64 va, uint64 size, uint64 pa, int perm)
{
  // pagetable 是根页表，va 和 pa 分别是虚拟地址起始位置和物理地址起始位置
  // perm 是标志位
  uint64 a, last;
  pte_t *pte;

  if(size == 0)
    panic("mappages: size");
  
  a = PGROUNDDOWN(va);
  last = PGROUNDDOWN(va + size - 1);
  // PGROUNDOWN 实际上是把一个数字的后 12 位全部都设成了 0
  // 所以 a 表示新映射的起始地址，last 为最后一个要映射的页帧

  for(;;){
    if((pte = walk(pagetable, a, 1)) == 0)
      return -1;
    if(*pte & PTE_V)
      panic("mappages: remap");
    *pte = PA2PTE(pa) | perm | PTE_V;
    if(a == last)
      break;
    a += PGSIZE;
    pa += PGSIZE;
    // 每次新分配一页
  }
  return 0;
}
```

所以我们可以在 `kernel/proc.c` 这个文件中的 `proc_pagetable()` 中调用 `mappages()` 创建新的一页映射。

这个 `proc_pagetable()` 会在创建新进程时被调用，符合我们的要求。

我们先观察 `proc_pagetable()` 是如何使用 `mappages()` 来创建 trampoline 和 trapframe 页的：

```c 
if(mappages(pagetable, TRAMPOLINE, PGSIZE,
            (uint64)trampoline, PTE_R | PTE_X) < 0){
    uvmfree(pagetable, 0);
    return 0;
}

// map the trapframe just below TRAMPOLINE, for trampoline.S.
if(mappages(pagetable, TRAPFRAME, PGSIZE,
            (uint64)(p->trapframe), PTE_R | PTE_W) < 0){
    // 没映射成功的话会把之前的 unmap，而不是这个本身
    uvmunmap(pagetable, TRAMPOLINE, 1, 0);
    uvmfree(pagetable, 0);
    return 0;
}
```

可以发现，如果当前这一页没有映射成功，我们需要把之前成功映射的 `uvmunmap()` 了。并且把映射失败的这一页 `uvmfree()`。

这是因为，如果想要使用 `uvmunmap()`，必须要确保我们 unmap 的页是存在的，如果不存在就会崩溃（~~毕竟这都没映射你咋取消呢~~）。

所以，因为我们没有成功映射当前页，就只能 `uvmfree()` 去释放内存，而不是取消映射。

`uvmfree()` 的源码如下：

```c 
// Free user memory pages,
// then free page-table pages.
void
uvmfree(pagetable_t pagetable, uint64 sz)
{
  if(sz > 0)
    uvmunmap(pagetable, 0, PGROUNDUP(sz)/PGSIZE, 1);
  freewalk(pagetable);
}
```

可以发现如果 `sz` 为 0，就只会调用 `freewalk` 去释放一整个页表的内存。包括之前所有映射过的页。

还有一个小细节是，调用 `freewalk()` 时，我们必须确保映射是已经取消了的，所以我们会先调用 `uvmunmap()`。具体可以看 `freewalk()` 的实现：

```c 
// Recursively free page-table pages.
// All leaf mappings must already have been removed.
void
freewalk(pagetable_t pagetable)
{
  // there are 2^9 = 512 PTEs in a page table.
  for(int i = 0; i < 512; i++){
    pte_t pte = pagetable[i];
    if((pte & PTE_V) && (pte & (PTE_R|PTE_W|PTE_X)) == 0){
      // this PTE points to a lower-level page table.
      uint64 child = PTE2PA(pte);
      freewalk((pagetable_t)child);
      pagetable[i] = 0;
    } else if(pte & PTE_V){ // 重点：PTE_V 为 1，说明映射没取消，会 panic
      panic("freewalk: leaf");
    }
  }
  kfree((void*)pagetable);
}
```

根据这些信息，我们就能写出给 USYSCALL （也就是共享页） 的映射，这个 USYSCALL 的位置在 trampoline 和 trapframe 的下面：

```c 
if(mappages(pagetable, USYSCALL, PGSIZE, (uint64)(p->usyscall), PTE_R | PTE_U) < 0){
    // 映射完成后，我们访问 USYSCALL 开始的页，就会访问到 p->usyscall
    uvmunmap(pagetable, TRAMPOLINE, 1, 0);
    uvmunmap(pagetable, TRAPFRAME, 1, 0);
    uvmfree(pagetable, 0);
    return 0;
  }
```

需要注意的是，因为这一页是和用户共享的，我们需要把 `PTE_R` 和 `PTE_U` 的标志位设置成 1，分别代表允许读，和允许用户访问。

和前面调用 `mappages()` 时相同，如果不成功，需要先把前面映射成功的取消，随后清空该页表的所有数据。

写完这些代码后，我们在用户态访问 USYSCALL 这个页中的地址，就能访问到内核中储存的 `p->usyscall` 了。

和 lab2 中给 `proc` 结构体加 `trace_mask` 属性一样，我们创建进程时多创建了一页映射，就需要在销毁进程时也取消这个映射。

因此在 `kernel/proc.c` 中，还需要更改一下 `proc_freepagetable()` 函数：

```c 
// Free a process's page table, and free the
// physical memory it refers to.
void
proc_freepagetable(pagetable_t pagetable, uint64 sz)
{
  uvmunmap(pagetable, USYSCALL, 1, 0); // 新添加的
  uvmunmap(pagetable, TRAMPOLINE, 1, 0);
  uvmunmap(pagetable, TRAPFRAME, 1, 0);
  uvmfree(pagetable, sz);
}
```

现在还有个问题，我们已经成功创建了从虚拟内存到物理的映射，但是并没有在创建进程的时候申请这个物理内存。如果不去申请这个物理内存，我们就会尝试把一个虚拟内存映射到空指针上，自然会出问题。

所以还需要改一下 `allocproc()` 这个函数。

观察 `allocproc()` 中给 trapframe 分配物理内存的过程：

```c 
if((p->trapframe = (struct trapframe *)kalloc()) == 0){
    freeproc(p);
    release(&p->lock);
    return 0;
}
```

还是比较好理解的，那我们直接~~抄一波~~参考一下不就好了。

```c 
// 分配 usyscall 页
if((p->usyscall = (struct usyscall *)kalloc()) == 0){
    freeproc(p->usyscall);
    release(&p->lock);
    return 0;
}
p->usyscall->pid = p->pid;
// 创建完了顺便把 pid 直接放进去
```

现在内核态这边的东西已经搞好了，用户态的函数就不需要我们自己写了，根据实验提示，已经在 `user\ulib.c` 中实现了：

```c 
int
ugetpid(void)
{
  struct usyscall *u = (struct usyscall *)USYSCALL;
  return u->pid;
}
```

和前面说的一样，我们直接访问 USYSCALL 这个虚拟地址，就能得到 `p->usyscall` 这个物理地址（其实也是虚拟的，但是内核中大部分页虚拟地址直接映射到物理地址）中的东西。 

这样我们就完成了这个任务。

## Print a page table
> ![](/img/xv6/lab/lab3_print_a_pagetable.png)
> 实现一个 `vmprint()` 函数，该函数接收一个 pagetable_t 的参数，然后打印该页表，具体格式参考图片中的样式。在创建 `init` 进程时，调用这个函数打印页表。

我们先别管在创建 `init` 进程时调用这个函数，先在 `kernel/vm.c` 中把这个函数写出来。

因为 xv6 的页表是多级的，所以是一个树的结构（不懂的话可以看我的[这篇文章](/2022/07/xv6_note/)），那么本质上我们就是需要写一个通过 dfs 打印树的函数。

如下：

```c 
void 
vmprint(pagetable_t pagetable, uint dep){
  if(dep == 0)
    printf("page table %p\n", pagetable);
  for(int i = 0; i < 512; i++){
    pte_t pte = pagetable[i];
    if(pte & PTE_V){
      for(int j = 0; j < dep; j++)
        printf(".. ");
      uint64 child = PTE2PA(pte);
      printf("..%d: pte %p pa %p\n", i, pte, child);
      if(dep < 2)
        // 如果层数等于 2 就不需要继续递归了，因为这是叶子节点
        vmprint((pagetable_t) child, dep + 1);
    }
  } 
}
```

这个函数接收两个参数，要打印的页表（可以理解为要打印的树的根节点）和当前的深度，多出来一个深度是因为根据图片中的格式，我们需要根据当前的深度打印出不同数量的点。而且我们需要通过深度知道是否到达了叶子节点。

对于每个 `pagetable`，最多有 512 个节点，所以我们就依次遍历它们。如果发现这个页表是已分配的，也就是符合 `pte & PTE_V == 1` 的，我们就继续递归。

在打印的时候，我们先需要打印出 `dep + 1` 个 `..`，然后再打印出 pte 和 pa。

这里指的 pte 指的是直接读取页表项的结果，而 pa 是去掉页表项中的标志位后得到的物理地址，我们通过这个物理地址可以找到下一层的页表项或是页帧。

注意可以这么 `pte_t pte = pagetable[i];` 写是因为，pa 指向的实际上是这个子页表的第一个元素，而 `pagetable[i]` 和 `*(pagetable + i)` 是等价的，也就是去访问第 i 个页表。

这样这个 lab 中的主要部分就搞好了，下面我们可以去 `kernel/exec.c` 中的结尾插入以下代码：

```c 
if(p->pid == 1)
    vmprint(p->pagetable, 0);
```

因为 `init` 是系统创建的第一个进程，所以 `init` 的 pid 是 1，那么在创建 init 时，我们就会打印这个页表。

然后我们就完成了。

## Detecting which pages have been accessed
> ![](/img/xv6/lab/lab3_detecting.png)
> 实现一个 `pgaccess()` 函数，这个函数的申明为：`int pgaccess(void *base, int len, void *mask);`。这个函数的主要作用就是检测**从上次调用这个函数开始**，页表是否被访问过。其中 `base` 参数是要检测的第一个页表，`len` 从这个页表开始，要检测多少个页表，而我们需要把每个页表的访问情况写到 `mask` 上。这个 `mask` 的作用和 lab2 中的 trace_mask 相同，如果当前页表被访问，那么 `mask` 中对应的位应该是 1。

因为这个 lab 的主要目的和 lab2 不一样，不是让我们熟悉系统调用的过程，所以这个系统调用已经注册好了，我们就不需要去注册一遍了。

接下来我们直接尝试在 `kernel/sysproc.c` 中实现这个函数。

首先我们的第一步一定是使用 `arg` 系列函数从用户态获取到传进来的参数（原因在 [lab2 那篇文章](/2022/07/xv6_lab2_record/)中有讲），因此有如下的代码:

```c 
pagetable_t u_pt = myproc()->pagetable;
uint64 fir_addr, mask_addr;
uint ck_siz; 
uint mask = 0;
try(argaddr(0, &fir_addr), return -1);
try(argint(1, &ck_siz), return -1);
try(argaddr(2, &mask_addr), return -1);
```

其中，`fir_addr`，`ck_siz` 和 `mask_addr` 分别对应函数申明中的三个参数。

接下来我们要考虑如何确认某个页表是否被访问过。这个就需要用到 PTE 中的标志位（[xv6 学习笔记](/2022/07/xv6_note/)那篇文章中有解释），具体如下[^1]：

> ![](/img/xv6/lab/riscv_pte_layout.png)
> Each leaf PTE contains an accessed (A) and dirty (D) bit. The A bit indicates the virtual page has been read, written, or fetched from since the last time the A bit was cleared. The D bit indicates the virtual page has been written since the last time the D bit was cleared.
> 翻译：每个叶子 PTE 有一个 accessed (a) 和 dirty (D) 标志位，标志位 A 表示从上次标志位被重置，这个虚拟地址被读写或是被使用了。标志位 D 表示自上次被重置，这个虚拟地址被写过了。

注意以上的标志位都是 risc-v 处理器去设置的，并不需要任何软件上的操作，所以我们在实现函数的时候只需要去读取标志位的信息并重置就好了。

因为我们需要检测的是这个地址是否被访问过，而不是单纯的读取，我们需要使用的是标志位 A。而 `PTE_A` 在 xv6 中还没被定义过，所以我们在 `kernel/riscv.h` 中定义一下：

```c
#define PTE_A (1L << 6) // 左移六位是看上图决定的
```

然后我们就可以在 `sys_pgaccess` 中这么写：

```c
if(ck_siz > 32){
    return -1;
}

pte_t* fir_pte = walk(u_pt, fir_addr, 0);

for(int i = 0; i < ck_siz; i++){
    if((fir_pte[i] & PTE_A) && (fir_pte[i] & PTE_V)){
        mask |= (1 << i);
        fir_pte[i] ^= PTE_A; // 复位
    }
}
```

`ck_siz` 大于 32 的话我们就没有那么多位去在 mask 中储存，所以要返回。


下面的 `walk()` 函数就比较重要了，这里不介绍具体的细节，其作用为：对于一个给定的页表和虚拟地址，`walk()` 函数会返回对应这个虚拟地址的叶子 PTE。

所以我们通过这个函数得到了第一个需要检测的页表的 PTE 的地址，`fir_pte`。

那么接下来只需要检测这个 PTE 后面 `ck_siz` 个 PTE 的 PTE_A 标志位就行了。

也就是：

```c
for(int i = 0; i < ck_siz; i++){
    if((fir_pte[i] & PTE_A) && (fir_pte[i] & PTE_V)){
        mask |= (1 << i);
        fir_pte[i] ^= PTE_A; // 复位
    }
}
```

接下来我们需要把计算出来的 `mask` 传回用户态。需要用到 `copyout()` 函数，这个函数在 [lab2 那篇文章](/2022/07/xv6_lab2_record/)解释过。

大概的用处就是，给定一个用户页表和虚拟地址，就可以把一些数据从内核态中拷到用户态中。

因此我们可以这么写：

```c
try(copyout(u_pt, (uint* )mask_addr, &mask, sizeof(uint)), return -1);
```

也就是把 `mask` 的数据拷贝到基于用户态页表的 `mask_addr` 这个地址上。

然后这个 lab 就做完了。

## 总结：
页表和虚拟地址的这些概念，说实话还是比系统调用难的。要做出这个 lab，还是得对 risc-v 中的页表实现非常清楚。我花了很久时间才弄明白。也只有做了这个 lab 才能理解页表和虚拟地址的设计的巧妙。

祝在做这个 lab 的人尽快 AC：

![](/img/xv6/lab/lab3_AC.png)




[^1]: <https://github.com/riscv/riscv-isa-manual/releases/download/Ratified-IMFDQC-and-Priv-v1.11/riscv-privileged-20190608.pdf>
