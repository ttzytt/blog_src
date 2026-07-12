---
title: "[MIT 6.s081] xv6 Lab 1: Utilities Record"
date: 2022-07-09 19:04:29
updated: 2022-10-15 18:48:12
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
cover: /img/xv6/lab/lab1_primes_pipeline_transfer.svg
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/07/xv6_lab1_record/).
{% endnote %}

Update on 2022/9/14: I recently put the lab code on GitHub. If you need a reference, you can find it here:

<https://github.com/ttzytt/xv6-riscv>

The different branches contain the different labs.

---

Before beginning, I have to complain: why is the style of the xv6 source code so strange? The return type of a function is not even on the same line as the function name.

```cpp
int
main(int argc, char* argv[]){
}
```
Like this...

I also recommend disabling dark mode with the gear icon in the lower-right corner while reading, because some images contain black text that is difficult to see in dark mode.

# Lab 1: utils

Lab instructions: <https://pdos.csail.mit.edu/6.828/2020/labs/util.html>

## sleep

>![](/img/xv6/lab/lab1_sleep.png)
>Implement a `sleep` command whose only argument is the amount of time to sleep.

Because the required system call already exists, the implementation is fairly simple: call the provided `sleep` system call directly.

The only detail to remember is that `#include kernel/types.h` must appear before `#include user/user.h`. The former contains several type definitions that `user.h` needs.

```c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
#include "kernel/fd_types.h"

int main(int argc, char *argv[]){
    if (argc != 2){
        fprintf(STDERR, "usage: sleep <tick count>");
        exit(1);
    }
    int tm = atoi(argv[1]); // String -> integer
    sleep(tm);
    exit(0);
}   
```

The included `kernel/fd_types.h` is a file I added myself. Its source is shown below; it simply defines the identifiers for the input and output files so that I do not forget them:

```c
#pragma once
const char STDIN  = 0;
const char STDOUT = 1;
const char STDERR = 2;
```

## pingpong

>![](/img/xv6/lab/lab1_pingpong.png)
>Create a child process and communicate between processes through pipes. The child and parent each send one message to the other through a pipe. After receiving a message, the parent prints "ping" in the terminal, while the child prints "pong" after receiving its message.

After creating the child, first let the parent process send some information. The parent can then call `wait()`. The child first outputs "pong" and sends a message to the parent. Finally, the parent receives that message and outputs "ping".

This process looks simple, but I initially did not understand the properties of pipes and therefore used them incorrectly. A pipe is generally used for one-way communication. Because this lab requires the parent and child to communicate in both directions, two pipes should be created.

This [Zhihu answer](https://www.zhihu.com/question/57509551/answer/153200357) explains the implementation of pipes quite clearly:

>Saying that data can move in only one direction means FIFO. Linux therefore constructs a circular queue internally. More specifically, it allocates a buffer as the entity of the anonymous pipe file created by `pipe()`. The buffer has two pointers, one for reading and one for writing. The read pointer cannot advance past the write pointer; otherwise the writer is awakened and the reader sleeps until the required number of bytes has been read. Similarly, the write pointer cannot advance past the read pointer; otherwise the reader is awakened and the writer sleeps until the required number of bytes has been written.

I also initially omitted `wait()`, which caused problems such as garbled output. We do not know whether the system will run the child or the parent first. Both processes may output "ping" and "pong" at the same time, causing the two words to become mixed together.

```cpp
#include "kernel/fd_types.h"
#include "kernel/types.h"
#include "user/user.h"
enum PIPE_END { REC = 0, SND = 1 };

int main(int argc, char* argv[]) {
    if (argc != 1) {
        fprintf(STDERR, "usage: pingpong (no parameter)");
        exit(114514);  // (sad)
    }
    int p[2];
    pipe(p);
    int cur_pid = fork();

    if (cur_pid == 0) {
        // Child process
        // The child receives a message first
        char buf[20];
        if (read(p[REC], buf, sizeof(buf)) > 0) {
            printf("%d: received pong\n", getpid(), buf);
        }
        // The child sends a message to the parent through the pipe
        fprintf(p[SND], "child");
        exit(0);
    } else if (cur_pid > 0) {
        char buf[20];
        
        // The parent sends a message first and receives one afterward
        fprintf(p[SND], "parent");
        wait(0);
        if (read(p[REC], buf, sizeof(buf))) {
            printf("%d: received ping\n", getpid(), buf);
        }
        exit(0);
    } else {
        fprintf(STDERR, "failed to fork");
        exit(1919810);// A homo-specific exit argument (sad)
    } 
    exit(0);
}
```
## primes

>![](/img/xv6/lab/lab1_primes.png)
>Create multiple child processes to find prime numbers. Each child filters from the numbers received from the preceding process all multiples of one prime, then passes the remaining numbers to another child. Because of xv6's performance limitations, it is sufficient to output the primes up to $35$. The diagrams below provide a more detailed explanation.

<table><tr>
<td><img src=/img/xv6/lab/lab1_primes_pipeline1.png></td>
<td><img src=/img/xv6/lab/lab1_primes_pipeline2.gif></td>
</tr></table>

Image sources: [^1] and [^2].

This is the strangest prime sieve I have ever seen, but it actually fits the definition of “sieving” very well. Each process acts as a particular sieve that filters out multiples of one prime. After the numbers have passed through many layers of sieves, the final primes remain. Note that the first number passed to the next process must be prime, because it is not divisible by any smaller number—or, more precisely, any smaller prime. If it were divisible, an earlier sieve would already have removed it.

One point to remember is that after `fork()`, the child begins executing at the line following `fork()`. After all, `fork()` copies all of the parent's state, including the PC register. (~~This is actually common knowledge and hardly worth noting. I simply did not know it before and made an extremely foolish mistake.~~)

Another point is that a pipe must be closed promptly after use. xv6 has limited resources, and leaving pipes open indefinitely may crash the program.

```cpp
int main(int argc, char* argv[]) {
    int pp[2];
    pipe(pp);
    int pid;
    pid = fork();
    if (pid == 0) {
        close(pp[SND]);
        child_proc(pp);
    } else {
        int init_num[MAX_P];
        int idx = 0;
        for(int i = 2; i <= MAX_P; i++){
            init_num[idx++] = i;
        }
        close(pp[REC]);
        send_to_next(pp[SND], init_num, idx);
        close(pp[SND]);
        wait(0);
    }
    exit(0);
}
```

In the parent process of the main function, we first create an initial array containing the integers from $2$ through $35$. We then call `send_to_next()`, whose purpose is to send the contents of an array through a pipe to the next process.

It is implemented as follows:

```cpp
void send_to_next(int outpp, int msg[], int msg_len) {
    // Send to the next child process
    // outpp is the sending end of the pipe
    for (int i = 0; i < msg_len; i++) {
        write(outpp, msg + i, sizeof(int));
    }
}
```

The child process created in the main function calls `child_proc()`. The function's only argument is the receiving end of a pipe, through which the child receives the numbers not removed by the preceding sieve.

```cpp
void child_proc(int pp[2]) { 
    int child_pp[2];
    pipe(child_pp);
    int prime;
    int len = read(pp[REC], &prime, sizeof(int));   

    if(len == 0){
        // If every number has been filtered out, we can naturally stop
        printf("OK"); 
        exit(0);
        return;
    }
    printf("prime %d\n", prime);
    int outlen;
    int* filtered = filter(prime, pp[REC], &outlen);
    close(pp[REC]);

    int pid = fork();
    if(pid == 0){
        close(child_pp[SND]);
        child_proc(child_pp);
    } else {
        close(child_pp[REC]);
        send_to_next(child_pp[SND], filtered, outlen);
        close(child_pp[SND]);
        wait(0); // wait releases the child's process ID and other resources
        exit(0);
    }
}
```

Inside `child_proc()`, the first received number is treated as prime for the reason explained earlier.

That prime and the `filter()` function are then used to eliminate all of its multiples. The implementation of `filter()` is:

```cpp
int* filter(int num, int inpp, int* outlen) {
    // Filter all multiples of num from the inpp pipe and return the filtered array
    (*outlen) = 0;
    // len is the number of values remaining after filtering
    int* out = (int *)malloc(MAX_P * sizeof(int));
    int ret = 0;
    do {
        ret = read(inpp, out + (*outlen), sizeof(int));
        // ret is the number of bytes read
        if (out[(*outlen)] % num != 0 && ret > 0) {
            (*outlen)++;
        }
    } while (ret > 0);
    return out;
}   
```

After filtering the multiples of the current prime, we can create another process and pass the remaining numbers to it. The child process calls `child_proc()` again:

```cpp
if(pid == 0){
    close(child_pp[SND]);
    child_proc(child_pp);
}
```

Notice that the pipe passed to `child_proc` is not the original `pp`, but the newly created `child_pp`. This is necessary because one process must both read the numbers sent by the preceding process and send its filtered numbers to the following process.

A pipe carries data in only one direction. If we used only one pipe, then while receiving data from the preceding process, the current process could not close the sending end because it would need that end later to pass filtered data to the next process.

However, if the sending end of a pipe has not been closed, a `read()` from that pipe blocks. It waits for new data because the system cannot know whether another message will later arrive from the sending end. Closing the sending end is the only indication that transmission has finished and no additional data will arrive.

At the beginning, both the child and parent inherit an open copy of each pipe end. In other words, two processes have the sending end open. If only one process closes its copy, reading from the receiving end still blocks because the sending end has not truly been closed everywhere.

This explanation may still be unclear. The following diagram shows the entire process more directly:

![](/img/xv6/lab/lab1_primes_pipeline_transfer.svg)

There is another detail. When the child executes `child_proc`, the parent must call `wait()`; otherwise a zombie process may be produced.

That is, the parent may finish and call `exit()` to release its space while the child is still running.

Contrary to what intuition might suggest, when the child later calls `exit()` and releases its resources, it does not disappear completely from the system. Its process descriptor remains, solely to provide status information to its parent.

The parent must therefore call `wait()` to release the last remaining resources of that process, including its process identifier and slab cache entries. The call blocks the current parent until one of its children exits.[^3]

Zombie processes consume resources such as process IDs and file descriptors and are therefore harmful.

Omitting `wait()` also causes the program to fail the supplied unit test, `./grade-lab-util`—which is how I discovered that my program was wrong. During the test, the process never terminates, so the grader reports a timeout.

The same behavior occurs in the shell. Even after all primes have been printed, the shell never displays `$`, showing that the process has not finished.

I am still not entirely sure why a zombie process causes this particular behavior. If you know, please explain it in the comments.

The complete code follows and refers to [^1]:

```cpp
#include "kernel/fd_types.h"
#include "kernel/types.h"
#include "user/user.h"
#include "kernel/dbg_macros.h"
const int MAX_P = 35;
// #define FDEBUG
enum PIPE_END { REC = 0, SND = 1 };
void send_to_next(int outpp, int msg[], int msg_len) {
    // Send to the next child process
    for (int i = 0; i < msg_len; i++) {
        write(outpp, msg + i, sizeof(int));
    }
}
int* filter(int num, int inpp, int* outlen) {
    // Filter all multiples of num from the inpp pipe and return the filtered array
    (*outlen) = 0;
    // len is the number of values remaining after filtering
    int* out = (int *)malloc(MAX_P * sizeof(int));
    int ret = 0;
    do {
        ret = read(inpp, out + (*outlen), sizeof(int));
        // ret is the number of bytes read
        if (out[(*outlen)] % num != 0 && ret > 0) {
            (*outlen)++;
        }
    } while (ret > 0);
    return out;
}   

void child_proc(int pp[2]) { 
    int child_pp[2];
    pipe(child_pp);
    int prime;
    int len = read(pp[REC], &prime, sizeof(int));   
    DEBUG("len: %d\n", len);
    if(len == 0){
        printf("OK"); 
        exit(0);
        return;
    }
    printf("prime %d\n", prime);
    int outlen;
    int* filtered = filter(prime, pp[REC], &outlen);
    dbg_arr_i32(filtered, 0, outlen);
    DEBUG("outlen: %d\n", outlen);
    close(pp[REC]);

    int pid = fork();
    if(pid == 0){
        close(child_pp[SND]);
        child_proc(child_pp);
    } else {
        close(child_pp[REC]);
        send_to_next(child_pp[SND], filtered, outlen);
        close(child_pp[SND]);
        wait(0); // wait releases the child's process ID and other resources
        exit(0);
    }
}

int main(int argc, char* argv[]) {
    int pp[2];
    pipe(pp);
    int pid;
    pid = fork();
    if (pid == 0) {
        close(pp[SND]);
        child_proc(pp);
    } else {
        int init_num[MAX_P];
        int idx = 0;
        for(int i = 2; i <= MAX_P; i++){
            init_num[idx++] = i;
        }
        close(pp[REC]);
        send_to_next(pp[SND], init_num, idx);
        close(pp[SND]);
        wait(0);
    }
    exit(0);
}
```

`DEBUG` and `dbg_arr_i32` are debugging functions or macros I added to `kernel/dbg_macros.h` as follows:

```cpp
#pragma once
#include "kernel/fd_types.h"

#if (!defined FPRINTF)
// Kernel mode has no fprintf, only printf, so redefine fprintf
#define fprintf(_stream, _fmt, ...) printf(_fmt, ##__VA_ARGS__)
#endif

#ifdef FDEBUG
#define try(_expr, _act)                                                     \
    {                                                                        \
        if ((_expr) < 0) {                                                   \
            fprintf(STDERR, "try: %s failed, at line %d, file %s\n", #_expr, \
                    __LINE__, __FILE__);                                     \
            _act;                                                            \
        }                                                                    \
    }
#else
#define try(_expr, _act)
#endif

#ifdef FDEBUG
#define DEBUG(fmt, ...) fprintf(STDERR, fmt, ##__VA_ARGS__)
#else
#define DEBUG(fmt, ...)
#endif

void dbg_arr_i32(int arr[], int st, int ed) {
#ifdef FDEBUG
    for (int i = st; i <= ed; i++) {
        DEBUG("%d ", arr[i]);
    }
    DEBUG("\n");
#endif
}
```

## find

>![](/img/xv6/lab/lab1_find.png)
>Implement the `find` command. It searches a directory for every file with a specified name and prints the absolute path of each matching file.

The implementation can refer to `ls`.

It is essentially a DFS. If the current path refers to a directory, recursively visit every file and subdirectory inside it.

To obtain the entries stored in a directory, directly call `read()` on that directory. The returned object is a `dirent` structure.

The structure is defined as:

```cpp
struct dirent {
  ushort inum;
  char name[DIRSIZ];
};
```

Its `inum` field is the inode number. It is different from a file descriptor: multiple file descriptors can refer to one file, but every file has a unique `inum`.

Remember to skip the `.` and `..` entries inside a directory; otherwise the recursion becomes an infinite loop.

Using the `dirent` structure, we can append `name` directly to the current path and recursively pass the resulting path to the next call.

The functionality required here differs from `ls`, so its implementation can actually be simplified further.

Because `ls` is not recursive, it must initially call `fstat()` on a file entry to determine whether it is a directory or a file. If it is a directory, `ls` then calls `stat()` to output information for every entry inside that directory.

Both `stat()` and `fstat()` obtain information about an inode. Their only difference is that `fstat()` accepts a file descriptor, whereas `stat()` accepts a path.

Because `find` is recursive and already obtains a descriptor with `open()`, it needs only one call to `fstat()` and does not need `stat()`.

```cpp
#include "kernel/fd_types.h"
#include "kernel/types.h"
#include "kernel/fs.h"
#include "kernel/stat.h"
#include "user/user.h"
// #define FDEBUG
#include "kernel/dbg_macros.h"

const int BUF_SIZ = 512;

char* get_fname_from_path(char path[]) {
    char* ptr = path + strlen(path);  // ptr points to the final element of path
    for (; ptr >= path && *ptr != '/'; ptr--) {
    }
    return ++ptr;  // After the loop it points to '/', so advance it once
}

void dfs_find(char* cur_path, char* name) {
    int cur_fd;
    char nexdir_buf[BUF_SIZ];
    struct stat cur_stat;
    struct dirent nex_dir;
    try(cur_fd = open(cur_path, 0), return );
    try(fstat(cur_fd, &cur_stat), return );  // fstat accepts a file descriptor
    if (cur_stat.type == T_FILE) {
        if (strcmp(get_fname_from_path(cur_path), name) == 0) {
            printf("%s\n", cur_path);
        }
    } else if (cur_stat.type == T_DIR) {
        strcpy(nexdir_buf, cur_path);
        char* path_end = nexdir_buf + strlen(nexdir_buf);

        *(path_end) = '/';
        path_end++;
        while (read(cur_fd, &nex_dir, sizeof(struct dirent)) ==
               sizeof(struct dirent)) {
            if (nex_dir.inum == 0)
                continue;  // inum is the inode number; zero means unavailable
            if (strcmp(".", nex_dir.name) == 0 || strcmp("..", nex_dir.name) == 0){
                DEBUG(". or ..\n");
                continue;
            }
            memmove(path_end, nex_dir.name, DIRSIZ);
            path_end[DIRSIZ] = '\0';
            try(stat(nexdir_buf, &cur_stat),
                continue);  // stat accepts an absolute path here; this line can be removed because the implementation is recursive
            dfs_find(nexdir_buf, name);
        }
    }
    close(cur_fd);
}

int main(int argc, char* argv[]) {
    if (argc != 3) {
        fprintf(STDERR, "usage: find <directory> <file name>");
        exit(114);
    }
    dfs_find(argv[1], argv[2]);
    exit(0);
}
```

## xargs

>![](/img/xv6/lab/lab1_xargs.png)
>Implement the UNIX `xargs` command.

At first, I spent a long time without understanding what this command did. It simply passes data from standard input as arguments to a command. The first argument to `xargs` is the name of another command. All subsequent arguments, together with data read from standard input, must be supplied as arguments when that command is executed.

`xargs` exists because many commands cannot read pipe input directly as command-line arguments. A shell pipe connects the standard output of the preceding command to the standard input of the next one. We therefore need to read this input and convert it into arguments for another command.

For example, consider `echo hello too | xargs echo bye`. The pipe writes the two strings "hello" and "too" to the standard input of `xargs`. It must read those strings and combine them with the argument "bye", then execute the second `echo` with all three as arguments.

First, we identify separate arguments by spaces and newline characters, split them, and store them in another character array named `std_args`.

Next, create a character-pointer array named `arg2pass` for the arguments passed to `exec()`. Put the command name, `argv[1]`, into `arg2pass` first, followed by the remaining elements of `argv`, and finally append the elements of `std_args`.

```cpp
#include "kernel/types.h"
#include "user/user.h"
// #define FDEBUG
#include "kernel/fd_types.h"
#include "kernel/param.h"
#include "kernel/dbg_macros.h"

const char* DEFAULT_CMD = "echo";
#define MX_ARG_CNT 32
#define MX_ARG_LEN 32

char cut_str_by(char* src, char* dst, int* srcpos, char* signs) {
    // Search src from index srcpos and stop at the first character contained in signs.
    // Copy src[srcpos ... position before the sign] into dst.
    // srcpos is a pointer, so after this function returns it tells the caller where
    // the character from signs was encountered.
    // The return value is effectively Boolean. C has no bool here, so char indicates
    // whether a character from signs was encountered.
    // If none was found, srcpos may already point to \0, meaning no argument remains.
    // Alternatively, a sequence was read without a following space or \n, meaning it is the final argument.
    for (int i = *srcpos; src[i] != '\0'; i++) {
        for (int s = 0; signs[s] != '\0'; s++) {
            if (src[i] == signs[s]) {
                src[i] = '\0';
                strcpy(dst, src + *srcpos);
                *srcpos = i + 1;
                return 1;
            }
        }
    }
    return 0;
};

char std_args[MX_ARG_CNT][MX_ARG_LEN];
int main(int argc, char* argv[]) {
    char* cmd;
    if (argc == 1) {
        cmd = DEFAULT_CMD;
    } else {
        cmd = argv[1];
    }

    int argcnt = 0;
    char buf[MX_ARG_LEN * MX_ARG_CNT];
    int curlen = 0;
    int lst_pos = 0;

    try(read(STDIN, buf, sizeof(buf)), exit(1145));

    memset(std_args, 0, sizeof(std_args));
    while (cut_str_by(buf, std_args[argcnt], &lst_pos, "\n ")) {
        while (buf[lst_pos] == '\n' || buf[lst_pos] == ' ') {
            // There may be many spaces between two arguments
            lst_pos++;
        }
        argcnt++;
    }

    char* arg2pass[MX_ARG_CNT];

    int lst = 0;
    arg2pass[lst++] = cmd; // Put argv[1] first
    for (int i = 2; i < argc; i++) {
        // Then the other argv entries
        arg2pass[lst++] = argv[i];
    }
    for (int i = 0; i < argcnt; i++) {
        // Finally append the argv entries read from standard input
        arg2pass[lst++] = std_args[i];
    }

    exec(cmd, arg2pass);
    exit(0);
}
```

## Summary

First, here is a picture showing that the lab passes. I also wish everyone working on this lab an early AC.

![](/img/xv6/lab/lab1_AC.png)

Most parts were not very hard to devise. Debugging consumed a great deal of time, however, making my progress extraordinarily slow. After years of using the C++ STL, I am no longer particularly familiar with C, and debugging C strings wasted especially much time. I should practice both debugging techniques and the C language in the future.

[^1]: <https://blog.csdn.net/weixin_44465434/article/details/111524650>
[^2]: <https://swtch.com/~rsc/thread/>
[^3]: <https://segmentfault.com/a/1190000038820321>
