---
title: "[MIT 6.s081] xv6 Lab 11: mmap Record"
date: 2022-08-21 00:00:00
updated: 2022-10-15 18:48:49
tags:
- xv6
- 2022
- UNIX
- Operating Systems
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/08/xv6_lab11_record/).
{% endnote %}

The lab implements subsets of `mmap()` and `munmap()`. `mmap()` maps file bytes into user memory; `munmap()` removes a mapping. This implementation supports only `addr=0` and `offset=0`, and `munmap()` may remove only a prefix or suffix, not a hole in the middle.

# Lab 11: mmap

## Design

Do not place mappings below `p->sz`, because `malloc()` could reuse and overwrite them. Allocate mappings downward from the trapframe. Add up to 16 VMAs to `struct proc`, recording start address, length, protection, flags, and the referenced file. Mappings are lazy: allocate a physical page only when a page fault occurs. `fork()` copies VMAs and duplicates file references; the child faults in pages as needed.

```c
struct mmap_vma{
  int in_use;
  uint64 sta_addr;
  uint64 sz;
  int prot;
  struct file *file;
  int flags;
};
#define VMA_SZ 16
```

`sys_mmap()` validates protection and shared-write permissions, finds a free VMA and downward address range, initializes the VMA, and calls `filedup()`. `get_mmap_space()` chooses a gap that does not overlap existing VMAs.

## Page Faults

`mmap_fault_handler()` locates the VMA, checks read/write permissions, allocates one page, zero-fills it, reads the corresponding file offset into it, and maps it with `PTE_U` plus the requested `PTE_R`, `PTE_W`, and `PTE_X` flags. If the mapping extends beyond EOF, the remaining bytes stay zero. Add this handler to `usertrap()` for `scause` 13 and 15.

## `munmap()` and Writeback

For `MAP_SHARED`, dirty pages must be written back before unmapping. Define the RISC-V dirty bit:
```c
#define PTE_D (1L << 7)
```
`mmap_writeback()` walks the affected pages, uses `PTE_D` to identify modified pages, writes them back with `writei()`, frees physical memory, and clears the PTE. The lab tests use page-aligned addresses and lengths; non-aligned handling is substantially more complicated.

`munmap()` rejects middle holes, updates the VMA's start and length, and calls `fileclose()` when the whole mapping disappears. `exit()` must unmap all active VMAs before closing open files, otherwise dirty data may never be written back.

## `fork()`

Copy each active VMA into the child and call `filedup()`. `uvmcopy()` only copies memory below `p->sz`, so lazy mappings above the heap are not duplicated; the child obtains their pages through the fault handler.

```c
for(int i=0;i<VMA_SZ;i++){
  if(p->mmap_vams[i].in_use){
    np->mmap_vams[i] = p->mmap_vams[i];
    filedup(p->mmap_vams[i].file);
  }
}
```

After this, the lab passes:
![](/img/xv6/lab/lab11_AC.png)

## Complaint

Adding `-g3` to the Makefile for GDB macro debugging unexpectedly made `usertests writebig` fail with `panic: balloc: out of blocks`; removing it fixed the test. Even `-O3` can trigger the same issue in some versions. See [xv6-riscv issue 133](https://github.com/mit-pdos/xv6-riscv/issues/133) and [issue 59](https://github.com/mit-pdos/xv6-riscv/issues/59).
