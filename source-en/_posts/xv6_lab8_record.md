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

Update (2022/9/14): The lab code is available at <https://github.com/ttzytt/xv6-riscv>; different branches correspond to different labs.

# Lab 8: Networking

Although the lab description is long because it introduces the E1000 NIC, the actual task is simple: implement the E1000 driver's `transmit()` and `recv()` functions. E1000 uses DMA to write packets directly to memory. Both transmission and reception are described by descriptor arrays interpreted as ring queues.

## E1000 Interaction
### Reception

When a packet arrives, the NIC raises an interrupt. A receive descriptor records its buffer address, length, checksum, status, and errors:
```c
struct rx_desc {
  uint64 addr;       /* Address of the descriptor's data buffer */
  uint16 length;     /* Length of data DMAed into data buffer */
  uint16 csum;       /* Packet checksum */
  uint8 status;      /* Descriptor status */
  uint8 errors;      /* Descriptor errors */
  uint16 special;
};
```
The NIC writes to the descriptor at `head` and sets `length` and `status`. The important status is DD (Descriptor Done), meaning the packet has been received. In the receive ring, the software consumes `tail + 1` and advances `tail`; the NIC writes new packets at `head` and advances it.

### Transmission

A transmit descriptor contains:
```c
struct tx_desc {
  uint64 addr;
  uint16 length;
  uint8 cso;
  uint8 cmd;
  uint8 status;
  uint8 css;
  uint16 special;
};
```
`cmd` includes RS (report status) and EOP (end of packet). DD in `status` indicates completion. In the transmit ring, `head` is the oldest pending descriptor and new descriptors are added at `tail`.

### xv6 Network Buffers

`struct mbuf` stores a packet with headroom, buffer, and tailroom:
```c
struct mbuf {
  struct mbuf *next;
  char *head;
  unsigned int len;
  char buf[MBUF_SIZE];
};
```
`mbufpushhdr()` expands the packet into headroom, while `mbufpullhdr()` removes a header. E1000 must transmit from `m->head`, not `m->buf`, because the Ethernet header is inserted into headroom before transmission.

## Implementation
### Transmission

Lock the device, read `E1000_TDT`, and obtain the first free descriptor. If DD is not set, the ring is full. Free the previous `mbuf`, assign the new buffer address and length, set RS|EOP, remember the `mbuf`, advance TDT, and unlock:
```c
int e1000_transmit(struct mbuf *m) {
  acquire(&e1000_lock);
  uint idx = regs[E1000_TDT];
  struct tx_desc *desc = &tx_ring[idx];
  if(!(desc->status & E1000_TXD_STAT_DD)){
    release(&e1000_lock); return -1;
  }
  if(tx_mbufs[idx] != NULL){ mbuffree(tx_mbufs[idx]); tx_mbufs[idx] = NULL; }
  desc->addr = m->head;
  desc->length = m->len;
  desc->cmd = E1000_TXD_CMD_RS | E1000_TXD_CMD_EOP;
  tx_mbufs[idx] = m;
  regs[E1000_TDT] = (idx + 1) % TX_RING_SIZE;
  release(&e1000_lock);
  return 0;
}
```

### Reception

Read every completed descriptor, not just one. Even though xv6 enables an interrupt after every packet, interrupts are disabled while an interrupt handler runs, so several packets may arrive before the handler checks the ring again. Start at `(RDT+1)%RX_RING_SIZE`, check DD, set the received length, pass the buffer to `net_rx()`, allocate a replacement buffer, clear status, and update RDT:
```c
static void e1000_recv(void) {
  while(1){
    uint idx = (regs[E1000_RDT] + 1) % RX_RING_SIZE;
    struct rx_desc *desc = &rx_ring[idx];
    if(!(desc->status & E1000_RXD_STAT_DD)) return;
    rx_mbufs[idx]->len = desc->length;
    net_rx(rx_mbufs[idx]);
    rx_mbufs[idx] = mbufalloc(0);
    desc->addr = rx_mbufs[idx]->head;
    desc->status = 0;
    regs[E1000_RDT] = idx;
  }
}
```

After this, the lab passes:
![](/img/xv6/lab/lab8_AC.png)
