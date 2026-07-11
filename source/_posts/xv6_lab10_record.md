---
title: "[MIT 6.s081] xv6 lab10 file system 实验记录"
date: 2022-08-18 00:00:00
updated: 2022-10-15 18:48:46
tags:
- xv6
- 2022
- UNIX
- 操作系统
- 文件系统
categories:
- 实验记录
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
upd@2022/9/14：最近把实验的代码放到 github 上了，如果需要参考可以查看这里：

<https://github.com/ttzytt/xv6-riscv>

里面不同的分支就是不同的实验。

---

# Lab10: file system

## Large files
### 描述

在 xv6 的底层实现中，文件是由 `struct dinode` 来描述的，如下：

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

这里我们主要关注结构体中的 `addrs` 属性。维护了此文件的实际储存位置。其中有 `addrs` 的前十二个直接指向文件储存的块，最后一个是间接的块，即其指向的块中储存了别的指针，这些指针才指向了实际储存数据的块。听起来有点绕，大概是下面这个示意图的样子：

![](/img/xv6/lab/lab10_inode.png)

那我们可以计算一下 xv6 能支持的最大文件大小。已知一个 `struct dinode` 有 64B 的大小，一个磁盘块能储存 1024B 的数据。

那么前 12 个直接指向数据块的 `addrs` 就能储存 $12 \times 1024B = 12288B$

而最后一个间接的数据指针指向一个存满了指针（指向别的磁盘块）的块，这个块能存放 $1024B \div 4B = 256$ 个地址。

而这里的每个地址都是一个块，因此，这个间接 `addrs` 能提供 $256 \times 1024B = 262144B$ 的储存空间。

那么他们加起来就是 $262144B + 12288B = 274432B$ 的储存空间，等于 $268KB$

这样的储存空间显然是非常小的，所以在这个 lab 中我们需要给 inode 加入一个二级的间接块指针来解决这个问题。

一个一级的间接块指针就是刚刚提到的，inode 中 `addrs` 的最后一个，其指向一个块，而这个块中储存的块指针又指向别的数据块。

在二级块指针中，`addrs` 中指针指向的块中的指针会指向另外的，储存指针的块，以此加大储存空间（有点像是多级页表了），如下：

![](/img/xv6/lab/lab10_多级块索引.jpg)

可以计算一下这个二级间接块指针能提供的空间，已知一个块能储存 256 个块指针，那么 `addrs` 指向的那个块能储存 256 个块指针块的块号，所以总数就是 $256\times 256 = 65536$ 个块。除以 1024 为 64MB，可见提升非常巨大。

### 思路

需要修改 `bmap()` 和 `itrunc()` 这两个函数，不过没有什么特别难以思考的地方，所以具体的解释还是放到代码部分。

### 代码

因为加入了二级间接索引，所以要先对一些宏定义进行修改：

```c
#define NDIRECT 11 // 减少一个直接索引，增加一个二级间接索引
#define NINDIRECT (BSIZE / sizeof(uint))
#define NBI_INDIRECT NINDIRECT * NINDIRECT // 二级间接索引提供的块
#define MAXFILE (NDIRECT + NINDIRECT + NBI_INDIRECT) // 
```

同时也需要修改 `struct dinode` 和 `struct inode`。其中，`dinode` 是实际储存在磁盘上的，而 `inode` 在 `dinode` 的基础上加入了很多方便处理 `inode` 的元数据：

```c
//in fs.h
// On-disk inode structure
struct dinode {
  short type;           // File type
  short major;          // Major device number (T_DEVICE only)
  short minor;          // Minor device number (T_DEVICE only)
  short nlink;          // Number of links to inode in file system
  uint size;            // Size of file (bytes)
  uint addrs[NDIRECT + 2];   // Data block addresses 这里修改成了 + 2
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
  uint addrs[NDIRECT+2];// 这里修改成了 + 2
};
```

`bmap()`：

这个函数接收 `inode` 指针和 `bn`，表示 `inode` 中的第几个块，返回对应的块号。

我们需要在这个函数中添加对二级间接块的支持。为了取得二级的间接块，我们可以先获取到一级的间接块。

代码中很多写法可以参考前面对一级间接块的处理。

```c
// in fs.c
……
  bn -= NINDIRECT;
  // bn 代表还剩多少个

  if(bn < NBI_INDIRECT){
    if((addr = ip->addrs[NDIRECT + 1]) == 0) // 如果之前没分配这个 block
      ip->addrs[NDIRECT + 1] = addr = balloc(ip->dev);    
    bp = bread(ip->dev, addr); // buf pointer 的简称
    a = (uint *)bp->data;

    uint idx_b1 = bn / NINDIRECT; // 取得 bn 对应的，一级间接块在 addr 中的下标
    if((addr = a[idx_b1]) == 0){  // 一个一级块负责 256 个二级块，这里检测对应一级块是否存在
      a[idx_b1] = addr = balloc(ip->dev);
      log_write(bp); 
      // 标志这个块被修改了，随后会更新到磁盘的日志区
      // 修改是因为，我们给这个储存块指针的块添加了一个新的块指针
    } 

    brelse(bp); // 释放块缓存
    
    bp2 = bread(ip->dev, addr); // bp2 为二级块的缓存
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

`itrunc()`：

此函数会清理 inode 中的所有块，或者可以理解成删除一个文件。这个函数内实际上是在不停的调用 `brelse()` 和 `bfree()`。

其中 `brelse()` 释放一个块缓存，而 `bfree()` 则通过修改磁盘上 bitmap 块的数据来释放磁盘上的一个块。

和 `bmap()` 相同，很多地方可以参考一级间接索引的实现。主要的思路类似递归，先遍历每个一级块，检查里面是否有数据，如果有，就去遍历这个一级块里的二级块。

```c
// in fs.c
……
  if(ip->addrs[NDIRECT + 1]){ // 判断 inode 是否使用了二级间接索引
    bp = bread(ip->dev, ip->addrs[NDIRECT + 1]);
    a = (uint*)bp->data;
    for (i = 0; i < NINDIRECT; i++){ // 遍历一级块
      if(a[i]){ // 如果有数据，就遍历这个一级块里的二级块
        struct buf* bp2 = bread(ip->dev, a[i]); // 获取这个块的对应缓存
        uint *a2 = bp2->data;
        for(j = 0; j < NINDIRECT; j++){
          if(a2[j])
            bfree(ip->dev, a2[j]); // a2[j] 存的是块号，这里把磁盘中这个块的内容清空了。或者说释放
        } 
 
        brelse(bp2); // 释放块缓存
        bfree(ip->dev, a[i]); // 释放磁盘中的块
        // 和 a[i] 对应的是 bp2
        // a[i] 是块号，bp2 是实际的块缓存
      }      
    }
    brelse(bp); // 释放缓存
    bfree(ip->dev, ip->addrs[NDIRECT + 1]); // 释放磁盘块
    ip->addrs[NDIRECT + 1] = 0;
  }
……
```

## Symbolic links

### 实验描述
这个实验需要我们实现符号链接，或者说软链接（说实话我现在还不是很清楚软硬链接的本质区别），有点像 windows 中的快捷方式。

实现起来其实很简单，不过这个 lab 中的提示给的（对我来说）不是很足，所以做的时候还是有点懵逼的，最后看了别人的博客才做出来。

首先软链接就像是一个文件的“指针”，如果我们打开某个软链接，实际打开的是那个链接指向的文件，这样就可以实现某个目录打开实际储存在不同目录的文件。

### 思路

那么我们要如何实现这个软链接呢？软链接的本质其实也是一个文件，我们只要在这个文件（其实是 inode）中储存此链接指向的文件的路径就行了。

为了实现链接的效果，在 `open()` 函数中，需要去根据链接中储存的路径，递归的找到最终指向的文件（可能会有一个软链接指向另一个软链接）。

可是万一我们想打开的是这个软连接本身呢？这就需要新定义的 `open()` 标志位了，这些标志位用于指定打开文件描述符的一些设置。那我们可以添加一个 `O_NOFOLLOW` 的标志位，意味不去递归打开软连接里的路径，而打开软连接本身。

```c
//in fcntl.h
#define O_RDONLY  0x000
#define O_WRONLY  0x001
#define O_RDWR    0x002
#define O_CREATE  0x200
#define O_TRUNC   0x400
#define O_NOFOLLOW 0x800
```

同时 inode 本身是对磁盘中储存的各种数据的一种“抽象”，为了得知 inode 里面具体放的是什么，需要定义一个新的 inode 类型：

```c
//in stat.h
#define T_DIR     1   // Directory
#define T_FILE    2   // File
#define T_DEVICE  3   // Device
#define T_SYMLINK 4   // 软连接
```

注意这个实验中比较烦人的一点是，`sys_symlink()` 这个系统调用是没有注册好的，需要和 lab2 一样，在各种文件中加入这个系统调用，我假设看这个文章的人都是做过 lab2 的，所以不赘述，如果你没有，可以看我的[这篇文章](/07/xv6_lab2_record)。
<!-- TODO 加入 lab2 链接-->

### 代码

`sys_symlink()`：

前面说软连接的本质其实是一种文件，不过这个文件其实又是一个 inode，那么在写代码的时候就需要注意各种操作都是对 inode 进行的。然后还有就是在各种文件相关的系统调用中，我们都需要使用 `open_op()` 和 `end_op()` 把这些系统调用包裹起来。其代表，在这个区间内的任何操作会先被记录到日志系统中（不熟悉可用参考 xv6 的书以及 lecture）。

```c
uint64 sys_symlink(){
  char tar_path[MAXPATH], path[MAXPATH];
  try(argstr(0, tar_path, MAXPATH), return -1);
  try(argstr(1, path, MAXPATH), return -1);
  struct inode* ip;


  begin_op();
  ip = create(path, T_SYMLINK, 0, 0); // 创建一个文件，返回其 inode（因为没注释，我其实不是很确定这个函数
                                      // 的用法，只是根据其实现猜测的）
  if(ip == 0){
    end_op();
    return -1;
  }
  try(writei(ip, 0, tar_path, 0, strlen(tar_path)), end_op(); return -1); 
  // writei 其实就是往某个 inode 中写数据，这里把软链接想要指向的路径写进去了
  iunlockput(ip);
  // 使用完 inode 后的标准操作
  // 先释放了锁，然后释放这个 inode
  // 这里对于 inode 的 iput() 和对于块缓存的 brelse() 很相似
  // 都是先减少了引用计数，然后判断是否可用真正的释放
  end_op();
  return 0;
}
```

`sys_open()`：

下面这段 `sys_open()` 开头的代码打开或者创建了用户传进来路径所对应文件的 inode，记录在 `ip` 中。而 `sys_open()` 的后续代码会处理这个 `ip` 来完成打开的操作，我们先不用管。

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

那对于一个符号链接来说，用户传进来路径对应的 `ip` 并不是其想要打开的 `ip`，所以我们需要递归的跟随符号链接中指向的文件来修改这个 `ip`。注意最终这个 `ip` 必须是上锁的。

如下（这部分代码添加在上面代码的后面）：

```c
\\ in sysfile.c
  if(!(omode & O_NOFOLLOW)){
    int rec_left = 10; // 递归次数限制，软链接可能成环
    struct inode* next_file;
    while(rec_left && ip->type == T_SYMLINK){
      
      if(readi(ip, 0, path, 0, MAXPATH) == 0){
        iunlockput(ip);
        end_op();
        return -1;
      }

      if((next_file = namei(path)) == 0){
        // namei 可用从一个路径获得 inode
        iunlockput(ip);
        end_op();
        return -1;
      }
      iunlockput(ip); // 储存链接的文件已经使用完了
      ip = next_file;
      rec_left--;  
      ilock(ip); // 在这里加锁而不在 while 的下面是因为如果这个 inode 不是一个软链接
                 // 我们还是需要持有这个锁的，因为后面的处理代码会修改 inode
    }
    if(rec_left <= 0){
      iunlockput(ip);
      end_op();
      return -1;
    }
  }
```

这里要特别特别注意一个点，在递归跟随软链接时，我们碰到一个不是软链接的文件需要停下来。这也要求我们去访问 inode 的 type 属性。那么判断这个属性一定要在 `ilock(ip)` 的后面，我调了好久才发现这个 bug。

我们先看下 `ilock()` 的代码：

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

可以发现，会先检查 `ip->valid`，这个 `valid` 属性表示当前 inode 的数据是否从磁盘中加载过。如果是没有，那么会先读取磁盘，然后把数据加载进这个 inode 中。

也就是说，如果在执行 `ilock()` 之前先访问了 inode，意味着这个 inode 很可能是空的，自然读到的东西也没意义（这也再一次提醒了我们访问线程间共享数据时，一定要加锁）。

做完这些后，就可以愉快的 AC 了，也祝在做这个 lab 的人尽快 AC：

![](/img/xv6/lab/lab10_AC.png)

提醒一点，如果你发现你的程序在 qemu 中跑测试没问题，但是 make grade 过不了的话，很可能是因为超时了（估计是我电脑性能太垃了），这个时候需要去 python 的计分程序 `grade-lab-fs` 中改下时限。

## 总结

数组越界，内存泄漏实在是非常可怕的事情——实际的错误和系统报的错没有任何的相关性，调都调不出来。

这里大概讲下我做这个 lab 时犯的一些傻逼到极致的错误吧，关键是调了两个下午才调出来。

最开始我在进行 symlinktest 的时候，会报 panic，信息是 `virtio_disk_intr status`。那这种跟虚拟磁盘有关的东西我肯定是不会处理的，于是单步了以下，找到了 symlinktest 中具体是哪一步出了问题。结果如下：

```c
  r = symlink("/testsymlink/4", "/testsymlink/3");
  if(r) fail("Failed to link 3->4");

  close(fd1);
  close(fd2); // 问题

  fd1 = open("/testsymlink/4", O_CREATE | O_RDWR);
  if(fd1<0) fail("Failed to create 4\n");
```

这里，symlinktest 调用 `close(fd2)` 之后就直接 panic 了。

然后我又单步了以下，大概发现，发生问题时的调用过程是这样的：

```
sys_close() -> fileclose() -> iput() -> itrunc() -> bread()：
```

我一想是 `itrunc()` 写错了，还直接新开了个分支，抄了别人的 `itrunc()` 然后还是不行。

后来又想，不会是什么玄学问题把，于是直接把那个 `panic()` 给注释掉了，又发现有新的 `panic()`，这次报的错是 `freeing free block`：

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
    panic("freeing free block"); // 这里
  bp->data[bi/8] &= ~m;
  log_write(bp);
  brelse(bp);
}
```

后来又发现，在 `itrunc()` 中，根本没有释放一级间接索引的块，而是直接释放了二级间接索引（因为 `addrs[12]` 非零）。这肯定是不合理的，一定是一级的用完了再用二级的。结合 `freeing free block` 的 `panic()` 信息，我基本确定了问题可能是由某种越界引起的。

最后发现，居然是 `struct inode` 这里出了问题：

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

我把 `dinode` 的 `addrs[NDIRECT + 1]` 改成了 `addrs[NDIRECT + 2]`，但是忘了改 `inode` 的。。。

这就造成了，我在访问 `addrs[12]` 时，访问的实际是下一个 inode 的 `dev` 属性。那么事情就离谱起来了，你说一个 inode 的二级间接索引块怎么可能会在一号块（超级块）呢。。。我其实还挺好奇的，`itrunc()` 的时候怎么没有把超级块给释放了，又是如何引起虚拟磁盘的 `panic()` 的。我是懒得调了，有兴趣的可以试试看。

不说了，破大防了。。。
