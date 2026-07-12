---
title: "[MIT 6.s081] xv6 Lab 3 (2021): Page Tables Record"
date: 2022-07-14 22:57:45
updated: 2022-10-15 18:48:19
tags:
- xv6
- 2022
- UNIX
- Operating Systems
- Page Tables
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/07/xv6_lab3_record/).
{% endnote %}

Update on 2022/9/14: I recently put the lab code on GitHub. If you need a reference, you can find it here:

<https://github.com/ttzytt/xv6-riscv>

The different branches contain the different labs.

---

Note: the basic knowledge related to page tables is discussed in [this article](/2022/07/xv6_note/), which you can use as a reference.

# Lab 3: page tables

## Speed up system calls

>![](/img/xv6/lab/lab3_speed_up_syscalls.png)
>To accelerate system calls, many operating systems reserve some read-only virtual memory in user space and let the kernel share data there. This reduces repeated transitions between user and kernel mode. We need to use this method to accelerate `getpid()`.

The general idea is to place a process's PID in shared space when the process is created. When user code queries its PID, it no longer needs an `ecall` transition to the kernel and avoids the overhead of preserving the execution context.

First, add one page to the user's virtual memory specifically for data shared with the kernel.

Creating a new mapping from virtual to physical memory requires `mappages()`, implemented in `kernel/vm.c`:

```c 
// Create PTEs for virtual addresses starting at va that refer to
// physical addresses starting at pa. va and size might not
// be page-aligned. Returns 0 on success, -1 if walk() couldn't
// allocate a needed page-table page.
int
mappages(pagetable_t pagetable, uint64 va, uint64 size, uint64 pa, int perm)
{
  // pagetable is the root page table; va and pa are the starting virtual and physical addresses
  // perm contains the flag bits
  uint64 a, last;
  pte_t *pte;

  if(size == 0)
    panic("mappages: size");
  
  a = PGROUNDDOWN(va);
  last = PGROUNDDOWN(va + size - 1);
  // PGROUNDDOWN effectively sets the final twelve bits of a number to zero.
  // Therefore, a is the start of the new mapping and last is the final page frame to map.

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
    // Allocate one new page each time
  }
  return 0;
}
```

We can therefore call `mappages()` from `proc_pagetable()` in `kernel/proc.c` to create the additional mapping.

`proc_pagetable()` is invoked when a new process is created, which meets our requirement.

First, observe how `proc_pagetable()` uses `mappages()` to create the trampoline and trapframe pages:

```c 
if(mappages(pagetable, TRAMPOLINE, PGSIZE,
            (uint64)trampoline, PTE_R | PTE_X) < 0){
    uvmfree(pagetable, 0);
    return 0;
}

// map the trapframe just below TRAMPOLINE, for trampoline.S.
if(mappages(pagetable, TRAPFRAME, PGSIZE,
            (uint64)(p->trapframe), PTE_R | PTE_W) < 0){
    // On failure, unmap the preceding mapping rather than this nonexistent one
    uvmunmap(pagetable, TRAMPOLINE, 1, 0);
    uvmfree(pagetable, 0);
    return 0;
}
```

If the current page cannot be mapped, the previously mapped page is removed with `uvmunmap()` rather than attempting to unmap the failed page itself. The page table is then released with `uvmfree()`.

This is necessary because `uvmunmap()` requires the page being unmapped to exist. Attempting to unmap a nonexistent mapping crashes—after all, one cannot remove a mapping that was never created.

Because the current page failed to map, we can only use `uvmfree()` to release memory rather than unmapping that page.

The source of `uvmfree()` is:

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

When `sz` is zero, it calls only `freewalk`, releasing the memory for the entire page-table hierarchy, including all pages that were previously mapped.

Another detail is that before calling `freewalk()`, we must ensure all mappings have already been removed, which is why `uvmunmap()` is called first. The implementation of `freewalk()` makes this clear:

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
    } else if(pte & PTE_V){ // Important: PTE_V being one means the mapping remains and causes a panic
      panic("freewalk: leaf");
    }
  }
  kfree((void*)pagetable);
}
```

Using this information, we can write the mapping for USYSCALL, the shared page. USYSCALL lies below the trampoline and trapframe:

```c 
if(mappages(pagetable, USYSCALL, PGSIZE, (uint64)(p->usyscall), PTE_R | PTE_U) < 0){
    // After mapping, accessing the page beginning at USYSCALL reaches p->usyscall
    uvmunmap(pagetable, TRAMPOLINE, 1, 0);
    uvmunmap(pagetable, TRAPFRAME, 1, 0);
    uvmfree(pagetable, 0);
    return 0;
  }
```

Because this page is shared with user mode, both the PTE_R and PTE_U flags must be set. They permit reading and user-mode access, respectively.

As with the earlier calls to `mappages()`, if mapping fails, first remove the mappings that succeeded earlier and then clear all data belonging to the page table.

After writing this code, accessing an address in the USYSCALL page from user mode reaches the kernel's `p->usyscall` storage.

Just as Lab 2 added a `trace_mask` field to `proc`, creating an additional page mapping when a process is created means we must remove that mapping when the process is destroyed.

Therefore, modify `proc_freepagetable()` in `kernel/proc.c`:

```c 
// Free a process's page table, and free the
// physical memory it refers to.
void
proc_freepagetable(pagetable_t pagetable, uint64 sz)
{
  uvmunmap(pagetable, USYSCALL, 1, 0); // Newly added
  uvmunmap(pagetable, TRAMPOLINE, 1, 0);
  uvmunmap(pagetable, TRAPFRAME, 1, 0);
  uvmfree(pagetable, sz);
}
```

One problem remains. We have created a virtual-to-physical mapping, but have not allocated the corresponding physical memory when creating the process. Without allocating it, we would try to map virtual memory to a null pointer, which naturally causes a failure.

We therefore also need to modify `allocproc()`.

Observe how `allocproc()` allocates physical memory for the trapframe:

```c 
if((p->trapframe = (struct trapframe *)kalloc()) == 0){
    freeproc(p);
    release(&p->lock);
    return 0;
}
```

The logic is straightforward, so we can directly use it as a reference.

```c 
// Allocate the usyscall page
if((p->usyscall = (struct usyscall *)kalloc()) == 0){
    freeproc(p->usyscall);
    release(&p->lock);
    return 0;
}
p->usyscall->pid = p->pid;
// Store the PID immediately after creating it
```

The kernel-side work is now complete. We do not need to write the user-mode function ourselves because, as the lab hint says, it is already implemented in `user\ulib.c`:

```c 
int
ugetpid(void)
{
  struct usyscall *u = (struct usyscall *)USYSCALL;
  return u->pid;
}
```

As described earlier, directly accessing the USYSCALL virtual address reaches the contents stored at the physical address `p->usyscall`. Strictly speaking, that kernel address is also virtual, but most kernel virtual addresses are directly mapped to physical addresses.

This completes the task.

## Print a page table

> ![](/img/xv6/lab/lab3_print_a_pagetable.png)
> Implement a `vmprint()` function. It accepts a `pagetable_t` and prints the page table in the format shown in the image. Call this function to print the page table when creating the `init` process.

Ignore the call during `init` creation for the moment and first implement the function in `kernel/vm.c`.

xv6 uses a multilevel page table, so its structure is a tree. If this is unfamiliar, see [this article](/2022/07/xv6_note/). In essence, we need a DFS that prints a tree.

The implementation is:

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
        // At depth 2, stop recursing because this is a leaf
        vmprint((pagetable_t) child, dep + 1);
    }
  } 
}
```

This function accepts two arguments: the page table to print, which can be understood as the root of the tree, and the current depth. The depth is needed because the required format prints a different number of dots at each level. It also tells us whether a leaf has been reached.

Each `pagetable` contains at most 512 entries, so traverse them in order. If an entry is allocated, meaning that `pte & PTE_V` is nonzero, continue recursively.

Before printing each entry, output `dep + 1` groups of `..`, followed by its PTE and PA.

Here, PTE means the value read directly from the page-table entry. PA is the physical address after removing the flag bits from that entry. The physical address leads to either the next-level page table or a page frame.

The expression `pte_t pte = pagetable[i];` works because PA points to the first element of the child page table, and `pagetable[i]` is equivalent to `*(pagetable + i)`, which accesses page-table entry $i$.

This completes the main part. Insert the following near the end of `kernel/exec.c`:

```c 
if(p->pid == 1)
    vmprint(p->pagetable, 0);
```

Because `init` is the first process created by the system, its PID is 1. Its page table will therefore be printed when `init` is created.

That completes this part.

## Detecting which pages have been accessed

> ![](/img/xv6/lab/lab3_detecting.png)
> Implement `pgaccess()`, declared as `int pgaccess(void *base, int len, void *mask);`. It determines whether pages have been accessed **since the previous invocation of this function**. `base` identifies the first page to inspect, `len` gives the number of pages beginning there, and the access state of every page must be written to `mask`. This mask works like `trace_mask` in Lab 2: if a page was accessed, its corresponding bit is one.

Unlike Lab 2, the purpose here is not to learn the system-call registration process. This call has already been registered, so we do not need to repeat that work.

We can directly implement it in `kernel/sysproc.c`.

The first step is necessarily to obtain the user-supplied arguments with the `arg` family of functions. The reason is explained in the [Lab 2 article](/2022/07/xv6_lab2_record/). This gives the following code:

```c 
pagetable_t u_pt = myproc()->pagetable;
uint64 fir_addr, mask_addr;
uint ck_siz; 
uint mask = 0;
try(argaddr(0, &fir_addr), return -1);
try(argint(1, &ck_siz), return -1);
try(argaddr(2, &mask_addr), return -1);
```

Here, `fir_addr`, `ck_siz`, and `mask_addr` correspond to the three declared arguments.

Next, consider how to determine whether a page has been accessed. We use flag bits in the PTE, explained in the [xv6 study notes](/2022/07/xv6_note/). The RISC-V specification says:[^1]

> ![](/img/xv6/lab/riscv_pte_layout.png)
> Each leaf PTE contains an accessed (A) and dirty (D) bit. The A bit indicates the virtual page has been read, written, or fetched from since the last time the A bit was cleared. The D bit indicates the virtual page has been written since the last time the D bit was cleared.
> Translation: every leaf PTE has accessed (A) and dirty (D) flags. A records whether the virtual address has been read, written, or used since A was last reset. D records whether the virtual address has been written since D was last reset.

These flags are set by the RISC-V processor and require no software action. The function only needs to read and reset them.

Because we need to detect any access rather than only writes, we use the A flag. xv6 does not yet define `PTE_A`, so add it to `kernel/riscv.h`:

```c
#define PTE_A (1L << 6) // The diagram above shows that it is shifted by six bits
```

Then write the following in `sys_pgaccess`:

```c
if(ck_siz > 32){
    return -1;
}

pte_t* fir_pte = walk(u_pt, fir_addr, 0);

for(int i = 0; i < ck_siz; i++){
    if((fir_pte[i] & PTE_A) && (fir_pte[i] & PTE_V)){
        mask |= (1 << i);
        fir_pte[i] ^= PTE_A; // Reset
    }
}
```

If `ck_siz` is greater than 32, the mask does not contain enough bits to store the results, so the function must return an error.

The `walk()` function below is important. I will not explain its detailed implementation here. Given a page table and virtual address, `walk()` returns the leaf PTE corresponding to that virtual address.

It therefore gives us `fir_pte`, the address of the PTE for the first page to inspect.

Next, inspect the PTE_A flag in the following `ck_siz` entries:

```c
for(int i = 0; i < ck_siz; i++){
    if((fir_pte[i] & PTE_A) && (fir_pte[i] & PTE_V)){
        mask |= (1 << i);
        fir_pte[i] ^= PTE_A; // Reset
    }
}
```

Finally, return the computed `mask` to user mode using `copyout()`, which is explained in the [Lab 2 article](/2022/07/xv6_lab2_record/).

In brief, given a user page table and virtual address, `copyout()` copies data from kernel mode to that location in user mode.

We can therefore write:

```c
try(copyout(u_pt, (uint* )mask_addr, &mask, sizeof(uint)), return -1);
```

This copies the `mask` data to `mask_addr`, interpreted using the user-mode page table.

The lab is now complete.

## Summary

The concepts of page tables and virtual addresses are honestly more difficult than system calls. Completing this lab requires a clear understanding of the RISC-V page-table implementation, and it took me a long time to understand it. Only after doing the lab did I appreciate how ingenious the design of page tables and virtual addresses is.

I wish everyone working on this lab an early AC:

![](/img/xv6/lab/lab3_AC.png)

[^1]: <https://github.com/riscv/riscv-isa-manual/releases/download/Ratified-IMFDQC-and-Priv-v1.11/riscv-privileged-20190608.pdf>
