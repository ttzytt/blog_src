---
title: "[MIT 6.s081] xv6 Lab 6: Copy-on-Write Record"
date: 2022-07-29 00:00:00
updated: 2022-10-15 18:48:28
tags:
- xv6
- 2022
- UNIX
- Operating Systems
- Page Tables
- Copy-on-Write (COW)
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/07/xv6_lab6_record/).
{% endnote %}

Update (2022/9/14): The lab code is available at <https://github.com/ttzytt/xv6-riscv>; different branches correspond to different labs.

# Lab 6: Copy-on-Write Fork for xv6
![](/img/xv6/lab/lab6_cow.png)

The problem is that xv6's `fork()` copies all parent user memory. This is slow for a large parent and often wasted, because a child commonly calls `exec()` immediately. A copy is genuinely needed only when parent or child writes a shared page.

The solution is copy-on-write (COW): create only the child's page table, point both page tables at the same physical pages, and clear `PTE_W` in both. A write then causes a page fault; the kernel allocates and copies a page, installs it writable, and resumes the process. Shared physical pages must be freed only after their final reference disappears.

## `uvmcopy()`

Map the parent's physical pages into the child, clear `PTE_W`, mark the entries with a COW flag, and increment the physical page's reference count:
```c
*pte &= (~PTE_W); // Make both mappings read-only.
*pte |= PTE_C;    // Mark this as a COW page.
flags = PTE_FLAGS(*pte);
if(mappages(new, i, PGSIZE, (uint64)pa, flags) != 0){
  goto err;
}
refcnt_inc(pa);
```

Define the reserved RSW bit as `PTE_C`:
```c
#define PTE_C (1L << 8) // COW page.
```

## `usertrap()`

Recognize a write fault (`scause == 15`) on a valid user COW page. `uncopied_cow()` checks `MAXVA`, `walk()`, `PTE_V`, `PTE_U`, and `PTE_C`. Then `cowalloc()` allocates a page, copies the old page **before** unmapping it, removes `PTE_C`, adds `PTE_W`, unmaps the old mapping, and maps the new page.

```c
int cowalloc(pagetable_t pgtbl, uint64 va){
  pte_t* pte = walk(pgtbl, va, 0);
  if(pte == 0) return -1;
  uint64 prev = PTE2PA(*pte);
  uint64 newpage = (uint64)kalloc();
  if(!newpage) return -1;
  uint64 va_sta = PGROUNDDOWN(va);
  uint64 perm = PTE_FLAGS(*pte);
  perm &= (~PTE_C); perm |= PTE_W;
  memmove((void*)newpage, (void*)prev, PGSIZE);
  uvmunmap(pgtbl, va_sta, 1, 1);
  if(mappages(pgtbl, va_sta, PGSIZE, newpage, perm) < 0){
    kfree((void*)newpage); return -1;
  }
  return 0;
}
```

## Reference Count

Each physical page needs a reference count. `kalloc()` sets it to 1; fork increments it; `kfree()` decrements it and returns the page to the free list only when it reaches zero. An address-indexed array works:
```c
#define PG2REFIDX(_pa) ((((uint64)_pa) - KERNBASE) / PGSIZE)
#define MX_PGIDX PG2REFIDX(PHYSTOP)
#define PG_REFCNT(_pa) pg_refcnt[PG2REFIDX((_pa))]
int pg_refcnt[MX_PGIDX];
```
Protect updates with `refcnt_lock`:
```c
void refcnt_inc(void* pa){
  acquire(&refcnt_lock);
  PG_REFCNT(pa)++;
  release(&refcnt_lock);
}
```
In `kfree()`, decrement under the lock and add the page to the free list only when the count is zero.

## `copyout()`

System calls may write to COW pages through `copyout()`. If the destination is COW, allocate its private writable copy before calling `walkaddr()`:
```c
va0 = PGROUNDDOWN(dstva);
if(uncopied_cow(pagetable, va0)){ // Allocate the private copy first.
  try(cowalloc(pagetable, va0), return -1);
}
pa0 = walkaddr(pagetable, va0);
```
The order is essential: calling `walkaddr()` first obtains the shared parent's physical page, so writing would corrupt the other processes' memory.

After these changes the lab passes:
![](/img/xv6/lab/lab6_AC.png)

## Summary
Some trivial mistakes took a surprisingly long time to find with GDB. Before writing code, I should understand the design first; otherwise debugging a wrong implementation also proceeds in the wrong direction.
