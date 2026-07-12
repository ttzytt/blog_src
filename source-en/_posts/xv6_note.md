---
title: "xv6 Notes: Page Tables and Traps"
date: 2022-07-06 23:09:46
updated: 2022-10-15 18:55:58
tags:
categories:
- Study Notes
keywords:
- UNIX
- xv6
- Operating Systems
- Page Tables
- Traps
- Assembly
- Low-level
description:
top_img: "linear-gradient(to right, #2c3e50, #4ca1af)"
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/07/xv6_note/).
{% endnote %}

Book link, Chinese translation: <https://github.com/duguosheng/6.S081-All-in-one>

# Chapter Zero

I could understand most of this chapter, but the example program involving a pipe confused me for a long time. I finally understood it, so I will record my interpretation here.

```cpp
int p[2];// p[0] stores the receiving descriptor and p[1] stores the sending descriptor
char *argv[2];
argv[0] = "wc"; // The first argument is the command name
argv[1] = 0; //stdin
pipe(p);
// child p[0] <--------- p[1] parent
if(fork() == 0) {
 close(0);
 dup(p[0]);
 close(p[0]);
 close(p[1]);
 exec("/bin/wc", argv);
} else {
 write(p[1], "hello world\n", 12);
 close(p[0]);
 close(p[1]);
}
```

First, note that file descriptors are shared between a parent and child process. In the example, `pipe()` appears to open another pipe after the child starts. In reality, the open descriptors are shared, so `p[0]` and `p[1]` in the parent and child refer to the same files, enabling communication between the processes.

According to *Advanced Programming in the UNIX Environment*, parents and children also share the following resources besides files, although I understand almost none of them.

<div align=center width=60%>
  <img width=60% src="/img/xv6/note/父子进程共享资源.png" >
</div>

Their differences are:

<div align=center width=60%>
  <img width=60% src="/img/xv6/note/父子进程不同点.png" >
</div>

After the parent obtains the pipe descriptors through `pipe()`, it writes `hello world` to `p[1]`, the sending end, and closes both ends. This part is easy to understand.

The child first calls `close(0)`. Descriptor $0$ represents stdin. It then calls `dup(p[0])` to duplicate descriptor `p[0]` onto another descriptor.

For example, after `x = dup(y)`, x and y refer to the same file. Here, however, the return value from `dup()` is ignored. How do we know which descriptor receives the duplicate?

`dup()` searches descriptors in increasing order and selects the first closed one. The child closed stdin, descriptor $0$, immediately beforehand, so `dup()` naturally redirects `p[0]` to stdin. Reading stdin is now equivalent to reading `p[0]`.

The child next calls `exec()` to run `wc`, a command that counts words in a file. Its arguments contain `argv[1] = 0`, meaning that `wc` should count the contents of standard input.

An important property of `exec()` is that the system replaces the current process image with the new program. The process becomes the program passed to `exec()`, so a successful call never returns. To avoid replacing the current process, first call `fork()` and then invoke `exec()` in the child.

Because of the earlier `dup()`, standard input now points to `p[0]`. The data counted by `wc` is therefore what the parent sent through `p[1]`: the `hello world` from `write(p[1], "hello world\n", 12)`.

Another point initially seemed strange. If the parent and child share file descriptors, are `p[0]` and `p[1]` not closed twice, causing a problem?

I found [this article](https://blog.csdn.net/qq_41822235/article/details/81544503), which finally clarified it.

>When `close()` closes a file, it does not necessarily close the underlying file immediately. It finds `f_count` in the `file` structure and decrements it. The actual close occurs only when `f_count` reaches zero. This well-known technique is reference counting.

# Page Tables

I strongly recommend this article: <https://zhuanlan.zhihu.com/p/351646541>. It introduces xv6 page tables in great detail, and the discussion below refers to it extensively.

## Introduction to page tables

A page table is a special data structure that implements memory virtualization in an operating system. It stores mappings from virtual addresses to physical addresses. The OS maintains a page table for every process, and a process can access physical memory only through that page table. Each process therefore **appears** to own all of the machine's resources, and a memory leak in one process does not affect another process's address space.

The CPU's memory-management unit translates virtual addresses into physical addresses:

![](/img/xv6/note/riscv_mmu.jpg)

Besides strengthening process isolation, page tables and virtual addresses allow memory to be used more efficiently. In practice, finding one large continuous free region in physical memory is difficult. A program may request memory when the total free space is sufficient, yet no single contiguous region is large enough. As programs and data are repeatedly moved out of and loaded into memory, fragmentation increases. Page tables divide memory into pages, allowing contiguous virtual memory to map to discontinuous physical frames and thereby using space more efficiently.

Page tables and virtual memory also enable many other useful tricks, such as mapping one physical address at two virtual addresses simultaneously.

## RISC-V page-table implementation

The simplest page-table implementation would resemble an array recording the virtual mapping for every physical page frame. In xv6, one frame is 4 KB.

Such a linear array itself consumes a large amount of storage. Most personal computers now have at least 8 GB of memory, so let us calculate the page-table space required for 8 GB.

With 4 KB frames, 8 GB contains $(8 \times 2^{30}) \div (4 \times 2^{10}) = 2097125$ page frames. Every frame needs a virtual-address mapping. Assuming a 64-bit machine, which an 8 GB computer must be, one address takes eight bytes. The page table therefore requires $2097125 \times 8 \div 2^{20} = 16\text{MB}$.

Sixteen megabytes would not itself be alarming on an 8 GB computer. The key problem is that every process needs a separate page table for its own virtual address space, with kernel and user page tables also separate. With fifty running processes, page tables would consume $16\text{MB} \times 2 \times 50 = 1.6\text{GB}$, which is clearly unacceptable.

To solve this problem, RISC-V and almost every other modern processor use multilevel page tables.

RISC-V uses three levels, which can be viewed as a three-level tree. The root has 512 entries, all of which occupy the root page. Entries at the remaining two levels can each lead to as many as 512 children, but the child tables need not exist.

These entries are formally called PTEs, Page Table Entries. Each PTE occupies 64 bits, of which 44 encode a physical page number and ten are flags describing the next page table or final memory page.

This explains why lower-level page tables need not all exist and why the hierarchy saves space. A flag in a PTE indicates whether the next table exists. If it does not, no storage is needed for that table. With a single-level page table, even an invalid mapping still requires its PTE to occupy a slot.

Multilevel page tables and PTE flags also make it possible to swap portions of page tables to disk and retrieve them only when needed, saving still more memory.

How is a virtual address translated after the CPU receives it?

First consider the virtual-address format used by xv6. Possibly for teaching convenience, xv6 uses only the low 39 bits; the upper 25 bits are reserved.

The CPU's satp register points to the current root page table. The virtual address is interpreted relative to the table identified by satp.

The process is shown here:

![](/img/xv6/note/riscv_pagetable.png)

The first nine relevant bits select a PTE in the root table. That PTE contains a physical page number leading to the next-level table. Because there are three levels, this selection repeats three times. Each level consumes nine virtual-address bits. The remaining twelve bits are the offset inside the final 4 KB frame, since $2^{12}=4096$.

The lower part of the diagram shows PTE flags, including:

- V, valid, indicates that the page table or frame referenced by the PTE exists.
- R, readable, controls reads.
- W, writable, controls writes.
- X, executable, allows the memory contents to be executed as instructions.
- And others.

## xv6 kernel virtual-memory layout

![](/img/xv6/note/kernel_pagetable.png)

In QEMU, RAM begins at 0x80000000, KERNBASE. Addresses below it correspond to I/O devices such as the network card and interrupt controllers; reading and writing those memory-mapped addresses communicates with the devices. RAM ends at 0x86400000, PHYSTOP, for a total of 128 MB.

Except for two special regions, the kernel directly maps virtual addresses to the same physical addresses. This makes physical-memory manipulation convenient. The direct mapping also lets the kernel simulate MMU translation and read user data under a different page table through functions such as `walk`, discussed later.

The two regions not simply direct-mapped are the trampoline and kernel stacks.

The trampoline is mapped at the top of virtual memory. The same physical page is mapped at the top of every user page table. The reason becomes clear in the trap section.

Each kernel stack is mapped once near the top with guard pages and also exists in the middle direct-mapped region. This duplication supports the guard-page design.

A guard page prevents stack overflow. Its PTE lacks the V flag, so accessing it causes a page fault.

Kernel stacks are separated by guard pages. If a stack overflows into one of them, a fault occurs instead of silently accessing memory belonging elsewhere.

To save physical space, guard pages do not map to physical memory at all. This is an example of virtual memory's flexibility: one physical address may be mapped at several virtual addresses, and a virtual address may map to no physical address.

## xv6 user virtual-memory layout

![](/img/xv6/note/user_pagetable.png)

The user layout is mostly ordinary except for the trampoline at the top, whose physical page is also mapped into the kernel as described above.

Immediately below the trampoline is the trapframe, which stores register state during system calls and traps.

## Some code

~~Postponed.~~

# Traps

## Purpose of the trap mechanism

Normally, a program executes in a roughly linear sequence, one instruction after another.

Certain events break this linear flow. A familiar example is a system call, which pauses the user program, enters the kernel to perform a service, and later returns to user mode.

xv6 calls this transition between user and kernel mode for special events a trap.

The following illustration[^1] makes the name vivid: execution seems to fall into a pit and then climb back out.

![](/img/xv6/note/trap_illu.webp)

Traps commonly arise from:

- System calls.
- Exceptions, such as division by zero.
- Device interrupts, such as timer interrupts.

Several registers participate in trap handling:

- stvec, Supervisor Trap Vector Base Address, contains the trap-handler address. On a trap, execution jumps to this address for further handling.
- sepc, Supervisor Exception Program Counter, preserves the original next program counter so execution can resume after the trap.
- scause, Supervisor Trap Cause, records whether the cause was a system call, exception, or interrupt.
- sscratch, Scratch Register for Supervisor Trap Handlers, generally stores the trapframe location.
- sstatus, Supervisor Status Register, holds flags shown here: ![](/img/xv6/note/sstatus_bits.png). Important bits include SIE, Supervisor Interrupt Enable, and SPP, Supervisor Previous Privilege. A clear SIE disables interrupts, which is necessary while handling a trap. SPP records whether the trap came from user or supervisor mode.
- satp, Supervisor Address Translation and Protection, contains the current root page table, as mentioned in the page-table section.

## Trapping from user mode

We will use a system call to illustrate xv6's trap mechanism.

The [Lab 2 record](/2022/07/xv6_lab2_record) mentioned that `ecall` switches from user to kernel mode without explaining every intermediate step. After studying traps, the missing process becomes understandable.

The `ecall` instruction performs the following operations.[^2]

- For a device interrupt—strictly not an ecall—do nothing if SIE is zero and interrupts are disabled.
- Clear SIE to disable interrupts, because the ecall itself produces a trap and two traps must not be handled simultaneously.
- Store the current mode in the SPP bit of sstatus.
- Change the current privilege to supervisor mode.
- Copy pc to sepc so the original location can later be restored.
- Copy stvec, the handler address, to pc, automatically jumping to the handler.
- Set scause to reflect the trap reason.

After ecall, execution jumps to the address in stvec. For a user trap in xv6, stvec points to `uservec` in `kernel/trampoline.S`; in kernel mode it points to `kernelvec` in `kernel/kernelvec.S`.

`kernelvec` is initially installed by `trapinithart()` from `main()`:

```c
// set up to take exceptions and traps while in the kernel.
void
trapinithart(void)
{
  w_stvec((uint64)kernelvec);
}
```

The function writes the address of `kernelvec` into stvec.

Our example traps from user mode, so first examine `uservec` in `kernel/trampoline.S`.

### uservec

```nasm
uservec:    
 #
        # trap.c sets stvec to point here, so
        # traps from user space start here,
        # in supervisor mode, but with a
        # user page table.
        #
        # sscratch points to where the process's p->trapframe is
        # mapped into user space, at TRAPFRAME.
        #
        
 # swap a0 and sscratch
        # so that a0 is TRAPFRAME
        csrrw a0, sscratch, a0

        # save the user registers in TRAPFRAME

        sd ra, 40(a0)
        sd sp, 48(a0)
        sd gp, 56(a0)
        sd tp, 64(a0)
        sd t0, 72(a0)
        sd t1, 80(a0)
        sd t2, 88(a0)
        sd s0, 96(a0)
        sd s1, 104(a0)
        sd a1, 120(a0)
        sd a2, 128(a0)
        sd a3, 136(a0)
        sd a4, 144(a0)
        sd a5, 152(a0)
        sd a6, 160(a0)
        sd a7, 168(a0)
        sd s2, 176(a0)
        sd s3, 184(a0)
        sd s4, 192(a0)
        sd s5, 200(a0)
        sd s6, 208(a0)
        sd s7, 216(a0)
        sd s8, 224(a0)
        sd s9, 232(a0)
        sd s10, 240(a0)
        sd s11, 248(a0)
        sd t3, 256(a0)
        sd t4, 264(a0)
        sd t5, 272(a0)
        sd t6, 280(a0)

 # save the user a0 in p->trapframe->a0
        csrr t0, sscratch
        sd t0, 112(a0)

        # restore kernel stack pointer from p->trapframe->kernel_sp
        ld sp, 8(a0)

        # make tp hold the current hartid, from p->trapframe->kernel_hartid
        ld tp, 32(a0)

        # load the address of usertrap(), p->trapframe->kernel_trap
        ld t0, 16(a0)

        # restore kernel page table from p->trapframe->kernel_satp
        ld t1, 0(a0)
        csrw satp, t1
        sfence.vma zero, zero

        # a0 is no longer valid, since the kernel page
        # table does not specially map p->tf.

        # jump to usertrap(), which does not return
        jr t0
```

Several parts are especially important. The first is:

```
csrrw a0, sscratch, a0
```

This instruction exchanges a0 and sscratch. From this point onward, a0 points to the trapframe. sscratch cannot be used directly by ordinary loads and stores because it is a privileged CSR; instructions such as `sd` and `ld` operate on general-purpose registers, while CSR instructions manipulate privileged registers.

Instructions such as `sd ra, 40(a0)` then copy register values into the trapframe in memory. Kernel C code accesses that memory through `struct trapframe`:

```c
struct trapframe {
  /*   0 */ uint64 kernel_satp;   // kernel page table
  /*   8 */ uint64 kernel_sp;     // top of process's kernel stack
  /*  16 */ uint64 kernel_trap;   // usertrap()
  /*  24 */ uint64 epc;           // saved user program counter
  /*  32 */ uint64 kernel_hartid; // saved kernel tp
  /*  40 */ uint64 ra;
  ……
  /* 264 */ uint64 t4;
  /* 272 */ uint64 t5;
  /* 280 */ uint64 t6;
};
```

`sd` means store. It writes ra to the address in a0 plus a 40-byte offset.

All general registers except the original a0 have now been copied, so save a0 separately:

```nasm
# save the user a0 in p->trapframe->a0
    csrr t0, sscratch
    sd t0, 112(a0)
```

Because of the earlier swap, sscratch currently contains the user's a0. Copying it to t0 makes t0 equal to the original user a0, and `sd t0, 112(a0)` stores that value in the trapframe.

Next, completely switch the processor environment to the kernel. The process was using the user page table and stack pointer, so the corresponding registers must be replaced.

The following code performs the switch. `ld`, load, copies values from memory into registers:

```nasm
# restore kernel stack pointer from p->trapframe->kernel_sp
ld sp, 8(a0)

# make tp hold the current hartid, from p->trapframe->kernel_hartid
ld tp, 32(a0)

# load the address of usertrap(), p->trapframe->kernel_trap
ld t0, 16(a0)

# restore kernel page table from p->trapframe->kernel_satp
ld t1, 0(a0)
csrw satp, t1
sfence.vma zero, zero
```

An elegant detail is that the trampoline page, which contains `uservec`, has the same virtual address in the kernel and user page tables. The same physical page is mapped twice. Execution can therefore continue in `uservec` immediately after `csrw satp, t1` changes the active page table.

The kernel context values in the trapframe—the kernel root page table, stack pointer, and so on—were saved when the kernel previously entered user mode.

They are assigned in `usertrapret()` in `kernel/trap.c`:

```c
// set up trapframe values that uservec will need when
// the process next re-enters the kernel.
p->trapframe->kernel_satp = r_satp();         // kernel page table
p->trapframe->kernel_sp = p->kstack + PGSIZE; // process's kernel stack
p->trapframe->kernel_trap = (uint64)usertrap;
p->trapframe->kernel_hartid = r_tp();         // hartid for cpuid()
```

The final instruction of `uservec` is:

```nasm
jr t0
```

It jumps to the address in t0. Recall that immediately beforehand the following loaded the `usertrap` address:

```nasm
# load the address of usertrap(), p->trapframe->kernel_trap
ld t0, 16(a0)
```

Thus, `jr t0` transfers control to `usertrap`.

In summary, `uservec`:

1. Saves the thread's 32 general-purpose registers.
2. Restores the kernel execution environment, including the kernel page table and stack pointer.
3. Jumps to `usertrap`.

### usertrap

The code is:

```c
void
usertrap(void)
{
  int which_dev = 0;

  if((r_sstatus() & SSTATUS_SPP) != 0)
    panic("usertrap: not from user mode");

  // send interrupts and exceptions to kerneltrap(),
  // since we're now in the kernel.
  w_stvec((uint64)kernelvec);

  struct proc *p = myproc();
  
  // save user program counter.
  p->trapframe->epc = r_sepc();
  
  if(r_scause() == 8){
    // scause stores the trap cause
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
  } else {
    printf("usertrap(): unexpected scause %p pid=%d\n", r_scause(), p->pid);
    printf("            sepc=%p stval=%p\n", r_sepc(), r_stval());
    p->killed = 1;
  }

  if(p->killed)
    exit(-1);

  // give up the CPU if this is a timer interrupt.
  if(which_dev == 2){    
    yield();
  }
  usertrapret();
}
```

It first checks whether the trap came from user or kernel mode:

```c
if((r_sstatus() & SSTATUS_SPP) != 0)
 // SPP in sstatus records whether the trap came from user or kernel mode
    panic("usertrap: not from user mode");
```

SPP in sstatus records the previous privilege. If the trap came from the kernel, this user handler cannot process it and panics.

For a user trap, the function changes stvec to `kernelvec`:

```c
w_stvec((uint64)kernelvec);
```

If an interrupt occurs while the kernel is running, its handling differs from a user trap and cannot use `uservec`.

```c
p->trapframe->epc = r_sepc();
```

sepc is saved because kernel processing may switch to another process, which can itself make a system call and overwrite the hardware sepc register. Saving it in the process trapframe preserves the original value across such switches.

Interrupts are enabled with `intr_on()` only after this state has been saved. A system call may take a long time, and enabling interrupts then lets the CPU service other work without losing the current process's context.

The rest of `usertrap` dispatches according to the cause. A system call necessarily used `ecall`; after completing it, user mode should resume at the instruction following ecall, so the saved epc is advanced by four bytes.

Device interrupts are handled by `devintr()`.

An unexpected exception marks the process as killed.

In summary, `usertrap`:

1. Determines whether the cause is a system call, interrupt, or exception and performs the corresponding action.
2. Changes stvec for possible kernel traps, and saves or adjusts sepc as required.

The final line calls `usertrapret()` to prepare the return.

### usertrapret

```c  
void
usertrapret(void)
{
  struct proc *p = myproc();

  // we're about to switch the destination of traps from
  // kerneltrap() to usertrap(), so turn off interrupts until
  // we're back in user space, where usertrap() is correct.
  intr_off();

  // send syscalls, interrupts, and exceptions to trampoline.S
  w_stvec(TRAMPOLINE + (uservec - trampoline));

  // set up trapframe values that uservec will need when
  // the process next re-enters the kernel.
  p->trapframe->kernel_satp = r_satp();         // kernel page table
  p->trapframe->kernel_sp = p->kstack + PGSIZE; // process's kernel stack
  p->trapframe->kernel_trap = (uint64)usertrap;
  p->trapframe->kernel_hartid = r_tp();         // hartid for cpuid()

  // set up the registers that trampoline.S's sret will use
  // to get to user space.
  
  // set S Previous Privilege mode to User.
  unsigned long x = r_sstatus();
  x &= ~SSTATUS_SPP; // clear SPP to 0 for user mode
  x |= SSTATUS_SPIE; // enable interrupts in user mode
  w_sstatus(x);

  // set S Exception Program Counter to the saved user pc.
  w_sepc(p->trapframe->epc);

  // tell trampoline.S the user page table to switch to.
  uint64 satp = MAKE_SATP(p->pagetable);

  // jump to trampoline.S at the top of memory, which 
  // switches to the user page table, restores user registers,
  // and switches to user mode with sret.
  uint64 fn = TRAMPOLINE + (userret - trampoline);
  ((void (*)(uint64,uint64))fn)(TRAPFRAME, satp);
}
```

The function first disables interrupts and changes stvec from `kernelvec` back to `uservec`.

It then writes kernel-context values into the trapframe so that the next user trap can restore the kernel environment, exactly as described in the `uservec` section:

```c
p->trapframe->kernel_satp = r_satp();         // kernel page table
p->trapframe->kernel_sp = p->kstack + PGSIZE; // process's kernel stack
p->trapframe->kernel_trap = (uint64)usertrap;
p->trapframe->kernel_hartid = r_tp();         // hartid for cpuid()
```

sepc is restored because the trap-return instruction copies it back into pc before resuming user execution.

The final lines are:

```c
// jump to trampoline.S at the top of memory, which 
// switches to the user page table, restores user registers,
// and switches to user mode with sret.
uint64 fn = TRAMPOLINE + (userret - trampoline);
((void (*)(uint64,uint64))fn)(TRAPFRAME, satp);
```

This unusual function-pointer call jumps to another function in the trampoline page: `userret`.

In summary, `usertrapret`:

1. Copies kernel-context data into the trapframe, including the kernel page table, stack pointer, and kernel trap handler.
2. Restores stvec and sepc.
3. Calls `userret`.

stvec and sepc could conceptually be regarded as part of the same context-restoration process even though they are not ordinary trapframe fields.

### userret

`userret` is essentially the inverse of `uservec`.

It receives two arguments, the trapframe address and user page-table value. Under the xv6 calling convention they arrive in a0 and a1.

```nasm
userret:
        # userret(TRAPFRAME, pagetable)
        # switch from kernel to user.
        # usertrapret() calls here.
        # a0: TRAPFRAME, in user page table.
        # a1: user page table, for satp.

        # switch to the user page table.
        csrw satp, a1
        sfence.vma zero, zero

        # put the saved user a0 in sscratch, so we
        # can swap it with our a0 (TRAPFRAME) in the last step.
        ld t0, 112(a0)
        # After ld, t0 stores the user's a0.
        # 112(a0) contains the user's a0.
        # The current a0 is the passed trapframe address.
        csrw sscratch, t0
        # Move t0 into sscratch, so sscratch stores the user's a0

        # restore all but a0 from TRAPFRAME
        ld ra, 40(a0)
        ld sp, 48(a0)
        ld gp, 56(a0)
        ld tp, 64(a0)
        ld t0, 72(a0)
        ld t1, 80(a0)
        ld t2, 88(a0)
        ld s0, 96(a0)
        ld s1, 104(a0)
        ld a1, 120(a0)
        ld a2, 128(a0)
        ld a3, 136(a0)
        ld a4, 144(a0)
        ld a5, 152(a0)
        ld a6, 160(a0)
        ld a7, 168(a0)
        ld s2, 176(a0)
        ld s3, 184(a0)
        ld s4, 192(a0)
        ld s5, 200(a0)
        ld s6, 208(a0)
        ld s7, 216(a0)
        ld s8, 224(a0)
        ld s9, 232(a0)
        ld s10, 240(a0)
        ld s11, 248(a0)
        ld t3, 256(a0)
        ld t4, 264(a0)
        ld t5, 272(a0)
        ld t6, 280(a0)

 # restore user a0, and save TRAPFRAME in sscratch
        csrrw a0, sscratch, a0
        
        # return to user mode and user pc.
        # usertrapret() set up sstatus and sepc.
        sret # The counterpart to ecall
```

The function restores all general-purpose registers from the trapframe, switches to the user page table, and finally executes `sret`.

Like `ecall`, `sret` performs several operations:

- Switches back to user mode.
- Copies sepc into pc.
- Enables interrupts.

User execution can then continue normally.

In summary, `userret`:

1. Restores the 32 general-purpose registers.
2. Restores the page table.
3. Executes `sret`.

# Interrupts

To be updated. ~~Postponed.~~
<!-- RISC-V hardware support for interrupts:

1. SIE register: enables external, software, and timer interrupts.
2. SSTATUS: enables interrupts on each core.
3. SIP, interrupt pending: indicates interrupt type.
4. scause.
5. stvec. -->

# Thread Scheduling

## Introduction

Modern operating systems generally provide multithreading, meaning that several tasks run **apparently** at the same time. The main reasons include:[^3]

- Computers sometimes need to execute multiple tasks concurrently. Modern operating systems, for example, allow several users to log in and run their own processes.
- Multithreading can improve program structure and make code easier to understand and maintain. The prime-number exercise in Lab 1 uses multiple processes to improve structure.
- Multithreaded designs can better use modern multicore processors.

In practice, a processor usually runs different tasks for short time slices, switching rapidly among threads to create the appearance of simultaneous execution.

Multithreading provides these benefits but also raises difficulties:[^3]

- How should execution switch between threads?
- A switch must save and restore thread state, so exactly what information must be preserved?
- A compute-intensive thread may run for a very long time without voluntarily yielding. How can the operating system regain control of the processor?

The following discussion uses a switch from one user process to another to explain xv6's implementation.

This diagram from the xv6 book summarizes the process-switching path:

![](/img/xv6/note/线程切换.png)

## Code

### Interrupt

Most process switches begin with a hardware timer interrupt. xv6 configures the RISC-V processor to generate such interrupts periodically, notifying the kernel that the current process has occupied the CPU long enough and should be switched out.

If the CPU is executing a user program when the interrupt arrives, as in the diagram, `usertrap()` in `kernel/trap.c` handles it:

```c
……
 if(p->killed)
    exit(-1);

  // give up the CPU if this is a timer interrupt.
  if(which_dev == 2) // which_dev equal to 2 means the timer caused the interrupt
    yield();

  usertrapret();
}
```

When the interrupting device is the timer, it calls `yield()`:

```c
// Give up the CPU for one scheduling round.
void
yield(void)
{
  struct proc *p = myproc();
  acquire(&p->lock);
  p->state = RUNNABLE;
  sched();
  release(&p->lock);
}
```

Apart from locking and unlocking the process, `yield()` calls `sched()`.

`sched()` is itself largely a wrapper around `swtch()`:

```c
// Switch to scheduler.  Must hold only p->lock
// and have changed proc->state. Saves and restores
// intena because intena is a property of this
// kernel thread, not this CPU. It should
// be proc->intena and proc->noff, but that would
// break in the few places where a lock is held but
// there's no process.
void
sched(void)
{
  int intena;
  struct proc *p = myproc();

  if(!holding(&p->lock))
    panic("sched p->lock");
  if(mycpu()->noff != 1)
    panic("sched locks");
  if(p->state == RUNNING)
    panic("sched running");
  if(intr_get())
    panic("sched interruptible");

  intena = mycpu()->intena;
  swtch(&p->context, &mycpu()->context);
  mycpu()->intena = intena;
}
```

### Switching

The checks and panics at the start validate the state; the essential operation is `swtch()`. Its name lacks an i because `switch` is a C keyword.

`swtch` is implemented in assembly in `kernel/swtch.S`:

```nasm
# Context switch
#
#   void swtch(struct context *old, struct context *new);
# 
# Save current registers in old. Load from new. 


.globl swtch
swtch:
        sd ra, 0(a0)
        sd sp, 8(a0)
        sd s0, 16(a0)
        sd s1, 24(a0)
        sd s2, 32(a0)
        sd s3, 40(a0)
        sd s4, 48(a0)
        sd s5, 56(a0)
        sd s6, 64(a0)
        sd s7, 72(a0)
        sd s8, 80(a0)
        sd s9, 88(a0)
        sd s10, 96(a0)
        sd s11, 104(a0)

        ld ra, 0(a1)
        ld sp, 8(a1)
        ld s0, 16(a1)
        ld s1, 24(a1)
        ld s2, 32(a1)
        ld s3, 40(a1)
        ld s4, 48(a1)
        ld s5, 56(a1)
        ld s6, 64(a1)
        ld s7, 72(a1)
        ld s8, 80(a1)
        ld s9, 88(a1)
        ld s10, 96(a1)
        ld s11, 104(a1)
        
        ret
```

It saves selected current registers into `old->context`, loads values from `new->context`, and assigns them to the processor registers.

Its actual purpose is to switch kernel-thread context, for example from the shell process's kernel stack to the scheduler stack shown in the diagram.

{% note info %}
At this point, it may seem strange that `swtch()` changes thread context but saves only fourteen registers rather than all 32 as the trapframe does.

Under the xv6 calling convention, s0 through s11 are callee-saved. The remaining general registers are caller-saved.

Those remaining registers can already be recovered from the stack through offsets from sp, so `swtch()` has no reason to save them again.

For the exact caller- and callee-saved classifications, see this RISC-V documentation table:

![](/img/xv6/lab/riscv_calling.png)

{% endnote %}

The saved and restored ra and sp deserve particular attention.

ra determines where `swtch()` returns, while sp determines the active stack. Thus, after the switch, the function does not necessarily return to the final statement in the current invocation of `sched()`. It returns to the location stored in `mycpu()->context.ra` using the restored scheduler stack.

### Scheduling

The ra in `mycpu()->context` points into `scheduler()`, matching the process shown in the diagram:

```c
// Per-CPU process scheduler.
// Each CPU calls scheduler() after setting itself up.
// Scheduler never returns.  It loops, doing:
//  - choose a process to run.
//  - swtch to start running that process.
//  - eventually that process transfers control
//    via swtch back to the scheduler.
void
scheduler(void)
{
  struct proc *p;
  struct cpu *c = mycpu();
  
  c->proc = 0;
  for(;;){
    // Avoid deadlock by ensuring that devices can interrupt.
    intr_on();

    for(p = proc; p < &proc[NPROC]; p++) {
      acquire(&p->lock);
      if(p->state == RUNNABLE) {
        // Switch to chosen process.  It is the process's job
        // to release its lock and then reacquire it
        // before jumping back to us.
        p->state = RUNNING;
        c->proc = p;
        swtch(&c->context, &p->context); // Return here

        // Process is done running for now.
        // It should have changed its p->state before coming back.
        c->proc = 0;
      }
      release(&p->lock);
    }
  }
}
```

Why does it return there? Examine `kernel/main.c`:

```c
#include "types.h"
#include "param.h"
#include "memlayout.h"
#include "riscv.h"
#include "defs.h"

volatile static int started = 0;

// start() jumps here in supervisor mode on all CPUs.
void
main()
{
  if(cpuid() == 0){
    consoleinit();
    printfinit();
    printf("\n");
    printf("xv6 kernel is booting\n");
    printf("\n");
    kinit();         // physical page allocator
    kvminit();       // create kernel page table
    kvminithart();   // turn on paging
    procinit();      // process table
    trapinit();      // trap vectors
    trapinithart();  // install kernel trap vector
    plicinit();      // set up interrupt controller
    plicinithart();  // ask PLIC for device interrupts
    binit();         // buffer cache
    iinit();         // inode table
    fileinit();      // file table
    virtio_disk_init(); // emulated hard disk
    userinit();      // first user process
    __sync_synchronize();
    started = 1;
  } else {
    while(started == 0)
      ;
    __sync_synchronize();
    printf("hart %d starting\n", cpuid());
    kvminithart();    // turn on paging
    trapinithart();   // install kernel trap vector
    plicinithart();   // ask PLIC for device interrupts
  }

  scheduler(); // Notice this line
}

```

After initialization, each CPU enters `scheduler()`. When `scheduler()` finds a RUNNABLE process, it calls `swtch(&c->context, &p->context)`.

At that moment, sp and ra refer to the scheduler function, so saving them in `mycpu()->context` records the address immediately after the scheduler's `swtch()`.

The behavior feels like a portal and time machine. Calling `swtch()` in one location returns from a call made much earlier, in computer terms, at another location. The call and return are separated: a call to `swtch` returns through the saved context of a different `swtch` call.[^4]

After `sched()` calls `swtch()`, execution resumes after the `swtch()` inside `scheduler()`. The scheduler searches for another RUNNABLE process and switches to it.

Before switching, it performs:

```c
p->state = RUNNING;
c->proc = p;
```

This changes the process state to RUNNING and records `p` as the current process of the CPU.

After the switch, `myproc()` can identify the process currently running on that CPU:

```c
// Return the current struct proc *, or zero if none.
struct proc*
myproc(void) {
  push_off();
  struct cpu *c = mycpu();
  struct proc *p = c->proc;
  pop_off();
  return p;
}
```

It simply returns the `proc` field from the CPU structure.

As described above, `swtch()` behaves like a portal. In `scheduler()`, switching to process p returns to the earlier `swtch()` invocation inside p's `sched()`:

```c
// Switch to scheduler.  Must hold only p->lock
// and have changed proc->state. Saves and restores
// intena because intena is a property of this
// kernel thread, not this CPU. It should
// be proc->intena and proc->noff, but that would
// break in the few places where a lock is held but
// there's no process.
void
sched(void)
{
  int intena;
  struct proc *p = myproc();
 
  ……
  
  intena = mycpu()->intena;
  swtch(&p->context, &mycpu()->context);
  mycpu()->intena = intena; // Continue here after returning.
}
```

In summary, `swtch()` called from `sched()` returns inside `scheduler()`, while `swtch()` called from `scheduler()` returns inside `sched()`.

After a timer interrupt, control reaches `scheduler()`, finds a runnable process, and restores that process's context through `swtch()`.

This explains the general process-switching and scheduling path, although several details remain.

### Locks

Both `yield()` and `scheduler()` perform lock operations. Why are they necessary?

First, trace their sequence. `scheduler()` acquires `p->lock` and calls `swtch()` to switch context. The target `sched()` returns into `yield()`, which releases `p->lock`.

In the opposite direction, a timer interrupt makes `yield()` acquire the process lock, and `sched()` calls `swtch()`, returning after the scheduler's `swtch()`. The scheduler then releases the process lock.

Like the split call and return of `swtch()`, acquisition and release of the process lock occur in different functions. A lock acquired by `yield()` is released by `scheduler()`, and one acquired by `scheduler()` is released by `yield()`.

The locked interval exactly covers the context-switch operation because the process structure is in an unstable state while a switch is underway.[^4]

For example, `yield()` marks the process RUNNABLE before the scheduler has actually switched it out. Another core running `scheduler()` could observe that RUNNABLE state and begin executing the same process, leaving two CPUs simultaneously running one process—a severe error.

With the lock held, another core encountering this incompletely switched RUNNABLE process blocks while trying to acquire its process lock. It cannot run the process until the original CPU completes the switch.

Lock acquisition also disables interrupts, preventing another timer interrupt during the switch.

### First scheduling

The preceding code shows that `swtch()` in `scheduler()` normally returns inside `sched()` because the process previously entered `sched()` after a timer interrupt and saved that context.

A newly created process has never experienced such an interrupt and has never called `sched()`. Immediately after initialization, `main.c` enters `scheduler()`. Where does the scheduler's first `swtch()` for a new process go?

The answer appears in `allocproc()`:

```c 
// Look in the process table for an UNUSED proc.
// If found, initialize state required to run in the kernel,
// and return with p->lock held.
// If there are no free procs, or a memory allocation fails, return 0.
static struct proc*
allocproc(void)
{
  ……

  // Set up new context to start executing at forkret,
  // which returns to user space.
  memset(&p->context, 0, sizeof(p->context));
  p->context.ra = (uint64)forkret; // Notice this line
  p->context.sp = p->kstack + PGSIZE;

  return p;
}

```

When the process is created, its saved ra is initialized to `forkret`. The first time `scheduler()` selects it, `swtch()` therefore jumps to `forkret()` rather than returning inside `sched()`.

`forkret()` simply prepares a direct return to user space:

```c 
// A fork child's very first scheduling by scheduler()
// will swtch to forkret.
void
forkret(void)
{
  static int first = 1;

  // Still holding p->lock from scheduler.
  release(&myproc()->lock);

  if (first) {
    // File system initialization must be run in the context of a
    // regular process (e.g., because it calls sleep), and thus cannot
    // be run from main().
    first = 0;
    fsinit(ROOTDEV);
  }

  usertrapret(); // Return to user space here
}
```


[^1]: <https://www.baeldung.com/cs/os-trap-vs-interrupt>
[^2]: <https://tarplkpqsm.feishu.cn/docs/doccnoBgv1TQlj4ZtVnP0hNRETd#>
[^3]: <https://mit-public-courses-cn-translatio.gitbook.io/mit6-s081/lec11-thread-switching-robert/11.1-thread>
[^4]: <https://zhuanlan.zhihu.com/p/353580321>
