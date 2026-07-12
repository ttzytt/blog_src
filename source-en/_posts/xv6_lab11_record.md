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

Update on 2022/9/14: I recently put the lab code on GitHub. If you need a reference, you can find it here:

<https://github.com/ttzytt/xv6-riscv>

The different branches contain the different labs.

---

This is the final lab. I have finally finished them all!

# Lab 11: mmap

## Description

This lab implements a subset of the `mmap()` and `munmap()` system calls commonly found in UNIX operating systems. These system calls map a file into user-space memory, allowing the user to modify and access the file directly through memory, which is much more convenient.

The definition of `mmap()` is:

```c
void *mmap(void *addr, size_t length, int prot, int flags,
           int fd, off_t offset);
```

It maps the first `length` bytes of the file whose descriptor is `fd` into memory beginning at `addr`, with an additional `offset`, meaning that the mapping does not necessarily start at the beginning of the file.

If `addr` is zero, the system automatically allocates an unused memory region for the mapping and returns that address.

In this lab, we only need to support cases in which both `addr` and `offset` are zero, so we do not need to consider a user-specified memory address or file offset at all.

Both `prot` and `flags` are sets of flags. More specifically, `prot` has the following options:

- PROT_NONE
- PROT_READ
- PROT_WRITE
- PROT_EXEC

They specify which operations may be performed on the mapped file.

The `flags` argument determines whether changes made through the memory mapping must be written back to the file when the mapping is removed.

Its two options are MAP_SHARED and MAP_PRIVATE.

The definition of `munmap()` is:

```c
int munmap(void *addr, size_t length);
```

It removes a file mapping of `length` bytes beginning at `addr`. One important restriction is that the function cannot “punch a hole” in the middle of a mapped range. It may remove only a portion at the beginning or end, or the complete mapping.

That may not be entirely clear. Suppose the mapped range is $[1,100]$. If we want to unmap the range $[l,r]$, it must satisfy either $l=1 \And r\le100$ or $l\ge1 \And r=100$.

## Overall approach

First, we must decide where in a user process to place memory-mapped files. The memory layout of a user process is shown below:

![](/img/xv6/note/user_pagetable.png)

Initially, I wanted to allocate memory for mappings in the same way as `sbrk()`:

```c
uint64
sys_sbrk(void)
{
  int addr;
  int n;

  if(argint(0, &n) < 0)
    return -1;
  addr = myproc()->sz;
  if(growproc(n) < 0)
    return -1;
  return addr;
}
```

In other words, allocate additional heap space to the process and put the file there. Although this would be easy to implement, closer consideration reveals many problems. We assume that all memory below `myproc()->sz` is freely available to the user, and that is precisely the memory allocated by `malloc()`.

If a mapped file were placed there, the same space could easily be allocated by `malloc()` and then overwritten.

Furthermore, after the file is unmapped, the PTE for the mapped location is set to zero. If the user later accesses the corresponding memory, another page fault occurs and must be handled, which is clearly rather complicated.

We can avoid conflicts with the process heap by allocating memory for file mappings in the opposite direction. That is, begin at the trapframe and allocate mapping regions downward.

Following the lab hints, we can add a VMA (virtual memory area) structure to the kernel's process structure. A VMA stores metadata about one file mapping, such as its starting address, length, and mapped file. This metadata makes the mappings much easier to manage.

To support a certain number of simultaneous file mappings, `struct proc` must contain that many VMAs. The hint recommends sixteen.

File mappings must also use lazy allocation; otherwise, copying a large file all at once would be very expensive. The file is copied into memory only after the user process triggers a page fault.

Finally, mapped files must remain available after `fork()`. This part is relatively simple: we only need to copy the VMA. The child page table does not contain the corresponding mapping, so accessing an address recorded in the VMA triggers a page fault. At that point, the required portion of the file can be copied into memory.

## Code

Note: this lab does not register the system calls or `mmaptest` for us. Follow the same procedure as in Lab 2. I will not repeat it here; if necessary, see [this article](/07/xv6_lab2_record).

`struct mmap_vma`:

```c
// in proc.h
struct mmap_vma{
  int in_use;      // Whether this VMA structure represents an active file mapping
  uint64 sta_addr; // Starting address
  uint64 sz;       // Mapping size
  int prot;
  struct file* file; // Mapped file
  int flags;         // map_shared or map_private
};

#define VMA_SZ 16

struct proc {
  ……
  struct mmap_vma mmap_vams[VMA_SZ];
}
```

`sys_mmap()`:

This call does not allocate physical memory. It calls `get_mmap_space()` to find an unused entry in `mmap_vams` and an available virtual region for the file mapping, then initializes the VMA structure.

It must also increment the reference count of the mapped file. Without this increment, the file would be closed when its reference count reached zero, leaving us unable to copy its contents into memory during lazy allocation.

```c
// in sysfile
uint64 
sys_mmap(){
  uint64 addr, length, offset; // Only zero is supported for addr and offset
  int prot, flags, fd;
  struct file* file;
  //void *mmap(void *addr, size_t length, int prot, int flags, int fd, off_t offset);
  // This really has a lot of arguments...
  try(argaddr(0, &addr), return -1)
  try(argaddr(1, &length), return -1)
  try(argint(2, &prot), return -1)
  try(argint(3, &flags), return -1)
  try(argfd(4, &fd, &file), return -1) // Obtain both the file and its descriptor
  try(argaddr(5, &offset), return -1)
  // Read the arguments
  struct proc* p = myproc();
  if(addr || offset) // This mmap subset does not support a custom address or offset
    return -1;
  if(!file->writable && (prot & PROT_WRITE) && (flags & MAP_SHARED))
    return -1;
  // The file itself is not writable, but PROT_WRITE was requested

  int unuse_idx = -1;
  uint64 sta_addr = get_mmap_space(length, p->mmap_vams, &unuse_idx);

  if(unuse_idx == -1)
    return -1;
  if(sta_addr <= p->sz) // No memory remains for mmap
    return -1;
  struct mmap_vma* cur_vma = &p->mmap_vams[unuse_idx];
  cur_vma->file = file;
  cur_vma->in_use = 1;
  cur_vma->prot = prot;
  cur_vma->flags = flags;
  cur_vma->sta_addr = sta_addr; 
  cur_vma->sz = length;
  filedup(file); // Increment the reference count
  return cur_vma->sta_addr;
} 
```

`get_mmap_space()`:

This function must locate an available memory region for a new file mapping, so we need to choose an allocation strategy. The safest method is to find the lowest virtual address used by all existing VMAs and use that position as the end of the new mapped region. This can never create a collision, but it also has a drawback:

![](/img/xv6/lab/lab11_find_map_pos.svg)

First, to simplify unmapping, we do not allow two file mappings to share one page frame; otherwise, `kfree()` would release both at once.

Second, always allocating below the lowest virtual address may cause the mapping region to continue growing downward even when a usable hole exists. In some uncommon situations this strategy could reduce the memory available to the user heap. In an extreme case it could cause a problem, although this is very unlikely because MAXVA is normally enormous and at least larger than physical memory.

In any case, I had time to spare and wrote code that handles this situation. It uses two nested loops, each traversing all VMAs. See the comments for the details.

```c
// in sysfile.c
uint64
get_mmap_space(uint64 sz, struct mmap_vma* vmas, int* free_idx){
  *free_idx = -1;
  
  // Return an address at which a new file mapping can be stored (its starting address).
  // Prefer a gap between VMA slots; if no gap exists, map below all existing regions.
  // A quicksort could be used here, but I was lazy...
  uint64 lowest_addr = TRAPFRAME;
  
  struct mmap_vma tmp; // Upper boundary; as in the diagram, the top may contain no mapped region
  tmp.sta_addr = TRAPFRAME, tmp.sz = 0;

  for(int i = 0; i <= VMA_SZ; i++){
    // Assume PGROUNDDOWN(sta_addr) of vmas[i] is the end of the new file mapping
    if(vmas[i].in_use == 0 && i != VMA_SZ){
      *free_idx = i;
      continue;
    } 
    uint64 ed_pos = i != VMA_SZ ? PGROUNDDOWN(vmas[i].sta_addr) 
                                : tmp.sta_addr;

    lowest_addr = ed_pos < lowest_addr ? ed_pos : lowest_addr; // Take the minimum
    
    for(int j = 0; j < VMA_SZ; j++){
      // Assume the new mapping begins above sta_addr + sz of vmas[j], the end of vmas[j]
      if(vmas[j].in_use == 0 && i != VMA_SZ) continue;

      uint64 st_pos = i != VMA_SZ ? vmas[j].sta_addr + vmas[j].sz 
                                  : tmp.sta_addr + tmp.sz; // This position is necessarily page-aligned
                                  
      if (ed_pos <= st_pos) continue; 
      // Skip here rather than checking below because unsigned subtraction would be incorrect
      if (ed_pos - st_pos >= sz){
        // The interval [st_pos, ed_pos)
        return st_pos;
      }
    }
  } 

  return lowest_addr - sz;
}
```

All mappings created so far are lazily allocated, so we need a function that handles page faults.

`mmap_fault_handler()`:

There is a slightly troublesome corner case here. If the mapping size requested by the user exceeds the size of the file itself, the remaining mapped region must be filled with zeroes; otherwise, `mmaptest()` will not pass.

Another point is that after a page fault we allocate and map only one page, rather than mapping the entire file at once.

```c
// in trap.c
int 
mmap_fault_handler(uint64 addr){
  struct proc* p = myproc();
  struct mmap_vma* cur_vma;
  if((cur_vma = get_vma_by_addr(addr)) == 0){
    // Find which file mapping contains this address.
    // Zero means it belongs to none of them.
    return -1;
  }

  if(!cur_vma->file->readable && r_scause() == 13 && cur_vma->flags & MAP_SHARED){
    DEBUG("mmap_fault_handler: not readable\n");
    return -1;
  } // Read fault
    
  if(!cur_vma->file->writable && r_scause() == 15 && cur_vma->flags & MAP_SHARED){
    DEBUG("mmap_fault_handler: not writable\n");
    return -1;
  } // Write fault
    

  uint64 pg_sta = PGROUNDDOWN(addr);
  uint64 pa = kalloc();
  if(!pa){
    DEBUG("mmap_fault_handler: kalloc failed\n");
    return -1;
  }

  memset(pa, 0, PGSIZE);

  int perm = PTE_U | PTE_V;
  if(cur_vma->prot & PROT_READ) perm |= PTE_R;
  if(cur_vma->prot & PROT_WRITE) perm |= PTE_W;
  if(cur_vma->prot& PROT_EXEC) perm |= PTE_X;
  // Impossible combinations were already rejected by mmap

  uint64 off = PGROUNDDOWN(addr - cur_vma->sta_addr); 
  // off is the number of page frames to skip when copying the file

  ilock(cur_vma->file->ip);
  int rdret;
  if((rdret = readi(cur_vma->file->ip, 0, pa, off, PGSIZE)) == 0){
    iunlock(cur_vma->file->ip);
    return -1;
  }

  iunlock(cur_vma->file->ip); // Do not put it because this file will be used again later;
                              // it can be put during unmap
  mappages(p->pagetable, pg_sta, PGSIZE, pa, perm);
  return 0;
}
```

`get_vma_by_addr()`:

This helper is used by the preceding fault handler and returns the VMA containing a given address:

```c
struct mmap_vam* 
get_vma_by_addr(uint64 addr){
  struct proc* p = myproc();
  for(int i = 0; i < VMA_SZ; i++){
    if(p->mmap_vams[i].in_use && addr >= p->mmap_vams[i].sta_addr && addr < p->mmap_vams[i].sta_addr + p->mmap_vams[i].sz){
      // Determine whether this address lies inside the file-mapped region
      return p->mmap_vams + i;
    }
  }
  return 0;
}
```


`usertrap()`:

```c
// in trap.c
……
if(r_scause() == 8){
  // system call

  if(p->killed)
    exit(-1);

  // sepc points to the ecall instruction,
  // but we want to return to the next instruction.
  p->trapframe->epc += 4;

  // an interrupt will change sstatus &c registers,
  // so don't enable until done with those registers.
  intr_on();

  syscall();
} else if((which_dev = devintr()) != 0){
  // ok
} else if ((r_scause() == 13 || r_scause() == 15)){
  try(mmap_fault_handler(r_stval()), bad = 1)
}
else{
  bad = 1;
}

if (bad){
  printf("usertrap(): unexpected scause %p pid=%d\n", r_scause(), p->pid);
  printf("            sepc=%p stval=%p\n", r_sepc(), r_stval());
  p->killed = 1;
}
……
```

We can now attempt to implement `munmap()`. If the VMA has the MAP_SHARED flag, modifications made in memory must be copied back to the file while the mapping is removed.

Because this process is relatively complicated, I wrote a separate `mmap_writeback()` function for it. We use the PTE_D flag in a PTE to determine whether a page of the file mapping has been modified. A modified page needs to be copied back.

This flag is not already defined, so define it in `riscv.h` according to the RISC-V manual:

```c
#define PTE_D (1L << 7)
```

If the unmap address and length are not multiples of `PGSIZE`, this function becomes particularly complicated:

- The region being unmapped may not cross a page-frame boundary; all of the removed memory then lies within one frame. That frame cannot be released, but the changed memory still needs to be copied back to the file.
- If the ending address lies in the middle of a page frame, we need another case distinction. If that frame is the final page of the mapped region, it must be written back and then released. If it is not the final page, it cannot be released.

Possibly because of this complexity, every `munmap()` and `mmap()` call in `mmaptest.c` uses `addr` and `len` values that are multiples of `PGSIZE`. The lab hints also say that supporting the features used by `mmaptest.c` is sufficient. The following version therefore does not support nonmultiples of `PGSIZE`. I also wrote a version that does, but it has not been tested at all because I was too lazy to write an enhanced `mmaptest.c`. Perhaps I will do so when I have time.

Normal version:

```c
// in vm.c
int
mmap_writeback(pagetable_t pt, uint64 src_va, uint64 len, struct mmap_vma* vma){
// Write dirty page frames back to the file and remove their mappings.
// Write back len bytes beginning at src_va.
  uint64 a;
  pte_t *pte;
  for(a = PGROUNDDOWN(src_va); a < PGROUNDDOWN(src_va + len); a += PGSIZE){
    if((pte = walk(pt, a, 0)) == 0){ 
      panic("mmap_writeback: walk");
    }
    if(PTE_FLAGS(*pte) == PTE_V)
      panic("mmap_writeback: not leaf");
    if(!(*pte & PTE_V)) continue; // Lazy allocation

    if((*pte & PTE_D) && (vma->flags & MAP_SHARED)){ 
      // Write back
      begin_op();
      ilock(vma->file->ip);
      uint64 copied_len = a - src_va;
      writei(vma->file->ip, 1, a, copied_len, PGSIZE);
      iunlock(vma->file->ip);
      end_op();
    }
    kfree(PTE2PA(*pte));
    *pte = 0;
  }
  return 0;
}
```

Version supporting values that are not multiples of `PGSIZE` (untested):

```c
//in vm.c
int
mmap_writeback_na(pagetable_t pt, uint64 src_va, uint64 len, struct mmap_vma* vma){
  uint64 a;
  pte_t *pte;
  a = PGROUNDDOWN(src_va);

  if(a == PGROUNDDOWN(src_va + len)){ 
    // The unmapped portion lies within a single page frame
    begin_op();
    ilock(vma->file->ip);
    writei(vma->file->ip, 1, src_va, 0, src_va - a);
    iunlock(vma->file->ip);
    end_op();
  }

  for(; a < PGROUNDDOWN(src_va + len); a += PGSIZE){ // This part handles only complete pages;
                                                     // an ending in the middle of a page is not handled here
    if((pte = walk(pt, a, 0)) == 0){ 
      panic("mmap_writeback: walk");
    }
    if(PTE_FLAGS(*pte) == PTE_V)
      panic("mmap_writeback: not leaf");
    if(!(*pte & PTE_V)) continue; // Lazy allocation
    if((*pte & PTE_D) && (vma->flags & MAP_SHARED)){ 
      // Write back
      begin_op();
      ilock(vma->file->ip);
      // On the first iteration, a may be smaller than src_va
      uint64 copied_len = a - src_va;
      if(a < src_va){ 
        // The first page frame is incomplete.
        // This case still requires kfree because the range crosses a page-frame boundary.
        writei(vma->file->ip, 1, src_va, 0, src_va - a); 
      } else {
        writei(vma->file->ip, 1, a, copied_len, PGSIZE);
      } 
      iunlock(vma->file->ip);
      end_op();
    }
    kfree(PTE2PA(*pte));
    *pte = 0;
  }
  
  uint64 copied_len = a - src_va;
  uint64 len_left = vma->sz - copied_len;

  if (len_left){
    // Handle an unmap range ending in the middle of a page frame
    begin_op();
    ilock(vma->file->ip);
    writei(vma->file, 1, a, copied_len, len_left);
    if(len_left + a == vma->sz + src_va){ // The page frame where it stops is exactly the final one
      pte_t *pte;
      if((pte = walk(pt, a, 0)) == 0){ 
        panic("mmap_writeback: walk");
      }
      kfree(PTE2PA(*pte));
    }
    iunlock(vma->file->ip);
    end_op();
  }

  return 0;
}
```

By comparison, `munmap()` itself is fairly simple. One detail remains important: if no part of the mapped region remains after unmapping, the corresponding file is no longer needed. We therefore call `fileclose()` to decrement its reference count and close it.

We also must not forget the restriction on removing a mapping: it can be removed only from its beginning or end, not by punching a hole in the middle, as described at the start of this article.

```c
// in sysfile.c
uint64
munmap(uint64 addr, uint64 len){
  struct proc* p = myproc();
  struct mmap_vma* cur_vma = get_vma_by_addr(addr);
  if(!cur_vma)
    return -1;

  if(addr > cur_vma->sta_addr && addr + len < cur_vma->sta_addr + cur_vma->sz){
    // Attempt to punch a hole in the middle
    return -1;
  }

  mmap_writeback(p->pagetable, addr, len, cur_vma);
 
  if(addr == cur_vma->sta_addr){ 
    // Removing from the starting position
    cur_vma->sta_addr += len;
  } 
  cur_vma->sz -= len;
  
  if(cur_vma->sz <= 0){
    // The entire mapped region is gone
    fileclose(cur_vma->file);
    cur_vma->in_use = 0;
  }
  return 0;  
}
```

You may notice that this function is not written as a system call. That is because we will also need to invoke it from inside the kernel. The system-call wrapper is:

```c 
uint64
sys_munmap(){
  // int munmap(void *addr, size_t length);
  uint64 addr;
  uint64 len;
  try(argaddr(0, &addr),  return -1)
  try(argaddr(1, &len), return -1)
  return munmap(addr, len);
}
```

The kernel needs to call `munmap()` because some processes may exit without unmapping their files. We must forcibly clean up those mappings to prevent memory leaks, and this cleanup can be placed in `exit()`.

Why place it in `exit()` rather than in `freeproc()`, which actually releases the process slot? Observe that a process is passed to `freeproc()` by `wait()` as follows:

```c
// in proc.c wait():
……
  for(;;){
    // Scan through table looking for exited children.
    havekids = 0;
    for(np = proc; np < &proc[NPROC]; np++){
      if(np->parent == p){
        // make sure the child isn't still in exit() or swtch().
        acquire(&np->lock);

        havekids = 1;
        if(np->state == ZOMBIE){
          // Found one.
          pid = np->pid;
          if(addr != 0 && copyout(p->pagetable, addr, (char *)&np->xstate,
                                  sizeof(np->xstate)) < 0) {
            release(&np->lock);
            release(&wait_lock);
            return -1;
          }
          freeproc(np); // Notice that freeproc is called only when the parent waits.
          release(&np->lock);
          release(&wait_lock);
          return pid;
        }
        release(&np->lock);
      }
    }
    ……
  }
……
```

If the parent process never calls `wait()`, these mapped files remain indefinitely and are never written back. Of course, a parent process ought to call `wait()`. The main reason I used `exit()` is that the lab hint says to do so, but the behavior just described may be why the hint makes that recommendation.

```c
// in proc.c exit():
void
exit(int status)
{
  struct proc *p = myproc();

  if(p == initproc)
    panic("init exiting");

  // Release and write back mmap data before closing files
  for(int i = 0; i < VMA_SZ; i++){
    if(p->mmap_vams[i].in_use){
      try(munmap(p->mmap_vams[i].sta_addr, p->mmap_vams[i].sz), panic("exit: munmap"));
    }
  }

  // Close all open files.
  for(int fd = 0; fd < NOFILE; fd++){
    if(p->ofile[fd]){
      struct file *f = p->ofile[fd];
      fileclose(f);
      p->ofile[fd] = 0;
    }
  }
……
}
```

The final step of the lab is allowing a child process to access mapped files after `fork()`. As mentioned earlier, we only need to copy the VMA. Its `sta_addr` is a virtual address. When the child attempts to access it, a page fault occurs because that virtual address has not been mapped to a physical address.

In `mmap_fault_handler()`, we then find that the faulting address belongs to a file-mapped region. The handler allocates a physical page for that virtual page and copies the corresponding file data into it.

Of course, after `fork()` another process is using the mapped file, so `filedup()` must increment its reference count.

`fork()`:

```c
// in proc.c
……
  for (int i = 0; i < VMA_SZ; i++){
    if(p->mmap_vams[i].in_use){
      np->mmap_vams[i] = p->mmap_vams[i]; 
      filedup(p->mmap_vams[i].file);
      // Copy the VMA
    }
  }
……
```

Initially I had a small question here. The earlier call to `uvmcopy()` had already copied the memory, so would it not copy the VMAs too? If we copied them afterward, would that duplicate the mappings?

Reading the implementation resolved the question: `uvmcopy()` copies only memory below `myproc()->sz`:

```c
// in vm.c
  for(i = 0; i < sz; i += PGSIZE){ // Notice the range here
    if((pte = walk(old, i, 0)) == 0)
      panic("uvmcopy: pte should exist");
    if((*pte & PTE_V) == 0)
      panic("uvmcopy: page not present");
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
```

After completing these changes, the lab passes. I wish everyone currently working on it an early AC as well:

![](/img/xv6/lab/lab11_AC.png)

## Complaints

I absolutely have to complain about a bug here, although I do not even know where the bug belongs: xv6, QEMU, or the Makefile.

While debugging with GDB, I wanted to use macros, mainly `PGROUNDDOWN()` and `PGROUNDUP()`. I therefore added the `-g3` compilation option to the Makefile as follows:

```Makefile
CFLAGS = -Wall -O -g3 -fno-omit-frame-pointer -ggdb -UFDEBUG
```

This caused one of the tests in `usertest.c` to fail with an immediate panic:

```shell
$ usertests writebig
usertests starting
test writebig: panic: balloc: out of blocks
```

Removing `-g3` somehow made everything work normally. I could never have imagined that a compiler option might affect the number of blocks on the virtual disk. I spent an entire day debugging this because who would expect a compiler option to have such an effect? Eventually I used Git to compare the files on this branch with other branches and tested the differences one by one until I found it.

I reported the problem on the [xv6-riscv GitHub repository](https://github.com/mit-pdos/xv6-riscv/issues/133). While browsing the issue tracker, I found something even more absurd:

<https://github.com/mit-pdos/xv6-riscv/issues/59>

Adding `-O3` to the compiler options can apparently cause the same problem. I simply do not understand it.
