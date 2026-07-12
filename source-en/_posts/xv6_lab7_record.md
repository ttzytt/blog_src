---
title: "[MIT 6.s081] xv6 Lab 7: Multithreading Record"
date: 2022-08-04 00:00:00
updated: 2022-10-15 18:48:32
tags:
- xv6
- 2022
- UNIX
- Operating Systems
- Multithreading
- Coroutines
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/08/xv6_lab7_record/).
{% endnote %}

Update on 2022/9/14: I recently put the lab code on GitHub. If you need a reference, you can find it here:

<https://github.com/ttzytt/xv6-riscv>

The different branches contain the different labs.

---

# Lab 7: Multithreading

## Uthread

> ![](/img/xv6/lab/lab7_uthread.png)
> Implement user-mode threads.

Because we are implementing user-mode multithreading, much of the design can follow the kernel's multithreading implementation.

Inspection of `user/uthread.c` shows that the basic framework has already been provided. We only need to implement several functions.

First, clarify what each unfinished function should do:

- `thread_switch()` is identical to the kernel's `swtch()` and switches processor context. As in the kernel implementation discussed in [this article](/2022/07/xv6_note/), this switch occurs through a normal function call, so caller-saved registers do not need to be saved and exchanged.
- `thread_create()` creates a new user thread. Following the kernel implementation, after `swtch()` the ra register determines the destination and sp determines the restored callee-saved-register context. Set ra so that the first execution of the user thread begins at the first instruction of its function.
- `thread_schedule()` plays the same role as the kernel's `scheduler()`. After the current thread calls `yield()`, it finds a RUNNABLE thread and executes it. `thread_schedule()` calls `thread_switch()` to exchange processor context.

With the purpose of each function clear, we can begin the implementation.

The original `uthread.c` does not include a context field in `struct thread`, so add one. The saved registers are exactly the same as those used by kernel-mode threads:

```c
struct Context{
  uint64 ra;
  uint64 sp;

  // callee-saved
  uint64 s0;
  uint64 s1;
  uint64 s2;
  uint64 s3;
  uint64 s4;
  uint64 s5;
  uint64 s6;
  uint64 s7;
  uint64 s8;
  uint64 s9;
  uint64 s10;
  uint64 s11;
};

struct thread {
  char       stack[STACK_SIZE]; /* the thread's stack */
  int        state;             /* FREE, RUNNING, RUNNABLE */
  struct Context ctx;
};
```

`thread_switch()` can then copy the contents of `swtch()` almost directly:

```nasm
 .text

 /*
         * save the old thread's registers,
         * restore the new thread's registers.
         */

 .globl thread_switch
 // a0 is the old context and a1 is the new context
thread_switch:
 /* YOUR CODE HERE */
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

 ret    /* return to ra */

```

That completes the first function.

Next is `thread_create()`. Its main challenge is setting ra and sp correctly. A new user thread has not used its registers yet, so the initial values of the other context registers do not matter.

After `thread_create()`, a call to `thread_schedule()` should execute the first statement of the thread function. Set ra as follows:

```c
t->ctx.ra = (uint64) func;
```

For sp, remember that the stack grows from high addresses toward low addresses—something I initially forgot. Set sp to the highest address in the stack:

```c  
t->ctx.sp = (uint64) &t->stack + (STACK_SIZE - 1);
```

The complete `thread_create()` is therefore:

```c
void 
thread_create(void (*func)())
{
  struct thread *t;

  for (t = all_thread; t < all_thread + MAX_THREAD; t++) {
    if (t->state == FREE) break;
  }
  t->state = RUNNABLE;
  // YOUR CODE HERE
  t->ctx.ra = (uint64) func;
  t->ctx.sp = (uint64) &t->stack + (STACK_SIZE - 1);
}
```

We can now handle `thread_schedule()`.

The original loop finds the first RUNNABLE thread and assigns it to `next_thread`. Clearly, the contexts of `current_thread` and `next_thread` should be exchanged.

One slightly tricky detail is that the function performs the following assignment before the switch:

```c  
t = current_thread;
current_thread = next_thread; // The current thread becomes the next thread
```

We therefore switch between `t` and `next_thread`:

```c
thread_switch((uint64) &t->ctx, (uint64) &next_thread->ctx);
```

The complete code is:

```c  
void 
thread_schedule(void)
{
 struct thread *t, *next_thread;

  /* Find another runnable thread. */
  next_thread = 0;
  t = current_thread + 1;
  for(int i = 0; i < MAX_THREAD; i++){
    if(t >= all_thread + MAX_THREAD)
      t = all_thread; // Wrap around
    if(t->state == RUNNABLE) {
      next_thread = t;
      break;
    }
    t = t + 1;
  }

  if (next_thread == 0) {
    printf("thread_schedule: no runnable threads\n");
    exit(-1);
  }

  if (current_thread != next_thread) {         /* switch threads?  */
    next_thread->state = RUNNING;
    t = current_thread;
    current_thread = next_thread; // The current thread becomes the next thread
    /* YOUR CODE HERE
     * Invoke thread_switch to switch from t to next_thread:
     * thread_switch(??, ??);
     */
    thread_switch((uint64) &t->ctx, (uint64) &next_thread->ctx);
  } else
    next_thread = 0;
}
```

After reading other people's blog posts,[^1] I realized that the user-mode multithreading implemented here is actually closer to coroutines. Threads voluntarily yield processor resources instead of being preempted by timer interrupts, and only one core is used.

In other words, a function can suspend itself and later resume through `thread_schedule()`.

I had previously read about coroutines and could understand only why they were called “functions that can be suspended.” I could not understand why a coroutine was considered a “user-mode thread,” much less how one was implemented.

It is a strange and satisfying experience to study one topic and suddenly understand something apparently unrelated that had remained incomprehensible before. If learning something has stalled for a long time, perhaps set it aside; at some unexpected time later, another topic may make it clear.

## Using threads

The lab description is long, so I will not reproduce its image here. The task is roughly to read a hash-table program and modify it so that it also works in a multithreaded environment.

Running the supplied program with one thread works normally. With two or more threads, some key-value pairs inserted into the hash table disappear entirely.

To solve the problem, inspect the hash table and locate the race. Its three most important functions are `insert()`, `put()`, and `get()`.

First, `insert()`:

```c
static void 
insert(int key, int value, struct entry **p, struct entry *n)
{
  struct entry *e = malloc(sizeof(struct entry));
  e->key = key;
  e->value = value;
  e->next = n;
  *p = e; // Change the head of p, table[i], to e
}
```

In a hash table, when the hash function maps several different keys to the same location, that bucket is represented as a linked list. A lookup traverses the list to find the correct key-value pair.

`insert()` adds an element to such a list. `e` is the new element inserted into list `*p`; its fields are initialized from the arguments.

The expression `e->next = n` is especially important. Here, `n` is the first element of `table[i]`, or `*p`. Assigning it to `e->next` inserts `e` before the previous head.

The next function is `put()`:

```c
static 
void put(int key, int value)
{
  // is the key already present?
  struct entry *e = 0;
  for (e = table[i]; e != 0; e = e->next) {
    if (e->key == key)
      break;
  }
  if(e){
    // update the existing key.
    e->value = value;
  } else {
    // the new is new.
    insert(key, value, &table[i], table[i]); // Insert a key-value pair at the front of table[i]
  }
}
```

It attempts to add a key-value pair to the hash table. First, it searches for `key`. If that key already exists, its old value is replaced with `value`.

Otherwise, it calls `insert()` to add the pair.

The final important function is `get()`:

```c 
static struct entry*
get(int key)
{
  int i = key % NBUCKET;
  struct entry *e = 0;
  for (e = table[i]; e != 0; e = e->next) {
    if (e->key == key) break;
  }
  return e;
}
```

It traverses the appropriate linked list in the hash table to find the value associated with the key.

Overall, this is an ordinary hash-table implementation and appears correct, but it contains a race in a multithreaded environment.

Consider the following situation.[^1]

Keys k1 and k2 belong to the same bucket list, and neither pair is currently present. Threads t1 and t2 attempt to insert the two keys into that list.

t1 first verifies that k1 is absent and prepares to call `insert()` to add it at the front.

At this moment, the scheduler switches to t2. Alternatively, on a multicore machine both run in parallel and t2 advances more quickly.

t2 also observes that k2 is absent and calls `insert()`. After insertion, k2 is the first element.

t1 then performs its insertion of k1. Because it does not know that t2 has inserted k2 at the head, it writes k1 using the head that it previously observed. k2 is overwritten, and the key-value pair is lost.

This race requires locking.

The preceding scenario shows that at any instant, only one thread may operate on a particular hash-table bucket, including both reads and modifications. Multiple threads may otherwise observe stale information, as above.

Create one mutex for every bucket list, and lock and unlock it at the beginning and end of `put()` and `get()`.

Why not lock inside `insert()`? Because `insert()` is called by `put()`, and acquiring the same nonrecursive mutex twice would deadlock.

The modified functions are:

```c
pthread_mutex_t bkt_lock[NBUCKET];

static 
void put(int key, int value)
{
  int i = key % NBUCKET;
  
  pthread_mutex_lock(&bkt_lock[i]);
  // is the key already present?
  struct entry *e = 0;
  for (e = table[i]; e != 0; e = e->next) {
    if (e->key == key)
      break;
  }
  if(e){
    // update the existing key.
    e->value = value;
  } else {
    // the new is new.
    insert(key, value, &table[i], table[i]); // Insert a key-value pair at the front of table[i]
  }
  pthread_mutex_unlock(&bkt_lock[i]);
}

static struct entry*
get(int key)
{
  int i = key % NBUCKET;

  pthread_mutex_lock(&bkt_lock[i]);
  
  struct entry *e = 0;
  for (e = table[i]; e != 0; e = e->next) {
    if (e->key == key) break;
  }
  pthread_mutex_unlock(&bkt_lock[i]);
  return e;
}
```

## Barrier

> ![](/img/xv6/lab/lab7_barrier.png)
> Implement a synchronization barrier.

First, what is a synchronization barrier? According to Wikipedia:

> A barrier is a synchronization method in parallel computing. For a group of processes or threads, a barrier means that any thread or process reaching that point must wait until all of them have arrived before execution can continue.

A naive implementation increments a variable whenever a thread reaches the barrier. Once the value equals the total thread count, execution may continue.

Before the count reaches the total, each thread must block at the barrier. When the condition becomes true, all blocked threads may cross it.

We could combine a mutex with polling to check the variable repeatedly, but this would have a significant performance cost.

Polling is passive: every thread repeatedly asks whether the condition is true. Why not instead let the final arriving thread notify all the others?

Condition variables in the pthread library provide exactly this function.

For example, after calling `pthread_cond_wait(&cond, &mutex)`, a thread remains blocked until another thread calls `pthread_cond_broadcast(&cond)`.

More specifically, `pthread_cond_wait(&cond, &mutex)` performs these operations in order:

1. Calls `pthread_mutex_unlock(&mutex)`.
2. Places the thread in the list of threads waiting for the condition.
3. Blocks the thread until another thread sends a signal.

Steps 1 and 2 are atomic.

When a thread signals the condition variable:

1. The kernel wakes waiting threads; the number depends on whether `signal` or `broadcast` was used.
2. `pthread_cond_wait()` returns in each awakened thread.
3. `mutex` is locked again.

Why must a condition variable be paired with a mutex? Here is my present understanding.

A condition variable is normally used together with another variable, which I will call x.

Before calling `wait()`, a thread checks whether x satisfies a condition. If it already does, there is no need to wait.

If not, the thread calls `wait()` so that it can be notified when x later satisfies the condition.

x is shared in a multithreaded environment. The thread must therefore hold a lock protecting x while checking it before the wait.

After discovering that x does not satisfy the condition and entering `wait()`, the lock must be released. Otherwise, no other thread can modify x to make the condition true.

Likewise, when x becomes suitable and `wait()` returns, the awakened thread reacquires the lock protecting x. It may inspect or modify x, and a concurrent change at that point would be unsafe.

Why must unlocking and joining the wait queue be one atomic operation?

Suppose a program uses a condition variable but performs those operations separately:[^2]

```c
lock(x_lock) // Acquire the lock protecting x
if (x satisfies the condition){
    unlock(x_lock); // Release the lock protecting x
    pthread_cond_wait(&cond); // Wait for a signal
    lock(x_lock); // dosomething may modify x
    dosomething();
}
unlock();
```

Between `unlock(x_lock)` and placing the current thread in the wait queue for `cond`, another thread might change x and signal the condition. Because the current thread has not yet joined the queue, it misses the signal permanently.

Therefore, queue insertion and unlocking must be atomic.

I did not expect to write so much about condition variables while barely mentioning barriers. Now return to the actual task and implement the barrier.

First inspect the supplied `barrier` structure in `barrier.c`:

```c
struct barrier {
  pthread_mutex_t barrier_mutex;
  pthread_cond_t barrier_cond;
  int nthread;      // Number of threads that have reached this round of the barrier
  int round;     // Barrier round
} bstate;
```

`nthread` is the variable x described above: threads wait on the condition variable only while `nthread` has not reached the required value.

The mutex that protects x is correspondingly `barrier_mutex`. This gives the following implementation:

```c
static void 
barrier()
{
  // YOUR CODE HERE
  //
  // Block until all threads have called barrier() and
  // then increment bstate.round.
  //
  pthread_mutex_lock(&bstate.barrier_mutex);
  bstate.nthread++;
  if(bstate.nthread < nthread){
    pthread_cond_wait(&bstate.barrier_cond, &bstate.barrier_mutex);
    // Wait if not every thread has reached the barrier.
    // This call blocks until a signal is received.
  }else{ // This is the final thread.
    bstate.nthread = 0;
    bstate.round++;
    pthread_cond_broadcast(&bstate.barrier_cond);
  }
  pthread_mutex_unlock(&bstate.barrier_mutex);
}
```

One detail is the distinction between `pthread_cond_broadcast()` and `pthread_cond_signal()`.

`broadcast()` wakes every thread in the waiting list, whereas `signal()` wakes only one.

When the final thread reaches this barrier, all threads may proceed, so the implementation uses `broadcast()`.

The lab now passes. I wish everyone working on it an early AC:

![](/img/xv6/lab/lab7_AC.png)

## Summary

Writing a blog is important. Producing working code does not necessarily mean that I understand it completely. With the condition variable in the final exercise, for example, I understood what it did and felt that the implementation was fine. While writing the article, however, I discovered that I could not explain it and had to consult more material. Explaining knowledge to someone else requires a deeper understanding of it.

The amount of code in this lab is relatively small. To be honest, none of the labs so far has required especially much code. It is possible to finish without fully understanding scheduling and context switching in xv6. Completing it after understanding those mechanisms, however, gives much more insight—especially for the uthread exercise, since the other two depend more heavily on pthread.

[^1]: <https://blog.miigon.net/posts/s081-lab7-multithreading/>
[^2]: <https://blog.csdn.net/weixin_37822792/article/details/112430570>
