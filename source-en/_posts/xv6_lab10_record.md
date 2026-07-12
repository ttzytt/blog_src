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

Update on 2022/9/14: I recently put the lab code on GitHub. If you need a reference, you can find it here:

<https://github.com/ttzytt/xv6-riscv>

The different branches contain the different labs.

---

# Lab 10: File System

## Large files

### Description

In xv6's underlying implementation, a file is described by `struct dinode`, as follows:

```c
struct dinode {
  short type;           // File type
  short major;          // Major device number (T_DEVICE only)
  short minor;          // Minor device number (T_DEVICE only)
  short nlink;          // Number of links to inode in file system
  uint size;            // Size of file (bytes)
  uint addrs[NDIRECT + 1];   // Data block addresses
};
```

Here we mainly care about the `addrs` field in this structure. It records the actual storage locations of the file. The first twelve entries of `addrs` point directly to blocks that store file data. The final entry is an indirect block: the block to which it points stores other pointers, and those pointers in turn point to the blocks that actually store the data. This may sound rather convoluted; it looks approximately like the following diagram:

![](/img/xv6/lab/lab10_inode.png)

We can calculate the maximum file size supported by xv6. A `struct dinode` occupies 64 B, and one disk block can store 1024 B of data.

The first twelve direct entries of `addrs` can therefore address $12 \times 1024B = 12288B$ of data.

The final indirect pointer points to a block filled with pointers to other disk blocks. That block can hold $1024B \div 4B = 256$ addresses.

Each address identifies an entire block, so this indirect entry of `addrs` supplies $256 \times 1024B = 262144B$ of storage.

Together they provide $262144B + 12288B = 274432B$, which is $268KB$.

This capacity is obviously very small. In this lab, we therefore need to add a doubly indirect block pointer to the inode.

A singly indirect block pointer is the last `addrs` entry just described: it points to a block, and the block pointers stored in that block point to the actual data blocks.

With a doubly indirect pointer, each pointer in the block addressed by `addrs` points to another block that stores pointers. This increases the available storage, somewhat like a multilevel page table, as illustrated below:

![](/img/xv6/lab/lab10_多级块索引.jpg)

We can calculate the capacity supplied by this doubly indirect pointer. One block holds 256 block pointers, so the block addressed by `addrs` can contain the block numbers of 256 pointer blocks. The total is therefore $256\times256=65536$ blocks. At 1024 bytes per block this is 64 MB, a very substantial increase.

### Approach

We need to modify the two functions `bmap()` and `itrunc()`. There is nothing particularly difficult to reason about, so I leave the detailed explanation in the code section.

### Code

Because a doubly indirect index has been added, several macro definitions must first be changed:

```c
#define NDIRECT 11 // Remove one direct index and add one doubly indirect index
#define NINDIRECT (BSIZE / sizeof(uint))
#define NBI_INDIRECT NINDIRECT * NINDIRECT // Blocks supplied by the doubly indirect index
#define MAXFILE (NDIRECT + NINDIRECT + NBI_INDIRECT) // 
```

We must also modify `struct dinode` and `struct inode`. A `dinode` is stored on the disk itself, while an `inode` adds metadata to the `dinode` representation to make inode processing more convenient:

```c
//in fs.h
// On-disk inode structure
struct dinode {
  short type;           // File type
  short major;          // Major device number (T_DEVICE only)
  short minor;          // Minor device number (T_DEVICE only)
  short nlink;          // Number of links to inode in file system
  uint size;            // Size of file (bytes)
  uint addrs[NDIRECT + 2];   // Data block addresses; changed to + 2 here
};
```

```c
// in file.h
// in-memory copy of an inode
struct inode {
  uint dev;           // Device number
  uint inum;          // Inode number
  int ref;            // Reference count
  struct sleeplock lock; // protects everything below here
  int valid;          // inode has been read from disk?

  short type;         // copy of disk inode
  short major;
  short minor;
  short nlink;
  uint size;
  uint addrs[NDIRECT+2];// Changed to + 2 here
};
```

`bmap()`:

This function accepts an `inode` pointer and `bn`, where `bn` means the index of a block within that inode, and returns the corresponding block number.

We need to add support for doubly indirect blocks to this function. To obtain a second-level indirect block, we can first obtain the corresponding first-level indirect block.

Much of the code can follow the existing handling of the singly indirect block.

```c
// in fs.c
……
  bn -= NINDIRECT;
  // bn represents how many blocks remain

  if(bn < NBI_INDIRECT){
    if((addr = ip->addrs[NDIRECT + 1]) == 0) // If this block has not previously been allocated
      ip->addrs[NDIRECT + 1] = addr = balloc(ip->dev);    
    bp = bread(ip->dev, addr); // Short for buffer pointer
    a = (uint *)bp->data;

    uint idx_b1 = bn / NINDIRECT; // Obtain the index in addr of the first-level block corresponding to bn
    if((addr = a[idx_b1]) == 0){  // One first-level block covers 256 second-level blocks; check whether it exists
      a[idx_b1] = addr = balloc(ip->dev);
      log_write(bp); 
      // Mark this block as modified; it will later be updated in the disk log area.
      // It changed because a new block pointer was added to this pointer block.
    } 

    brelse(bp); // Release the cached block
    
    bp2 = bread(ip->dev, addr); // bp2 is the cache for the second-level block
    a = (uint *)bp2->data;
    uint idx_b2 = bn % NINDIRECT;
    if((addr = a[idx_b2]) == 0){
      a[idx_b2] = addr = balloc(ip->dev);
      log_write(bp2);
    }
    brelse(bp2);
    return addr;
  }
……
```

`itrunc()`:

This function clears every block belonging to an inode; it can also be understood as deleting a file. Internally, it repeatedly calls `brelse()` and `bfree()`.

Here, `brelse()` releases a cached block, while `bfree()` releases a disk block by modifying the data in the disk's bitmap block.

As with `bmap()`, much of the implementation can follow the singly indirect index. The main idea resembles recursion: traverse every first-level block, check whether it contains data, and, if it does, traverse the second-level blocks referenced from it.

```c
// in fs.c
……
  if(ip->addrs[NDIRECT + 1]){ // Determine whether the inode uses the doubly indirect index
    bp = bread(ip->dev, ip->addrs[NDIRECT + 1]);
    a = (uint*)bp->data;
    for (i = 0; i < NINDIRECT; i++){ // Traverse the first-level blocks
      if(a[i]){ // If data exists, traverse the second-level blocks within this first-level block
        struct buf* bp2 = bread(ip->dev, a[i]); // Obtain the corresponding cache for this block
        uint *a2 = bp2->data;
        for(j = 0; j < NINDIRECT; j++){
          if(a2[j])
            bfree(ip->dev, a2[j]); // a2[j] stores a block number; release that disk block here
        } 
 
        brelse(bp2); // Release the cached block
        bfree(ip->dev, a[i]); // Release the disk block
        // bp2 corresponds to a[i].
        // a[i] is the block number, while bp2 is the actual cached block.
      }      
    }
    brelse(bp); // Release the cache
    bfree(ip->dev, ip->addrs[NDIRECT + 1]); // Release the disk block
    ip->addrs[NDIRECT + 1] = 0;
  }
……
```

## Symbolic links

### Lab description

This exercise asks us to implement symbolic links, also called soft links. To be honest, I am still not completely clear about the essential difference between soft and hard links. A symbolic link is somewhat like a shortcut in Windows.

The implementation is actually simple. However, the hints supplied by this lab were not sufficient for me, so I was rather confused while doing it and eventually finished only after reading someone else's blog.

First, a symbolic link is like a “pointer” to a file. When we open a symbolic link, the file to which it points is what actually gets opened. This lets a path in one directory open a file that is physically stored in a different directory.

### Approach

How should this symbolic link be implemented? A symbolic link is itself a file. We only need to store the path of its target file in that file—or, more precisely, in its inode.

To achieve link following, `open()` must use the stored path to recursively find the final target file, because one symbolic link may point to another symbolic link.

But what if we want to open the symbolic link itself? That requires a new `open()` flag. Such flags specify settings for opening a file descriptor. We can add an `O_NOFOLLOW` flag meaning that the path stored in a symbolic link should not be followed recursively and that the link itself should be opened.

```c
//in fcntl.h
#define O_RDONLY  0x000
#define O_WRONLY  0x001
#define O_RDWR    0x002
#define O_CREATE  0x200
#define O_TRUNC   0x400
#define O_NOFOLLOW 0x800
```

An inode is an abstraction over the various kinds of data stored on disk. To determine what an inode actually contains, we also need to define a new inode type:

```c
//in stat.h
#define T_DIR     1   // Directory
#define T_FILE    2   // File
#define T_DEVICE  3   // Device
#define T_SYMLINK 4   // Symbolic link
```

One annoying detail in this exercise is that the `sys_symlink()` system call has not already been registered. As in Lab 2, it must be added to the various relevant files. I assume readers of this article have completed Lab 2, so I will not repeat that process. If you have not, see [this article](/07/xv6_lab2_record).
<!-- TODO: add the Lab 2 link -->

### Code

`sys_symlink()`:

As described above, a symbolic link is essentially a kind of file, but that file is itself represented by an inode. While writing the code, remember that all these operations are performed on an inode. In addition, all file-related system calls must be enclosed by `begin_op()` and `end_op()`. This means that every operation in that interval is first recorded in the logging system. For background, refer to the xv6 book and lectures.

```c
uint64 sys_symlink(){
  char tar_path[MAXPATH], path[MAXPATH];
  try(argstr(0, tar_path, MAXPATH), return -1);
  try(argstr(1, path, MAXPATH), return -1);
  struct inode* ip;


  begin_op();
  ip = create(path, T_SYMLINK, 0, 0); // Create a file and return its inode (there are no comments, so I am not
                                      // entirely sure how this function is used; I inferred it from the implementation)
  if(ip == 0){
    end_op();
    return -1;
  }
  try(writei(ip, 0, tar_path, 0, strlen(tar_path)), end_op(); return -1); 
  // writei writes data to an inode; here it stores the path targeted by the symbolic link
  iunlockput(ip);
  // Standard operations after finishing with an inode:
  // first release the lock and then release this inode.
  // iput() for an inode is similar to brelse() for a cached block.
  // Both first decrement the reference count and then determine whether the object can truly be freed.
  end_op();
  return 0;
}
```

`sys_open()`:

The following code at the beginning of `sys_open()` opens or creates the inode corresponding to the path supplied by the user and stores it in `ip`. The later code in `sys_open()` processes this `ip` to finish the open operation, but we do not need to consider that part yet.

```c
\\ in sysfile.c
  if(omode & O_CREATE){
    ip = create(path, T_FILE, 0, 0);
    if(ip == 0){
      end_op();
      return -1;
    }
  } else {
    if((ip = namei(path)) == 0){
      end_op();
      return -1;
    }
    ilock(ip);
    if(ip->type == T_DIR && omode != O_RDONLY){
      iunlockput(ip);
      end_op();
      return -1;
    }
  }
```

For a symbolic link, the `ip` corresponding to the path supplied by the user is not the inode the user ultimately wants to open. We therefore need to follow the files referenced by symbolic links recursively and update `ip`. Note that the final `ip` must remain locked.

The code is as follows and is added after the preceding block:

```c
\\ in sysfile.c
  if(!(omode & O_NOFOLLOW)){
    int rec_left = 10; // Recursion limit because symbolic links may form a cycle
    struct inode* next_file;
    while(rec_left && ip->type == T_SYMLINK){
      
      if(readi(ip, 0, path, 0, MAXPATH) == 0){
        iunlockput(ip);
        end_op();
        return -1;
      }

      if((next_file = namei(path)) == 0){
        // namei obtains an inode from a path
        iunlockput(ip);
        end_op();
        return -1;
      }
      iunlockput(ip); // We have finished using the file that stores the link
      ip = next_file;
      rec_left--;  
      ilock(ip); // Lock here rather than below the while loop because, even if this inode is not a symbolic link,
                 // we still need to hold the lock since the later processing code modifies the inode
    }
    if(rec_left <= 0){
      iunlockput(ip);
      end_op();
      return -1;
    }
  }
```

There is one particularly important detail here. While following symbolic links recursively, we need to stop when we reach a file that is not a symbolic link. This requires access to the inode's `type` field. The check of this field must occur after `ilock(ip)`. It took me a long time to discover this bug.

First, examine the code for `ilock()`:

```c
// Lock the given inode.
// Reads the inode from disk if necessary.
void
ilock(struct inode *ip)
{
  struct buf *bp;
  struct dinode *dip;

  if(ip == 0 || ip->ref < 1)
    panic("ilock");

  acquiresleep(&ip->lock);

  if(ip->valid == 0){
    bp = bread(ip->dev, IBLOCK(ip->inum, sb));
    dip = (struct dinode*)bp->data + ip->inum%IPB;
    ip->type = dip->type;
    ip->major = dip->major;
    ip->minor = dip->minor;
    ip->nlink = dip->nlink;
    ip->size = dip->size;
    memmove(ip->addrs, dip->addrs, sizeof(ip->addrs));
    brelse(bp);
    ip->valid = 1;
    if(ip->type == 0)
      panic("ilock: no type");
  }
}
```

The function first checks `ip->valid`. This `valid` field indicates whether the current inode's data has been loaded from disk. If it has not, the function reads the disk first and loads the data into this inode.

In other words, accessing an inode before calling `ilock()` means the inode may still be empty, so the values read from it naturally have no meaning. This also reminds us once again that shared data accessed between threads must be locked.

After finishing these changes, the lab can finally pass. I also wish everyone working on this lab an early AC:

![](/img/xv6/lab/lab10_AC.png)

One reminder: if your tests run successfully in QEMU but `make grade` still fails, the likely cause is a timeout—perhaps my computer is simply too slow. In that case, increase the time limit in the Python grading program `grade-lab-fs`.

## Summary

Array out-of-bounds errors and memory leaks are truly terrifying. The actual defect may have no apparent relationship whatsoever to the error reported by the system, making it nearly impossible to debug.

I will briefly describe some exceptionally foolish mistakes I made while doing this lab. The worst part is that debugging them consumed two entire afternoons.

At first, `symlinktest` caused a panic whose message was `virtio_disk_intr status`. I certainly did not know how to deal with something involving a virtual disk, so I stepped through the program and located the exact operation in `symlinktest` where the problem occurred:

```c
  r = symlink("/testsymlink/4", "/testsymlink/3");
  if(r) fail("Failed to link 3->4");

  close(fd1);
  close(fd2); // The problem occurs here

  fd1 = open("/testsymlink/4", O_CREATE | O_RDWR);
  if(fd1<0) fail("Failed to create 4\n");
```

Here, `symlinktest` panicked immediately after calling `close(fd2)`.

I stepped through it again and found that the call sequence when the failure occurred was approximately:

```
sys_close() -> fileclose() -> iput() -> itrunc() -> bread()：
```

I assumed that I had written `itrunc()` incorrectly. I even created a new branch and copied someone else's `itrunc()`, but the problem remained.

Then I wondered whether it was some inexplicable issue, so I simply commented out that `panic()`. A new panic appeared, this time reporting `freeing free block`:

```c
static void
bfree(int dev, uint b)
{
  struct buf *bp;
  int bi, m;

  bp = bread(dev, BBLOCK(b, sb));
  bi = b % BPB;
  m = 1 << (bi % 8);
  if((bp->data[bi/8] & m) == 0)
    panic("freeing free block"); // Here
  bp->data[bi/8] &= ~m;
  log_write(bp);
  brelse(bp);
}
```

Later, I also found that `itrunc()` had not released the singly indirect index blocks at all and instead attempted to release the doubly indirect index immediately because `addrs[12]` was nonzero. That made no sense: the singly indirect capacity should be exhausted before the doubly indirect index is used. Combined with the `freeing free block` panic, this made me fairly certain that some kind of out-of-bounds access was responsible.

Eventually I discovered that the problem was actually in `struct inode`:

```c
struct inode {
  uint dev;           // Device number
  uint inum;          // Inode number
  int ref;            // Reference count
  struct sleeplock lock; // protects everything below here
  int valid;          // inode has been read from disk?

  short type;         // copy of disk inode
  short major;
  short minor;
  short nlink;
  uint size;
  uint addrs[NDIRECT+2];
};
```

I had changed `addrs[NDIRECT + 1]` to `addrs[NDIRECT + 2]` in `dinode`, but had forgotten to make the same change in `inode`.

Consequently, when I accessed `addrs[12]`, I was actually accessing the `dev` field of the next inode. Things then became absurd: how could an inode's doubly indirect index block possibly be block number one, the superblock?

I am actually curious why `itrunc()` did not free the superblock and exactly how this caused the virtual-disk panic. I am too tired to debug it further, but anyone interested can investigate.

That is enough. This completely broke me.
