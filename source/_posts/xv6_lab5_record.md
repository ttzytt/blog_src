---
title: "[MIT 6.s081] xv6 lab5 (2020) lazy page allocation 实验记录"
date: 2022-07-28 00:00:00
updated: 2022-10-15 18:48:24
tags:
- xv6
- 2022
- UNIX
- 操作系统
- 页表
- 懒分配
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

# Lab5 (2020): lazy page allocation

## Eliminate allocation from sbrk()
> ![](/img/xv6/lab/lab5_eliminate.png)
> 删除 `sbrk()` 系统调用里实际分配内存的部分。
这个没啥好说的，直接按照提示信息，删掉对 `growproc()` 的调用就好了，如下：

```c
uint64
sys_sbrk(void)
{
  int addr;
  int n;

  if(argint(0, &n) < 0)
    return -1;
  addr = myproc()->sz;
//   if(growproc(n) < 0) <- 这里删掉实际申请内存的部分
//     return -1;
  myproc()->sz += n; // 但是把当前进程占用空间扩大
  return addr;
}
```

然后很自然的，当我们去输入 `echo hi` 的时候，就报 panic 了。


## Lazy allocation
> ![](/img/xv6/lab/lab5_lazy.png)
> 实现页表的懒分配，如果发现在陷入过程中产生了缺页错误，就给这个发生错误的地址新分配一页。

查询 riscv 的手册，以及实验提示，可以找到 scause 寄存器中储存 13 和 15 代表缺页错误（试图写入或者试图读出）：

<div align=center width=60% >
  <img src=/img/xv6/lab/riscv_exception_code.png width=60%>
</div>

那么我们在 `trap.c` 这个文件中可以查询 scause 寄存器，如果是 13 或 15 就进行下一步的处理：

```c 
……
  } else if((which_dev = devintr()) != 0){
    // ok
  } else if((r_scause() == 13 || r_scause() == 15)){
    // do something here
  }
  else {
    printf("usertrap(): unexpected scause %p pid=%d\n", r_scause(), p->pid);
    printf("            sepc=%p stval=%p\n", r_sepc(), r_stval());
    p->killed = 1;
  }
……
```

这里的处理其实就是给用户分配这一页页表，我们可以把它封装成一个函数，叫做 `lazy_alloc()`：

注意虽然发生缺页错误的是一个地址，但是我们需要把这个地址所在的页帧映射到物理地址上，所以要先用 `PGROUNDDOWN` 找到这个地址所在的页帧。
```c
int lazy_alloc(uint64 va){
  struct proc *p = myproc();
  uint64 page_sta = PGROUNDDOWN(va);
  uint64* newmem = kalloc();
  if(newmem == 0){
    return -1;
  }
  memset(newmem, 0, PGSIZE);
  if(mappages(p->pagetable, page_sta, PGSIZE, (uint64)newmem, PTE_W|PTE_R|PTE_X|PTE_U) != 0){
    kfree(newmem);
    return -1;
  }
  
  return 0;
}
```

并且，在调用 `mappages()` 映射的时候，需要注意这个页表的权限，因为是允许在用户态使用的，所以要把 `PTE_U` 设置上。

改好这些代码，我们再去执行 `echo hi`，会发现 `uvmunmap()` 这个函数会报 panic。

这是因为，我们采取页表懒分配之后，有些页可能一直都没被使用就被 `uvmunmap()` 了，这个时候，因为想要 unmap 的页根本就没有实际的分配，就会 panic，所以我们需要去修改一下 `uvmunmap()` 这个函数：

```c
void
uvmunmap(pagetable_t pagetable, uint64 va, uint64 npages, int do_free)
{
  uint64 a;
  pte_t *pte;

  if((va % PGSIZE) != 0)
    panic("uvmunmap: not aligned");

  for(a = va; a < va + npages*PGSIZE; a += PGSIZE){
    if((pte = walk(pagetable, a, 0)) == 0)
      continue; // 从 panic 改成 continue
      // panic("uvmunmap: walk");
    // 释放进程的时候会用到 uvmunmap，但是有可能释放的时候这个页根本就没实际被分配
    if((*pte & PTE_V) == 0)
      continue; // 从 panic 改成 continue
    //   panic("uvmunmap: not mapped");
    if(PTE_FLAGS(*pte) == PTE_V)
      panic("uvmunmap: not a leaf");
    if(do_free){
      uint64 pa = PTE2PA(*pte);
      kfree((void*)pa);
    }
    *pte = 0;
  }
}
```

然后这个 lab 就可以顺利完成了。


## Lazytests and Usertests (moderate)
> ![](/img/xv6/lab/lab5_utest.png)
> 让前面写出来的 Lazy allocation 通过 usertests 和 lazytests。

我们刚刚写出来的懒分配实际上是有些 bug 的，这个 lab 就是让我们修复这些 bug，然后通过 lazytests 和 usertests。

可以根据提示一个一个的改，首先需要处理 `sbrk()` 函数的参数为负数的情况。

对于正数的情况，我们只是改变进程的大小属性，并不会去实际分配空间。但如果是负数（减少当前进程空间），我们需要实际的释放空间，要不然就没法把这些内存分配给别的需要的进程，所以可以这样写：

```c  
uint64
sys_sbrk(void)
{
  int addr;
  int n;
  struct proc *p = myproc();
  if(argint(0, &n) < 0)
    return -1;
  addr = p->sz;
  if(n < 0){
    if(p->sz + n < 0){ // 一个进程不能释放比自己大的空间
      return -1;
    }
    if(growproc(n) < 0){
      // 注意这里是实际调用 growproc 去释放空间的。
      printf("growproc err\n");
      return -1;
    }
  }else{
    myproc()->sz += n;
  }
  // if(growproc(n) < 0) 
  //   return -1;
  return addr;
}
```

下一个提示是：
> Kill a process if it page-faults on a virtual memory address higher than any allocated with `sbrk()`.

大概就是说，如果一个进程出现缺页错误的地址以前并没有被分配过（通过调用 `sbrk()`）。那么我们就不应该去分配这个页，而是直接把进程 kill 了。

可以写一个函数，用来判某个虚拟地址是否属于合法的懒分配页：

```c 
int is_lazy_addr(uint64 va){
  struct proc *p = myproc();
  if(va < PGROUNDDOWN(p->trapframe->sp)
  && va >= PGROUNDDOWN(p->trapframe->sp) - PGSIZE
  ){
    // 防止 guard page，这个之后会提到
    return 0;
  }
  if(va > MAXVA){
    return 0;
  }
  pte_t* pte = walk(p->pagetable, va, 0);
  
  if(pte && (*pte & PTE_V)){
    return 0;
  }  

  if(va >= p->sz){
    return 0;
  }

  return 1;
}
```

首先，很明显的一点是，如果一个页有 `PTE_V` 的标志，那么一定不是懒分配的，因为已经分配了。

然后，如果 `va >= p->sz`，就说明这个地址之前没有通过 `sbrk()` 申请，所以也不是懒分配。

之后再把这个函数加到 `trap.c` 的判断中，就变成了：

```c
……
  } else if((which_dev = devintr()) != 0){
    // ok
  } else if((r_scause() == 13 || r_scause() == 15) && is_lazy_addr(r_stval())){ // 这里加了一个 is_lazy_addr
    // 如果是 page fault，那就直接分配内存
    uint64 fault_addr = r_stval();
      if(lazy_alloc(fault_addr) < 0){
        p->killed = 1;
      }
  }
  else {
    printf("usertrap(): unexpected scause %p pid=%d\n", r_scause(), p->pid);
    printf("            sepc=%p stval=%p\n", r_sepc(), r_stval());
    p->killed = 1;
  }
……
```

接下来要解决的是：

> Handle the parent-to-child memory copy in fork() correctly.

大概是说需要正确的处理 `fork()` 中从父进程到子进程的内存拷贝。

阅读 `fork()` 的代码后可以发现，执行这个内存拷贝的函数是 `vm.c` 中的 `uvmcopy()`。其在懒分配中出现问题的原因是，父进程的某些页帧是没有实际分配的，这个时候再试图去拷贝这个页帧，`uvmcopy()` 函数就会报 panic。和之前处理 `uvmunmap()` 函数一样，这里我们只需要跳过那些懒分配的页就行了，所以直接把 `panic` 改成 `continue`：

```c 
int
uvmcopy(pagetable_t old, pagetable_t new, uint64 sz)
{
  pte_t *pte;
  uint64 pa, i;
  uint flags;
  char *mem;

  for(i = 0; i < sz; i += PGSIZE){
    if((pte = walk(old, i, 0)) == 0)
      continue;   // 注意这里，panic 改成了 continue。
      // panic("uvmcopy: pte should exist");
    if((*pte & PTE_V) == 0)
      continue;
      // panic("uvmcopy: page not present");
    pa = PTE2PA(*pte);
    flags = PTE_FLAGS(*pte);
    if((mem = kalloc()) == 0)
      goto err;
    memmove(mem, (char*)pa, PGSIZE);
    if(mappages(new, i, PGSIZE, (uint64)mem, flags) != 0){
      kfree(mem);
      goto err;
    }
  }
  return 0;

 err:
  uvmunmap(new, 0, i / PGSIZE, 1);
  return -1;
}
```

> Handle the case in which a process passes a valid address from sbrk() to a system call such as read or write, but the memory for that address has not yet been allocated.

这个提示说说实话挺难理解的，我当时在网上查了好久才搞懂。这大概就是说，有些系统调用会在用户态的虚拟地址上写值，比如说 `write()`。那万一这个地址是一个懒分配的地址，就会出问题，会引起缺页错误。当然，如果是用户态引起的缺页错误（像之前的一样）就完全没问题。但是如果我们发现内核态出现了异常，会直接 panic （见 xv6 学习笔记那篇文章）。

如果系统调用想要往用户态的虚拟地址写值（或者读值），是需要调用 `copyin()` 和 `copyout()` 的。可以观察一下这两个函数：

```c 
// Copy from user to kernel.
// Copy len bytes to dst from virtual address srcva in a given page table.
// Return 0 on success, -1 on error.
int
copyin(pagetable_t pagetable, char *dst, uint64 srcva, uint64 len)
{
  uint64 n, va0, pa0;

  while(len > 0){
    va0 = PGROUNDDOWN(srcva);
    pa0 = walkaddr(pagetable, va0); // 注意这里
    if(pa0 == 0)
      return -1;
    n = PGSIZE - (srcva - va0);
    if(n > len)
      n = len;
    memmove(dst, (void *)(pa0 + (srcva - va0)), n);

    len -= n;
    dst += n;
    srcva = va0 + PGSIZE;
  }
  return 0;
}
```

能发现，它们都会调用 `walkaddr()` 来找到用户态虚拟地址对应的物理地址，而 `walkaddr()` 的实现如下：

```c
// Look up a virtual address, return the physical address,
// or 0 if not mapped.
// Can only be used to look up user pages.
uint64
walkaddr(pagetable_t pagetable, uint64 va)
{
  pte_t *pte;
  uint64 pa;

  if(va >= MAXVA)
    return 0;

  pte = walk(pagetable, va, 0);
  
  if(pte == 0)
    return 0;
  if((*pte & PTE_V) == 0)
    return 0;
  if((*pte & PTE_U) == 0)
    return 0;
  pa = PTE2PA(*pte);
  return pa;
}
```

可以发现 `walkaddr()` 会调用 `walk()` ，而如果得到的结果是 0，就会直接返回 0。

我们还可以从 `walkaddr()` 函数作用的角度去理解。因为这个函数是用于查找虚拟地址对应的物理地址的，那一个懒分配的页帧并没有实际的物理地址，就自然找不到物理地址，所以会返回一个 0 。

也就是，如果 `va` 属于一个懒分配的页帧，这个 `walk()` 一定是会返回 0 的，具体可以看下面的代码：

```c 
pte_t *
walk(pagetable_t pagetable, uint64 va, int alloc)
{
  if(va >= MAXVA)
    panic("walk");

  for(int level = 2; level > 0; level--) {
    pte_t *pte = &pagetable[PX(level, va)];
    if(*pte & PTE_V) { // 这里会判断是否为分配过的地址，
                       // 如果没分配过并且 alloc 参数还为 0，就会返回 0
      pagetable = (pagetable_t)PTE2PA(*pte);
    } else {
      if(!alloc || (pagetable = (pde_t*)kalloc()) == 0)
        return 0;
      memset(pagetable, 0, PGSIZE);
      *pte = PA2PTE(pagetable) | PTE_V;
    }
  }
  return &pagetable[PX(0, va)];
}
```

那我们可以在 `walkaddr()` 中判断，当前 `va` 是否属于懒分配的页帧，如果是的话就先别返回 0，而是先给它分配一个物理页，然后再进行后面的操作。（分配完物理页后就能查询到物理地址了）。

```c
// Look up a virtual address, return the physical address,
// or 0 if not mapped.
// Can only be used to look up user pages.
uint64
walkaddr(pagetable_t pagetable, uint64 va)
{
  pte_t *pte;
  uint64 pa;

  if(va >= MAXVA)
    return 0;
  
  if(is_lazy_addr(va)){ // 注意这里，如果是懒分配的会先分配物理地址。
    lazy_alloc(va);
  }
  pte = walk(pagetable, va, 0);
  
  if(pte == 0)
    return 0;
  if((*pte & PTE_V) == 0)
    return 0;
  if((*pte & PTE_U) == 0)
    return 0;
  pa = PTE2PA(*pte);
  return pa;
}
```


再看第五个提示：

> Handle out-of-memory correctly: if kalloc() fails in the page fault handler, kill the current process.

也就是如果分配物理页的时候，没有足够内存了，应该把当前进程 kill 了。

其实这个东西我们已经完成了，在 `trap.c` 中，是这样写的：

```c 
uint64 fault_addr = r_stval();
if(lazy_alloc(fault_addr) < 0){
  p->killed = 1;
}
```

如果 `lazy_alloc()` 不成功（没内存）就会把进程 kill 了。

然后是最后一个提示：

> Handle faults on the invalid page below the user stack.

也就是正确处理发生在用户栈下面地址的缺页错误。

这个就需要复习下页表那章的内容了，下图是用户态下的内存布局：

![](/img/xv6/note/user_pagetable.png)

可以看到，栈下面是一个保护页，这个页的 `PTE_V` 是没有设置的，如果用户访问，就会触发缺页错误。本来这个机制是没啥问题的，但是我们现在搞了懒分配，也就是触发缺页错误的时候不会 kill 掉这个进程，而是给这个地方分配物理地址。

那显然这个保护页是用于防止内存溢出的，不能去再分配物理页。所以需要在 `is_lazy_addr()` 这个函数中加入这个判断，如果某个地址属于保护页，那就不是一个合法的懒分配的地址，然后就有了下面的代码：

```c 
if(va < PGROUNDDOWN(p->trapframe->sp)            // 这里使用了用户栈的栈指针 sp 来判断用户栈的虚拟地址
                                                 // 因为用户栈的下面就是保护页，所以把 
                                                 // PGROUNDDOWN(p->trapframe->sp) 当作保护页的上界
&& va >= PGROUNDDOWN(p->trapframe->sp) - PGSIZE
){
  return 0;
}
```

这样写完之后就可以成功 AC 了，也祝在做这个 lab 的人尽快 AC：

![](/img/xv6/lab/lab5_AC.png)

## 总结
感觉要提升下 debug 的能力，这个 lab 真的调了好久……
