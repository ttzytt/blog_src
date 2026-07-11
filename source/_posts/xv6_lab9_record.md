---
title: "[MIT 6.s081] xv6 lab9 Lockss 实验记录"
date: 2022-08-12 00:00:00
updated: 2022-10-15 18:48:43
tags:
- xv6
- 2022
- UNIX
- 操作系统
- 锁
- 多线程
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

upd@2022/8/18: 本文的第二个实验不完全正确，并且还有很多其他的做法，具体可以见[这篇博客中我和博主的讨论](https://github.com/Miigon/blog/issues/8)。以及博主根据讨论[新写的代码](https://github.com/Miigon/my-xv6-labs-2020/commit/0c7a387612bfb7973784e754f4b8b15afa1f524c)。

如果接下来有时间，会把第二部分的代码改掉并添加注释。

upd@2022/9/14：最近把实验的代码放到 github 上了，如果需要参考可以查看这里：

<https://github.com/ttzytt/xv6-riscv>

里面不同的分支就是不同的实验。

---


# Lab9: locks

## Memory allocator

### 实验描述
这 lab 的描述也是非常长，所以就不截图了。下面描述一下大概的题意：

在原本的 `kalloc()` 中，只有一个大锁，我们会维护一个 `freelist` 链表，如果有任何程序申请内存，都需要竞争 `freelist` 的锁，以修改 `freelist` 的内容。具体可见 `freelist` 和 `kalloc()` 的实现：

```c
struct run {
  struct run *next;
};

struct {
  struct spinlock lock;
  struct run *freelist;
} kmem;

……

// Free the page of physical memory pointed at by v,
// which normally should have been returned by a
// call to kalloc().  (The exception is when
// initializing the allocator; see kinit above.)
void
kfree(void *pa)
{
  struct run *r;

  if(((uint64)pa % PGSIZE) != 0 || (char*)pa < end || (uint64)pa >= PHYSTOP)
    panic("kfree");

  // Fill with junk to catch dangling refs.
  memset(pa, 1, PGSIZE);

  r = (struct run*)pa;

  acquire(&kmem.lock);
  r->next = kmem.freelist;
  kmem.freelist = r;
  release(&kmem.lock);
}

// Allocate one 4096-byte page of physical memory.
// Returns a pointer that the kernel can use.
// Returns 0 if the memory cannot be allocated.
void *
kalloc(void)
{
  struct run *r;

  acquire(&kmem.lock);
  r = kmem.freelist;
  if(r)
    kmem.freelist = r->next;
  release(&kmem.lock);

  if(r)
    memset((char*)r, 5, PGSIZE); // fill with junk
  return (void*)r;
}

```

可以发现，不可能同时有多个核心去调用 `kalloc()` 函数以及 `kfree()` 函数，大大降低了内存分配的效率。

经测试，可以发现这个大锁就是一个很大瓶颈（kmem 这个锁是所有锁中等待次数最多，竞争最激烈的）：

```
$ kalloctest
start test1
test1 results:
--- lock kmem/bcache stats
lock: kmem: #fetch-and-add 83375 #acquire() 433015
lock: bcache: #fetch-and-add 0 #acquire() 1260
--- top 5 contended locks:
lock: kmem: #fetch-and-add 83375 #acquire() 433015
lock: proc: #fetch-and-add 23737 #acquire() 130718
lock: virtio_disk: #fetch-and-add 11159 #acquire() 114
lock: proc: #fetch-and-add 5937 #acquire() 130786
lock: proc: #fetch-and-add 4080 #acquire() 130786
tot= 83375
test1 FAIL
```

在这个 lab 中，我们就需要解决这个问题。实验提示中给出的提示是给每个处理器核心都分配一个 `freelist`，那如果某个核心想要分配一页内存，就无需等待耗时的锁操作，直接分配就行了（其实也要加锁，但是竞争显著的变少了）。

### 思路

这也带来了一个新的问题，有的时候某些核心会有充足的待分配页帧，而某些核心已经没有了，那么就算总的空闲页帧是足够的，也不能分配新的页帧。

所以，如果当前核心没有页帧可以分配了。我们需要去从别的核心“偷”一些新的页帧。

那我们大概可以写出下面的伪代码：

```c
struct {
  struct spinlock lock;
  struct run *freelist;
} kmems[NCPU];

void kalloc(){
    struct run* r = 0;
    push_off();
    int cpu = cpuid();
    pop_off();

    acquire(&kmems[cpu].lock);

    int stealed = 0;
    if(!kmems[cpu].freelist){
        for (i : kmems){
            acquire(&i.lock);
            while (i 中还有页帧 && stealed < STEAL_CNT) {
                释放 i 中 feelist 的页帧;
                把释放的页帧加入 kmems[cpu].freelist;
            }
            if(stealed >= STEAL_CNT){
                break;
            }
            releae(&i.lock);
        }

    }
    r = kmems[cpu].freelist;

    if (r) {    
        kmems[cpu].freelist = r->next;
    }

    release(&kmems[cpu].lock);
    return r;
}
```

看起来还是比较合理的，其实这样的代码也能通过测试。不过这个代码其实是可能发生死锁的（其实是几乎不可能）。

注意 `for (i : kmems)` 这个循环，可以发现，在循环中，会持有两个锁，或者说是尝试获得两个锁：第一个是本核心的锁，也就是 `kmems[cpu].lock` 第二个是尝试偷页帧时，获得的锁 `i.lock`。

假设我们的处理器只有两个核心，a 和 b，那如果这两个线程现在都没有空闲页帧了，就会先拿到自己的锁，然后去尝试偷对方的页帧。

在偷的过程中，都会先尝试拿到对方的锁，但是之前 a 和 b 都已经拿到自己的锁了。这就造成了死锁。

当然死锁不止会发生在只有两个核心的情况下，这里使用两个核心只是为了方便说明。

要解决这个问题，我们可以让每个核心不能同时持有本核心和别的核心的锁。

当然这也引出了别的问题，比如我们在偷页帧，并且加入本核心 `freelist` 的时候，另一个核心可能试图从我们这里偷页帧。这样两个核心同时修改 `freelist` 的时候，就会出现奇怪的问题。

下面解释下我的解决方案：

首先在发现没有空闲页帧后，立刻释放掉本核心的锁，然后尝试偷页。需要同时持有两个锁是因为可能有多个核心同时修改 `freelist`，那我们不如就让本核心不去修改 `freelist`，而是把可以偷的页从别的核心那里释放掉，然后把这个页加入一个候选队列。随后取得本核心的锁后，再扫描候选队列，然后把这些页加入 `freelist`。

同时，因为我们并没有在本核心的 `freelist` 中加入偷到的页，而只是记录在候选队列，如果别的核心尝试去偷本核心的页帧，就会发现已经没有空闲页了，不会更改本核心的 `freelist`。这样在偷页过程中没有任何核心修改 `freelist`，自然也不需要加锁。

不过这里需要注意一个点，就是中断。因为在偷页过程中可能是不持有任何锁的，xv6 会把中断打开。那当前核心可能会跳出去处理别的进程，而别的进程可能又会导致调用 `kalloc()`，会造成重复的偷页。

然后就可以写出如下代码：

### 代码

`kinit()`：
```c
struct {
  struct spinlock lock, stlk;
  struct run *freelist;
  uint64 st_ret[STEAL_CNT]; // 候选队列
} kmems[NCPU];

const uint name_sz = sizeof("kmem cpu 0");
char kmem_lk_n[NCPU][sizeof("kmem cpu 0")];

void
kinit()
{ 
  for(int i = 0; i < NCPU; i++){
    snprintf(kmem_lk_n[i], name_sz, "kmem cpu %d", i);
    initlock(&kmems[i].lock, kmem_lk_n[i]);
  }
  freerange(end, (void*)PHYSTOP);
}
```

`kfree()` ：

```c
void
kfree(void *pa)
{
  struct run *r;

  if(((uint64)pa % PGSIZE) != 0 || (char*)pa < end || (uint64)pa >= PHYSTOP)
    panic("kfree");
  push_off();
  uint cpu = cpuid();
  pop_off();
  // Fill with junk to catch dangling refs.
  memset(pa, 1, PGSIZE);
  r = (struct run*)pa;
  acquire(&kmems[cpu].lock);
  r->next = kmems[cpu].freelist;
  kmems[cpu].freelist = r;
  release(&kmems[cpu].lock);
}
```

这里相当于是哪个核心在运行当前进程，就把这个页帧分配到当前核心的 `freelist`。也是一个比较简单的分配策略，可能有更好的策略，~~不过我懒~~。

`steal()`：

这个函数是新添加的，其实就是扫描所有核心的 `freelist`，然后把空闲的加入当前核心的候选队列，也就是 `st_ret[STEAL_CNT]`：

```c
int steal(uint cpu){ // 返回偷到了几个
  uint st_left = STEAL_CNT;
  int idx = 0; 

  memset(kmems[cpu].st_ret, 0, sizeof(kmems[cpu].st_ret));
  for(int i = 0; i < NCPU; i++){
    if(i == cpu)  continue;
    acquire(&kmems[i].lock);

    while(kmems[i].freelist && st_left){ 
      kmems[cpu].st_ret[idx++] = kmems[i].freelist;  
      kmems[i].freelist = kmems[i].freelist->next;  
      st_left--;
    }

    release(&kmems[i].lock);
    if(st_left == 0) { // 一共偷 STEAL_CNT 个
      break;
    }
  }
  return idx;
}
```

`kalloc()`：

如果没有空闲的页帧了，会调用 `steal()`，之后会把偷来的真正的加到 `freelist` 中。注意整个 `kalloc()` 都是关闭中断的，因为开中断可能造成同时有两个进程执行 `steal()`，造成重复偷页。

```c
void *
kalloc(void)
{
  struct run *r = 0;
  
  push_off();
  uint cpu = cpuid();   
  acquire(&kmems[cpu].lock);
  r = kmems[cpu].freelist;
  // r 是之后要返回的页帧
  if(r){ 
    kmems[cpu].freelist = r->next;
    release(&kmems[cpu].lock);
    } else {
    release(&kmems[cpu].lock);
    int ret = steal(cpu); // steal 过程中不可能 kfree，因为关闭中断
    // ret 是偷到了多少页
    if(ret <= 0){
      pop_off();
      return 0;
    }
    acquire(&kmems[cpu].lock);
    for(int i = 0; i < ret; i++){
      if (!kmems[cpu].st_ret[i]) break;
      ((struct run*)kmems[cpu].st_ret[i])->next = kmems[cpu].freelist; // 把偷来的页加到 freelist 的前面
      kmems[cpu].freelist = kmems[cpu].st_ret[i];
    }
    r = kmems[cpu].freelist;
    kmems[cpu].freelist = r->next;
    release(&kmems[cpu].lock);
  }
  if(r){
    memset((char*)r, 5, PGSIZE); // fill with junk  
    DEBUG("kalloc 成功\n");
  }
  pop_off();
  return r;
}
```

## Buffer cache

首先说下：这部分的思路很大程度参考~~抄~~了这位[大佬的博客](https://blog.miigon.net/posts/s081-lab8-locks/)。

### 实验描述 

在 xv6 中，我们是不能直接访问硬盘设备的，如果想要读取硬盘中的数据，需要先把数据拷贝到一个缓存中，然后读取缓存中的内容。

在 xv6 中，磁盘数据的最小单位是一个块，大小为 1024 kb。或者说我们每次从硬盘中最少能读出 1024kb 的数据。

在读写硬盘的时候，需要通过 `bread()` 函数得到相应的缓存（缓存中已经存放了硬盘对应块中的数据）：

```c
// 文件位于 bio.c
// Return a locked buf with the contents of the indicated block.
struct buf*
bread(uint dev, uint blockno)
{
  struct buf *b;

  b = bget(dev, blockno);
  if(!b->valid) {
    virtio_disk_rw(b, 0);
    b->valid = 1;
  }
  return b;
}
```

注意这里先调用了 `bget()` 函数。这个 `bget()` 会首先判断是否之前已经缓存过了硬盘中的这个块。如果有，那就直接返回对应的缓存，如果没有，会去找到一个最长时间没有使用的缓存，并且把那个缓存分配给当前块。如下：

```c
// Look through buffer cache for block on device dev.
// If not found, allocate a buffer.
// In either case, return locked buffer.
static struct buf*
bget(uint dev, uint blockno)
{
  struct buf *b;

  acquire(&bcache.lock);

  // Is the block already cached?
  for(b = bcache.head.next; b != &bcache.head; b = b->next){
    if(b->dev == dev && b->blockno == blockno){
      b->refcnt++;
      release(&bcache.lock);
      acquiresleep(&b->lock);
      return b;
    }
  }

  // Not cached.
  // Recycle the least recently used (LRU) unused buffer.
  for(b = bcache.head.prev; b != &bcache.head; b = b->prev){
    if(b->refcnt == 0) {
      b->dev = dev;
      b->blockno = blockno;
      b->valid = 0;
      b->refcnt = 1;
      release(&bcache.lock);
      acquiresleep(&b->lock);
      return b;
    }
  }
  panic("bget: no buffers");
}
```

可以看到，所有的缓存被串到了一个双向链表里。链表的第一个元素是最近使用的，最后一个元素是很久没有使用的。

每次 `bget()` 的时候会先遍历一遍链表，检查当前块是否已经被存到缓存里了。如果没有，那就会从后到前遍历链表（意味着是从最久没有使用的开始找），找到第一个引用计数为 0 （代表没有程序正在使用这个块）的缓存作为当前块的缓存。

这就造成了，在任何时候想要分配缓存，都需要竞争这个链表的锁。

可能你会想到使使用前一个实验的方法来优化，但把缓存分配到不同核心的方法是行不通的。因为分配页帧和回收页帧的时候，只需要有一个核心参与，而且分配后某个页帧只会被一个进程访问。

而分配出去的块缓存可能会被不同进程访问。比如不同的进程可以访问和写入同一个块缓存。如果预先按照核心分配缓存，有很大概率进程需要的缓存不属于当前核心。那就需要去一个一个的遍历别核心的块缓存，造成性能下降。（不过如果每个块缓存单独持有一个锁，粒度更小了会不会性能更好点）。

实验描述中给我们的提示是实现一个散列表。散列表会把块号映射到块缓存的桶，那么只有两个进程试图操作同一个桶中的块缓存，才会造成竞争。而且在查找所需块缓存时页不需要遍历所有的缓存，只需要遍历对应的桶。

当然，在对应桶中没有足够缓存时，我们可以像在 `kalloc()` 中一样，从别的桶中偷缓存。

### 思路

这个实验中的散列表还是比较容易理解的。不过散列表中也有涉及页表分配实验中“偷”的过程，这样会陷入一种两难的境地。

在“偷”的过程中，我们会需要同时获得当前桶的锁，也需要检查别的桶，所以需要拿到别的桶的锁。这样就不可避免的同时持有了两把锁。

而这两把锁可能会造成死锁，如下[^1]：

```
假设块号 b1 的哈希值是 2，块号 b2 的哈希值是 5
并且两个块在运行前都没有被缓存
----------------------------------------
CPU1                  CPU2
----------------------------------------
bget(dev, b1)         bget(dev,b2)
    |                     |
    V                     V
获取桶 2 的锁           获取桶 5 的锁
    |                     |
    V                     V
缓存不存在，遍历所有桶    缓存不存在，遍历所有桶
    |                     |
    V                     V
  ......                遍历到桶 2
    |                尝试获取桶 2 的锁
    |                     |
    V                     V
  遍历到桶 5          桶 2 的锁由 CPU1 持有，等待释放
尝试获取桶 5 的锁
    |
    V
桶 5 的锁由 CPU2 持有，等待释放

!此时 CPU1 等待 CPU2，而 CPU2 在等待 CPU1，陷入死锁!

```

这里有一个办法就是，如果发现没有需要的缓存，就在开始偷之前把自己的锁释放掉。

当然这就造成了新的问题。假设在某一时刻我们放弃了自己的锁，然后开始找别的桶里空闲的缓存。这时候另一个进程调用了 `bget()` 函数，并且 blockno 还是同一个。那么这另一个个进程也会进入到找空闲缓存的状态。

在两个进程都找到了空闲缓存后，它们会把两个缓存都加到当前 blockno 的桶中，这样一个 blockno 对应的缓存就有了两个。

所以我们需要对添加缓存的操作加锁，然后得到锁之后再检查一遍是否已经有了对应缓存（可能有别的进程在相同时间调用了 `bget()` 并且块号还是一样的）。

除了锁相关的问题，我们还需要考虑如何找出最长时间没用过的缓存（LRU, least recent used）。因为 LRU 缓存通常在短时间之内不会再用到，所以在缓存不够的时候一般会回收这些缓存。

在原来的设计中，我们维护了一个双向链表，如果有新释放的缓存就加到链表的前面。所以链表尾部的缓存是最久没使用的，反之亦然。

但是在新设计中，我们维护了好几条链表（桶）没有办法在这些链表之间做比较。那么我们可以给 `buf` 结构体新加一个 `lst_use` 属性，表示最后一次使用的时间。而这个最后使用的时间可以从 `ticks` 全局变量获得，这个变量是由计时器中断维护的。代码如下：

```c
//trap.c
……

void
clockintr()
{
  acquire(&tickslock);
  ticks++;
  wakeup(&ticks);
  release(&tickslock);
}

if(cpuid() == 0){
  clockintr();
}
……

```

### 代码

`binit()`：
```c
#define BUCK_SIZ 13
#define BCACHE_HASH(dev, blk) (((dev << 27) | blk) % BUCK_SIZ) // 支持多个 dev 
                                                               // 其实也可以直接模 BUCK_SIZ

// or 13, 1009, 10007
struct {
  struct spinlock bhash_lk[BUCK_SIZ]; // buf hash lock
  struct buf bhash_head[BUCK_SIZ]; // 每个桶的开头，不用 buf* 是因为我们需要得到某个 buf 前面的 buf
                                   // 用了指针会比较麻烦，见后文

  struct buf buf[NBUF]; // 最终的缓存

  // Linked list of all buffers, through prev/next.
  // Sorted by how recently the buffer was used.
  // head.next is most recent, head.prev is least.
} bcache;

void
binit(void)
{
  for (int i = 0; i < BUCK_SIZ; i++){
    initlock(&bcache.bhash_lk[i], "bcache buf hash lock");
    bcache.bhash_head[i].next = 0;
  }

  for(int i = 0; i < NBUF; i++){ // 最开始把所有缓存都分配到桶 0 上
    struct buf *b = &bcache.buf[i];
    initsleeplock(&b->lock, "buf sleep lock");
    b->lst_use = 0;
    b->refcnt = 0;
    b->next = bcache.bhash_head[0].next; // 往 0 的头上插
    bcache.bhash_head[0].next = b;
  }
}
```

`bget()`： 

这个就是我们主要修改的函数

```c
// Look through buffer cache for block on device dev.
// If not found, allocate a buffer.
// In either case, return locked buffer.
static struct buf*
bget(uint dev, uint blockno)
{
  struct buf *b;

  uint key = BCACHE_HASH(dev, blockno);

  acquire(&bcache.bhash_lk[key]);
  for(b = bcache.bhash_head[key].next; b; b = b->next){
    // 查看 blockno 是否在对应的桶里被缓存
    if(b->dev == dev && b->blockno == blockno){
      b->refcnt++;
      release(&bcache.bhash_lk[key]);
      acquiresleep(&b->lock);
      return b;
    }
  }
  release(&bcache.bhash_lk[key]);
  int lru_bkt;
  struct buf* pre_lru = bfind_prelru(&lru_bkt);
  // pre_lru 会返回空闲缓存前一个（链表中前一个）缓存的地址
  // 并且确保拿到了缓存对应的桶锁
  // 我们会传进去一个 lru_bkt，函数执行好后，这个值会储存缓存对应的桶
  if(pre_lru == 0){
    panic("bget: no buffers");
  }
  
  struct buf* lru = pre_lru->next; 
  // lru （lru 是最久没有使用的缓存，并且 refcnt = 0）是 pre_lru 后面的一个
  pre_lru->next = lru->next; 
  // 让 pre_lru 的后面一个直接变成 lru 的后面一个，相当于删除 lru
  release(&bcache.bhash_lk[lru_bkt]);

  acquire(&bcache.bhash_lk[key]);  

  for(b = bcache.bhash_head[key].next; b; b = b->next){
    // 拿到锁之后要确保没有重复添加缓存
    if(b->dev == dev && b->blockno == blockno){
      b->refcnt++;
      release(&bcache.bhash_lk[key]);
      acquiresleep(&b->lock);
      return b;
    }
  }

  lru->next = bcache.bhash_head[key].next; // 把找到的缓存添加到链表头部
  bcache.bhash_head[key].next = lru;

  lru->dev = dev, lru->blockno = blockno;
  lru->valid = 0, lru->refcnt = 1; 

  release(&bcache.bhash_lk[key]);

  acquiresleep(&lru->lock);
  return lru;
}
```

`bfind_prelru()`：

比较关键的一个函数，接收一个 `lru_bkt` 的指针，然后返回最久没使用的，`ref_cnt` 为 0 的缓存的前一个缓存的地址。注意我们需要一直持有 `lru` 所在的桶的锁。要不在然释放掉这个锁后，把缓存添加近当前桶前，这个缓存（指 lru）可能会被修改。

传进 `lru_bkt` 指针是因为我们希望给 `lru_bkt` 赋值，这样函数返回后我们能知道去释放哪个桶的锁。

```c
struct buf* bfind_prelru(int* lru_bkt){ // 返回 lru 前面的一个，并且加锁
  struct buf* lru_res = 0;
  *lru_bkt = -1;
  struct buf* b;
  for(int i = 0; i < BUCK_SIZ; i++){
    acquire(&bcache.bhash_lk[i]);
    int found_new = 0;
    for(b = &bcache.bhash_head[i]; b->next; b = b->next){ 
      if(b->next->refcnt == 0 && (!lru_res || b->next->lst_use < lru_res->next->lst_use)){
        lru_res = b;
        found_new = 1;
      }
    }
    if(!found_new){
      // 没有更好的选择，就一直持有这个锁（需要确保一直持有最佳选择对应桶的锁）
      release(&bcache.bhash_lk[i]);
    }else{ // 有更好的选择（有更久没使用的）
      if(*lru_bkt != -1) release(&bcache.bhash_lk[*lru_bkt]); // 直接释放以前选择的锁
      *lru_bkt = i; // 更新最佳选择
    }
  }
  return lru_res;
}
```

`brelse()`：

```c
// Release a locked buffer.
// Move to the head of the most-recently-used list.
void
brelse(struct buf *b)
{
  if(!holdingsleep(&b->lock))
    panic("brelse");

  releasesleep(&b->lock);

  uint key = BCACHE_HASH(b->dev, b->blockno);
  // 改成散列表后要先得到 key
  acquire(&bcache.bhash_lk[key]);
  b->refcnt--;
  if (b->refcnt == 0) {
    // no one is waiting for it.
    b->lst_use = ticks;
  }
  
  release(&bcache.bhash_lk[key]);
}

```

`bpin` 和 `bunpin`：


```c
void
bpin(struct buf *b) {
  uint key = BCACHE_HASH(b->dev, b->blockno);
  acquire(&bcache.bhash_lk[key]);
  b->refcnt++;
  release(&bcache.bhash_lk[key]);
}

void
bunpin(struct buf *b) {
  uint key = BCACHE_HASH(b->dev, b->blockno);
  acquire(&bcache.bhash_lk[key]);
  b->refcnt--;
  release(&bcache.bhash_lk[key]);
}
```


[^1]: https://blog.miigon.net/posts/s081-lab8-locks/
