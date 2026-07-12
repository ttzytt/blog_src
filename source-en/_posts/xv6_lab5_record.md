---
title: "[MIT 6.s081] xv6 Lab 5 (2020): Lazy Page Allocation Record"
date: 2022-07-28 00:00:00
updated: 2022-10-15 18:48:24
tags:
- xv6
- 2022
- UNIX
- Operating Systems
- Page Tables
- Lazy Allocation
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/07/xv6_lab5_record/).
{% endnote %}

Update on 2022/9/14: I recently put the lab code on GitHub. If you need a reference, you can find it here:

<https://github.com/ttzytt/xv6-riscv>

The different branches contain the different labs.

---

# Lab 5 (2020): lazy page allocation

## Eliminate allocation from sbrk()

> ![](/img/xv6/lab/lab5_eliminate.png)
> Remove the part of the `sbrk()` system call that actually allocates memory.

There is not much to explain here. Follow the hint and remove the call to `growproc()`:

```c
uint64
sys_sbrk(void)
{
  int addr;
  int n;

  if(argint(0, &n) < 0)
    return -1;
  addr = myproc()->sz;
//   if(growproc(n) < 0) <- Remove the actual memory allocation here
//     return -1;
  myproc()->sz += n; // Still enlarge the current process's recorded size
  return addr;
}
```

Naturally, entering `echo hi` afterward produces a panic.

## Lazy allocation

> ![](/img/xv6/lab/lab5_lazy.png)
> Implement lazy allocation for page tables. When a page fault occurs during trap handling, allocate a page for the faulting address.

The RISC-V manual and lab hints show that values 13 and 15 in the scause register represent page faults caused by attempted reads or writes:

<div align=center width=60% >
  <img src=/img/xv6/lab/riscv_exception_code.png width=60%>
</div>

In `trap.c`, inspect scause and perform additional handling when it is 13 or 15:

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

The required handling allocates the missing user page. We can encapsulate it in a function named `lazy_alloc()`.

Although a page fault reports an address, the entire page frame containing that address must be mapped to physical memory. Use `PGROUNDDOWN` first to find the beginning of that frame.

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

When calling `mappages()`, pay attention to the permissions. The page is accessible from user mode, so PTE_U must be set.

After these changes, running `echo hi` produces a panic in `uvmunmap()`.

With lazy allocation, some pages may never be used before `uvmunmap()` attempts to remove them. Because such pages were never physically allocated, unmapping them causes a panic. We therefore need to modify `uvmunmap()`:

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
      continue; // Change panic to continue
      // panic("uvmunmap: walk");
    // uvmunmap is used while releasing a process, but this page may never have been allocated
    if((*pte & PTE_V) == 0)
      continue; // Change panic to continue
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

This completes the basic part of the lab.

## Lazytests and Usertests (moderate)

> ![](/img/xv6/lab/lab5_utest.png)
> Make the lazy allocation implementation pass `usertests` and `lazytests`.

The lazy allocator just written still contains several bugs. This exercise asks us to fix them and pass both test suites.

The hints can be handled one at a time. First, support a negative argument to `sbrk()`.

For a positive amount, we change only the process-size field and do not allocate actual space. For a negative amount, which reduces the process size, memory must truly be released so that other processes can use it. The implementation can be written as follows:

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
    if(p->sz + n < 0){ // A process cannot release more space than it owns
      return -1;
    }
    if(growproc(n) < 0){
      // growproc is actually called here to release space.
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

The next hint is:

> Kill a process if it page-faults on a virtual memory address higher than any allocated with `sbrk()`.

That is, when the faulting address was never allocated through `sbrk()`, the kernel must not allocate a page there; it should kill the process instead.

We can write a helper that determines whether a virtual address belongs to a valid lazily allocated page:

```c 
int is_lazy_addr(uint64 va){
  struct proc *p = myproc();
  if(va < PGROUNDDOWN(p->trapframe->sp)
  && va >= PGROUNDDOWN(p->trapframe->sp) - PGSIZE
  ){
    // Exclude the guard page, which is discussed later
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

First, a page with PTE_V set is clearly not lazily allocated because it already has a valid mapping.

Next, if `va >= p->sz`, the address was never requested through `sbrk()`, so it is not a valid lazy-allocation address.

Adding this helper to the condition in `trap.c` gives:

```c
……
  } else if((which_dev = devintr()) != 0){
    // ok
  } else if((r_scause() == 13 || r_scause() == 15) && is_lazy_addr(r_stval())){ // Add is_lazy_addr here
    // Allocate memory directly for a page fault
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

The next requirement is:

> Handle the parent-to-child memory copy in fork() correctly.

This means that memory copying from the parent into the child during `fork()` must work with lazily allocated pages.

Reading `fork()` shows that `uvmcopy()` in `vm.c` performs this copy. It fails under lazy allocation because some parent page frames have never actually been allocated, and trying to copy them causes a panic. As with `uvmunmap()`, skip such lazy pages by replacing the panics with `continue`:

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
      continue;   // Change panic to continue here.
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

The next hint says:

> Handle the case in which a process passes a valid address from sbrk() to a system call such as read or write, but the memory for that address has not yet been allocated.

This hint was honestly hard to understand, and I searched online for a long time. Some system calls write data to a user virtual address, such as `write()`. If that address is lazy, the access causes a page fault. A user-mode page fault is fine because our handler deals with it. A kernel-mode exception, however, causes an immediate panic, as explained in the xv6 notes.

System calls use `copyin()` and `copyout()` to read or write user virtual addresses. Examine one of these functions:

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
    pa0 = walkaddr(pagetable, va0); // Notice this line
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

Both functions call `walkaddr()` to find the physical address corresponding to a user virtual address. `walkaddr()` is implemented as:

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

`walkaddr()` calls `walk()` and returns zero immediately when no mapping is found.

The behavior also makes sense from the function's purpose. A lazily allocated page frame does not yet have any physical address, so looking up that address naturally returns zero.

If `va` belongs to a lazy page, `walk()` necessarily returns zero. The following implementation shows why:

```c 
pte_t *
walk(pagetable_t pagetable, uint64 va, int alloc)
{
  if(va >= MAXVA)
    panic("walk");

  for(int level = 2; level > 0; level--) {
    pte_t *pte = &pagetable[PX(level, va)];
    if(*pte & PTE_V) { // Check whether the address has been allocated.
                       // If not and alloc is zero, return zero.
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

We can modify `walkaddr()` to check whether the current `va` belongs to a lazy page. If it does, allocate a physical page before returning zero and then continue the normal lookup. Once physical memory has been allocated, its address can be found.

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
  
  if(is_lazy_addr(va)){ // If this is lazy allocation, allocate physical memory first.
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


The fifth hint is:

> Handle out-of-memory correctly: if kalloc() fails in the page fault handler, kill the current process.

In other words, if no physical page is available, kill the current process.

This is already implemented in `trap.c`:

```c 
uint64 fault_addr = r_stval();
if(lazy_alloc(fault_addr) < 0){
  p->killed = 1;
}
```

If `lazy_alloc()` fails because memory is exhausted, the process is killed.

The final hint is:

> Handle faults on the invalid page below the user stack.

This requires reviewing the page-table chapter. The following diagram shows the user-mode memory layout:

![](/img/xv6/note/user_pagetable.png)

Immediately below the stack is a guard page whose PTE_V bit is not set. Accessing it from user mode triggers a page fault. That mechanism worked before, but lazy allocation now responds to a fault by allocating physical memory rather than killing the process.

The guard page exists to prevent memory overflow and must not receive a physical page. Add a test to `is_lazy_addr()`: if an address belongs to the guard page, it is not a valid lazy-allocation address.

```c 
if(va < PGROUNDDOWN(p->trapframe->sp)            // Use the user stack pointer sp to locate the stack's virtual address.
                                                 // The guard page is immediately below the stack, so use
                                                 // PGROUNDDOWN(p->trapframe->sp) as its upper boundary.
&& va >= PGROUNDDOWN(p->trapframe->sp) - PGSIZE
){
  return 0;
}
```

After this change, the tests pass. I wish everyone working on this lab an early AC:

![](/img/xv6/lab/lab5_AC.png)

## Summary

I need to improve my debugging ability. This lab genuinely took me a very long time to debug...
