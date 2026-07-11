---
title: "[MIT 6.s081] xv6 Lab 9: Locks Record"
date: 2022-08-12 00:00:00
updated: 2022-10-15 18:48:43
tags:
- xv6
- 2022
- UNIX
- Operating Systems
- Locks
- Multithreading
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/08/xv6_lab9_record/).
{% endnote %}

The second experiment is not fully correct; alternative implementations are discussed at <https://github.com/Miigon/blog/issues/8>.

# Lab 9: Locks
## Memory Allocator

The original allocator has one global `kmem.lock` protecting one free list, so every CPU contends for it. The lab assigns one free list and lock to each CPU. A CPU allocates locally without global contention. If its list is empty, it steals a limited number of pages from another CPU.

The naive implementation can deadlock: CPU A holds its lock while waiting for B's lock, and CPU B holds its lock while waiting for A's. Release the local lock before stealing. Store stolen pages in a temporary candidate array, then reacquire the local lock and add them. Keep interrupts disabled during the complete `kalloc()` operation so the same CPU cannot recursively steal.

```c
struct {
  struct spinlock lock;
  struct run *freelist;
} kmems[NCPU];
```
`kfree()` returns a page to the list of the CPU currently running the process. `steal(cpu)` scans other lists under their locks and removes at most `STEAL_CNT` pages. `kalloc()` first consumes the local list and calls `steal()` only when it is empty.

## Buffer Cache

`bread()` calls `bget()`, which searches a global LRU list for a cached `(dev, blockno)` pair or recycles the least-recently-used unreferenced buffer. This global lock is another bottleneck.

Use a hash table of buckets. Only operations on the same bucket contend, and lookup no longer scans every buffer. When a bucket has no free buffer, find the globally least-recently-used unreferenced buffer, release its old bucket lock, then recheck the destination bucket after acquiring its lock. The recheck prevents two concurrent `bget()` calls from installing duplicate buffers. Never hold two bucket locks in an inconsistent order.

Use `lst_use = ticks` when a buffer's reference count drops to zero. A helper such as `bfind_prelru()` scans buckets while retaining the lock of the currently best candidate.

```c
#define BUCK_SIZ 13
#define BCACHE_HASH(dev, blk) (((dev << 27) | blk) % BUCK_SIZ)

void brelse(struct buf *b){
  if(!holdingsleep(&b->lock)) panic("brelse");
  releasesleep(&b->lock);
  uint key = BCACHE_HASH(b->dev, b->blockno);
  acquire(&bcache.bhash_lk[key]);
  b->refcnt--;
  if(b->refcnt == 0) b->lst_use = ticks;
  release(&bcache.bhash_lk[key]);
}
void bpin(struct buf *b){
  uint key=BCACHE_HASH(b->dev,b->blockno);
  acquire(&bcache.bhash_lk[key]); b->refcnt++; release(&bcache.bhash_lk[key]);
}
void bunpin(struct buf *b){
  uint key=BCACHE_HASH(b->dev,b->blockno);
  acquire(&bcache.bhash_lk[key]); b->refcnt--; release(&bcache.bhash_lk[key]);
}
```

Reference: <https://blog.miigon.net/posts/s081-lab8-locks/>
