---
title: "[MIT 6.s081] xv6 Lab 10: File System Record"
date: 2022-08-18 00:00:00
updated: 2022-10-15 18:48:46
tags:
- xv6
- 2022
- UNIX
- Operating Systems
- File Systems
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/08/xv6_lab10_record/).
{% endnote %}

Update: the lab code is at <https://github.com/ttzytt/xv6-riscv>.

# Lab 10: File System
## Large Files

An xv6 `dinode` stores twelve direct block addresses and one single-indirect address. A 1 KB block holds 256 addresses, so the maximum is only $12\times1024+256\times1024=268$ KB. Add a double-indirect pointer: the first-level block points to 256 second-level blocks, providing $256\times256$ blocks (64 MB).

Reduce `NDIRECT` by one and add a second-indirect slot:
```c
#define NDIRECT 11
#define NINDIRECT (BSIZE / sizeof(uint))
#define NBI_INDIRECT (NINDIRECT * NINDIRECT)
#define MAXFILE (NDIRECT + NINDIRECT + NBI_INDIRECT)
```
Change both on-disk and in-memory inode structures to `addrs[NDIRECT + 2]`.

In `bmap()`, after the single-indirect range, allocate the double-indirect block, select its first-level index with `bn / NINDIRECT`, read the second-level block, and select `bn % NINDIRECT`. Log newly allocated pointer blocks. In `itrunc()`, traverse every first-level pointer and free all second-level data blocks, then free both pointer levels.

## Symbolic Links

A symbolic link is an inode containing the target path. `open()` normally follows links recursively; `O_NOFOLLOW` opens the link itself. Add:
```c
#define O_NOFOLLOW 0x800
#define T_SYMLINK 4
```

`sys_symlink()` creates a `T_SYMLINK` inode and writes the target path into it. In `sys_open()`, while the inode type is `T_SYMLINK` and `O_NOFOLLOW` is absent, read the target path, obtain the next inode with `namei()`, release the old inode, and lock the new one. Limit recursion (for example, 10 steps) to prevent cycles. Always call `ilock()` before reading `ip->type`, because `ilock()` loads inode data from disk.

```c
uint64 sys_symlink(){
  char tar_path[MAXPATH], path[MAXPATH];
  try(argstr(0, tar_path, MAXPATH), return -1);
  try(argstr(1, path, MAXPATH), return -1);
  begin_op();
  struct inode *ip = create(path, T_SYMLINK, 0, 0);
  if(ip == 0){ end_op(); return -1; }
  try(writei(ip, 0, tar_path, 0, strlen(tar_path)), end_op(); return -1);
  iunlockput(ip);
  end_op();
  return 0;
}
```

The system call must also be registered in the same places as the earlier labs. After completing these changes the tests pass:
![](/img/xv6/lab/lab10_AC.png)

## Summary

Out-of-bounds arrays and memory leaks are frightening because the reported error may have no visible relation to the real bug. My final mistake was changing `dinode.addrs` to `NDIRECT+2` but forgetting to make the same change in `struct inode`; accessing `addrs[12]` then actually accessed the next inode's `dev` field, producing bizarre disk errors.
