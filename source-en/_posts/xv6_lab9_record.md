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

Update on 2022/8/18: the second exercise in this article is not completely correct, and many other approaches exist. See [my discussion with the author of this blog](https://github.com/Miigon/blog/issues/8) and the author's [new code based on that discussion](https://github.com/Miigon/my-xv6-labs-2020/commit/0c7a387612bfb7973784e754f4b8b15afa1f524c).

If I have time later, I will revise the second part and add comments.

Update on 2022/9/14: I recently put the lab code on GitHub. If you need a reference, you can find it here:

<https://github.com/ttzytt/xv6-riscv>

The different branches contain the different labs.

---

# Lab 9: locks

## Memory allocator

### Lab description

The lab description is again very long, so I will not reproduce a screenshot. Here is the general problem.

The original `kalloc()` uses one large lock and maintains a single `freelist`. Every program that allocates or frees memory must compete for that lock before modifying the list. The implementations of `freelist`, `kfree()`, and `kalloc()` are:

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

Multiple cores cannot call `kalloc()` or `kfree()` concurrently, greatly reducing memory-allocation performance.

Testing confirms that this global lock is a major bottleneck. Among all locks, `kmem` has the most waits and the most severe contention:

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

The lab asks us to solve this problem. Its hint suggests assigning one `freelist` to each processor core. A core can then allocate a page without waiting on the globally contended lock. It still uses a lock, but contention is dramatically reduced.

### Approach

This creates another problem. Some cores may have many free page frames while another has none. Even if the machine has enough free frames overall, the empty core cannot allocate one locally.

When a core has no available frames, it therefore needs to “steal” some from other cores.

The approximate pseudocode is:

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
            while (i still has page frames && stealed < STEAL_CNT) {
                remove a page frame from i's freelist;
                add the removed frame to kmems[cpu].freelist;
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

This looks reasonable and can even pass the tests, but it can deadlock, although the deadlock is extremely unlikely.

Notice the `for (i : kmems)` loop. While inside it, the core holds or attempts to acquire two locks: its own `kmems[cpu].lock`, and the `i.lock` of the core from which it wants to steal.

Suppose the processor has only two cores, a and b, and both have exhausted their free frames. Each first acquires its own lock and then attempts to steal from the other.

During stealing, each tries to acquire the other core's lock. But a and b already hold their respective local locks, so both wait forever: a deadlock.

The same pattern can occur with more than two cores; two cores merely make the explanation easier.

To prevent it, a core must not simultaneously hold its own lock and another core's lock.

That introduces a further issue. While one core is stealing pages and adding them to its local `freelist`, another may try to steal from it. Concurrent modification of the same list would corrupt it.

My solution works as follows.

When a core discovers that its list is empty, immediately release the local lock and begin stealing. Two locks would ordinarily be needed because several cores might modify a `freelist` at once. Instead, do not modify the local `freelist` while stealing. Remove available pages from other cores and record them in a candidate array. After reacquiring the local lock, scan that array and insert the stolen pages into the local list.

Because stolen pages are only recorded in the candidate array and are not yet in the local `freelist`, another core attempting to steal from this core still sees an empty list and does not modify it. No core changes the local list during stealing, so its lock is unnecessary during that interval.

One more issue is interrupts. During stealing, the core may hold no locks, allowing xv6 to enable interrupts. It could leave to run another process, which might call `kalloc()` again and begin a duplicate steal operation.

This leads to the following implementation.

### Code

`kinit()`:

```c
struct {
  struct spinlock lock, stlk;
  struct run *freelist;
  uint64 st_ret[STEAL_CNT]; // Candidate array
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

`kfree()`:

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

Whichever core is running the current process receives the released page in its own `freelist`. This is a simple allocation policy; better ones may exist, but I was lazy.

`steal()`:

This newly added function scans every core's `freelist` and places available pages into the current core's candidate array, `st_ret[STEAL_CNT]`:

```c
int steal(uint cpu){ // Return the number of pages stolen
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
    if(st_left == 0) { // STEAL_CNT pages have been stolen in total
      break;
    }
  }
  return idx;
}
```

`kalloc()`:

When no local frame remains, call `steal()` and then truly add the stolen frames to `freelist`. Interrupts remain disabled for the entire `kalloc()` because enabling them could let two processes on one core execute `steal()` and steal the same pages twice.

```c
void *
kalloc(void)
{
  struct run *r = 0;
  
  push_off();
  uint cpu = cpuid();   
  acquire(&kmems[cpu].lock);
  r = kmems[cpu].freelist;
  // r is the page frame that will be returned
  if(r){ 
    kmems[cpu].freelist = r->next;
    release(&kmems[cpu].lock);
    } else {
    release(&kmems[cpu].lock);
    int ret = steal(cpu); // kfree cannot occur during steal because interrupts are disabled
    // ret is the number of pages stolen
    if(ret <= 0){
      pop_off();
      return 0;
    }
    acquire(&kmems[cpu].lock);
    for(int i = 0; i < ret; i++){
      if (!kmems[cpu].st_ret[i]) break;
      ((struct run*)kmems[cpu].st_ret[i])->next = kmems[cpu].freelist; // Add the stolen page to the front of freelist
      kmems[cpu].freelist = kmems[cpu].st_ret[i];
    }
    r = kmems[cpu].freelist;
    kmems[cpu].freelist = r->next;
    release(&kmems[cpu].lock);
  }
  if(r){
    memset((char*)r, 5, PGSIZE); // fill with junk  
    // [generated by LLM] The Chinese string below means "kalloc succeeded".
    DEBUG("kalloc 成功\n");
  }
  pop_off();
  return r;
}
```

## Buffer cache

First, the approach in this section substantially refers to—almost copies—this expert's [blog post](https://blog.miigon.net/posts/s081-lab8-locks/).

### Lab description

xv6 cannot directly access the disk device. To read disk data, it first copies the data into a cache and then reads the cache.

The smallest unit of disk data in xv6 is one block, whose size is 1024 bytes. In other words, every disk read obtains at least 1024 bytes.

Disk reads and writes call `bread()` to obtain the appropriate cache buffer, which already contains the data from the corresponding block:

```c
// This file is bio.c
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

Notice that it first calls `bget()`. `bget()` checks whether the disk block is already cached. If it is, it returns the existing buffer. Otherwise, it locates the least recently used buffer and assigns that buffer to the current block:

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

All buffers are linked into one doubly linked list. The first element is the most recently used and the final element is the least recently used.

Every call to `bget()` first traverses the list to check whether the current block is cached. If not, it traverses backward from the end, beginning with the least recently used entries, and selects the first buffer whose reference count is zero, meaning no program is using it.

Every cache allocation therefore competes for the lock protecting this list.

The per-core technique from the preceding exercise might seem applicable, but assigning buffers to individual cores does not work well. Allocating or releasing a page frame involves only one core, and an allocated frame is then accessed by a single process.

A buffer cache entry, however, may be accessed by different processes. Several processes can read and write the same cached disk block. If buffers were preassigned by core, a process would frequently need a buffer owned by another core and would have to scan other cores' caches one by one, reducing performance. Giving every individual buffer its own lock might reduce granularity, but that is a different design.

The lab hint proposes a hash table. It maps block numbers to buckets containing cache buffers. Contention occurs only when two processes operate on buffers in the same bucket. A lookup also traverses only the relevant bucket instead of all cached blocks.

When the corresponding bucket lacks a free buffer, it can steal one from another bucket as `kalloc()` did.

### Approach

The hash table itself is straightforward. However, stealing introduces the same dilemma as page allocation.

During a steal, the code needs the current bucket lock and must also inspect other buckets, requiring their locks. Holding two locks at once can deadlock as follows:[^1]

```
Assume block b1 hashes to 2 and block b2 hashes to 5,
and neither block is cached before execution.
----------------------------------------
CPU1                  CPU2
----------------------------------------
bget(dev, b1)         bget(dev,b2)
    |                     |
    V                     V
Acquire bucket 2 lock    Acquire bucket 5 lock
    |                     |
    V                     V
Not cached; scan buckets  Not cached; scan buckets
    |                     |
    V                     V
  ......                Reach bucket 2
    |                   Try to acquire bucket 2 lock
    |                     |
    V                     V
  Reach bucket 5       Bucket 2 lock is held by CPU1; wait
Try to acquire bucket 5 lock
    |
    V
Bucket 5 lock is held by CPU2; wait

CPU1 now waits for CPU2 while CPU2 waits for CPU1: deadlock!

```

One solution is to release the current bucket lock before searching for an unused buffer elsewhere.

This creates a new race. Suppose a process releases its bucket lock and begins searching other buckets for a free buffer. Another process then calls `bget()` for the same `blockno` and also begins searching.

After both find free buffers, they may each insert one into the bucket for that block number, leaving two cache entries for the same disk block.

The insertion must therefore be locked, and after acquiring the lock the code must search again for an existing buffer. Another process may have called `bget()` for the same block concurrently.

Besides locking, we need to identify the least recently used buffer. An LRU buffer is unlikely to be used again soon and is normally recycled when cache space is scarce.

The original design maintained one doubly linked list. A newly released buffer moved to the front, making the tail least recently used.

The new design has several lists, one per bucket, and cannot compare their positions directly. Add `lst_use` to `struct buf` to record the last-use time. This time comes from the global `ticks` variable maintained by timer interrupts:

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

### Code

`binit()`:

```c
#define BUCK_SIZ 13
#define BCACHE_HASH(dev, blk) (((dev << 27) | blk) % BUCK_SIZ) // Support multiple devices;
                                                               // simply taking modulo BUCK_SIZ would also work

// or 13, 1009, 10007
struct {
  struct spinlock bhash_lk[BUCK_SIZ]; // buf hash lock
  struct buf bhash_head[BUCK_SIZ]; // Head of each bucket; avoid buf* because we need the buffer preceding another buffer
                                   // A pointer would make that operation more awkward, as discussed later

  struct buf buf[NBUF]; // The actual cache buffers

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

  for(int i = 0; i < NBUF; i++){ // Initially assign every cache buffer to bucket 0
    struct buf *b = &bcache.buf[i];
    initsleeplock(&b->lock, "buf sleep lock");
    b->lst_use = 0;
    b->refcnt = 0;
    b->next = bcache.bhash_head[0].next; // Insert at the front of bucket 0
    bcache.bhash_head[0].next = b;
  }
}
```

`bget()`:

This is the primary function being changed.

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
    // Check whether blockno is cached in the corresponding bucket
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
  // pre_lru returns the address of the list element before the free buffer
  // and ensures that the corresponding bucket lock is held.
  // lru_bkt is an output parameter that receives the buffer's bucket.
  if(pre_lru == 0){
    panic("bget: no buffers");
  }
  
  struct buf* lru = pre_lru->next; 
  // lru, the least recently used buffer with refcnt zero, follows pre_lru
  pre_lru->next = lru->next; 
  // Make pre_lru point to lru's successor, thereby removing lru
  release(&bcache.bhash_lk[lru_bkt]);

  acquire(&bcache.bhash_lk[key]);  

  for(b = bcache.bhash_head[key].next; b; b = b->next){
    // After acquiring the lock, ensure no duplicate buffer has been inserted
    if(b->dev == dev && b->blockno == blockno){
      b->refcnt++;
      release(&bcache.bhash_lk[key]);
      acquiresleep(&b->lock);
      return b;
    }
  }

  lru->next = bcache.bhash_head[key].next; // Add the selected buffer to the front of the list
  bcache.bhash_head[key].next = lru;

  lru->dev = dev, lru->blockno = blockno;
  lru->valid = 0, lru->refcnt = 1; 

  release(&bcache.bhash_lk[key]);

  acquiresleep(&lru->lock);
  return lru;
}
```

`bfind_prelru()`:

This important helper accepts a pointer to `lru_bkt` and returns the address of the buffer immediately preceding the least recently used buffer whose reference count is zero. It must continue holding the lock for the bucket containing `lru`. Otherwise, after releasing that lock and before inserting the buffer into the current bucket, another process could modify the selected `lru` buffer.

`lru_bkt` is passed by pointer so the function can assign the bucket number, allowing its caller to know which lock to release.

```c
struct buf* bfind_prelru(int* lru_bkt){ // Return the element before lru while retaining its lock
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
      // No better choice was found; do not retain this lock because the best bucket lock must remain held
      release(&bcache.bhash_lk[i]);
    }else{ // A better, less recently used choice was found
      if(*lru_bkt != -1) release(&bcache.bhash_lk[*lru_bkt]); // Release the lock for the previous choice
      *lru_bkt = i; // Update the best choice
    }
  }
  return lru_res;
}
```

`brelse()`:

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
  // Obtain the key first after changing to a hash table
  acquire(&bcache.bhash_lk[key]);
  b->refcnt--;
  if (b->refcnt == 0) {
    // no one is waiting for it.
    b->lst_use = ticks;
  }
  
  release(&bcache.bhash_lk[key]);
}

```

`bpin` and `bunpin`:

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
