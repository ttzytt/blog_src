---
title: "[Stanford CS144] Lab 4 Record"
date: 2023-01-30 00:00:00
updated: 2023-02-02 01:37:53
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

{% note danger simple %}
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2023/01/CS144_lab4_rec/).
{% endnote %}

# Implementing the TCP State-Transition Diagram

The main purpose of Lab 4 is to combine the receiver and sender from the previous labs into a complete TCP protocol stack. Therefore, it is important to become familiar with the TCP state-transition diagram.

Here is a TCP state-transition diagram:

![TCP state-transition diagram <https://www.ibm.com/support/pages/flowchart-tcp-connections-and-their-definition>](/img/CS144/tcp状态流转图.jpg)

## Establishing a TCP Connection

As shown above, TCP has two ways to establish a connection. The first is an active connection, in which a SYN packet is sent to the peer. The second is a passive connection, in which a SYN+ACK packet is sent in response after receiving a SYN packet.

### Active Connection

For an active connection, we need to implement `connect()`:

```cpp
void TCPConnection::connect() {
    _shutted = false;
    _sender.fill_window();
    send_sender_segs();
}
```

The `shutted` variable indicates whether the connection has been closed and is used later in `active()`. We previously implemented `TCPSender::fill_window()`, which records whether the connection has been established and automatically sends a SYN packet if it has not.

However, `TCPSender::fill_window()` only pushes the packets to be sent into its `_segments_out` queue. We need to put these packets into `TCPConnection`'s `_segments_out`, so that Sponge will send them using IP.

Therefore, one purpose of `send_sender_segs()` after `fill_window()` is to move the packets in `_segments_out` into `TCPConnection`'s `_segments_out`.

Of course, `TCPSender` does not know some header information when sending a packet, such as `win` and `ackno`. The former indicates how much data `TCPReceiver` can still receive, while the latter indicates how much data `TCPReceiver` has already received. Therefore, we also need to fill in this information in `send_sender_segs()`.

One relatively tricky part is the range of `win` in the header. The definition in `TCPHeader` is:

```cpp
uint16_t win = 0;           //!< window size
```

This is an unsigned 16-bit integer. However, `TCPReceiver::window_size()` returns a 64-bit integer:

```cpp
size_t TCPReceiver::window_size() const { 
    // Number of bytes that can still be received starting from ackno.
    return _capacity - _reassembler.stream_out().buffer_size();
    // window_size() + buffer_size() = capacity.
}
```

If we directly assign the result of `window_size()` to `win`, overflow may occur, so assign it as follows:

```cpp
seg.header().win = min(_receiver.window_size(), (size_t)numeric_limits<uint16_t>::max());
```

### Passive Connection

Looking again at the state diagram, if the current state is `LISTEN`, then after receiving a SYN and replying with SYN+ACK, the connection is established.

But how do we determine the `LISTEN` state? A convenient method is to use the `TCPState` class provided by Sponge.

It can determine not only the overall state of `TCPConnection`, but also the states of `TCPSender` and `TCPReceiver` separately.

Here, `LISTEN` is an overall state.

In `segment_received()`, we can determine whether to perform a passive connection as follows:

```cpp
bool passive_connect = (state() == TCPState::State::LISTEN && seg.header().syn);
```

If a passive connection is needed, write:

```cpp
    // Passively establish a connection when in the listen state.
    bool passive_connect = (state() == TCPState::State::LISTEN && seg.header().syn);
    // For the receiver: LISTEN.
    // For the sender: CLOSED.

    _receiver.segment_received(seg);  
    // Call segment_received first so that we know which ackno to send.
    if (passive_connect) {
        connect();
        return;
    }
```

At this point, the connection has been established successfully. For every newly arriving packet, we only need to call `_receiver.segment_received()` and `_sender.ack_received()` in `segment_received()` to update the information and maintain the connection (`_sender.ack_received()` lets the sender know what the peer received, so it can retransmit missing data).

## Closing a TCP Connection

Compared with establishing a connection, closing one is more complicated, and a "perfect" close cannot always be guaranteed.

In computer networking, a famous thought experiment describing why TCP cannot close a connection perfectly is the Two Generals' Problem. The description on Wikipedia[^1] is as follows:

> Two armies led by different generals are preparing to attack a fortified city. The armies camp in two valleys near the city. Since another valley separates the two hills, the generals can communicate only by sending messengers through the valley. However, the valley is occupied by the city's guards, who may capture any messenger passing through it.
>
> Although the armies have agreed to attack simultaneously, they have not agreed on an attack time. To attack successfully, both armies must attack at the same time. If only one army attacks, it will be defeated, so the generals must agree on an attack time and **ensure that the other general knows that they agree to the plan**.

> General A first sends a messenger to General B saying, "Attack at 9:00 on August 4." After sending the messenger, General A does not know whether it successfully passed through enemy territory. Worried about becoming the only attacking army, General A may hesitate to attack as planned.
> To remove this uncertainty, General B can send General A a confirmation saying, "I received your message and will attack at 9:00 on August 4," but the messenger carrying the confirmation may also be captured. Worried that General A did not receive the confirmation and will retreat, General B may hesitate to attack as planned.
> Sending another confirmation seems to solve the problem—General A can send a new messenger saying, "I received your confirmation to attack at 9:00 on August 4." But General A's new messenger may also be captured. Clearly, no number of confirmations satisfies the second condition: both parties must ensure that the other has agreed to the plan. The generals will always doubt whether the last messenger they sent successfully crossed enemy territory.

TCP closing has the same problem. After A sends a disconnection message, B can send an ACK packet to indicate that it received the message. However, B does not know whether A received the ACK, and therefore worries about whether A will close normally. A can of course send another ACK, but this falls into the Two Generals' dilemma.

Repeatedly sending confirmations may seem to reduce errors, but the TCP protocol does not reply to an ACK packet (a packet containing no actual data, only an ACK) with another ACK, so we need another solution.

As with connection establishment, we can discuss active and passive closing separately.

### Passive Close

![Passive close](/img/CS144/tcp状态流转图_被动关闭.png)

Compared with active closing, passive closing is relatively simple, so let us discuss it first.

The only difference between passively and actively closing endpoints is the order in which they send FIN packets. An active closer sends a FIN packet after sending all TCP packets produced by its own outgoing byte stream.

Although one side has sent FIN at this point, this does not mean that the connection is closed, because the passive side may still have data to send. After it finishes sending, the passive side also sends FIN and enters the `LAST_ACK` state.

The sole purpose of this state is to wait for the other side to acknowledge FIN. If the active side does not acknowledge it, the passive side must keep sending FIN to ensure that the peer received it.

After receiving the ACK, it can close directly.

### Active Close

![Active close](/img/CS144/tcp状态流转图_主动关闭.png)

When the outgoing byte stream has been completely sent, one endpoint sends FIN and enters `FIN_WAIT_1`. This indicates that one direction of the TCP connection has closed: the current endpoint only receives data and will not send new data. After the peer acknowledges the FIN, the endpoint changes to `FIN_WAIT_2` and waits for the peer to finish sending its data.

After receiving and acknowledging the peer's FIN, the endpoint enters `TIME_WAIT`. This state means:

1. The endpoint has completed reassembling the incoming byte stream, and the incoming byte stream is closed.
2. The outgoing byte stream has been completely sent and acknowledged.

Although, after entering `TIME_WAIT`, we cannot know whether the peer received our acknowledgment of its FIN, if it did not, it will most likely retransmit FIN within a certain time (TCP's timeout retransmission mechanism is implemented by `TCPSender`).

Although the network may be congested, if we wait (linger) for a relatively long time and the peer does not retransmit, it is likely that the peer received the acknowledgment and closed the connection.

The assignment specifies this waiting time:

> it has been at least 10 times the initial retransmission timeout (`cfg.rt_timeout`) since the local peer has received any segments from the remote peer.[^2]

With the default `cfg.rt_timeout`, the total waiting time is at least 10 seconds.

### Implementing Passive Close

Earlier we mentioned that the passive side does not need to wait, or linger. It can be implemented as follows:

```cpp
// In segment_received.

    // The endpoint that sends FIN later (receives FIN first) does not need to linger.
    // This is the transition from ESTABLISHED to CLOSE_WAIT.
    if (TCPState::state_summary(_receiver) == TCPReceiverStateSummary::FIN_RECV &&
        TCPState::state_summary(_sender) == TCPSenderStateSummary::SYN_ACKED) {
        // We cannot directly use state() == CLOSE_WAIT because CLOSE_WAIT also requires linger_after to be false,
        // while we assume lingering first.
        _linger_after_streams_finish = false;
    }
    
    // This is the transition from LAST_ACK to CLOSED.
    if (TCPState::state_summary(_receiver) == TCPReceiverStateSummary::FIN_RECV &&
        TCPState::state_summary(_sender) == TCPSenderStateSummary::FIN_ACKED && !_linger_after_streams_finish) {
        // We cannot use state() == LAST_ACK because that means the sender sent FIN, not that FIN was acknowledged (FIN_ACKED).
        _shutted = true;
        return;
    }
```

### Implementing Active Close

Because `_linger_after_streams_finish` defaults to true, if it was not set to false in the preceding check, we are the active closer.

The only function in `TCPConnection` that can obtain the current time is `tick()`. To implement directly closing the connection after a timeout, add the following to `tick()`:

```cpp

if (state() == TCPState::State::TIME_WAIT && _since_lst_rx_ms >= 10 * _cfg.rt_timeout) {
        _shutted = true;
        _linger_after_streams_finish = false;
    }
```

After adding a great many details, the tests pass. (The assignment's collaboration policy says that the code cannot be made public, so only some code snippets are included here.) The test result is:

```
./tcp_benchmark
CPU-limited throughput                : 0.37 Gbit/s
CPU-limited throughput with reordering: 0.36 Gbit/s
```

To be honest, the speed is still relatively slow. The main reason can also be seen from the earlier flame graph: string copying and processing. After optimizing it, I may write another blog post introducing the optimization process and content.

[^1]: <https://zh.wikipedia.org/wiki/%E4%B8%A4%E5%86%9B%E9%97%AE%E9%A2%98>
[^2]: <https://cs144.github.io/assignments/lab4.pdf>
