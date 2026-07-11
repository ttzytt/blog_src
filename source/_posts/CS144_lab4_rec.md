---
title: "[Stanford CS144] lab4 实验记录"
date: 2023-01-30 00:00:00
updated: 2023-02-02 01:37:53
tags:
- CS144
- 网络
- TCP/IP
categories:
- 实验记录
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments:
cover: /img/CS144/tcp状态流转图.jpg
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

# 代码实现 TCP 状态流转图

Lab4 的主要作用是把前面的 receiver 和 sender 结合起来，形成一个完整的 TCP 协议栈。所以熟悉 TCP 的状态流转图就很重要了。

下面是一个 TCP 的状态流转图：

![TCP 状态流转图 <https://www.ibm.com/support/pages/flowchart-tcp-connections-and-their-definition>](/img/CS144/tcp状态流转图.jpg)

## TCP 连接的建立

参考上图，可以看到 TCP 有两种建立连接的方法。第一种是主动连接，即给对方发送一个 SYN 包。第二种是被动连接，即接收到一个 SYN 包后，回复 SYN+ACK 包。

### 主动连接

对于主动连接，我们需要实现 `connect()` 函数：

```cpp
void TCPConnection::connect() {
    _shutted = false;
    _sender.fill_window();
    send_sender_segs();
}
```

这里的 `shutted` 变量表示连接是否已经关闭，之后在 `active()` 函数中使用。因为我们之前实现过 `TCPSender` 的 `fill_window()` 函数，它会记录连接是否已经建立，如果没有会自动发送 SYN 包。

不过 `TCPSender` 的 `fill_window()` 仅仅会把要发送的 TCP 包推入它的 `_segments_out` 队列。我们需要把这里的包放到 `TCPConnection` 的 `_segments_out` 中，这样 sponge 才会用 IP 协议把它们发送出去。

所以 `fill_window()` 后面的 `send_sender_segs()` 中的一个作用就是把 `_segments_out` 中的包放到 `TCPConnection` 的 `_segments_out` 中。

当然，`TCPSender` 发送包的时候是不清楚一些报头中的信息的。比如 `win` 和 `ackno`，前者代表 `TCPReceiver` 还能接收多少数据，后者代表 `TCPReceiver` 已经收到的数据。所以我们还需要在 `send_sender_segs()` 中把这些信息填好：

填写过程中有一个比较坑的地方，就是报头中 `win` 的范围。查看 `TCPHeader` 中 `win` 的定义：

```cpp
uint16_t win = 0;           //!< window size
```

可以发现这是一个 16 位的无符号整数。但是在 `TCPReceiver` 中，`window_size()` 返回的是一个 64 位的整数：

```cpp
size_t TCPReceiver::window_size() const { 
    // 从 ackno 开始，还能接收多少字节
    return _capacity - _reassembler.stream_out().buffer_size();
    // window_size() + buffer_size() = capacity
}
```

如果强行调用 `window_size()` 给 `win` 赋值，可能会造成溢出，所以赋值的时候需要这样写：

```cpp
seg.header().win = min(_receiver.window_size(), (size_t)numeric_limits<uint16_t>::max());
```

### 被动连接

再参考状态流转图，如果现在在 `LISTEN` 状态。收到一个 SYN 包并且回复了 SYN+ACK 包后，连接就建立了。

但是如何确定这个 `LISTEN` 的状态呢？一个很方便的方法是直接使用 Sponge 提供的 `TCPState` 类。

其不仅可以判断 `TCPConnection` 整体的状态，也可以分别判断 `TCPSender` 和 `TCPReceiver` 的状态。

这里的 `LISTEN` 是整体的一个状态。

在 `segment_received()` 函数中这么写就可以判断当前是否要进行被动连接了：

```cpp
bool passive_connect = (state() == TCPState::State::LISTEN && seg.header().syn);
```

如果发现是需要被动连接，那么直接这么写就行了：

```cpp
    // 如果是在 listen 状态，被动建立连接
    bool passive_connect = (state() == TCPState::State::LISTEN && seg.header().syn);
    // 对于 receiver, LISTEN
    // 对于 sender, CLOSED

    _receiver.segment_received(seg);  
    // 先调用 segment_received 才知道要回复什么 ackno
    if (passive_connect) {
        connect();
        return;
    }
```

现在为止，我们已经成功的建立了连接。对于每个新到达的包，只需要在 `segment_received()` 中调用 `_receiver.segment_received()` 和 `_sender.ack_received()` （这样 sender 知道对方收到了哪些信息，可以重发没有收到的） 来更新信息就可以一直维持连接了。

## TCP 连接的关闭

相比建立连接，关闭连接会显得复杂一些，并且不能保证总是“完美”的关闭。

计算机网络学科中，有一个著名的思想实验来描述 TCP 不能完美关闭连接的问题 -- 两军问题。维基百科的描述[^1]如下：

> 两支军队由不同将军领导，准备进攻一座坚固的城市。军队在城市附近的两个山谷扎营。由于有另一个山谷将两山隔开，两名将军只能透过派信使穿越山谷通信，但这山谷由城市护卫占领，有可能俘虏途径山谷传递消息的任何信使。
>
> 虽然两军已约定要同时进攻，但尚未约定进攻时间。要顺利攻击，两军必须同时进攻。如果同一时间仅一支军队进攻就会战败，因此两名将军须约定攻击时间，**并确保对方知道自己同意了进攻计划**。

> 将军甲首先派信使向将军乙传递消息“在8月4日9时进攻”。然而，派遣信使后，将军甲不知道信使是否成功穿过敌方领土。由于担心自己成为唯一的进攻军队，将军甲可能会犹豫要否按计划进攻。
> 为了消除不确定性，将军乙可以向将军甲发送确认消息“我收到了您的消息，并会在8月4日9时进攻”，但传递确认消息的使者同样可能会被敌方俘虏。由于担心将军甲没有收到确认消息而退缩，将军乙会犹豫要否按计划进攻。
> 再次发送确认消息看来可以解决问题——将军甲再让新信使发送确认消息：“我已收到您确认在8月4日9时进攻”。但是，将军甲的新信使也可能被俘虏。显然，无论确认几次都无法满足该问题的条件二，即两方都必须确保对方已同意计划，两名将军总会怀疑他们最后派遣的使者有否顺利穿过敌方领土。

可以发现，TCP 关闭连接的时候，也存在同样的问题。当 A 发送断开连接的消息后，B 可以发送一个 ACK 包表明收到了断开的消息。然而，B 不知道 A 是否收到了 ACK 包，从而担心 A 是否会正常关闭。A 当然可以再回复一个 ACK 包，但这就陷入了两个将军的困境中。

多次的互相发送确认消息看起来可能能减少错误，但是 TCP 协议中是不会对一个 ACK （即不包含实际数据的包，只有 ACK）包回复 ACK 包的，所以我们还需要一些别的解决方案。

和建立连接类似，断开连接时我们也可以分为主动和被动两个方面去讨论。

### 被动关闭解释

![被动关闭](/img/CS144/tcp状态流转图_被动关闭.png)

和主动关闭相比，被动关闭相对比较简单。所以我们可以先讨论。

被动和主动关闭端点的唯一区别就是发送 FIN 包的先后。主动关闭在发送完所有自身出向字节流产生的 TCP 包后，会发送一个带 FIN 的包。

虽然这时连接的一方已经发送 FIN 了，但这并不代表连接就已经关闭了。因为被动的一方可能还有数据没发完。等到发完后，被动端也会发送一个 FIN 进入 LST_ACK 状态。

这个状态唯一的目的就是等待另一端发送对 FIN 的确认信息。如果主动方没确认，被动方还需要一直发送 FIN 来确保对方收到了。

待收到 ACK 后，就可以直接关闭了。

### 主动关闭解释

![主动关闭](/img/CS144/tcp状态流转图_主动关闭.png)

如果出向的字节流已经被完全发送出去了，连接的一方就会发送 FIN 并进入 FIN_WAIT_1 状态。表明 TCP 双向连接的其中一向已经关闭了（即当前端点只接收数据，不会再新发送）。对方确认该 FIN 消息后，当前端点会转换到 FIN_WAIT_2 状态，等待对方完全发送它想传输的数据。

收到对方的 FIN，并且确认后，端点就进入了 TIME_WAIT 状态。这个状态代表代表着：

1. 当前端点完成了对入向字节流的重排，并且入向字节流已经关闭
2. 出向字节流被完全发送并且确认。

虽然进入 TIME_WAIT 后，我们无法确定对方是否收到了对于其 FIN 的确认消息，但是如果对方没有收到，大概率是会在一定的时间内重发 FIN 的（TCP 的超时重传机制，`TCPSender` 有实现）。

虽然网络可能比较拥堵，但如果我们等待（linger）了比较长的一段时间对方都没有重发，那大概率是对方已经收到确认消息并且关闭连接了。

这个等待的时间在实验指导书中有写到：

> it has been at least 10 times the initial retransmission timeout (`cfg.rt_timeout`) since the local peer has received any segments from the remote peer.[^2]

如果采用的是默认的 `cfg.rt_timeout`，那么总的等待时间最少是 10 秒。

### 被动关闭实现

前面提到了被动关闭的一方不需要等待，也就是 linger，用如下的代码就可以实现出来：

```cpp
// 在 segment_received 中

    // 后发 fin（先收到 fin）的端点不需要 linger
    // 这里是 ESTABLISHED 向 CLOSE_WAIT 的转换
    if (TCPState::state_summary(_receiver) == TCPReceiverStateSummary::FIN_RECV &&
        TCPState::state_summary(_sender) == TCPSenderStateSummary::SYN_ACKED) {
        // 不能直接用 state() == CLOSE_WAIT 是因为 CLOSE_WAIT 要求 linger_after 也是 false
        // 但是我们假设先 linger
        _linger_after_streams_finish = false;
    }
    
    // 这里是 LAST_ACK 向 CLOSED 的转换
    if (TCPState::state_summary(_receiver) == TCPReceiverStateSummary::FIN_RECV &&
        TCPState::state_summary(_sender) == TCPSenderStateSummary::FIN_ACKED && !_linger_after_streams_finish) {
        // 不能用 state() == LAST_ACK 是因为其代表 sender 发送了 FIN。并不是 FIN 被确认，即 FIN_ACKED
        _shutted = true;
        return;
    }
```

### 主动关闭实现

因为 `_linger_after_streams_finish` 这个变量是默认设为 true 的，所以只要在之前的判断中，这个变量没有被设置成 false，那么我们就是主动关闭的一方。

`TCPConnection` 类中。唯一一个能够获取当前时间的函数就是 `tick()` 了，为了实现超时直接断开连接的功能，我们可以在 `tick()` 中加入如下代码：

```cpp

if (state() == TCPState::State::TIME_WAIT && _since_lst_rx_ms >= 10 * _cfg.rt_timeout) {
        _shutted = true;
        _linger_after_streams_finish = false;
    }
```

完成这些后再加上亿点点细节，就可以通过测试了（因为实验指导书上的合作政策写了不能公开代码，所以这里只放部分的代码片段），测试结果如下：

```
./tcp_benchmark
CPU-limited throughput                : 0.37 Gbit/s
CPU-limited throughput with reordering: 0.36 Gbit/s
```

说实话速度还是比较慢的，主要原因也能从之前的火焰图看出来，是字符串拷贝和处理的问题。我在优化完后应该还会再写一篇博客来介绍优化的过程和内容。

[^1]: <https://zh.wikipedia.org/wiki/%E4%B8%A4%E5%86%9B%E9%97%AE%E9%A2%98>
[^2]: <https://cs144.github.io/assignments/lab4.pdf>
