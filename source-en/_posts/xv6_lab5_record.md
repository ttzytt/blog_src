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

Update (2022/9/14): I recently put the lab code on GitHub. If you need a reference, see <https://github.com/ttzytt/xv6-riscv>. Different branches correspond to different labs.

# Lab 5 (2020): Lazy Page Allocation

## Eliminate Allocation from `sbrk()`
> ![](/img/xv6/lab/lab5_eliminate.png)
> Remove the part that actually allocates memory from the `sbrk()` system call.

Following the prompt, delete the call to `growproc()`:
```c
uint64
sys_sbrk(void)
{
  int addr;
  int n;
  if(argint(0, &n) < 0) return -1;
  addr = myproc()->sz;
  // growproc(n) is intentionally not called: allocation is lazy.
  myproc()->sz += n; // Increase the address-space size.
  return addr;
}
```
Naturally, entering `echo hi` now causes a panic.

## Lazy Allocation
> ![](/img/xv6/lab/lab5_lazy.png)
> Implement lazy page-table allocation: when a page fault occurs, allocate a page for the faulting address.

The RISC-V manual and the lab hints show that `scause` values 13 and 15 represent page faults (an attempted read or write):
<div align=center width=60% ><img src=/img/xv6/lab/riscv_exception_code.png width=60%></div>

Handle these values in `trap.c`, and allocate the page containing the fault address. Use `PGROUNDDOWN` first because the fault address must be rounded to its page frame:
```c
int lazy_alloc(uint64 va){
  struct proc *p = myproc();
  uint64 page_sta = PGROUNDDOWN(va);
  uint64* newmem = kalloc();
  if(newmem == 0) return -1;
  memset(newmem, 0, PGSIZE);
  if(mappages(p->pagetable, page_sta, PGSIZE, (uint64)newmem,
              PTE_W|PTE_R|PTE_X|PTE_U) != 0){
    kfree(newmem); return -1;
  }
  return 0;
}
```
Since the page is user-accessible, set `PTE_U`. After this, `uvmunmap()` panics because some never-used lazy pages have no physical allocation. Change the relevant `panic` cases to `continue` and skip invalid or non-present PTEs.

## Lazytests and Usertests (moderate)
> ![](/img/xv6/lab/lab5_utest.png)
> Make the lazy allocation implementation pass `usertests` and `lazytests`.

For negative `sbrk()` values, memory really must be released; positive values only enlarge the process size:
```c
if(n < 0){
  if(p->sz + n < 0) return -1; // A process cannot release more than its address space.
  if(growproc(n) < 0){ printf("growproc err\n"); return -1; }
}else{
  p->sz += n;
}
```

Kill a process if its fault address is above anything allocated by `sbrk()`. A helper such as `is_lazy_addr()` rejects addresses at or above `p->sz`, addresses already mapped with `PTE_V`, addresses above `MAXVA`, and the guard page below the user stack.

In `usertrap()`, allocate only when `scause` is 13 or 15 and `is_lazy_addr(r_stval())` is true; otherwise kill the process.

`fork()` must copy only pages that actually exist. In `uvmcopy()`, change missing or non-present PTE panics to `continue`, since lazy pages are intentionally absent.

System calls such as `read()` and `write()` access user virtual addresses through `copyin()` and `copyout()`. Their `walkaddr()` call returns 0 for a lazy page. Make `walkaddr()` call `lazy_alloc(va)` first when `is_lazy_addr(va)` is true, then perform the normal lookup.

If `kalloc()` fails in the page-fault handler, kill the current process; the existing check is:
```c
uint64 fault_addr = r_stval();
if(lazy_alloc(fault_addr) < 0) p->killed = 1;
```

Finally, handle faults on the invalid page below the user stack. xv6 leaves this guard page without `PTE_V`; it must not be lazily allocated. In `is_lazy_addr()`:
```c
if(va < PGROUNDDOWN(p->trapframe->sp)
   && va >= PGROUNDDOWN(p->trapframe->sp) - PGSIZE){
  // The page below the stack is the guard page.
  return 0;
}
```

After these changes, the lab passes:
![](/img/xv6/lab/lab5_AC.png)

## Summary
I should improve my debugging ability; this lab took a very long time to debug.
