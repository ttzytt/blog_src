---
title: "[MIT 6.s081] xv6 lab6 COW 实验记录"
date: 2022-07-29 00:00:00
updated: 2022-10-15 18:48:28
tags:
- xv6
- 2022
- UNIX
- 操作系统
- 页表
- 写时复制（COW）
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

# Lab6: Copy-on-Write Fork for xv6

> ![](/img/xv6/lab/lab6_cow.png)

这个 lab 的描述属实是简洁，其实他主要的描述在前面：

> **The problem**
> The fork() system call in xv6 copies all of the parent process's user-space memory into the child. If the parent is large, copying can take a long time. Worse, the work is often largely wasted; for example, a fork() followed by exec() in the child will cause the child to discard the copied memory, probably without ever using most of it. On the other hand, if both parent and child use a page, and one or both writes it, a copy is truly needed.
> **The solution**
> The goal of copy-on-write (COW) fork() is to defer allocating and copying physical memory pages for the child until the copies are actually needed, if ever.
> COW fork() creates just a pagetable for the child, with PTEs for user memory pointing to the parent's physical pages. COW fork() marks all the user PTEs in both parent and child as not writable. When either process tries to write one of these COW pages, the CPU will force a page fault. The kernel page-fault handler detects this case, allocates a page of physical memory for the faulting process, copies the original page into the new page, and modifies the relevant PTE in the faulting process to refer to the new page, this time with the PTE marked writeable. When the page fault handler returns, the user process will be able to write its copy of the page.
> COW fork() makes freeing of the physical pages that implement user memory a little trickier. A given physical page may be referred to by multiple processes' page tables, and should be freed only when the last reference disappears.

大概就是说我们需要实现 UNIX 中的写时复制技术 （copy on write）。在没有写时复制的系统中，调用 `fork()` 时，我们会把父进程的所有的内存都拷贝到子进程的空间，自然，这个耗时是巨大且不可接受的。

并且在实际应用中，`fork()` 时拷贝的大部分内存都时不会被用到的，比如，在 UNIX 中新建一个进程的通常会先调用 `fork()`，然后调用 `exec()`。那么原先复制过来的数据就全部没用了。

在 `fork()` 时，只有一种情况是需要复制内存的。就是写入数据时，如果父进程或子进程尝试往某个地址写入值，那么为了确保写入的这个值不会影响别的进程，我们需要复制这个页帧。

而写时复制就是这样的一个技术，我们会把父进程和子进程共享页帧的 PTE 标为不可写的。那么有任何一个进程尝试往这个页帧写入时，就会产生缺页错误。在 `usertrap()` 函数中，我们可以处理这样的情况，也就是把共享页帧复制一份给尝试写入的进程，这个被复制的页帧会被标记为可写的。

实现写时复制后，可能会有多个进程同时共享一个页帧，那么只有所有的进程都不需要这个共享页帧时，我们才能真正的释放这个页帧。

然后就可以根据提示一点一点实现了：

## uvmcopy()
> Modify `uvmcopy()` to map the parent's physical pages into the child, instead of allocating new pages. Clear PTE_W in the PTEs of both child and parent.
> 修改 `uvmcopy()`，把父进程的物理内存直接映射到子进程的虚拟内存上，而不是去分配新的内存。清除父进程和子进程 PTE 的 PTE_W。

修改 `uvmcopy()` 后，子进程和父进程相当于共享内存了，然后我们希望任何一方试图写入共享内存时都会引发缺页错误，所以要清楚 PTE_W：

```c 
// Given a parent process's page table, copy
// its memory into a child's page table.
// Copies both the page table and the
// physical memory.
// returns 0 on success, -1 on failure.
// frees any allocated pages on failure.
int
uvmcopy(pagetable_t old, pagetable_t new, uint64 sz)
{
  pte_t *pte;
  uint64 pa, i;
  uint flags;
  char *mem;

  for(i = 0; i < sz; i += PGSIZE){
    if((pte = walk(old, i, 0)) == 0)
      panic("uvmcopy: pte should exist");
    if((*pte & PTE_V) == 0)
      panic("uvmcopy: page not present");
    pa = PTE2PA(*pte);

    *pte &= (~PTE_W); // 这里清除了 PTE_W
    *pte |= PTE_C;    // 添加 PTE_C 代表这是一个 COW 页，之后会讲
    flags = PTE_FLAGS(*pte);
    // if((mem = kalloc()) == 0)  这里都是实际分配内存的，需要删除
    //   goto err;
    // memmove(mem, (char*)pa, PGSIZE);
    if(mappages(new, i, PGSIZE, (uint64)pa, flags) != 0){ 
      // 这里并没有把虚拟地址 i 映射到新分配的物理地址 mem
      // 而是映射到了父进程的物理内存 pa 上
      printf("uvmcopy failed\n");
      kfree(mem);
      goto err;
    }
    refcnt_inc(pa); // 这个东西之后会讲
  }
  return 0;

 err:
  uvmunmap(new, 0, i / PGSIZE, 1);
  return -1;
}
```

## usertrap()
> Modify `usertrap()` to recognize page faults. When a page-fault occurs on a COW page, allocate a new page with kalloc(), copy the old page to the new page, and install the new page in the PTE with PTE_W set.
> 修改 `usertrap()` 来处理缺页错误。如果缺页错误发生在 COW 页上，就分配一个新的物理页，拷贝原页帧的数据到新页，并设置新页的 PTE_W。

和页表懒分配那个 lab 类似，我们也需要有一个函数判断某个虚拟地址是否是合法的，未分配的 COW 页。这个提示中说到了只有缺页错误**发生在 COW 页**上才能分配新的物理页。那么我们如何判断当前页是否是一个合法的 COW 页呢？这就可以利用 riscv PTE 中的保留位了。我们知道每个 PTE 中有 10 个标志位，其中已经定义了的有 8 个，剩下 10 个就是保留位，如下：

![](/img/xv6/lab/riscv_pte_layout.png)

其中的 RSW 位，也就是 8 和 9 位就是保留位。

我们可以定义第 8 位为 1 的就说明当前页帧是 COW 页，所以可以在 `kernel/riscv.h` 中加入如下的宏定义，同时，这也解答了为什么我们之前要在 `uvmcopy()` 中给子进程的 PTE 设置 PTE_C：

```c 
#define PTE_V (1L << 0) // valid
#define PTE_R (1L << 1)
#define PTE_W (1L << 2)
#define PTE_X (1L << 3)
#define PTE_U (1L << 4) // 1 -> user can access
#define PTE_C (1L << 8) // 这里是新加的
```

然后判断是否为未分配 COW 页的函数如下，和懒分配页表那个 lab 一样，我放在了 `vm.c` 这个文件中：

```c 
int uncopied_cow(pagetable_t pgtbl, uint64 va){
  if(va >= MAXVA) 
    return 0;
  pte_t* pte = walk(pgtbl, va, 0);
  if(pte == 0)             // 如果这个页不存在
    return 0;
  if((*pte & PTE_V) == 0)
    return 0;
  if((*pte & PTE_U) == 0)
    return 0;
  return ((*pte) & PTE_C); // 有 PTE_C 的代表还没复制过，并且是 cow 页
}
```

接下来就可以修改 `usertrap()` 了：

```c 
……
  syscall();
  } else if((which_dev = devintr()) != 0){
    // ok
  } else if(r_scause() == 15 && uncopied_cow(p->pagetable, r_stval())){ 
    if(cowalloc(p->pagetable, r_stval()) < 0){
      p->killed = 1;
    }
  } else {
    printf("usertrap(): unexpected scause %p pid=%d\n", r_scause(), p->pid);
    printf("            sepc=%p stval=%p\n", r_sepc(), r_stval());
    p->killed = 1;
  }
……
```

注意这里有一个和页表懒分配 lab 不一样的点，就是我们只会处理 scause 寄存器为 15 的情况，根据 riscv 的文档：

<div align=center width=60% >
  <img src=/img/xv6/lab/riscv_exception_code.png width=60%>
</div>

scause 为 15 代表尝试写入引发的缺页错误。 

然后我们发现当前页是合法的 COW 页之后，就需要给这个 COW 页分配物理内存，这里也和上一个 lab 一样，我封装了一个 `cowalloc()` 函数：

```c 
int cowalloc(pagetable_t pgtbl, uint64 va){
  pte_t* pte = walk(pgtbl, va, 0);
  uint64 perm = PTE_FLAGS(*pte);

  if(pte == 0) return -1;
  uint64 prev_sta = PTE2PA(*pte); // 这里的 prev_sta 就是这个页帧原来使用的父进程的页表
                                  // 这里写 sta 是因为这个地址是和页帧对齐的（page-aligned）
                                  // 所以写个 sta 表示一个页帧的开始
  uint64 newpage = kalloc();     
  if(!newpage){
    return -1;
  }
  uint64 va_sta = PGROUNDDOWN(va); // 当前页帧

  perm &= (~PTE_C); // 复制之后就不是合法的 COW 页了
  perm |= PTE_W;    // 复制之后就可以写了

  memmove(newpage, prev_sta, PGSIZE); // 把父进程页帧的数据复制一遍
  uvmunmap(pgtbl, va_sta, 1, 1);      // 然后取消对父进程页帧的映射
  
  if(mappages(pgtbl, va_sta, PGSIZE, (uint64)newpage, perm) < 0){
    kfree(newpage);
    return -1;
  }
  return 0;
}
```

这里需要注意一点，我们这个 `memmove()` 必须在 `uvmunmap()` 的前面（我当时调了好久）因为 `uvmunmap()` 之后这个父进程的物理页可能就被释放了，这个时候 `memmove()` 得到的是无效的数据。

看完这段程序之后，你可能会发现一个问题，就是这个父进程的页表可能被不止一个子进程共享，那我们调用 `uvmunmap()`，并且 `do_free` 参数还是 1，这个父进程页帧不就可能会被释放吗，然后其他使用这个页帧的进程就会出问题。

这就引出了 lab 的下一个提示：

## reference count （引用记数）

> Ensure that each physical page is freed when the last PTE reference to it goes away -- but not before. A good way to do this is to keep, for each physical page, a "reference count" of the number of user page tables that refer to that page. Set a page's reference count to one when `kalloc()` allocates it. Increment a page's reference count when fork causes a child to share the page, and decrement a page's count each time any process drops the page from its page table. `kfree()` should only place a page back on the free list if its reference count is zero. It's OK to to keep these counts in a fixed-size array of integers. You'll have to work out a scheme for how to index the array and how to choose its size. For example, you could index the array with the page's physical address divided by 4096, and give the array a number of elements equal to highest physical address of any page placed on the free list by `kinit()` in kalloc.c.

也就是说，我们需要使用引用计数来解决这个问题。对于每个页帧，都有一个引用计数，代表有多少个 COW 页正在使用这个页。那如果没有任何 COW 页还在使用这个页帧，我们就可以真正的释放这个页了（有点类似 `close()` 函数）。在 `kalloc()` 函数中，我们会把一个页的引用计数设为 1。然后在 `kalloc()` 函数中，我们需要先减少这个页的引用计数，如果减少后为 0，就可以直接释放这个页。

然后我们可以思考下如何储存这些引用计数，因为每个页帧的起始位置肯定都是能被 4096 整除的，所以我们可以直接把每个页帧的地址除以 4096 作为其编号。

那就可以写出如下的宏：

```c 
#define PG2REFIDX(_pa) ((((uint64)_pa) - KERNBASE) / PGSIZE)
#define MX_PGIDX PG2REFIDX(PHYSTOP)
#define PG_REFCNT(_pa) pg_refcnt[PG2REFIDX((_pa))]

int pg_refcnt[MX_PGIDX];
```

最好照着下面这张图来理解：

![](/img/xv6/note/kernel_pagetable.png)

里面的 PHYSTOP 和 KERNBASE 代表着内存物理地址的起始和结束，所以我们要把 pa 减去 KERNBASE 后再除以 PGSIZE。

我刚开始还很疑惑，我们在内核中开了这个数组，是存在哪里的。其实可以看下 `kinit()` 的实现：

```c 
void
kinit()
{
  initlock(&kmem.lock, "kmem");
  freerange(end, (void*)PHYSTOP); // 注意这里
}
```

这里的 `end` 是上图中 Free memory 的开始，定义在 `kernle.ld` 中，也就是说，对于内核自己的数据和代码（包括这个数组），是存在 kernel text 和 kernel data 中的，而 `kalloc()` 函数只会去分配 end ~ PHYSTOP 中的内存。

接下来就可以基于引用计数开始修改 `kalloc.c` 中的各种函数了：

首先是 `kalloc()`：

```c  
void *
kalloc(void)
{
  struct run *r;

  acquire(&kmem.lock);
  r = kmem.freelist;
  if(r){
    kmem.freelist = r->next;
  }
  release(&kmem.lock);

  if(r){
    memset((char*)r, 5, PGSIZE); // fill with junk
    PG_REFCNT(r) = 1;            
    // 注意这里，分配时总共有一个进程使用这个页帧，所以置为 1 。
  }
  return (void*)r;
}
```

接下来是 `kfree()`：

```c 
void
kfree(void *pa)
{
  struct run *r;

  if(((uint64)pa % PGSIZE) != 0 || (char*)pa < end || (uint64)pa >= PHYSTOP)
    panic("kfree");

  acquire(&refcnt_lock);
  if(--PG_REFCNT(pa) <= 0){ // 先减少引用计数，如果小于等于 0 就真的释放
    memset(pa, 1, PGSIZE);
    // Fill with junk to catch dangling refs.
    r = (struct run*)pa;
    acquire(&kmem.lock);
    r->next = kmem.freelist;
    kmem.freelist = r;
    release(&kmem.lock);
  }
  release(&refcnt_lock);
}
```

其中的 `refcnt_lock` 是一个锁，其初始化在 `kinit()` 中：

```c
void
kinit()
{
  initlock(&kmem.lock, "kmem");
  initlock(&refcnt_lock, "ref cnt"); // here
  freerange(end, (void*)PHYSTOP);
}
```

这里加锁是因为可能有多个引用某个页的进程同时 `kfree()` 这个页，那么他们同时减少引用计数就会造成错误的结果。

然后在 `uvmcopy()` 中，我们需要增加父进程页帧的引用计数（多一个进程在共享这个页帧），所以在 `mappages()` 后面写了 `refcnt_inc()`，其定义如下：

```c 
void refcnt_inc(void* pa){
  acquire(&refcnt_lock);
  PG_REFCNT(pa)++;
  release(&refcnt_lock);
} 
```

然后我们就完成了实现了引用计数的部分。

最后，还有一个提示：

## copyout()

修改 `copyout()` 的原因和上一个 lab 很类似，主要是因为有些系统调用也会去往 COW 页上写数据。因为 COW 页的 PTE_W 没有设置，就会引发缺页错误。在 `trap.c` 中，我们规定了如果异常是从系统调用发生的，就会直接 panic。所以在 `copyout()` 的时候，如果我们发现了当前页是 COW 页，就直接给他分配一个新的页。

这个 lab 不需要和上一个 lab 一样，修改 `copyin` 是因为，我们 `copyin()` 时，实际上读取的是父进程共享给我们的页帧，但是在页表懒分配的 lab 中，`copyin()` 时的页帧根本就没有分配一个物理地址，当然是无法读入的。

所以可以这样修改 `copyout()`：

```c 
// Copy from kernel to user.
// Copy len bytes from src to virtual address dstva in a given page table.
// Return 0 on success, -1 on error.
int
copyout(pagetable_t pagetable, uint64 dstva, char *src, uint64 len)
{
  uint64 n, va0, pa0;

  while(len > 0){
    va0 = PGROUNDDOWN(dstva); 
    if(uncopied_cow(pagetable, va0)){          // 注意这里是新加的
      try(cowalloc(pagetable, va0), return -1);
    }
    pa0 = walkaddr(pagetable, va0);
    if(pa0 == 0)
      return -1;
    n = PGSIZE - (dstva - va0);
    if(n > len)
      n = len;
    memmove((void *)(pa0 + (dstva - va0)), src, n);

    len -= n;
    src += n;
    dstva = va0 + PGSIZE;
  }
  return 0;
}
```

然后写这个函数的时候一定要注意一个点，就是 `cowalloc()` 和 `walkaddr()` 的顺序。我之前就写错了，然后调了好久才找到问题。如果我们在 `cowalloc()` 之前用 `walkaddr()` 来查找虚拟地址对应的物理地址，查到的物理地址其实是父进程的共享页帧。

那么到时候就会往这个地址里写东西，造成错误（别的进程也会使用这个页帧）。

而在 `cowalloc()` 之后查找物理地址，查到的就是新分配的物理地址，写入的也是当前进程独有的页帧，不会影响别的进程。

然后写完这个，lab 就能 AC 了，如下，也祝在做这个 lab 的人尽快 AC：

![](/img/xv6/lab/lab6_AC.png)

## 总结
真不知道为什么一些傻逼错误用 gdb 调了那么久还没发现………… 都开始怀疑编译器出错了。以后写之前还是得先想明白了再写，要不然你写了错的东西，debug 的时候也往错的方向想，那这个 bug 就永远找不出来了。
