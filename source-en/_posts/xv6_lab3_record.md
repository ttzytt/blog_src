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

Update (2022/9/14): The lab code is available at <https://github.com/ttzytt/xv6-riscv>; different branches correspond to different labs.

The page-table basics are covered in [this article](/2022/07/xv6_note/).

# Lab 3: Page Tables
## Speed Up System Calls
>![](/img/xv6/lab/lab3_speed_up_syscalls.png)
> Many systems provide read-only user-space pages containing kernel-shared data to avoid repeated user/kernel transitions. Use this to speed up `getpid()`.

When creating a process, map an additional user page and allocate a `usyscall` page. In `proc_pagetable()`, map it below the trampoline and trapframe with `PTE_R | PTE_U`; on failure unmap earlier mappings and free the page table. Allocate `p->usyscall` in `allocproc()`, set `p->usyscall->pid = p->pid`, and unmap it in `proc_freepagetable()`.

The supplied user function is:
```c
int ugetpid(void){
  struct usyscall *u = (struct usyscall *)USYSCALL;
  return u->pid;
}
```
Accessing the `USYSCALL` virtual address now reads the shared page without an `ecall`.

## Print a Page Table
>![](/img/xv6/lab/lab3_print_a_pagetable.png)
> Implement `vmprint(pagetable_t)` and call it while creating `init`.

Because xv6 page tables are multi-level trees, print them with DFS:
```c
void vmprint(pagetable_t pagetable, uint dep){
  if(dep == 0) printf("page table %p\n", pagetable);
  for(int i = 0; i < 512; i++){
    pte_t pte = pagetable[i];
    if(pte & PTE_V){
      for(int j = 0; j < dep; j++) printf(".. ");
      uint64 child = PTE2PA(pte);
      printf("..%d: pte %p pa %p\n", i, pte, child);
      if(dep < 2) vmprint((pagetable_t)child, dep + 1);
    }
  }
}
```
Each page table has at most 512 entries. `PTE_V` indicates a valid entry; `PTE2PA` obtains the child page-table or leaf-frame address. Call `vmprint(p->pagetable, 0)` when `p->pid == 1` in `exec.c`.

## Detecting Accessed Pages
>![](/img/xv6/lab/lab3_detecting.png)
> Implement `pgaccess(void *base, int len, void *mask)`, which reports whether each page has been accessed since the previous call.

The RISC-V leaf PTE has an accessed (A) bit and a dirty (D) bit. Define:
```c
#define PTE_A (1L << 6)
```
Obtain the arguments with `argaddr`, `argint`, and `argaddr`; reject `len > 32`. Use `walk()` to obtain the first leaf PTE, inspect `PTE_A` and `PTE_V`, set the corresponding bit in `mask`, and clear `PTE_A`:
```c
if(ck_siz > 32) return -1;
pte_t* fir_pte = walk(u_pt, fir_addr, 0);
for(int i = 0; i < ck_siz; i++){
  if((fir_pte[i] & PTE_A) && (fir_pte[i] & PTE_V)){
    mask |= (1 << i);
    fir_pte[i] ^= PTE_A; // Reset the accessed bit.
  }
}
try(copyout(u_pt, (uint*)mask_addr, &mask, sizeof(uint)), return -1);
```

This completes the lab. Page-table and virtual-address concepts are more difficult than system calls; understanding this lab makes xv6's design much clearer.

![](/img/xv6/lab/lab3_AC.png)

[^1]: <https://github.com/riscv/riscv-isa-manual/releases/download/Ratified-IMFDQC-and-Priv-v1.11/riscv-privileged-20190608.pdf>
