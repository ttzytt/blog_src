---
title: "[Stanford CS144] Lab 0–Lab 3 Lab Notes"
date: 2022-12-25 00:00:00
updated: 2022-12-28 17:26:52
tags:
- CS144
- Networking
- TCP/IP
categories:
- Lab Records
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments:
cover: /img/CS144/sponge结构图.svg
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/12/CS144_lab0-3_rec/).
{% endnote %}

Note: Because both the lab guide and the course files[^1] explicitly state that code must not be published, the lab notes on this blog mainly record ideas and a few core code snippets; I will not publish the complete repository.

# Lab 0: Networking Warmup

The lab requires implementing a reliable byte stream in memory (`ByteStream`), which feels rather similar to a Unix pipe. A first-in, first-out structure like this could be implemented very simply with the STL `queue<char>`. However, since the lab requires a fixed-capacity byte stream, I personally think it is more appropriate to simulate it directly with an array, which should also be faster.

More specifically, use a `string` to store the data—I did not use a raw character array because the lab guide recommends modern C++ style and avoiding `new` for manual memory allocation—along with head and tail pointers that point to the beginning and end of the byte stream. This implements a circular queue. The `peek_output()` function is roughly:

```cpp
string ByteStream::peek_output(const size_t len) const {
    size_t peek_size = min(buffer_size(), len);
    size_t i = 0;
    string ret = "";
    ret.resize(peek_size);
    while (i < peek_size) {
        ret[i] = _data[(_head + i) % _capa];
        i++;
    }
    return ret;
}
```

Although this implementation looks intuitive, its performance is relatively poor. The main reason is that the circular queue uses the modulo operation extensively, which causes a significant slowdown. Since I had not started Lab 4 at the time, I did not consider performance too deeply. The Lab 0 test results in release mode were:

```
[100%] Testing Lab 0...
Test project /mnt/e/ocourses/st_cs144/sponge/build
    Start 26: t_byte_stream_construction
1/9 Test #26: t_byte_stream_construction .......   Passed    0.01 sec
    Start 27: t_byte_stream_one_write
2/9 Test #27: t_byte_stream_one_write ..........   Passed    0.01 sec
    Start 28: t_byte_stream_two_writes
3/9 Test #28: t_byte_stream_two_writes .........   Passed    0.01 sec
    Start 29: t_byte_stream_capacity
4/9 Test #29: t_byte_stream_capacity ...........   Passed    0.22 sec
    Start 30: t_byte_stream_many_writes
5/9 Test #30: t_byte_stream_many_writes ........   Passed    0.01 sec
    Start 31: t_webget
6/9 Test #31: t_webget .........................   Passed    0.81 sec
    Start 53: t_address_dt
7/9 Test #53: t_address_dt .....................   Passed    0.05 sec
    Start 54: t_parser_dt
8/9 Test #54: t_parser_dt ......................   Passed    0.01 sec
    Start 55: t_socket_dt
9/9 Test #55: t_socket_dt ......................   Passed    0.01 sec

100% tests passed, 0 tests failed out of 9

Total Test time (real) =   1.17 sec
[100%] Built target check_lab0
```

# Lab 1: Stitching Substrings into a Byte Stream

This lab requires implementing a “reassembler”: it rearranges different data fragments into a continuous byte stream according to their supplied starting indices. We must also put received data into the byte stream as quickly as possible. In other words, if every character in $[0,i]$ has been received, that entire section should be inserted into the byte stream immediately.

Even before considering the experiment itself, the requirements in the lab guide are rather difficult to understand, especially the concept of `capacity`. In simple terms, it is the size of unread data in the byte stream plus the receive range of the reassembler.

Put another way, the reassembler has limited capacity. If the `index` of a data segment is too large, the reassembler can discard it directly. The more unread data there is in the byte stream, the smaller the minimum `index` that will be discarded. This means capacity is shared between bytes already assembled but not yet read and out-of-order bytes still waiting in the reassembler; treating those as two independent capacities would allow the implementation to retain more data than the lab permits.

## Implementation

### Rough Description

There are many ways to implement the reassembler. The simplest is to copy every arriving data segment, then insert data into the byte stream whenever a continuous run appears at the front of the reassembler.

This algorithm is obviously very inefficient. Every newly arriving data segment must be traversed completely, even if exactly the same data has already been received.

To avoid repeated copying, I implemented a data structure dedicated to maintaining a “set of segments.”

Any newly arriving data segment can be represented as an interval $[l,r)$. We can also maintain a set of segments, denoted by $u$, representing the ranges not yet received. For a new segment $x=[l,r)$, if we can calculate the portions where $u$ and $x$ overlap—that is, $u\cap x$—we need only traverse those portions: the unfilled segments covered by $x$. If the length of $u\cap x$ is 0, the new data contains no previously unreceived portion, so we can return immediately and avoid the repeated traversal described above.

After writing the $u\cap x$ portion of the new segment, we must also change $u$ by removing $u\cap x$, indicating that this portion has now been received. The data structure therefore records missing ranges rather than received ranges. A repeated segment has an empty intersection with the missing set and can be rejected without touching every byte again.

### Example

The description above may not be very clear, so consider an example.

Suppose the goal is to receive a data segment covering $[0,10)$. At the beginning, no data has arrived, so $u$ is the range $[0,10)$.

Now a new segment $x=[2,5)$ arrives. We obtain $u\cap x=[2,5)$, meaning that none of the data in $x$ is duplicated.

After filling $x$, perform $u=u-(x\cap u)$. The minus sign here does not denote a set difference in the formal sense; it means removing a portion from $u$. This indicates that $x\cap u$ is no longer unfilled. The value of $u$ becomes $\{[0,2),[5,10)\}$.

Now receive another segment $y=[1,6)$. It completely covers the previous segment $x=[2,5)$, but there is no need to traverse the already filled portion again. Instead, fill only the intersection $u\cap y=\{[1,2),[5,6)\}$.

### Requirements

At this point, the required data structure is relatively clear. We should implement two classes: `Seg`, representing one segment, and `Segs`, representing a set containing many segments.

`Segs` needs the following operations:

- Find its intersection with a `Seg`, the $u\cap x$ operation described above.
- Delete a `Seg`, the $u=u-(u\cap x)$ operation described above.

A `Segs` can contain many `Seg` objects. To calculate the intersection of a `Segs` object $a$ and a $Seg` object $b$, first find a subset $c$ of $a$ in which every $Seg` overlaps $b$, approximately as follows:

```
         1        2(c1)            3(cn)            4
Segs a : |---|    |-----|          |--------|       |---|
Seg  b :        |-----------------------|
```

Segments 2 and 3 of $a$ overlap $b$ and therefore belong to subset $c$.

### Algorithm

Traversing the small `Seg` objects of $a$ one by one has linear complexity and is not much better than the naive algorithm.

The optimization I use is binary search.

Let the first segment of subset $c$ be $c_1$—segment 2 in the diagram—and let its last segment be $c_n$—segment 3 in the diagram.

Observation shows that $c_1$ must be the first segment whose right endpoint is greater than the left endpoint of $b$. Likewise, $c_n$ must be the last segment whose left endpoint is less than the right endpoint of $b$. Expressions of this “maximize a minimum” form can clearly be solved by binary search, provided that the multiple $Seg` objects stored in `Segs` are ordered.

Because the `Segs` class frequently inserts and deletes segments, I used `std::set<Seg>` to store them while maintaining an ordered state for convenient queries.

This reduces the complexity of finding $c_1$ and $c_n$ to $\log(\text{number of segments})$. Only the segments between these two iterators can overlap the query, so later intersection and deletion operations can work on the relevant consecutive range rather than scanning the entire set.

The function that queries $c_1$ and $c_n$ is the core of the entire data structure. It is shown below; the other portions are inconvenient to show because of the rule against publishing code.

```cpp
template <integral T, bool REC_LEN>
typename std::pair<typename Segs<T, REC_LEN>::s_iter_t, typename Segs<T, REC_LEN>::s_iter_t>
Segs<T, REC_LEN>::intersect_iter(const Seg<T> &b) const {
    // return the first and last iterator of the intersected segments
    // Return iterators to the first and last segments that overlap b.
    if (b.len() == 0)
        return {_segs.end(), _segs.end()};
    auto fir = fir_GT_iter_r(b.l); // c1 above: the first segment whose right endpoint exceeds the query's left endpoint
    if (fir != _segs.end() && ((*fir) ^ b).len() == 0)  // if no intersection
        fir = _segs.end();
    auto las = lst_LT_iter(b.r); // cn above: the last segment whose left endpoint is below the query's right endpoint
    if (las != _segs.end() && ((*las) ^ b).len() == 0)
        las = _segs.end();

    // Handle cases in which c1 or cn was not found.
    if (fir == _segs.end() && las != _segs.end())
        fir = las;
    if (fir != _segs.end() && las == _segs.end())
        las = fir;
    return {fir, las};
}
```

Then, in `StreamReassembler::push_substring`, the data can be filled directly according to the ranges supplied by `Segs`:

```cpp
……
    // insert new arrival into _tmp
    const Seg coverage{index, index + data.size()}; // Range of the newly arrived segment
    auto &&unfilled_intersect = _unfilled_segs ^ coverage; // ^ is overloaded here to mean intersection.
    for (auto &s : unfilled_intersect) {
        // s denotes an unfilled segment.
        for (size_t i = s.l; i < s.r && (i - _fir_unpushed_idx) <= _capacity; i++) {
            _tmp[i - _fir_unpushed_idx] = data[i - index];
            // _tmp[0] corresponds to _fir_unpushed_idx, the first position not yet inserted
            // into the byte stream. Add an offset, while (i - _fir_unpushed_idx) <= _capacity
            // ensures that _tmp does not go out of bounds.
            _unassembled_bt++;
        }
    }
    _unfilled_segs -= coverage;
    // find the first unfilled segment, before this segment, all data are filled
……
```

The performance of `push_substring` implemented this way is fairly satisfactory:

```
[100%] Testing the stream reassembler...
Test project /mnt/e/ocourses/st_cs144/sponge/build
      Start 18: t_strm_reassem_single
 1/16 Test #18: t_strm_reassem_single ............   Passed    0.01 sec
      Start 19: t_strm_reassem_seq
 2/16 Test #19: t_strm_reassem_seq ...............   Passed    0.01 sec
      Start 20: t_strm_reassem_dup
 3/16 Test #20: t_strm_reassem_dup ...............   Passed    0.01 sec
      Start 21: t_strm_reassem_holes
 4/16 Test #21: t_strm_reassem_holes .............   Passed    0.01 sec
      Start 22: t_strm_reassem_many
 5/16 Test #22: t_strm_reassem_many ..............   Passed    0.10 sec
      Start 23: t_strm_reassem_overlapping
 6/16 Test #23: t_strm_reassem_overlapping .......   Passed    0.01 sec
      Start 24: t_strm_reassem_win
 7/16 Test #24: t_strm_reassem_win ...............   Passed    0.10 sec
      Start 25: t_strm_reassem_cap
 8/16 Test #25: t_strm_reassem_cap ...............   Passed    0.07 sec
      Start 26: t_byte_stream_construction
 9/16 Test #26: t_byte_stream_construction .......   Passed    0.01 sec
      Start 27: t_byte_stream_one_write
10/16 Test #27: t_byte_stream_one_write ..........   Passed    0.01 sec
      Start 28: t_byte_stream_two_writes
11/16 Test #28: t_byte_stream_two_writes .........   Passed    0.01 sec
      Start 29: t_byte_stream_capacity
12/16 Test #29: t_byte_stream_capacity ...........   Passed    0.20 sec
      Start 30: t_byte_stream_many_writes
13/16 Test #30: t_byte_stream_many_writes ........   Passed    0.01 sec
      Start 53: t_address_dt
14/16 Test #53: t_address_dt .....................   Passed    0.05 sec
      Start 54: t_parser_dt
15/16 Test #54: t_parser_dt ......................   Passed    0.01 sec
      Start 55: t_socket_dt
16/16 Test #55: t_socket_dt ......................   Passed    0.01 sec

100% tests passed, 0 tests failed out of 16

Total Test time (real) =   0.70 sec
[100%] Built target check_lab1
```

Later, I also used `perf` to generate flame graphs and tried to optimize the implementation further. The generated results are below. These SVG images are interactive, but they need to be opened in a separate window.

![Debug mode](/img/CS144/lab1_perf.svg)
![Release mode](/img/CS144/lab1_perf_O2.svg)

The first image is from debug mode, and the second is from release mode. In release mode, many functions are inlined, making analysis difficult. In debug mode, however, we can see that operations on `Segs` consume little time inside `push_substring`; instead, string operations on the `deque` are very expensive, such as:

```
_ZNSt5dequeIcSaIcEEixEm -> std::deque<char, std::allocator<char> >::operator[](unsigned long)
_ZNSt5dequeIcSaIcEE5frontEv -> std::deque<char, std::allocator<char> >::front()
```

Clearly, using a `deque` to store temporary data is not a good choice. However, since `Segs` performs well, I will leave it unchanged for now and address the string-copying problem specifically when optimizing performance in Lab 4.

# Lab 2: The TCP Receiver

This lab has two parts. The first requires implementing conversions between relative and absolute sequence numbers, while the second actually uses the wrapper class implemented earlier to write the TCP receiver.

Completing this lab requires a basic understanding of the TCP header. First, one message may be split into many small segments for transmission under TCP, and every segment has a header. The SYN and FIN flags mark the beginning and end of the transmission, respectively.

That is, if SYN in a header is true, the TCP packet is the first packet of the entire message. FIN similarly identifies the last packet.

We normally use 0 as the first index in a sequence of data, such as a character array. TCP does not do this: the index of the first data is randomized. Every TCP header contains a sequence number, `seqno`, that denotes the starting index of the data in that packet. A packet containing SYN is the first packet in the whole sequence, so its `seqno` is the first index of the whole sequence. We call this first index the ISN, or initial sequence number.

Why use a random sequence number? The main reason is to avoid confusion with historical data. During an earlier connection, some packets may have been transmitted extremely slowly because of network congestion and may arrive only after the connection has closed. If sequence numbers were not randomized, the historical packet's sequence number would very likely fall inside the receive window of the new connection and be accepted incorrectly[^2].

## Sequence-Number Wrapper

Although the TCP packet's index is randomized, when we use it—for example, in the previously implemented `push_substring` function—we still need to convert it into a zero-based index. This index differs from `seqno` and is 64 bits wide.

The lab guide calls the zero-based index the absolute sequence number, or absolute `seqno`. We need to write a class specifically to convert between these two kinds of sequence number.

Converting an absolute sequence number to a wrapped `seqno` is simple: return ISN plus the absolute sequence number. Natural overflow directly produces the wrapped sequence number.

Converting a wrapped `seqno` back to an absolute sequence number is not as simple. A wrapped `seqno` is 32 bits, while the absolute sequence number is 64 bits, so the same wrapped value can correspond to multiple absolute values separated by multiples of $2^{32}$. The required $unwrap` function therefore receives an additional `checkpoint`; the converted absolute sequence number must be the one closest to that checkpoint. Without the checkpoint, the low 32 bits alone cannot tell us which wraparound period contains the intended absolute position.

The problem is clearer in mathematical language. Let the checkpoint be $c$, the wrapped sequence number be $s$, and $M=2^{32}$.

We need to find an absolute sequence number $s_a$ such that $s_a\equiv s-\text{isn}\pmod M$ while minimizing $|s_a-c|$.

My implementation is below. It may look confusing at first glance; in fact, the explanation below is also rather confusing. I tried several ways to express the idea, but my mathematics and writing abilities prevented me from explaining it clearly.

```cpp
//! \param n The relative sequence number
//! \param isn The initial sequence number
//! \param checkpoint A recent absolute 64-bit sequence number
uint64_t unwrap(WrappingInt32 n, WrappingInt32 isn, uint64_t checkpoint) {
    WrappingInt32 wrapped_ckp = wrap(checkpoint, isn); 
    // Reduce modulo 2^32 and add isn.
    // This converts an absolute checkpoint into a checkpoint relative to isn.
    int32_t offset = n - wrapped_ckp;
    static constexpr uint32_t MX32 = numeric_limits<uint32_t>::max();
    int64_t ret = offset + checkpoint;
    if (ret < 0)
        return ret + MX32 + 1; 
    return ret;
} 
```

Here, `offset` is the distance, modulo $2^{32}$, from $checkpoint + isn` to the `seqno` being converted. It may be positive or negative.

```
0     2^32     2*2^32     3*2^32
|        |        |        |
|--------|--------|--------|
 |     |                 |
seqno  ckp + isn       ckp + isn (actual)
 |<--->|
  offset
```

To obtain a `seqno` closest to `checkpoint + isn`, add the newly obtained offset to `checkpoint + isn`. This is equivalent to adding some multiple of $2^{32}$ to the $seqno`.

Subtracting `isn` from `offset + checkpoint + isn` yields the absolute sequence number, because a wrapped and absolute sequence number differ by exactly `isn`.

Therefore, the absolute sequence number equals `offset + checkpoint`.

However, this direct calculation may not produce the optimal solution. The following is the result of using the method directly:

```
0     2^32     2*2^32     3*2^32
|        |        |        |
|--------|--------|--------|
                   |     |               
                  seqno  ckp + isn      
                   |<--->|
                    offset
```

We can see that adding $2^{32}$ directly to the current $seqno` would place it closer to `checkpoint + isn`, while still satisfying $s_a\equiv s-\text{isn}\pmod M$.

Such a failure to find the optimum can only occur when $|\text{offset}|>2^{32}\div2$.

Adding any multiple of $2^{32}$ to $seqno` does not change it modulo $2^{32}$. The offset does change, however, and our goal is to minimize that offset.

For example, if $\text{offset}=-2^{32}+1$, which certainly satisfies the preceding inequality, then:

$$
(\text{offset}+2^{32})=1
$$

As in the preceding example, adding $2^{32}$ directly to $seqno` gives:

```
2^32     2*2^32   3*2^32   4*2^32
|        |        |        |
|--------|--------|--------|
                |  |                 
        ckp + isn  seqno       
                <-->
                offset   
```

Natural overflow handles this problem for us, so we do not need to deal with it ourselves.

Notice that `offset` is stored as an `int32_t`. It is signed and has exactly the range $[-2^{32}\div2,2^{32}\div2-1]$.

Therefore, whenever $|\text{offset}|>2^{32}\div2$, `offset` automatically adds or subtracts a multiple of $2^{32}$ from itself to minimize its value.

This implementation still has a bug, however. Consider:

```
0                      2^32
|-----------------------|
  |                  |
  ckp+isn            seqno
  |<---------------->|
          offset  
```

The offset here is clearly positive and greater than $2^{31}$. Subtracting $2^{32}$ from $seqno` would reduce the absolute value of the offset, but it would also make `seqno` negative, which is clearly invalid. The following lines prevent a negative result: if the result is negative, add $2^{32}$ back.

```cpp
static constexpr uint32_t MX32 = numeric_limits<uint32_t>::max();
    int64_t ret = offset + checkpoint;
    if (ret < 0)
        return ret + MX32 + 1; 
```
[^1]: <https://cs144.github.io/logistics.pdf>
[^2]: <https://www.zhihu.com/question/53658729>
