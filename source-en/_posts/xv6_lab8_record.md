---
title: "[MIT 6.s081] xv6 Lab 8: Networking Record"
date: 2022-08-08 00:00:00
updated: 2022-10-15 18:48:35
tags:
- xv6
- 2022
- UNIX
- Operating Systems
- Networking
- Drivers
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/08/xv6_lab8_record/).
{% endnote %}

Update on 2022/9/14: I recently put the lab code on GitHub. If you need a reference, you can find it here:

<https://github.com/ttzytt/xv6-riscv>

The different branches contain the different labs.

---

# Lab 8: Networking

The lab description is extremely long, although much of it introduces the E1000 network card. The final task is actually simple: implement `transmit()` and `recv()` in the E1000 driver.

The code is not complicated, but writing it requires a solid understanding of the hints and consultation of the E1000 documentation.

I will first explain how the processor interacts with the E1000 and then describe the implementation of the two functions.

## Interacting with the E1000

The E1000 uses DMA, or direct memory access, and can write received packets directly into computer memory. This is particularly useful for large volumes of data because memory serves as a buffer.

For transmission, software similarly writes descriptors, discussed below, into specific memory locations. The E1000 finds the data awaiting transmission and sends it itself.

For both receiving and transmission, packets are described by arrays of descriptors. The receive and transmit descriptor layouts are introduced in their respective sections.

### Receiving

When the network card receives data, it generates an interrupt and invokes the corresponding interrupt handler to process the newly arrived packet.

#### Descriptors

The receive descriptor format is:

![](/img/xv6/lab/lab8_recv_desc.png)

In `xv6`, it is defined as:

```c
// [E1000 3.2.3]
struct rx_desc
{
  uint64 addr;       /* Address of the descriptor's data buffer */
  uint16 length;     /* Length of data DMAed into data buffer */
  uint16 csum;       /* Packet checksum */
  uint8 status;      /* Descriptor status */
  uint8 errors;      /* Descriptor Errors */
  uint16 special;
};
```

An array of descriptors is placed in memory and interpreted as a ring queue.

When the card receives a packet, it examines the descriptor at `head` and writes the data to that descriptor's buffer, whose address is stored in `addr`.

The `status` and `length` fields are also important, and the card sets both when writing.

`length` is the size of the packet written at `addr`. `status` represents the following states:

{% pdf /files/xv6/lab/lab8_recv_desc_status.pdf%}

The main flag we need is DD, Descriptor Done, which means the card has completely received the packet.

The driver must inspect this flag. If reception is incomplete, it should wait for some additional time.

#### Ring queue

As described above, the card writes a newly received packet into the buffer of the descriptor at `head`. We now consider how the card and driver manage this buffer.

The following diagram shows the receive-descriptor ring:

![](/img/xv6/lab/lab8_recv_q.png)

During initialization, `head` is zero and `tail` is one less than the queue-buffer size.

The light-colored region from `head` through `tail` is free. The diagram appears slightly inaccurate because the position at `tail` is also free. Software has finished processing every packet in this region. When another packet arrives, the card writes at the beginning of this area, `head`, overwriting old data, and then increments `head`.

Software processes the dark region in order. When reading the ring, it reads the buffer at `tail + 1`, which is the longest-waiting unprocessed packet. After processing the buffer, software increments `tail`.

### Transmission

#### Descriptors

The transmit descriptor format is:

{% pdf /files/xv6/lab/lab8_tran_desc_status.pdf %}

In `xv6`, it is defined as:

```c
// [E1000 3.3.3]
struct tx_desc
{
  uint64 addr;
  uint16 length;
  uint8 cso;       // checksum offset
  uint8 cmd;       // command field
  uint8 status;    // 
  uint8 css;       // checksum start field
  uint16 special;  // 
};
```

`addr` and `length` have the same purposes as in a receive descriptor, so I will not repeat them.

The other fields we mainly use are `cmd` and `status`.

As on receive descriptors, the DD status flag means that transmission of the referenced data has completed.

`cmd` describes settings for transmitting the packet—in other words, commands for the network card.

The available commands are:

{% pdf /files/xv6/lab/lab8_tran_desc_cmd.pdf %}

We need the following commands:

- RPS, Report Packet Sent: after this is set, the card reports transmission status. For example, after sending the data referenced by a descriptor, it sets that descriptor's DD flag.
- EOP, End of Packet: indicates that this descriptor is the end of a packet. A very large packet may occupy buffers from several descriptors. EOP is set on its final descriptor. Only then can certain other features, such as IC checksum insertion, be applied.

#### Ring queue

The transmit-descriptor ring differs slightly from the receive ring. The region from `head` through `tail`, shown in a light color, contains data that software wants to send but the card has not yet transmitted.

![](/img/xv6/lab/lab8_tran_desc_q.png)

`head` points to the longest-waiting pending descriptor, from which the card begins transmission. After finishing, it increments `head`. New descriptors are inserted at the `tail` side, and software increments `tail` as well.

### xv6's representation of network data

To simplify packet handling, xv6 defines `struct mbuf`:

```c
struct mbuf {
  struct mbuf  *next; // the next mbuf in the chain
  char         *head; // the current start position of the buffer
  unsigned int len;   // the length of the buffer
  char         buf[MBUF_SIZE]; // the backing store
};
```

`e1000_transmit()` receives network data in an `mbuf`, writes it to the memory used by DMA, and thereby lets the card transmit it.

The approximate layout of an `mbuf` is:

```c
// The above functions manipulate the size and position of the buffer:
//            <- push            <- trim
//             -> pull            -> put
// [-headroom-][------buffer------][-tailroom-]
// |----------------MBUF_SIZE-----------------|
//
// These marcos automatically typecast and determine the size of header structs.
// In most situations you should use these instead of the raw ops above.
#define mbufpullhdr(mbuf, hdr) (typeof(hdr)*)mbufpull(mbuf, sizeof(hdr))
#define mbufpushhdr(mbuf, hdr) (typeof(hdr)*)mbufpush(mbuf, sizeof(hdr))
#define mbufputhdr(mbuf, hdr) (typeof(hdr)*)mbufput(mbuf, sizeof(hdr))
#define mbuftrimhdr(mbuf, hdr) (typeof(hdr)*)mbuftrim(mbuf, sizeof(hdr))----------------MBUF_SIZE-----------------|
```

Data can be pushed into headroom to store network-protocol headers. After receiving network data, a portion of the central buffer can also be pulled and interpreted as a header structure such as:

```c
// an Ethernet packet header (start of the packet).
struct eth {
  uint8  dhost[ETHADDR_LEN];
  uint8  shost[ETHADDR_LEN];
  uint16 type;
} __attribute__((packed));

```

The conversion appears in `net_rx()`:

```c
struct eth *ethhdr;
uint16 type;

ethhdr = mbufpullhdr(m, *ethhdr);
```

The buffer contains the packet body. Tailroom is whatever remains of `char buf[MBUF_SIZE]` after headroom and the occupied buffer.

Within `struct mbuf`, `len` is the length of the body and `head` marks the end of headroom, or the current beginning of the buffer.

`net.c` contains many mbuf-related functions. The most important are `mbufalloc()` and `mbuffree()`, which allocate and release an mbuf.

### Register operations

Specific memory mappings provide access to the E1000 control registers. More precisely, code adds offsets to the global `regs` variable in `e1000.c`; those offsets are defined in `e1000_dev.h`.

## Implementation and explanation

### Transmission

The overall idea follows the lab hints.

First, read the current ring tail—the first descriptor not currently being transmitted—from the memory-mapped control register, and obtain its descriptor:

```c
acquire(&e1000_lock); // Multiple threads may transmit simultaneously, so acquire the lock
uint idx = regs[E1000_TDT]; // Transmit tail, identifying the first free ring descriptor
struct tx_desc *desc = &tx_ring[idx];
```

Then inspect the descriptor status. If E1000_TXD_STAT_DD is clear, the ring has no free position: tail has reached the light-colored region because the entire queue contains pending transmit descriptors. Return immediately in this case.

```c 
if(!(desc->status & E1000_TXD_STAT_DD)){ // If transmission is incomplete, the ring has no free buffer
  release(&e1000_lock);
  return -1;
}
```

Next, check the mbuf associated with this descriptor. Its `addr` points to the mbuf. If the descriptor's old data has finished transmitting, release that mbuf.

```c
if(tx_mbufs[idx] != NULL){ // This buffer points to the packet being transmitted
  // The preceding check guarantees that transmission has completed.
  // tx_mbufs requires no allocation and points directly to argument m.
  mbuffree(tx_mbufs[idx]);
  tx_mbufs[idx] = NULL;
}
```

After freeing the old buffer, point `addr` at the data currently being sent and update the length:

```c
desc->addr = m->head;
desc->length = m->len;
```

It took me a long time to understand why the assignment is `desc->addr = m->head` rather than `desc->addr = m->buf`.

I initially thought an mbuf's headroom stored the packet header. In fact, the header is stored at the beginning of the central buffer, while headroom is only reserve space. If the current header must be replaced by a larger one, for example, code can call `mbufpullhdr()` and then `mbufpushhdr()`.

An example caller of `e1000_transmit()` shows the purpose of headroom. The only caller in `net.c` is `net_tx_eth()`:

```c
// sends an ethernet packet
static void
net_tx_eth(struct mbuf *m, uint16 ethtype)
{
  struct eth *ethhdr;
  ethhdr = mbufpushhdr(m, *ethhdr); // Notice this line
  memmove(ethhdr->shost, local_mac, ETHADDR_LEN);
  // In a real networking stack, dhost would be set to the address discovered
  // through ARP. Because we don't support enough of the ARP protocol, set it
  // to broadcast instead.
  memmove(ethhdr->dhost, broadcast_mac, ETHADDR_LEN);
  ethhdr->type = htons(ethtype);
  if (e1000_transmit(m)) {
    mbuffree(m);
  }
}
```

This function primarily adds an Ethernet header. `ethhdr = mbufpushhdr(m, *ethhdr);` shrinks headroom and enlarges the buffer, returning the newly added space as `ethhdr`.

The following calls to `memmove(ethhdr->shost, local_mac, ETHADDR_LEN)` and `memmove(ethhdr->dhost, broadcast_mac, ETHADDR_LEN)` copy the header fields into that space carved out of headroom. The mbuf's buffer now includes the packet header.

If a larger header is later required, headroom can again be reduced to enlarge the buffer.

Returning to `e1000_transmit()`, after setting `addr` and `length`, set the descriptor commands:

```c
desc->cmd = E1000_TXD_CMD_RS | E1000_TXD_CMD_EOP;
```

The two commands were explained in the transmit-descriptor section above.

The final code in `e1000_transmit()` is:

```c
tx_mbufs[idx] = m; // Record it for later cleanup

regs[E1000_TDT] = (idx + 1) % TX_RING_SIZE; // Update tail

release(&e1000_lock);
return 0;
```

The main line to explain is `tx_mbufs[idx] = m`. Earlier, the function checked E1000_TXD_STAT_DD to learn whether transmission of this descriptor had finished. If not, it returned. If so, it released the old packet buffer.

Assigning `m` to `tx_mbufs[idx]` records the buffer so the next use of this descriptor can inspect and clean up its transmission state.

The complete `e1000_transmit()` is:

```c
int
e1000_transmit(struct mbuf *m)
{
  acquire(&e1000_lock);
  uint idx = regs[E1000_TDT];
  struct tx_desc *desc = &tx_ring[idx];
  if(!(desc->status & E1000_TXD_STAT_DD)){
    release(&e1000_lock);
    return -1;
  }

  if(tx_mbufs[idx] != NULL){
    mbuffree(tx_mbufs[idx]);
    tx_mbufs[idx] = NULL;
  }

  desc->addr = m->head;
  desc->length = m->len;

  desc->cmd = E1000_TXD_CMD_RS | E1000_TXD_CMD_EOP;
  
  tx_mbufs[idx] = m; 

  regs[E1000_TDT] = (idx + 1) % TX_RING_SIZE;

  release(&e1000_lock);
  return 0;
}
```

### Receiving

One important point is that `e1000_recv()` must read every currently pending packet in one invocation. It therefore needs a loop that repeatedly reads the descriptor at tail until it finds one whose reception is incomplete.

The E1000 supports several interrupt strategies for received packets. A common one is RDTR, the Receive Interrupt Delay Timer. Roughly, after a packet is received and DMA writes it into host memory, a timer begins; the interrupt occurs only after the configured delay.

This strategy reduces interrupt volume when many packets arrive in a short interval. xv6 does not use it, however, and instead generates an interrupt after every write into host memory:

```c
regs[E1000_RDTR] = 0; // interrupt after every received packet (no timer)
regs[E1000_RADV] = 0; // interrupt after every packet (no timer)
```

If every packet produces an interrupt, why not read only one descriptor per interrupt instead of looping at tail?

My understanding is that interrupt delivery is disabled while handling an external-device interrupt.

Suppose many packets arrive quickly. The first interrupt begins handling, but several more interrupts may be generated before that handler finishes. Those later interrupts cannot be received while interrupts are disabled, especially if processing a descriptor is slower than packet arrival.

The handler therefore checks for additional arrived packets every time it runs and continues reading while they exist.

Returning to the implementation, first read tail and obtain its descriptor:

```c
uint idx = (regs[E1000_RDT] + 1) % RX_RING_SIZE; // The region from head through tail is free
struct rx_desc *desc = &rx_ring[idx];
```

Tail itself is a free buffer whose data was processed earlier, so increment tail before selecting the next descriptor.

Use the DD flag to determine whether all pending descriptors have been read:

```c
if(!(desc->status & E1000_RXD_STAT_DD)){
  return;
} 
```

Set the mbuf length from the received descriptor:

```c
rx_mbufs[idx]->len = desc->length;
```

Unlike transmission, each receive descriptor has a permanently associated mbuf. Its `addr` was initialized beforehand. The initialization code allocates the first set of mbufs as follows:

```c
// [E1000 14.4] Receive initialization
memset(rx_ring, 0, sizeof(rx_ring));
  for (i = 0; i < RX_RING_SIZE; i++) {
  rx_mbufs[i] = mbufalloc(0);
  if (!rx_mbufs[i])
      panic("e1000");
  rx_ring[i].addr = (uint64) rx_mbufs[i]->head;
}
```

Then pass the mbuf to `net_rx()` for processing by the appropriate network-protocol stack:

```c
net_rx(rx_mbufs[idx]);
```

The upper protocol layers still need the old mbuf, so it cannot be overwritten. Allocate a fresh mbuf for the current descriptor:

```c
rx_mbufs[idx] = mbufalloc(0);
desc->addr = rx_mbufs[idx]->head;
desc->status = 0;
```

Finally, update tail. Remember that tail itself points to a descriptor already processed by software:

```c
regs[E1000_RDT] = idx;
```

The complete `e1000_recv()` is:

```c
static void
e1000_recv(void)
{
  while(1){
    uint idx = (regs[E1000_RDT] + 1) % RX_RING_SIZE;
    struct rx_desc *desc = &rx_ring[idx];
    if(!(desc->status & E1000_RXD_STAT_DD)){
      return;
    } 
    rx_mbufs[idx]->len = desc->length;
    net_rx(rx_mbufs[idx]);
    rx_mbufs[idx] = mbufalloc(0);
    desc->addr = rx_mbufs[idx]->head;
    desc->status = 0;
    regs[E1000_RDT] = idx;
  }
}
```

After completing these functions, the lab passes:

![](/img/xv6/lab/lab8_AC.png)
