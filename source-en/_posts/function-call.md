---
title: "How Function Calls Work and What They Enable"
date: 2022-04-20 23:53:01
updated: 2023-12-08 20:51:15
tags:
- Assembly
- Low-level
- Stack Frames
- DFS
- Experiments
- 2022
categories:
- Study Notes
keywords:
description:
top_img: "linear-gradient(to right, #2c3e50, #4ca1af)"
comments:
cover: /img/非递归dfs/cover.png
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/04/function-call/).
{% endnote %}

<!-- Preface: A few days ago, I watched an operating-systems lecture by Professor Jiang Yanyan of Nanjing University. His nonrecursive Tower of Hanoi gave me a new understanding of recursion and function calls and made me curious about their implementation. I decided to study function calls in detail and write something similar, such as a nonrecursive DFS. The latter is mainly an experiment rather than an OI optimization. -->

Update on 2022/12/18: thank you to [@adpitacor](https://www.luogu.com.cn/user/374733) and [@iterator_traits](https://www.luogu.com.cn/user/72922) for pointing out several typographical errors in the comments. They have now been corrected.

Update on 2022/11/24: I was surprised that this article was selected for Luogu Daily. I also feel that my older writing was not very strong, but since it was selected, I want to improve it as much as possible. I cannot rewrite the entire article, but I can add things learned since then, such as stack-overflow attacks and a backtrace implementation, so I added them before publication.

This update also corrected typographical errors, primarily thanks to [@cancan123456](https://www.luogu.com.cn/space/show?uid=448887). Many Luogu readers offered corrections and suggestions. [@szTom](https://www.luogu.com.cn/user/108422) mentioned shadow space in `__fastcall`; [@LiuTianyou](https://www.luogu.com.cn/user/206814) introduced forced inlining, which the newly added section uses; and [@小菜鸟](https://www.luogu.com.cn/user/60489) mentioned `longjmp`, which relates to returning through several functions at once. I am very grateful. As I learn these topics, I may add them gradually. I also want this article to be as understandable as possible, so please contact me if any wording is ambiguous or too concise.

# 1. How Is a Function Call Implemented?

## 1.1. A small example

```c
#include<stdio.h>
int add2(int a, int b) {return (a + b);}
int add1(int a, int b) {return (a + add2(a, b));}
int main(){
    int c = add1(114, 514);
    printf("%d\n", c);
}
```
In this program, `main` calls `add1`; `add1` calls `add2` and uses its result; only afterward does `main` execute `printf`.

Compare the completion order, $\text{add2} \rArr \text{add1} \rArr \text{main}$, with the starting order, $\text{main} \rArr \text{add1} \rArr \text{add2}$. A function that begins earlier ends later because it depends on the result of the function it called.

This is a stack, a last-in, first-out structure. In function calls, the latest function to begin is the first to finish.

We can abstract each invocation as one stack element. The CPU executes the function on top. A newly called function is pushed; a completed function is popped.

The following Manim video demonstrates the process:

{% raw %}
<video src='/video/非递归dfs/func_and_stk.mp4' type='video/mp4' controls='controls' width='100%' height='100%'></video>
{% endraw%}

## 1.2. Stack frames

### 1.2.1. Basic structure

The stack element representing one function invocation is a stack frame. What must it contain for the CPU to execute the function correctly?

First, a function may declare local variables. Successful execution requires access to them. Passed arguments can also be considered local variables.

Second, after the called function finishes, execution must return. The computer otherwise does not know which instruction follows. In the example, after `add1`, should it execute `printf` or jump directly to `return 0`? The frame must store a return address, the instruction to execute after returning.

Finally, an array-based stack needs a pointer to its top to know where the next element belongs. A frame needs both its end and its beginning so that popping it restores the preceding frame correctly.

On x86 and x86-64, two registers mark the beginning and end of the current frame: xbp, the base or frame pointer, and xsp, the stack pointer. The x depends on machine width: rbp and rsp on 64-bit machines, ebp and esp on 32-bit machines.

This diagram[^1] shows the stack-frame layout:

![Stack-frame structure](/img/非递归dfs/栈帧结构.png)

The stack grows from high addresses toward low addresses, so a callee frame occupies lower addresses than its caller.

The upper part is the caller frame. It contains arguments and the current function's return address. On a 64-bit system, the saved return address is located at frame pointer plus eight bytes; on the illustrated 32-bit system, it is plus four.

The lower part is the current function's frame, containing local variables. ebp and esp mark its beginning and end. Local variables are accessed through offsets from the frame pointer.

This organization is not merely a drawing convention. During nested calls, each function keeps its own locals in a separate interval of the same stack. The saved frame pointer links the current interval to the caller's interval, while the saved return address links the callee's completion to the exact instruction sequence that the caller must resume. Consequently, walking saved frame pointers traverses callers, and fixed offsets from the active frame pointer retrieve this invocation's variables without confusing them with identically named variables in another invocation.

### 1.2.2. Frame changes during a call

1. Push the return address, the value of pc[^2] at the call.
2. Push the old frame pointer so it can be restored later.
3. Begin the callee frame. Since it is initially empty, its beginning and end both equal the old stack end. Set the frame pointer to the current stack pointer.
4. Reserve space for locals and arguments. Because the stack grows downward, subtract their required size from the stack pointer.
5. Store local data and execute the function. The new frame is complete.

### 1.2.3. Frame changes during return

1. Release all memory used by the frame by setting the stack pointer equal to the frame pointer, undoing step four above.
2. Pop the saved old frame pointer into the frame-pointer register.
3. Pop the return address into pc.
4. Continue the caller according to pc.

### 1.2.4. Video explanation

The text may be unclear, so the following Manim video demonstrates frame changes for this C program.

{% note info%}
For demonstration, assume every source line corresponds to one CPU instruction. Real assembly requires more instructions, discussed later.
{% endnote %}

```c
int add(int a, int b)
    {return a + b;}
int main(){
    int c = add(114, 514);
    int d = c + 1919;
}
```

{% raw %}
<video src='/video/非递归dfs/detail_func_call.mp4' type='video/mp4' controls='controls' width='100%' height='100%'></video>
{% endraw%}

### 1.2.5. Talk is cheap. Show me the code.

The explanation and video convey the general principle, but assembly is necessary for the exact process. Do not worry if assembly is unfamiliar; this section explains it in detail.

#### 1.2.5.1. Viewing assembly

There are two convenient methods:

- With GCC, run `gcc -S [file]`. It emits AT&T syntax by default. I prefer Intel syntax, which can be requested with `-masm=intel`.
- Compiler output can contain system-related code unrelated to the program, and beginners may not know which assembly corresponds to one C line. [Compiler Explorer](https://gcc.godbolt.org/) solves both problems.

#### 1.2.5.2. Compiler Explorer basics

Its basic interface looks like this:

![Compiler Explorer interface](/img/非递归dfs/ce界面.png)

I will mention only basic options, although the site is effectively a powerful online IDE. See this [video](https://www.bilibili.com/video/BV1pJ411w7kh?p=93).

![Compiler Explorer options](/img/非递归dfs/ce选项.png)

From left to right, the highlighted controls:

1. Enable Vim editing mode.
2. Choose a language; more than thirty are supported.
3. Choose a compiler or interpreter. C and C++ choices include embedded Xtensa targets and IBM Power architectures.
4. Select output, including Intel versus AT&T assembly or a binary file.
5. Filter content unrelated to the source.
6. Add compiler options.
7. Share through a link.

Returning to the first screenshot:

![Compiler Explorer interface](/img/非递归dfs/ce界面.png)

The C++ and assembly lines use matching colors; lines with the same color correspond.

#### 1.2.5.3. Analyzing call assembly

{%tabs Function-call assembly%}
<!-- tab Assembly -->
```nasm
add:
        push    rbp
        mov     rbp, rsp
        mov     DWORD PTR [rbp-4], edi
        mov     DWORD PTR [rbp-8], esi
        mov     edx, DWORD PTR [rbp-4]
        mov     eax, DWORD PTR [rbp-8]
        add     eax, edx
        pop     rbp
        ret
main:
        push    rbp
        mov     rbp, rsp
        sub     rsp, 16
        mov     esi, 514
        mov     edi, 114
        call    add
        mov     DWORD PTR [rbp-4], eax
        mov     eax, DWORD PTR [rbp-4]
        add     eax, 1919
        mov     DWORD PTR [rbp-8], eax
        mov     eax, 0
        leave
        ret
```
<!-- endtab -->

<!-- tab C -->
```c
int add(int a, int b)
    {return a + b;}
int main(){
    int c = add(114, 514);
    int d = c + 1919;
}
```
<!-- endtab -->

<!-- tab Screenshot and link -->
[Compiler Explorer shared link](https://gcc.godbolt.org/#g:!((g:!((g:!((h:codeEditor,i:(filename:'1',fontScale:14,fontUsePx:'0',j:1,lang:___c,selection:(endColumn:2,endLineNumber:6,positionColumn:2,positionLineNumber:6,selectionStartColumn:2,selectionStartLineNumber:6,startColumn:2,startLineNumber:6),source:'int+add(int+a,+int+b)%0A++++%7Breturn+a+%2B+b%3B%7D%0Aint+main()%7B%0A++++int+c+%3D+add(114,+514)%3B%0A++++int+d+%3D+c+%2B+1919%3B%0A%7D'),l:'5',n:'0',o:'C+source+%231',t:'0')),k:51.24919923126201,l:'4',n:'0',o:'',s:0,t:'0'),(g:!((h:compiler,i:(compiler:cg102,filters:(b:'0',binary:'1',commentOnly:'0',demangle:'0',directives:'0',execute:'1',intel:'0',libraryCode:'0',trim:'1'),flagsViewOpen:'1',fontScale:14,fontUsePx:'0',j:1,lang:___c,libs:!(),options:'',selection:(endColumn:12,endLineNumber:24,positionColumn:12,positionLineNumber:24,selectionStartColumn:12,selectionStartLineNumber:24,startColumn:12,startLineNumber:24),source:1,tree:'1'),l:'5',n:'0',o:'x86-64+gcc+10.2+(C,+Editor+%231,+Compiler+%231)',t:'0')),k:48.75080076873799,l:'4',m:100,n:'0',o:'',s:0,t:'0')),l:'2',n:'0',o:'',t:'0')),version:4)

![Compiler Explorer function-call code](/img/非递归dfs/ce函数调用代码.png)
<!-- endtab -->
{% endtabs %}

`main` calls `add` through `int c = add(114, 514);`. One C statement requires:

```nasm
mov     esi, 514              ; Assign 514 to esi to pass an argument to add
mov     edi, 114              ; Assign 114 to edi to pass an argument to add
call    add                   ; Call add; see the explanation below
mov     DWORD PTR [rbp-4], eax; See the explanation below
```
The first two `mov` instructions pass arguments. `call` performs two operations: it pushes the address of the following instruction, then changes pc to the beginning of `add`. The CPU starts executing `add`.

The pushed address is the location of `mov DWORD PTR [rbp-4], eax`, not the address of `call` itself. This distinction lets `ret` continue after the call instead of invoking `add` repeatedly. Although a C call looks atomic, argument preparation, saving the continuation, transferring control, creating the callee frame, computing the result, restoring the frame, and resuming the caller are separate machine-level actions.

The final line is less obvious, especially `DWORD PTR [rbp-4]`. WORD is a two-byte integer; DWORD, double word, is four bytes, equivalent to C `int` here.

`PTR` resembles dereferencing in C. `mov DWORD PTR [rbp-4], eax` copies four bytes from eax into memory beginning at rbp-4.

rbp is the frame pointer, and local variables are addressed relative to it. eax contains the return value from `add`, so this line stores `add(114,514)` into local variable `c`.

Now inspect `add`:

```nasm
add:
        push    rbp                    ; Push rbp; push first decreases sp and stores the value at the new stack top
        mov     rbp, rsp               ; Copy rsp to rbp, indicating that the new frame is initially empty
        mov     DWORD PTR [rbp-4], edi ; edi and esi hold the arguments
        mov     DWORD PTR [rbp-8], esi ; These two lines store the arguments in the frame
        mov     edx, DWORD PTR [rbp-4] ;
        mov     eax, DWORD PTR [rbp-8] ; Move arguments a and b into edx and eax
        add     eax, edx               ; Equivalent to eax += edx
        pop     rbp                    ; Pop the stack top into rbp, restoring the saved frame pointer
        ret                            ; Pop the saved return address into pc and continue main
```

Earlier, stack allocation subtracted from sp, and return restored sp from bp. Those operations are absent because the compiler optimized away unnecessary work.

sp matters for placing another frame without overwriting this one. `add` calls no other function, so it does not need additional stack space. Since sp never changed, return does not need to restore it.

{% note info%}
Try adding `-O2` in Compiler Explorer. The compiler calculates $114+514+1919$ at compile time and removes the call to `add` entirely.
{% endnote %}

If `add` becomes recursive, these optimizations cannot apply because recursive frames would overwrite one another. See [this example](https://gcc.godbolt.org/#g:!((g:!((g:!((h:codeEditor,i:(filename:'1',fontScale:14,fontUsePx:'0',j:1,lang:___c,selection:(endColumn:2,endLineNumber:6,positionColumn:2,positionLineNumber:6,selectionStartColumn:2,selectionStartLineNumber:6,startColumn:2,startLineNumber:6),source:'int+add(int+a,+int+b)%0A++++%7Breturn+add(a,+b)%3B%7D%0Aint+main()%7B%0A++++int+c+%3D+add(114,+514)%3B%0A++++int+d+%3D+c+%2B+1919%3B%0A%7D'),l:'5',n:'0',o:'C+source+%231',t:'0')),k:50.83279948750801,l:'4',n:'0',o:'',s:0,t:'0'),(g:!((h:compiler,i:(compiler:cg85,filters:(b:'0',binary:'1',commentOnly:'0',demangle:'0',directives:'0',execute:'1',intel:'0',libraryCode:'0',trim:'1'),flagsViewOpen:'1',fontScale:14,fontUsePx:'0',j:1,lang:___c,libs:!(),options:'',selection:(endColumn:20,endLineNumber:11,positionColumn:20,positionLineNumber:11,selectionStartColumn:20,selectionStartLineNumber:11,startColumn:20,startLineNumber:11),source:1,tree:'1'),l:'5',n:'0',o:'x86-64+gcc+8.5+(C,+Editor+%231,+Compiler+%231)',t:'0')),k:49.167200512491995,l:'4',m:100,n:'0',o:'',s:0,t:'0')),l:'2',n:'0',o:'',t:'0')),version:4). `leave` combines `mov rsp, rbp` with `pop rbp`: it releases frame space and restores the old frame pointer.

## 1.3. Calling conventions

Many assembly designs could implement a call. Why does the compiler choose this specific one? Why do edi and esi pass arguments instead of the stack or other registers? Why does the callee, rather than caller, release this frame?

Calling conventions answer these questions.

> A calling convention describes how arguments are passed to a called function, how return values are returned, and which side balances the stack.

The following are several classic conventions that handwritten assembly can also follow.

### 1.3.1. x86 32-bit conventions

GCC normally emits 64-bit assembly. Add `-m32` for 32-bit output. On my MinGW system it works, and source can use annotations such as `__cdecl` or `__stdcall`. Compiler Explorer behaved strangely and did not honor the convention under GCC even with `-m32`, so I selected MSVC instead. If you know why GCC there rejects it, please comment.

I use the same code for comparison and place a different convention annotation before `add`. The Compiler Explorer [link is here](https://gcc.godbolt.org/#z:OYLghAFBqd5QCxAYwPYBMCmBRdBLAF1QCcAaPECAMzwBtMA7AQwFtMQByARg9KtQYEAysib0QXACx8BBAKoBnTAAUAHpwAMvAFYTStJg1AB9U8lJL6yAngGVG6AMKpaAVxYMQAJlIOAMngMmABy7gBGmMQgAGykAA6oCoS2DM5uHt7xickCAUGhLBFRsZaY1ilCBEzEBGnunlwWmFY2ApXVBHkh4ZF6ClU1dRmN/R1dBUUSAJQWqK7EyOwcgQQA1Kb96KK0tKtM6OgQK3ukq8dhp8fIUwCkGgCCq0%2BrNwDsAELEmATzDHsvXneqzCAKByBuAGZ3m8ACJ3e7HFhMQIQW4feHPM6CVbIF4QmF7A4QLhSU4AVlJqy4AE4abcofDGa8YRwZrROGTeJ4OFpSKhOI5Vgo5gtMACITxSARNKyZgBrECvAB0ZMkkghrwAHNFqZqvF5JJqybF2RxJFyZXzOLwFCANFKZTM4LAkGgWHE6JFyJQ3R76FFkMhaMYggB3YwQnw0WgESK2iBhS1hQLVACenElbrYggA8gxaOmebwsEijOIi6R8F9ygA3TC2iuYVRlVyxjO8FbNS20PBhYhp5xYS0EYh4FjtmZUAzABQANTwmFDObijHbMkEIjE7FJ/EEihU6grukaBiMIFMxnMPbCtsgM1QcVaDAbNuaZSf9gYThc9T0/kC3SFL0jQJEkT5DA0WRgSk4w9FEIxvuUbQDLUP7DE0LQVChsFAfBFgoRBfTYQBEzATMwrzIsegjpgSw8GyHIWhW/IcKo2qrCwCg1riNY0kqUirBAADqACSwTYFMgmOKcuCECQ4qNKszjup6xAKVMvDSkWUzyt4ZJKlqmrUqq0QQhSGiapI1Impw5qkOOXAaPa3K8ixNp2g62mkM6iAoBgOD4EQZAUNQnrMGwa67sI2zbtIUX7molq6D4p4mGYGHvikn7fukniar4X44ZMIHZOBaF5VBOQMEVwEZUhDDtIM5WKnVT6NZ0JFwURHSEa8%2BFjJ1uHTLMlFLMcZhYEGhKHMcTCXNiFxYms1wYs8byfN8vz/DcgLAqCOKQtCzLwoiyIMKi62rU8Vx4gS%2ByHCS0irBST00nSh2Mg8sKsvojGkC5vAsYKFGiuKXiaY6umOUqXgahCmqaq8BoaGZ0QnrZTGudaFgeVpWhOjAvm%2Bqp3oQMT/ooEGIaLhGUZ0LGxDxomFbJswxCFpmqAsNmBB5gWloloYwDlryVaZXWDa8k2LZttwHaCF2FbXv27ODksvIjmOE58NOc4LkuK7cpKUWbuIO6yAlh68sl%2BhC%2Be6XXreqJ8o%2BKQvq1WUQA4hFcPl/75F1JKVWVuUgNSwcwYNxUIZhyE9c1vse3HNQ1fBIwEc14ejCnUfAVw5EilRPg0XRP2mpy/2WixbHRBxXE8XxAnCWJElSTJgXyTtkanMpfqRGDGmefjuleBoMNeK8VmvGSE%2BjxorzWb9ZqY4D2O2vaeM/T5ECuv5slBaT0aMKwpfrtFW4SHFFtKIlR4gBCttnhe5ilPV2WET4/uAZMsSgVVH8R1yLnYoScGoZ1Dj4V%2BbViIByGiUcBv5IEwO/r0aIBdRqcHGsYKgTB%2BjbF2PdI42I5pLWBPNZatwHiYnWl8H4xA/hMH2iCHaYIPrHQeKdFEaJoRUOeDdSEd0iSPXJJSN61J6Q8PuEyFkDEOAVwBlaDgwNC5ii7hCCG2koaSCVAjY0TkrLUleNEMkrwIQP1NHZBRbkcYb0dN5QmO8/IqX9KTcmvRAzBjDLTPg9M4yUGZryVmaY1xZkYLzfMhZRaYFLMLdWxY8DVhsBLS00tkCtlPp2U0vJlYDn8sOUc445aTl1vORcy5VxyzPqbWKZ9LZJXvo/NKl59C9idveV2Ah3ZQM9t7BOftCrAIkCVaCAgP72j/k%2BVOYdQHtR9vlbpycOqwOjv1JqED7TZyWSgqI4iRqigaSXbW5cV6KJrnXbiqxeLUn4pIQSolxKSQgNJVY%2B9O6wwfkpLmfc1JqMHpvHSpAFReC4EqCUaMF60mNNESQZIITSAsSc6x68h6yiXuDSuzFsb/JmHWRmWVJBAA).

```c
int add(int a, int b, int c)
    {return a + b + c;}
int main(){
    int c = add(114, 514, 1919);
}
```


{%tabs Different calling conventions%}
<!-- tab cdecl (C declaration) -->

Declare `int __cdecl add(int a, int b, int c)` to select cdecl.

cdecl is the default 32-bit C convention:

- Arguments are pushed on the stack from right to left.
- The caller releases the callee's argument space, manually balancing the stack.
- Integer returns use ax; floating-point returns use st0.

The generated assembly is:

```nasm
_a$ = 8                                       ; size = 4
_b$ = 12                                                ; size = 4
_c$ = 16                                                ; size = 4
_add    PROC
        push    ebp
        mov     ebp, esp
        mov     eax, DWORD PTR _a$[ebp]
        add     eax, DWORD PTR _b$[ebp]
        add     eax, DWORD PTR _c$[ebp]
        pop     ebp
        ret     0
_add    ENDP

_c$ = -4                                                ; size = 4
_main   PROC
        push    ebp
        mov     ebp, esp
        push    ecx
        push    1919                                    ; 0000077fH
        push    514                           ; 00000202H
        push    114                           ; 00000072H
        call    _add
        add     esp, 12                             ; 0000000cH
        mov     DWORD PTR _c$[ebp], eax
        xor     eax, eax
        mov     esp, ebp
        pop     ebp
        ret     0
_main   ENDP
```

Notice:

```nasm
push    1919                                    ; 0000077fH
push    514                           ; 00000202H
push    114                           ; 00000072H
```
Arguments are pushed right to left. `push` already decreases esp while storing data, so `add` does not separately subtract stack space.

As in section 1.2.5.3, some frame work is optimized because `add` calls no other function.

`add esp, 12` releases the twelve bytes occupied by arguments. It appears in `main`, demonstrating that cdecl makes the caller clean the stack.

The callee can use those arguments while it runs because ebp provides a stable base. The symbolic operands `_a$[ebp]`, `_b$[ebp]`, and `_c$[ebp]` refer to positive offsets where the caller placed the values. Once `add` returns, the caller no longer needs those slots and moves esp upward by twelve bytes. Repeating cleanup at each cdecl call site is intentional because each site knows exactly how many arguments it supplied.

The main benefit is variadic arguments. Common C examples are `printf()` and `scanf()`. `int printf(const char *__format, ...)` uses the three dots to denote a variable count. For more, see this [Luogu Daily article](https://www.luogu.com.cn/blog/wenge/variable-arguments).

A variadic callee does not generally know a fixed amount of argument space to release. Its callers know the count and sizes for each invocation and can clean exactly the right amount. Other designs could pass the size in a register or split cleanup, but no standard C/C++ convention here does so.

<!-- endtab -->

<!-- tab stdcall -->

Declare `int __stdcall add(int a, int b, int c)` to select stdcall.

Most Win32 APIs use stdcall:

- Arguments are pushed right to left.
- The callee releases its argument space automatically.
- Other behavior resembles cdecl.

```nasm
_a$ = 8                                       ; size = 4
_b$ = 12                                      ; size = 4
_c$ = 16                                      ; size = 4
_add@12 PROC
        push    ebp
        mov     ebp, esp
        mov     eax, DWORD PTR _a$[ebp]
        add     eax, DWORD PTR _b$[ebp]
        add     eax, DWORD PTR _c$[ebp]
        pop     ebp
        ret     12                            ; 0000000cH
_add@12 ENDP

_c$ = -4                                      ; size = 4
_main   PROC
        push    ebp
        mov     ebp, esp
        push    ecx
        push    1919                          ; 0000077fH
        push    514                           ; 00000202H
        push    114                           ; 00000072H
        call    _add@12
        mov     DWORD PTR _c$[ebp], eax
        xor     eax, eax
        mov     esp, ebp
        pop     ebp
        ret     0
_main   ENDP
```

The push order is identical:

```nasm
push    1919                          ; 0000077fH
push    514                           ; 00000202H
push    114                           ; 00000072H
```

The difference is `ret 12` inside `add`, equivalent to `add esp,12` followed by `ret`. The callee releases its own twelve bytes.

This can reduce program size when the parameter count is fixed: cleanup is identical at every call site, so it appears once in the callee rather than after every call.

The `12` encoded in both the decorated name `_add@12` and `ret 12` corresponds to three four-byte arguments. Unlike cdecl, a caller cannot freely vary that number for the same stdcall function because the callee always removes the fixed amount it expects. This tradeoff explains both compact cleanup and why cdecl is a more natural fit for variadic functions.

<!-- endtab -->

<!-- tab fastcall -->

Declare `int __fastcall add(int a, int b, int c)` to select fastcall.

fastcall improves speed by passing arguments in registers. Unlike cdecl and stdcall, it has no single implementation across compilers. These properties follow the [Visual Studio 2022 convention](https://docs.microsoft.com/zh-cn/cpp/cpp/fastcall?view=msvc-170):

- The first two left-to-right integer arguments of 32 bits or less use ecx and edx; remaining arguments are pushed right to left.
- The callee releases stack space as in stdcall.

```nasm
_b$ = -8                                                ; size = 4
_a$ = -4                                                ; size = 4
_c$ = 8                                       ; size = 4
@add@12 PROC
        push    ebp
        mov     ebp, esp
        sub     esp, 8
        mov     DWORD PTR _b$[ebp], edx
        mov     DWORD PTR _a$[ebp], ecx
        mov     eax, DWORD PTR _a$[ebp]
        add     eax, DWORD PTR _b$[ebp]
        add     eax, DWORD PTR _c$[ebp]
        mov     esp, ebp
        pop     ebp
        ret     4
@add@12 ENDP

_c$ = -4                                                ; size = 4
_main   PROC
        push    ebp
        mov     ebp, esp
        push    ecx
        push    1919                                    ; 0000077fH
        mov     edx, 514                      ; 00000202H
        mov     ecx, 114                      ; 00000072H
        call    @add@12
        mov     DWORD PTR _c$[ebp], eax
        xor     eax, eax
        mov     esp, ebp
        pop     ebp
        ret     0
_main   ENDP
```
Observe:

```nasm
push    1919                                    ; 0000077fH
mov     edx, 514                      ; 00000202H
mov     ecx, 114                      ; 00000072H
```
The first two arguments, 114 and 514, use registers; 1919 is pushed. `ret 4` shows callee cleanup. Only one four-byte argument occupied stack space.

Inside `add`, the compiler stores ecx and edx into local stack slots before doing arithmetic. Passing an argument in a register does not mean it can never appear on the stack; it means the ABI transfers it across the call boundary in a register. The callee may still spill it. The third argument is already available at a positive frame offset because the caller pushed it.

<!-- endtab -->
{%endtabs%}

### 1.3.2. x64 conventions

x86 has only eight general-purpose registers, so many conventions pass most arguments through the slower stack. x64 has sixteen, enabling register-heavy conventions similar to fastcall.

The two main x64 families are Microsoft's convention and the System V AMD64 ABI. I focus on System V, used by Solaris, GNU/Linux, FreeBSD, and other non-Microsoft systems. For Microsoft x64, see this [page](https://docs.microsoft.com/zh-cn/cpp/build/x64-calling-convention?view=msvc-170).

The earlier stack-frame assembly already follows System V, whose primary rules include:

- The first six integer and pointer arguments use RDI, RSI, RDX, RCX, R8, and R9 from left to right.
- The first eight floating-point arguments use xmm0 through xmm7.
- Remaining arguments are pushed right to left.
- The callee restores its own frame.

Calling conventions also enable cross-language calls. They specify caller and callee responsibilities and the parameter representation. When both languages obey the same ABI, one can call code written in the other. Python's ctypes library, for example, needs a convention when loading a C dynamic library.

Additional references:

1. [Microsoft calling conventions](https://docs.microsoft.com/zh-cn/cpp/cpp/calling-conventions?view=msvc-170)
2. [Calling convention article](https://www.laruence.com/2008/04/01/116.html)
3. [Wikipedia: x86 calling conventions](https://zh.wikipedia.org/wiki/X86%E8%B0%83%E7%94%A8%E7%BA%A6%E5%AE%9A)

# 2. Experiments Enabled by Understanding Calls

## 2.1. Backtrace

### 2.1.1. Introduction

I am unsure of the exact Chinese translation, so I simply use “call backtrace.”

Backtracing is a common debugging technique. When a bug appears, we want to know which function contains it. That alone is insufficient because many locations may call the same function; we want the entire call relationship. GDB's `backtrace`, abbreviated `bt`, provides it.

Consider:

```c 
#include <stdio.h>
volatile int add1(int a, int b) {
    int* bug_val = 0;
    printf("%d\n", *bug_val); // The bug occurs here
    return a + b;
}
volatile int add2(int a, int b) { return add1(a, b); }
volatile int add3(int a, int b) { return add2(a, b); }
volatile int add4(int a, int b) { return add3(a, b); }
int main() {
    int c = add4(1, 2);
    return 0;
}
```

Dereferencing address zero in `add1` causes a segmentation fault because zero is NULL. Set a GDB breakpoint at `add1` and execute `bt`:

![](/img/非递归dfs/调用回溯演示.png)

The relationship is:

```
#0  add1 (a=1, b=2) at bt_bug.c:3
#1  0x00005555555551aa in add2 (a=1, b=2) at bt_bug.c:7
#2  0x00005555555551cd in add3 (a=1, b=2) at bt_bug.c:8
#3  0x00005555555551f0 in add4 (a=1, b=2) at bt_bug.c:9
#4  0x000055555555520d in main () at bt_bug.c:11
```

### 2.1.2. A simple implementation

Can we implement a simplified version that prints only addresses?

All necessary information is hidden in stack frames. Addresses such as `0x...51aa` are return addresses. In the stack diagram, the return address lies one word above the frame pointer, bp plus eight bytes on x64. Traversing frames yields every return address and therefore the call chain.

Each reported address identifies a continuation in the caller rather than necessarily its first instruction. Debug information and the executable symbol table let tools map that continuation back to a function name and source line. This is why GDB can display both `add2` and a line number while the simple implementation below initially sees only raw addresses.

At bp plus zero is the preceding frame's frame pointer. Following these pointers recursively walks the chain, which illustrates the name backtrace.

Two questions remain:

1. What terminates traversal?
2. How can C read the bp register?

Termination differs by system. In my Ubuntu 22.04.1 on WSL2 environment, the preceding pointer eventually becomes `0x1`. I do not know whether Linux specifies this; I observed it while debugging.

In xv6, used by MIT 6.S081, a kernel stack occupies one page, so traversal ends when the pointer leaves that page.

If you know a portable method, please comment.

For the second question, GCC's `__builtin_frame_address` can return the current frame pointer.

To experiment with nonstandard GCC features, use inline assembly:

```c 
#define FORCE_INLINE __attribute__((always_inline)) inline
FORCE_INLINE void* r_bp() {
    // Read the frame pointer
    size_t x;
    asm volatile("mov %0, rbp" : "=r"(x));
    return (void*)x;
    // This uses Intel assembly syntax, so compilation requires -masm=intel
}
```

In `"mov %0, rbp" : "=r"(x)`, the first string is a template. GCC replaces `%0` with the register assigned to output variable x. It means: copy rbp into the register holding x.

For inline assembly, see the [GCC constraints documentation](https://gcc.gnu.org/onlinedocs/gcc/Simple-Constraints.html#Simple-Constraints) and my more detailed [Lab 4 article](/2022/07/xv6_lab4_record/).

The code also uses:

```c 
#define FORCE_INLINE __attribute__((always_inline)) inline
```

`inline` alone only suggests inlining and does not guarantee it.[^4] `__attribute__((always_inline)) inline` forces GCC to inline. `__attribute__` has many other uses described in the [documentation](https://gcc.gnu.org/onlinedocs/gcc/Variable-Attributes.html).

Forced inlining matters specifically for `r_bp()`. If it remained a separate function, reading rbp would obtain the frame pointer of `r_bp` itself rather than the frame that invoked the backtrace logic. Inlining places the assembly in its caller, making the observed register correspond to the intended starting frame. `-masm=intel` is also required because the template uses Intel operand order.

The rest mainly involves pointers:

```c
FORCE_INLINE void* r_bp() {
    // Read the frame pointer
    size_t x;
    asm volatile("mov %0, rbp" : "=r"(x));
    return (void*)x;
}

size_t btrace(void** buffer_arr, size_t size) {
    // buffer_arr is an array of generic void pointers.
    // Store each frame's return address in buffer_arr.
    // size is the desired maximum number of calls to trace.
    size_t* cur_frame_addr = (size_t*)r_bp();
    // Obtain the call stack through stack and frame pointers
    int i = 0;
    while (i < size && (size_t)cur_frame_addr != 0x1) {
        size_t* returning_addr = cur_frame_addr[1];  // Return address is stored at bp plus eight bytes
        size_t* prev_frame_addr = cur_frame_addr[0]; // Previous bp is stored at bp plus zero bytes
        buffer_arr[i++] = returning_addr;
        cur_frame_addr = prev_frame_addr;            // Continue the backtrace
    }
}
```

### 2.1.3. Adding function names

The simple version prints only addresses, while GDB shows names. How can an address be converted into a function name?

Linux provides `addr2line`, although I had trouble using it successfully.

Another method is `backtrace_symbols` from `execinfo.h`. It converts an address array into a name array:

```c
/* Return names of functions from the backtrace list in ARRAY in a newly
   malloc()ed memory block.  */
extern char **backtrace_symbols (void *const *__array, int __size)
```

Compile with `-rdynamic` so the linker places symbols in the dynamic symbol table. The original explanation is from this source:

> <https://stackoverflow.com/questions/6934659/how-to-make-backtrace-backtrace-symbols-print-the-function-names>
> The symbols are taken from the dynamic symbol table; you need the -rdynamic option to gcc, which makes it pass a flag to the linker which ensures that all symbols are placed in the table.

The complete program is:

```c
#include <execinfo.h>
#include <stddef.h>
#include <stdio.h>

#define FORCE_INLINE __attribute__((always_inline)) inline

FORCE_INLINE void* r_bp() {
    size_t x;
    asm volatile("mov %0, rbp" : "=r"(x));
    return (void*)x;
}

size_t btrace(void** buffer_arr, size_t size) {
    size_t* cur_frame_addr = (size_t*)r_bp();
    int i = 0;
    while (i < size && (size_t)cur_frame_addr != 0x1) {
        size_t* returning_addr = cur_frame_addr[1];  
        size_t* prev_frame_addr = cur_frame_addr[0];
        buffer_arr[i++] = returning_addr;
        cur_frame_addr = prev_frame_addr;
    }
}

volatile int add1(int a, int b) {
    void* buf_arr[10];
    btrace(buf_arr, 10);
    char** func_names = backtrace_symbols(buf_arr, 10);
    for (int i = 0; i < 10; i++) {
        printf("%s\n", func_names[i]);
    }
    // Free func_names because backtrace_symbols returns a malloc-allocated array
    free(func_names);
    return a + b;
}

volatile int add2(int a, int b) { return add1(a, b); }

volatile int add3(int a, int b) { return add2(a, b); }

volatile int add4(int a, int b) { return add3(a, b); }

int main() { 
    int c = add4(1, 2);
    return 0;
}
```

Compile with:

```
gcc backtrace.c -o bt -masm=intel -ggdb3 -rdynamic
```

Running `./bt` produces:

```
./bt(add1+0x32) [0x55bfc409e25b]
./bt(add2+0x21) [0x55bfc409e2ed]
./bt(add3+0x21) [0x55bfc409e310]
./bt(add4+0x21) [0x55bfc409e333]
./bt(main+0x1b) [0x55bfc409e350]
/lib/x86_64-linux-gnu/libc.so.6(+0x29d90) [0x7f5c1391ed90]
[(nil)]
[(nil)]
[(nil)]
[(nil)]
```

Of course, this is intentionally reinventing the wheel: `execinfo.h` already contains a function named `backtrace()`.

## 2.2. Stack-overflow attack

The idea comes from this [video](https://www.bilibili.com/video/BV1gZ4y1q7rH/?spm_id_from=333.999.0.0&vd_source=4de003ee9a3815aedd7d0cb2c7a12d14).

A stack-overflow attack can execute a function without explicitly calling it:

```c
#include <stdio.h>
#include <stdlib.h>

void malfunc() {
    asm volatile("pop rbp");
    puts("hello world");
    exit(0);
}

void set_arr() {
    size_t a[2];
    a[0] = 114;
    a[1] = 514;
    a[3] = (size_t)malfunc;
}

int main() {
    set_arr();
    return 0;
}
```

Compile using:

```
gcc stk_ov.c -o stk_ov -fno-stack-protector -ggdb3 -masm=intel
```
The program prints `hello world`. This is dangerous: modifying the stack can redirect execution to malicious code. Modern compilers defend against it, so without `-fno-stack-protector` this program is stopped.

Why does `malfunc` execute? Draw the `set_arr()` frame:

```
Low addresses

a[0]
------------------------------------
a[1]
------------------------------------
Original frame pointer (main's frame pointer) <--- current frame pointer, a[2]
------------------------------------
Return address of this function (inside main) <--- a[3]

High addresses
```

`a[3]` overlaps the stored return address of `set_arr`. Replacing it with `malfunc` naturally redirects return there.

Why does `malfunc` contain `pop rbp`? I honestly do not know.

Without it, the program runs in Compiler Explorer, as this [link](https://gcc.godbolt.org/#g:!((g:!((g:!((h:codeEditor,i:(filename:'1',fontScale:14,fontUsePx:'0',j:1,lang:___c,selection:(endColumn:29,endLineNumber:5,positionColumn:29,positionLineNumber:5,selectionStartColumn:29,selectionStartLineNumber:5,startColumn:29,selectionStartLineNumber:5),source:'%23include+%3Cstdio.h%3E%0A%23include+%3Cstdlib.h%3E%0A%0Avoid+malfunc()+%7B%0A++++asm+volatile(%22pop+rbp%22)%3B%0A%09puts(%22hello+world%22)%3B%0A%09exit(0)%3B%0A%7D%0A%0Avoid+set_arr()+%7B%0A%09size_t+a%5B2%5D%3B%0A%09a%5B0%5D+%3D+114%3B%0A%09a%5B1%5D+%3D+514%3B%0A%09a%5B3%5D+%3D+(size_t)malfunc%3B%0A%7D%0A%0Aint+main()+%7B%0A%09set_arr()%3B%0A%09return+0%3B%0A%7D'),l:'5',n:'0',o:'C+source+%231',t:'0')),k:33.74973307708735,l:'4',n:'0',o:'',s:0,t:'0'),(g:!((h:compiler,i:(compiler:cg122,deviceViewOpen:'1',filters:(b:'0',binary:'1',commentOnly:'0',demangle:'0',directives:'0',execute:'0',intel:'0',libraryCode:'0',trim:'1'),flagsViewOpen:'1',fontScale:14,fontUsePx:'0',j:1,lang:___c,libs:!(),options:'-g3+-masm%3Dintel',selection:(endColumn:21,endLineNumber:10,positionColumn:1,positionLineNumber:3,selectionStartColumn:21,selectionStartLineNumber:10,startColumn:1,startLineNumber:3),source:1),l:'5',n:'0',o:'+x86-64+gcc+12.2+(Editor+%231)',t:'0')),k:32.91693358957934,l:'4',m:100,n:'0',o:'',s:0,t:'0'),(g:!((h:output,i:(compilerName:'x86-64+gcc+10.2',editorid:1,fontScale:14,fontUsePx:'0',j:1,wrap:'1'),l:'5',n:'0',o:'Output+of+x86-64+gcc+12.2+(Compiler+%231)',t:'0')),k:33.33333333333333,l:'4',n:'0',o:'',s:0,t:'0')),l:'2',n:'0',o:'',t:'0')),version:4) shows.

Locally, omitting the instruction causes a segmentation fault. I described the case in this [Stack Overflow question](https://stackoverflow.com/questions/74567770/why-stack-overflow-attacks-modifying-the-returning-address-of-a-function-call). Please answer there or in the comments if you understand it.

# 3. Writing a Nonrecursive DFS for a Tree

## 3.1. Implementation

We now understand how calls work. The simplest way to implement a nonrecursive DFS is to simulate the assembly call process ourselves.

Start with the familiar recursive DFS:

```cpp
#include<bits/stdc++.h>
using namespace std;
const int MAXN = 200;
vector<int> e[MAXN];

int dfs(int cur, int fa){
    printf("vised %d\n", cur);
    for(int nex:e[cur]){
        if(nex != fa) dfs(nex, cur);
    }
}

int main(){
    int n;
    scanf("%d", &n);
    for (int i = 1; i <= n; i++)
    {
        int from, to;
        scanf("%d%d", &from, &to);
        e[from].push_back(to);
        e[to].push_back(from);
    }
    dfs(1, 0);
    system("pause");
}
```
Its local variables or parameters are `cur` and `fa`, the current node and parent.

The recursive loop has an implicit execution position as well. When DFS calls itself for one neighbor, the caller must later return to the loop, advance to the next edge, and continue. The simulated `pc` makes that hidden continuation explicit. Storing only `cur` and `fa` would be insufficient: returning from a child would restart the parent at its first statement and repeatedly revisit the same edge.

A frame contains locals, the saved bp, and the return address pc. Saved bp lets the caller restore its frame pointer and access its own locals correctly.

Instead, encapsulate each frame in a structure and represent the full call stack as an array of those structures. Then bp need not be stored because each frame's fields remain directly accessible.

This frame contains only pc, representing where execution should continue, and the function parameters. DFS must preserve pc because it calls another function before the current one finishes and must later continue rather than restart:

```cpp
template <typename PARA_TYPE> // PARA_TYPE is the argument type
struct Frame{
    int pc;// Program counter
    PARA_TYPE paras;// Arguments of the current frame
};
```
Simulate stack operations:

```cpp
template <typename FRAME_TYPE>// Frame type
struct Mystk{
    FRAME_TYPE stk[E_SZ];
    int sp;// Points to the stack top
    Mystk()     {sp = 0; memset(stk, 0, sizeof(stk));}// Constructor that initializes the stack
    inline void push(FRAME_TYPE x)   { stk[++sp] = x;}// Ordinary stack operations
    inline FRAME_TYPE& top()         {return stk[sp];}
    inline bool empty()              {return sp <= 0;}
    inline bool pop()            {return (--sp) <= 0;}
};
```
Finally combine the two concepts:

```cpp
template <typename PARA_TYPE>
struct Func_stk
{
    struct Frame{
        int pc;
        PARA_TYPE paras;
        inline void my_goto(int line){pc = line - 1;}
        // Custom goto: pc selects the next instruction, so changing pc changes that instruction
    };
    Mystk<Frame> cur_stk;
    inline void call(PARA_TYPE paras) {cur_stk.push({.pc = 0, .paras = paras});}
    // Calling a function pushes a frame whose first instruction is initially selected.
    inline void ret()                 {cur_stk.pop();}
    // Returning from a function pops one frame
};
```

Use these structures according to the assembly process:

1. Calling a function pushes a new frame through `Func_stk::call`.
2. Returning pops a frame through `Func_stk::ret`.
3. Otherwise, execute the statement selected by pc.
4. Increment pc after every statement.

The interpreter loop always refreshes `cur_frame` from the stack top. A call may push a new frame, so retaining a pointer to the old top would execute the caller when the callee should be active. A return pops the current top and exposes its caller. Refreshing the pointer plays the same role as restoring sp and the frame pointer during a machine-level call or return.

The DFS becomes:

```cpp
void dfs(int cur, int fa){
    Func_stk<Dfs_paras> dfs_stk;
    dfs_stk.call({cur, fa}); // Push the first frame
    Func_stk<Dfs_paras>::Frame *cur_frame = &dfs_stk.cur_stk.top();// Pointer to the current frame
    for (; !dfs_stk.cur_stk.empty(); cur_frame->pc++, cur_frame = &dfs_stk.cur_stk.top()) 
    // Continue while frames remain and increment the current pc after every instruction.
    // If a callee later returns, the caller's continuation has advanced by one instruction.
    // Refresh cur_frame so it always points to the top frame.
    {
        if (cur_frame->pc == 0)// The first DFS instruction prints the current node at pc zero
            printf("vised %d\n", cur_frame->paras.cur);
        else if (cur_frame->pc <= e[cur_frame->paras.cur].size()){                 // If pc does not exceed the incident-edge count,
                                                                                   // some adjacent subtree remains unvisited
            if (e[cur_frame->paras.cur][cur_frame->pc - 1] != cur_frame->paras.fa){// Recurse when the next node is not the parent
                dfs_stk.call({.cur = e[cur_frame->paras.cur][cur_frame->pc - 1], .fa = cur_frame->paras.cur});
            }
        }
        else{
            dfs_stk.ret();// A pc beyond the edge count means every adjacent subtree is complete, so return
        }
    }
}
```

The complete program follows. You are welcome to copy and run it:

```cpp
#include <bits/stdc++.h>
using namespace std;
const int E_SZ = 200; // Maximum number of edges

struct Dfs_paras{
    int cur, fa;
};
vector<int> e[E_SZ];

template <typename FRAME_TYPE>
struct Mystk{
    FRAME_TYPE stk[E_SZ];
    int sp;// Points to the stack top
    Mystk()    {sp = 0; memset(stk, 0, sizeof(stk));}// Constructor that initializes the stack
    inline void push(FRAME_TYPE x)   { stk[++sp] = x;}// Ordinary stack operations
    inline FRAME_TYPE& top()         {return stk[sp];}
    inline bool empty()             {return sp <= 0;}
    inline bool pop()           {return (--sp) <= 0;}
};

template <typename PARA_TYPE>
struct Func_stk
{
    struct Frame{
        int pc;
        PARA_TYPE paras;
        inline void my_goto(int line){pc = line - 1;}
    };
    Mystk<Frame> cur_stk;
    inline void call(PARA_TYPE paras) {cur_stk.push({.pc = 0, .paras = paras});}
    inline void ret()                 {cur_stk.pop();}
};

void dfs(int cur, int fa){
    Func_stk<Dfs_paras> dfs_stk;
    dfs_stk.call({cur, fa});
    Func_stk<Dfs_paras>::Frame *cur_frame = &dfs_stk.cur_stk.top();
    for (; !dfs_stk.cur_stk.empty(); cur_frame->pc++, cur_frame = &dfs_stk.cur_stk.top()) // Execute DFS and increment pc each step
    {
        if (cur_frame->pc == 0)
            printf("vised %d\n", cur_frame->paras.cur);
        else if (cur_frame->pc <= e[cur_frame->paras.cur].size()){
            if (e[cur_frame->paras.cur][cur_frame->pc - 1] != cur_frame->paras.fa){
                dfs_stk.call({.cur = e[cur_frame->paras.cur][cur_frame->pc - 1], .fa = cur_frame->paras.cur});
            }
        }
        else{
            dfs_stk.ret();
        }
    }
}

int main()
{
    int n;
    scanf("%d", &n);
    for (int i = 1; i <= n; i++){
        int from, to;
        scanf("%d%d", &from, &to);
        e[from].push_back(to);
        e[to].push_back(from);
    }
    dfs(1, 0);
    system("pause");
}
```

## 3.2. Small optimization

The original recursive DFS is:

```cpp
int dfs(int cur, int fa){
    printf("vised %d\n", cur);
    for(int nex:e[cur]){
        if(nex != fa) dfs(nex, cur);
    }
}
```
The new call shares one parameter with the current call: the next function's `fa` is the current `cur`. Instead of storing `fa`, access `cur` in the preceding frame, such as `dfs_stk.stk[dfs_stk.sp-1].paras` after making `paras` a single integer.

This saves some space.

## 3.3. Is it useful?

It is mainly educational and deepens understanding of calls, although it has a few possible uses.

### 3.3.1. Test method

To compare it accurately with normal DFS, I used Python and Luogu's CYaRon generator to create ten tests, each a tree with $10^6$ nodes.

Generator:

```python
from cyaron import *
def generate():
    MX_PT = int(1e6)
    for _ in range(1, 11):
        test_data = IO(file_prefix="tree", data_id=_)
        cur_tree = Graph.tree(MX_PT)
        test_data.input_writeln(MX_PT - 1)
        test_data.input_writeln(cur_tree)
if __name__ == "__main__":
    generate()
```
Answer generator:

```cpp
#include<bits/stdc++.h>
using namespace std;
const int MAXN = 1e6 + 5;
vector<int> e[MAXN];
void dfs(int cur, int fa){
    printf("%d\n", cur);
    for(int nex:e[cur]){
        if(nex != fa) dfs(nex, cur);
    }
}
int main(){
    for(int fid = 1; fid <= 10; fid++){
        string cur_name = "tree" + to_string(fid);
        for(int _ = 0; _ < MAXN; _++) e[_].clear();
        freopen((cur_name + ".in").c_str(), "r", stdin);
        freopen((cur_name + ".out").c_str(), "w", stdout);
        int n;
        scanf("%d", &n);
        for (int i = 1; i <= n; i++)
        {
            int from, to, none;
            scanf("%d%d%d", &from, &to, &none);
            e[from].push_back(to);
            e[to].push_back(from);
        }
        dfs(1, 0);
    }
}
```
I created a Luogu [problem](https://www.luogu.com.cn/problem/U214511) and uploaded the data. All following tests use it.

### 3.3.2. Space?

In theory, after the optimization, the nonrecursive DFS should use about 4 MB less: one fewer `int` in each of up to $10^6$ frames, plus no saved bp.

I submitted the conventional DFS for comparison:

| Time (s) | Memory (MB) |
|---|---|
|9.06|55|

See the [submission list](https://www.luogu.com.cn/record/list?pid=U214511).

What happened in reality? The experimental version used 62 MB and 9.2 seconds—both worse.

See the [submission](https://www.luogu.com.cn/record/74546760).

I suspect the array-based stack. Although each frame is smaller, popped array slots remain allocated and much reserved memory is unused. A normal recursive frame is released immediately when popped.

More precisely, a fixed-capacity array reserves space for the worst possible depth throughout execution, even when the traversal is shallow most of the time. Popping changes only the simulated index and cannot return that reserved storage. A native stack also reserves an address range, but committed pages and judge accounting can behave differently, while an STL stack dynamically allocates and releases blocks at additional runtime cost.

Using an actual dynamic stack should test this. STL `stack` produced the same memory usage as recursion, but took 10.26 seconds. [Submission](https://www.luogu.com.cn/record/74546780).

I still do not know why memory was not lower than recursion; please comment if you do.

### 3.3.3. Time?

Why is time slower? In theory, simulated calls should be faster because pushing and popping only increments or decrements a stack index, while normal calls perform the steps from sections 1.2.2 and 1.2.3.

I eventually inspected the [assembly](https://gcc.godbolt.org/#z:OYLghAFBqd5QCxAYwPYBMCmBRdBLAF1QCcAaPECAMzwBtMA7AQwFtMQByARg9KtQYEAysib0QXACx8BBAKoBnTAAUAHpwAMvAFYTStJg1DIApACYAQuYukl9ZATwDKjdAGFUtAK4sGEgGykrgAyeAyYAHI%2BAEaYxCBmZqQADqgKhE4MHt6%2BASlpGQKh4VEssfGJtpj2jgJCBEzEBNk%2BflyBdpgOmfWNBMWRMXEJSQoNTS257bbj/WGDZcOJAJS2qF7EyOwc5gDMYcjeWADUJrtu0YQKAPRj6KaW1gB0CGfYJhoAgl7pRsfMbAUySYW2OdzOVi%2BaAYY2OYQIx2wAH0hAAtU67AAixy4mH8p0sxwArBDjtdrqdsP4TABONwmAAcGhM2BJn0kJk%2BAHYWQyTBZ3hYaSzqTSSRZmV8Pp8AG5dIjEM5ueFvY6YExEgUo1EazEQ6XSgiYFjJAxGjFuAgAT2SjFYmGOADEAEqfACyyIAKgBNZTvXbvL5jYheBzHN1WsYAaxMXMhn2Oiadro9SJ9frBBBjmuRaN1%2Bq%2BSbhgjByQh5JFjPpDJ5rNpzJpXErn2ZDL52GFnybFmphaTEejEGWRdOcaBGOxzN2FmObBYSgIEGjpGOGhX6QAXphUFQl1nlst9VzMRWqbT3gyOR3GcyWyySTX%2BXqz2L%2BczsI7%2BdX6dgeTSOZ87YchYnyMu8dZtrSz5sjyDJWBB9I0tS2B8hYn40sK2DAXynygWed6QX2iZhLQ8zHDKqB4OgxzJD8CAQC67per62DHKow6JrGM7RhqViPJYQK6hObFHie1y8vy6GYcBoE0vBoq7Iyz7AXqdIssB9IShJnzvF2LLCgyikWNB/IXu2sGip%2BZ4MmYjLSfyoEMshn4WN%2B6n8nyDLPjhPKfIp16PgyoFEcWpHhMmTFpix5j4kQyRDiORZccQmAEBsDCZtmFiCUSerTrGeohSRZHRKgnhqia1oJYlNXJal6WlhaZyTqJ0pFsV4UUVRNGoPFHE1bVY7JAAtMNrVSseBbBZ8RommaDpKtatoAg6yifK6UV%2Bm80rBqGCKOl4DDIEiPETfGRa7WGjrEPaXFtTV8I0aY%2BUhUWa0bemrHAjdChTQNHUOl11EsFaSLAKgRAQI9YWYIecbJMgwkw8cw04uNCZJgVf39pGWZKtdt0BscyAbCdeMvRjxEMMjQPE2ItAQO9nybV9jRMAow5cSTxBk1GTy0Qo9FcfziPNauK782zCjCd97MFYe%2BWTUV1NkbTKWLv1A2JVzpPRvzvVDujWMU9KtPoFQChQyW3Nw%2BdSYHUdvNKiqRPmwoTsU0Wbu808oi0AzNvY4mDvHTx5wu9gIAgATbDHAAVNzSJUDdsdizF3t64netxYbntJvwxDHBApJgGAGdZr7usV8ayRVQrM6J8n9pjQGCPWNYK6NynC1YgS/jl3zWcVznB5kuJ1mdrWOFNgyP7iqp/kPgZmJu/ejI8sZlavlpH5flWzafgyVnUp89Jdm3AVGd5nLUgyTb8XbnFxvdiV4FQRdd83bwIxOYsaIer0arJGIPCXc5hbJmCJOgDUbgGDgM7qTJubAW7YFlhzIOI5qhKDhO/CAn9kHf1FucMW6pNT4MwCgtBuonibkwEOW2L8tZvyLqQiw5DKFS3zGQxB3dKGI1Rk2XKxxS5iwHpXHmeseKajEUPPmQJhqCMxJLH6DDAFa2ODI%2BmEBWHsO/pw3KvFdGt34WjXK9dGEDSxmo0chVKaYNoEoO61ivYWx9urXOj8RxWLsd43xXxHosCYGEQ2Z1GGPTgXnRMChRAMDAYkcwUD4F9wYOYkKBci6PTwMJJs044RNV7hEmceB26WFUXY9qJZk6oBYCuIgK4GACHVJEkc0TDBxIgYkyB0CulJJilUmpfc6nJMaak8pSZWH9OoQLBASJoggijBAIgoyBqsKIFMuisz5nUGINU5ZmMlZ2LdhALgeyom42NMXRIwIfjqhWFNAqHBVi0E4ESXgfgOBaFIKgTg9IH5gnWJsBaZhdg8FIAQTQjzVhRhAESDQTxDJmC5BhSQNZYVMi4PoTgkg3kQq%2BZwXgCgQBrnBR8x5pA4CwCQGgE0dA4jkEoNS5ItL4jAC4FwJINBaBGmIISiA0RcWXGYMQK0nBQXUrYIIAA8tTEVpLSBYECUYcQcr8ApW6HKQlcrMCqC6F4I0oreDwmqLi0i0QbrCo8FgXFBAQEsANasKgBhgAKAAGp4EwAAd0lctA1MhBAiDEOwKQfr5BKDULi3QGKDBGBQCUmwprCWQFWL1WoMJ8VVBqJkFwDB3CeFaAkIkQQc0DFKOUCQZhAipHSKmyYfhIH5GrZkEtQx4jso6NUeUPRZi1oLRmztdRZjNsWK2itMw%2Bg9vrWMPoQ6y1ttWAoAFWw9A2swNsHgTyXk4rld8jgqgnLDX8JIY4wBkCIzZU8MwRdfl8RsIifACoCQgpXB4Gl9BC57BObwElWgDykGhZIGkTx2hcjMBoDQRJ2UAa4BhQtzyODYtIHargYHSDvM%2BTuglRKwUQt/XBswW70Ppu/ZC0gcoeVZskEAA).

![Debug assembly](/img/非递归dfs/ce_inline.png)

The circled source and assembly correspond. At first glance the functions are simply called normally.

But I marked them `inline`:[^3]

```cpp
inline FRAME_TYPE& top()         {return stk[sp];}
inline bool empty()              {return sp <= 0;}
```
If inlining was ignored, the calls I expected to remove have returned and may even add overhead.

`inline` is only a suggestion. The compiler may decline, although these functions seem exceptionally simple.

Replacing them with macros guarantees textual inlining. The result was 8.83 seconds and 63.16 MB. [Submission](https://www.luogu.com.cn/record/74546789). It saved about 0.2 seconds, at the cost of many extra lines.

### 3.3.4. Unusual operations

#### 3.3.4.1. Returning through multiple function levels

In normal recursion, one `return` pops one frame and resumes the caller. When simulated frames give us complete control, why not pop several at once?

Suppose recursive brute force finds the answer deep in the search. Normally, every recursive level must return in turn. With simulated frames, clear all preceding frames or simply `break` from the interpreter loop.

To test performance, I uploaded another Luogu problem: a $5000\times5000$ grid whose cells are zero or one, representing blocked and passable positions. Determine whether eight-direction movement can reach $(x,y)$ from $(1,1)$ while printing visited positions in DFS order.

Input generator:

```cpp
#include<bits/stdc++.h>
using namespace std;
float valid_possiblity = 0.7;
const int MAXN = 5000;
int main(){
    for(int _ = 1; _ <= 10; _++){
        string f_name = "test" + to_string(_);
        freopen((f_name + ".in").c_str(), "w", stdout);
        printf("%d %d\n", MAXN, MAXN);
        // int endx = rand() % MAXN;
        // int endy = rand() % MAXN;
        printf("%d %d\n", MAXN, MAXN);
        for(int i = 1; i <= MAXN; i++){
            for(int j = 1; j <= MAXN; j++){
                if(i == 1 && j == 1 || i == MAXN && j == MAXN){
                    printf("1 ");
                    continue;
                }
                if(double(rand()) <= double(RAND_MAX) * valid_possiblity){
                    printf("1 ");
                }
                else{
                    printf("0 ");
                }
            }
            printf("\n");
        }
    }
}
```

A nonrecursive DFS can exit immediately after reaching the target; recursion unwinds one level at a time. Perhaps it should be faster.

Results:

| | Conventional DFS | Nonrecursive, array stack | Nonrecursive, STL stack |
|---|---|---|---|
|Submission|[Record](https://www.luogu.com.cn/record/74590998)|[Record](https://www.luogu.com.cn/record/74742271)|[Record](https://www.luogu.com.cn/record/74742233)|
|Time (s)|7.77|9.53|10.50, TLE|
|Memory (MB)|512+, MLE|335.54|187.01|

The result was unexpected. Conventional DFS ran faster on earlier tests but exceeded memory on the final one. Compared with an STL stack, nonrecursive DFS significantly reduced memory here. The large array-stack memory was explained above.

These tests still do not isolate unwinding versus immediate return, so I measured only return time using `chrono`, whose nanosecond precision exceeds `clock()`.

The flattering interpretation is that direct return was about 500 times faster. The less flattering one is that unwinding took only 50,000 nanoseconds, or 0.05 milliseconds. Return cost also depends on the return type; an exceptionally deep recursion returning a huge object might show a meaningful difference, but such a case is rare.

#### 3.3.4.2. Reading caller locals and other operations

The small optimization already used this idea. When every frame is stored in one stack, an array implementation can access local variables in previous frames. Tree DFS can use the caller's `cur` instead of storing another `fa`.

Likewise, just as any number of frames can be popped, one simulated function can push any number of calls at once. I have not found a useful application for that strange operation.

## 3.4. Summary

Nonrecursive DFS has more educational than practical value. It may occasionally improve constants, but writing it takes much longer. With `-O2`, even its small constant advantage often disappears. Unless a problem is extremely tight and forbids both BFS and optimization, avoid this odd technique.

Its potential optimizations depend on the special nature of recursion: every invocation has the same frame structure and size, allowing a structure to represent frames and simplify calls.

The unusual operations also depend on complete control of those uniform frames. Outside recursion, frames have different layouts and sizes, so arbitrary access and manipulation are not generally possible.

Questions and suggestions are welcome in the comments or through direct contact.

[^1]: Source: [https://www.cnblogs.com/zzdbullet/p/9629909.html](https://www.cnblogs.com/zzdbullet/p/9629909.html)
[^2]: pc means program counter, which points to the memory address of the next instruction.
[^3]: C and C++ introduced `inline` to reduce repeated stack overhead from frequently called small functions. It effectively places a function body at its call site. [Source](https://www.runoob.com/w3cnote/cpp-inline-usage.html)
[^4]: A later section says inline does not force inlining. The backtrace section was added in November 2022, after I learned forced inlining. Thanks again to [@LiuTianyou](https://www.luogu.com.cn/user/206814) for the comment.
