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

Update on 2022/9/14: I recently put the lab code on GitHub. If you need a reference, you can find it here:

<https://github.com/ttzytt/xv6-riscv>

The different branches contain the different labs.

---

# Lab 6: Copy-on-Write Fork for xv6

> ![](/img/xv6/lab/lab6_cow.png)

The lab description itself is remarkably brief because its main explanation appears immediately beforehand:

> **The problem**
> The fork() system call in xv6 copies all of the parent process's user-space memory into the child. If the parent is large, copying can take a long time. Worse, the work is often largely wasted; for example, a fork() followed by exec() in the child will cause the child to discard the copied memory, probably without ever using most of it. On the other hand, if both parent and child use a page, and one or both writes it, a copy is truly needed.
> **The solution**
> The goal of copy-on-write (COW) fork() is to defer allocating and copying physical memory pages for the child until the copies are actually needed, if ever.
> COW fork() creates just a pagetable for the child, with PTEs for user memory pointing to the parent's physical pages. COW fork() marks all the user PTEs in both parent and child as not writable. When either process tries to write one of these COW pages, the CPU will force a page fault. The kernel page-fault handler detects this case, allocates a page of physical memory for the faulting process, copies the original page into the new page, and modifies the relevant PTE in the faulting process to refer to the new page, this time with the PTE marked writeable. When the page fault handler returns, the user process will be able to write its copy of the page.
> COW fork() makes freeing of the physical pages that implement user memory a little trickier. A given physical page may be referred to by multiple processes' page tables, and should be freed only when the last reference disappears.

In short, we need to implement the copy-on-write technique used by UNIX. Without COW, `fork()` copies all memory belonging to the parent into the child's address space. This consumes an enormous and unacceptable amount of time for a large process.

Much of the memory copied during `fork()` is never used. For example, the usual UNIX process-creation sequence first invokes `fork()` and then `exec()`. All data copied from the parent is immediately discarded by `exec()`.

There is only one situation in which memory truly needs to be copied during a fork: a write. If the parent or child attempts to write a value at an address, the corresponding page frame must be copied so that the write does not change memory observed by the other process.

Copy-on-write implements precisely this behavior. Mark shared parent and child PTEs as not writable. When either process attempts to write a shared page, the CPU generates a page fault. `usertrap()` handles it by copying the shared frame for the writing process and marking that new frame writable.

After COW is implemented, several processes may share one physical page frame. That frame can be truly released only after every process has stopped using it.

We can now follow the hints one at a time.

## uvmcopy()

> Modify `uvmcopy()` to map the parent's physical pages into the child, instead of allocating new pages. Clear PTE_W in the PTEs of both child and parent.
> Modify `uvmcopy()` so that the parent's physical memory is mapped directly into the child's virtual address space rather than allocating new memory. Clear PTE_W in both parent and child PTEs.

After this change, the parent and child effectively share memory. We want a write by either process to cause a page fault, so PTE_W must be cleared:

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

    *pte &= (~PTE_W); // Clear PTE_W here
    *pte |= PTE_C;    // PTE_C marks this as a COW page, as discussed later
    flags = PTE_FLAGS(*pte);
    // if((mem = kalloc()) == 0)  These lines allocate physical memory and must be removed
    //   goto err;
    // memmove(mem, (char*)pa, PGSIZE);
    if(mappages(new, i, PGSIZE, (uint64)pa, flags) != 0){ 
      // Do not map virtual address i to newly allocated physical memory mem.
      // Map it to the parent's physical memory at pa instead.
      printf("uvmcopy failed\n");
      kfree(mem);
      goto err;
    }
    refcnt_inc(pa); // Discussed later
  }
  return 0;

 err:
  uvmunmap(new, 0, i / PGSIZE, 1);
  return -1;
}
```

## usertrap()

> Modify `usertrap()` to recognize page faults. When a page-fault occurs on a COW page, allocate a new page with kalloc(), copy the old page to the new page, and install the new page in the PTE with PTE_W set.
> Modify `usertrap()` to handle page faults. When the fault occurs on a COW page, allocate a new physical page, copy the original frame into it, and install the new page with PTE_W set.

As in the lazy-allocation lab, we need a helper that determines whether a virtual address is a valid, not-yet-copied COW page. The hint says that a new physical page may be allocated only when the fault **occurs on a COW page**. How can we distinguish one? We can use the reserved bits in a RISC-V PTE. Each PTE has ten flag bits; eight have defined meanings, leaving bits 8 and 9 reserved:

![](/img/xv6/lab/riscv_pte_layout.png)

These RSW bits are available to software.

Define bit 8 as an indicator that the frame is a COW page. Add the following macro in `kernel/riscv.h`. This also explains why `uvmcopy()` above sets PTE_C in the child PTE:

```c 
#define PTE_V (1L << 0) // valid
#define PTE_R (1L << 1)
#define PTE_W (1L << 2)
#define PTE_X (1L << 3)
#define PTE_U (1L << 4) // 1 -> user can access
#define PTE_C (1L << 8) // Newly added
```

The helper that detects an uncopied COW page follows. As in the lazy-allocation lab, I placed it in `vm.c`:

```c 
int uncopied_cow(pagetable_t pgtbl, uint64 va){
  if(va >= MAXVA) 
    return 0;
  pte_t* pte = walk(pgtbl, va, 0);
  if(pte == 0)             // This page does not exist
    return 0;
  if((*pte & PTE_V) == 0)
    return 0;
  if((*pte & PTE_U) == 0)
    return 0;
  return ((*pte) & PTE_C); // PTE_C means this is an uncopied COW page
}
```

We can now modify `usertrap()`:

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

Unlike the lazy-allocation lab, only scause 15 is handled. According to the RISC-V documentation:

<div align=center width=60% >
  <img src=/img/xv6/lab/riscv_exception_code.png width=60%>
</div>

An scause of 15 means a page fault caused by an attempted write.

After determining that the current page is a valid COW page, allocate physical memory for it. As in the preceding lab, I wrapped this work in `cowalloc()`:

```c 
int cowalloc(pagetable_t pgtbl, uint64 va){
  pte_t* pte = walk(pgtbl, va, 0);
  uint64 perm = PTE_FLAGS(*pte);

  if(pte == 0) return -1;
  uint64 prev_sta = PTE2PA(*pte); // prev_sta is the parent's page frame originally used by this mapping.
                                  // The name uses sta because the address is page-aligned
                                  // and therefore denotes the start of a page frame.
  uint64 newpage = kalloc();     
  if(!newpage){
    return -1;
  }
  uint64 va_sta = PGROUNDDOWN(va); // Current page frame

  perm &= (~PTE_C); // After copying, it is no longer an uncopied COW page
  perm |= PTE_W;    // It becomes writable after copying

  memmove(newpage, prev_sta, PGSIZE); // Copy the parent's page-frame data
  uvmunmap(pgtbl, va_sta, 1, 1);      // Then remove the mapping to the parent's frame
  
  if(mappages(pgtbl, va_sta, PGSIZE, (uint64)newpage, perm) < 0){
    kfree(newpage);
    return -1;
  }
  return 0;
}
```

One detail is critical: `memmove()` must precede `uvmunmap()`. This took me a long time to debug. After `uvmunmap()`, the parent's physical page may have been released, so a later `memmove()` would read invalid data.

After reading this function, another problem may be apparent. The parent's page frame might be shared by more than one child. Calling `uvmunmap()` with `do_free` equal to one may release the parent frame while other processes still use it.

This leads to the next hint.

## Reference count

> Ensure that each physical page is freed when the last PTE reference to it goes away -- but not before. A good way to do this is to keep, for each physical page, a "reference count" of the number of user page tables that refer to that page. Set a page's reference count to one when `kalloc()` allocates it. Increment a page's reference count when fork causes a child to share the page, and decrement a page's count each time any process drops the page from its page table. `kfree()` should only place a page back on the free list if its reference count is zero. It's OK to keep these counts in a fixed-size array of integers. You'll have to work out a scheme for how to index the array and how to choose its size. For example, you could index the array with the page's physical address divided by 4096, and give the array a number of elements equal to highest physical address of any page placed on the free list by `kinit()` in kalloc.c.

We need reference counts to solve the problem. Every page frame has a count recording how many COW mappings refer to it. Only when no COW page still uses a frame can it actually be freed, somewhat like the behavior of `close()`. `kalloc()` sets the reference count of a newly allocated page to one. `kfree()` first decrements the count and frees the frame only when the result reaches zero.

We also need a way to store these counts. Because every page-frame start address is divisible by 4096, divide the physical address of a frame by 4096 to obtain its index.

This gives the following macros and array:

```c 
#define PG2REFIDX(_pa) ((((uint64)_pa) - KERNBASE) / PGSIZE)
#define MX_PGIDX PG2REFIDX(PHYSTOP)
#define PG_REFCNT(_pa) pg_refcnt[PG2REFIDX((_pa))]

int pg_refcnt[MX_PGIDX];
```

The following diagram helps explain the calculation:

![](/img/xv6/note/kernel_pagetable.png)

PHYSTOP and KERNBASE mark the beginning and end of the physical-memory range, so subtract KERNBASE from `pa` before dividing by PGSIZE.

At first I wondered where this array would itself be stored in kernel memory. The implementation of `kinit()` gives the answer:

```c 
void
kinit()
{
  initlock(&kmem.lock, "kmem");
  freerange(end, (void*)PHYSTOP); // Notice this line
}
```

Here, `end` is the beginning of Free memory in the diagram and is defined in `kernel.ld`. The kernel's own code and data, including this array, live in kernel text and kernel data. `kalloc()` allocates only from the range `end` through PHYSTOP.

We can now modify the functions in `kalloc.c` around the reference counts.

First, `kalloc()`:

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
    // One process uses the newly allocated frame, so initialize the count to one.
  }
  return (void*)r;
}
```

Next, `kfree()`:

```c 
void
kfree(void *pa)
{
  struct run *r;

  if(((uint64)pa % PGSIZE) != 0 || (char*)pa < end || (uint64)pa >= PHYSTOP)
    panic("kfree");

  acquire(&refcnt_lock);
  if(--PG_REFCNT(pa) <= 0){ // Decrement first; truly free the frame only at zero
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

`refcnt_lock` is initialized in `kinit()`:

```c
void
kinit()
{
  initlock(&kmem.lock, "kmem");
  initlock(&refcnt_lock, "ref cnt"); // here
  freerange(end, (void*)PHYSTOP);
}
```

The lock is required because several processes referencing the same frame may call `kfree()` simultaneously. Concurrent decrements without synchronization could produce an incorrect result.

In `uvmcopy()`, increment the reference count for the parent's page frame because one additional process now shares it. This is the `refcnt_inc()` call after `mappages()`, whose definition is:

```c 
void refcnt_inc(void* pa){
  acquire(&refcnt_lock);
  PG_REFCNT(pa)++;
  release(&refcnt_lock);
} 
```

This completes the reference-counting portion.

One final hint remains.

## copyout()

The reason for modifying `copyout()` resembles the previous lab. Some system calls write data into COW pages. Because PTE_W is clear on those pages, the write generates a page fault. `trap.c` treats an exception occurring inside a system call as a kernel fault and panics. Therefore, if `copyout()` discovers a COW page, it should allocate a private page directly.

Unlike the lazy-allocation lab, `copyin` does not need a modification here. `copyin()` can read the physical frame shared by the parent. In the lazy-allocation lab, by contrast, the frame being read had no physical address at all and therefore could not be accessed.

Modify `copyout()` as follows:

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
    if(uncopied_cow(pagetable, va0)){          // Newly added
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

When writing this function, the order of `cowalloc()` and `walkaddr()` is crucial. I originally reversed them and spent a long time finding the problem. Calling `walkaddr()` before `cowalloc()` returns the physical address of the parent's shared frame.

The later write would then modify that shared address, corrupting data used by other processes.

Calling `walkaddr()` after `cowalloc()` instead returns the newly allocated physical address. The write goes to a frame owned by the current process and cannot affect any other process.

With this function complete, the lab passes. I wish everyone working on it an early AC:

![](/img/xv6/lab/lab6_AC.png)

## Summary

I cannot understand why GDB failed to reveal several foolish mistakes even after so much debugging. I began to suspect the compiler itself. In the future, I need to reason through the design before writing it. If the implementation is wrong and my debugging assumptions follow the same wrong direction, the bug will never be found.
