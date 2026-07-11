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

Note: the lab handout and course files[^1] explicitly prohibit publishing the code. Therefore these notes focus on ideas and a few core snippets rather than the complete repository.

# Lab 0: networking warm-up

The task is to implement a reliable in-memory byte stream (`ByteStream`), much like a Unix pipe. A fixed-capacity stream is easiest to model with a `string`, a head pointer, and a tail pointer, forming a circular queue:

```cpp
string ByteStream::peek_output(const size_t len) const {
    size_t peek_size = min(buffer_size(), len);
    string ret(peek_size, '\0');
    for (size_t i = 0; i < peek_size; i++)
        ret[i] = _data[(_head + i) % _capa];
    return ret;
}
```

This simple version performs many modulo operations and is not especially fast, but it passed all nine Lab 0 tests in release mode.

# Lab 1: stitching substrings into a byte stream

`StreamReassembler` receives substrings that may arrive out of order and assembles them into the contiguous stream expected by the `ByteStream`. The implementation keeps a window beginning at `_first_unassembled`, stores bytes that fall inside the capacity window, merges overlapping ranges, and writes every newly contiguous byte to the output. When the last segment is marked `eof`, the output is closed once all bytes before that index have been assembled.

## Implementation

### Rough description

For each incoming substring, discard bytes before the first unassembled index or beyond the available capacity. Record the remaining interval, avoid counting duplicate bytes, and repeatedly flush the prefix that now starts at `_first_unassembled`.

### Example and requirements

Segments can overlap and can arrive in any order. The reassembler must report the number of unassembled bytes, never exceed its capacity, and close the stream only after the complete input has been delivered.

### Algorithm

An array (or interval map) represents the current window. After inserting a segment, scan from the window start while bytes are present; write that run to the `ByteStream`, advance `_first_unassembled`, and free the consumed slots. This makes the correctness condition explicit: the output is always the longest contiguous prefix received so far.

# Lab 2: the TCP receiver

The receiver combines the reassembler with TCP sequence numbers. TCP sequence numbers wrap around, so a small wrapper class converts between wrapped and absolute numbers using a checkpoint near the most recently assembled byte.

## Sequence-number wrapper

Given a wrapped number and a checkpoint, choose the absolute number whose low 32 bits match the wrapped value and whose distance from the checkpoint is smallest. The receiver then converts SYN, payload, and FIN positions into stream indices, rejects segments outside the receive window, and passes accepted payload to the reassembler. ACK is the next unassembled absolute sequence number; the window advertises the remaining `ByteStream` capacity.

[^1]: Stanford CS144 course material.
