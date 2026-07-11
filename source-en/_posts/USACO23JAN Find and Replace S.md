---
title: USACO23JAN Find and Replace S (Luogu P9013) Solution
date: 2023-02-05 21:15:37
updated: 2023-06-16 19:47:08
tags:
- USACO
- USACO Silver
- Graph Theory
- Strings
- 2023
categories:
- Solutions
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments: 
cover: "/img/USACO_logo.png"
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2023/02/USACO23JAN%20Find%20and%20Replace%20S/).
{% endnote %}

[Problem link](https://www.luogu.com.cn/problem/P9013)

[The reading experience is better on the blog](https://ttzytt.com/2023/02/USACO23JAN%20Find%20and%20Replace%20S/)

# Analysis

The statement is very concise: given a series of character replacements, find the minimum number of steps required to turn string $s$ into string $t$.

After receiving the problem, we can first analyze the samples.

From the sample $\texttt{BBC} \to \texttt{ABC}$, we can see that it is impossible to replace one character with two characters at the same time ($\texttt{BB} \to \texttt{AB}$), because this creates a conflict.

Then, can the number of positions where $s_i \ne t_i$ (after deduplicating the strings, so cases such as $s = \texttt{AA}, t = \texttt{BB}$ do not exist) directly be used as the answer? The final sample shows that this is not the case.

## Handling Cycles

Because the $\texttt{CD}$ part in the final sample is the same, let us directly consider the transformation $\texttt{AB} \to \texttt{BA}$. If we directly perform the operation $\texttt{A} \to \texttt{B}$, we obtain a string $\texttt{BB}$. At this point, the same problem as before appears: it cannot be transformed into $\texttt{BA}$. Performing $\texttt{B} \to \texttt{A}$ is analogous.

The solution is to first perform $\texttt{AB} \to x\texttt{B}$ and then process $x\texttt{B} \to \texttt{BA}$ ($x$ is any other character).

Can all mutually dependent cases be solved in this way? Let us consider a larger sample, $\texttt{ABCD} \to \texttt{BCDA}$. It is clearer to represent it as a graph (create an edge $s_i \to t_i$ and remove duplicate edges and self-loops):

{% mermaid %}
graph LR
    A --> B
    B --> C
    C --> D
    D --> A
{% endmermaid %}

This is a cycle. No matter which $x \to y$ transformation we perform first, we will need to perform a $y \to z$ transformation afterward, because $y$ wants to become something else. At this point, the earlier $x$ will also be changed to $z$.

However, the problem can be solved if we can "turn the cycle into a chain." For example, we can first perform $\texttt{A} \to x$, turning the chain into:

{% mermaid %}
graph LR
    x --> B
    B --> C
    C --> D
    D --> A
{% endmermaid %}

Now there is a place where, after executing $x \to y$, we do not need to execute $y \to z$: $\texttt{D} \to \texttt{A}$. (After executing it, $\texttt{C} \to \texttt{D}$ also satisfies this condition, so we can convert the entire string to the target by following the chain backward.)

These two examples show that, **in general, one operation can turn a cycle into a chain, or reduce the length of a chain (the number of edges) by 1.**

So is the answer the number of cycles plus the length of the chains?

## Two Special Cases

### 1

First, turning a cycle into a chain requires a character that does not appear in the cycle. If the cycle contains every character in the character set, we cannot handle it.

Suppose our character set contains only the four characters $\texttt{A} \sim \texttt{D}$. When processing the following example, we encounter a problem:

{% mermaid %}
graph LR
    A --> B
    B --> C
    C --> D
    D --> A
{% endmermaid %}

No matter which character we change $\texttt{A}$ into first, that character will undergo at least one more transformation afterward, preventing $\texttt{A}$ from being transformed into the target character $\texttt{B}$.

Of course, an unprocessable case does not necessarily require the entire graph to contain only one cycle. It is enough that:

1. Every node is in a cycle.
2. Every character in the character set is used.

For example, the following case with two cycles is also impossible (the character set is $\texttt{A} \sim \texttt{C}$):

{% mermaid %}
graph LR
    A --> B
    B --> A
    C --> D
    D --> C
{% endmermaid %}

### 2

Consider the input $\texttt{ABCDEF} \to \texttt{BCDABE}$:

{% mermaid %}

graph LR
    A --> B
    B --> C
    C --> D
    D --> A

    E --> B
    F --> E
{% endmermaid %}

We can turn the cycle into a chain and reduce the chain length by 1 in a single operation. Observe that both $\texttt{A}$ and $\texttt{E}$ want to be transformed into $\texttt{B}$. From the perspective of character transformations, $\texttt{A} \to \texttt{B} \And \texttt{E} \to \texttt{B}$ and $\texttt{A} \to \texttt{E} \And \texttt{E} \to \texttt{B}$ have the same final result and number of steps. However, when executing $\texttt{A} \to \texttt{E}$, the second method also transforms a character in the cycle into a character outside the cycle, turning the cycle into a chain.

The prerequisite for doing this is that multiple characters outside the cycle want to become one character inside the cycle. More precisely, some node in the cycle must have in-degree at least 2.

At this point, all cases have essentially been analyzed, and we can summarize them as follows (the conditions in parentheses are the actual checks):

1. If one character wants to be transformed into multiple characters, there is no solution. (Every node has out-degree at most 1.)
2. If all nodes (all possible characters) are in cycles, there is no solution. (Every character has in-degree 1.)
3. Answer = number of edges + number of absolute cycles (every node in the cycle has both in-degree and out-degree equal to 1).

The check for the second point can be explained slightly. We do not choose to use out-degree because of the case where a cycle is connected to a tree; see the figure above.

# Code Implementation

When implementing this, pay attention to the cycle-finding part; the other parts are relatively simple.

We know that Tarjan's algorithm can detect cycles. However, this problem can use a "simplified version" of Tarjan that does not record discovery timestamps. During DFS, we push every visited node from the back of a deque.

If DFS starts from a node on a cycle, it must eventually visit a node equal to the front of the deque. At this point, popping all nodes between the front and back gives all nodes in the cycle.

If we find that a node was visited previously but is not at the front, we can determine that the nodes in the deque are not an "absolute cycle," because a tree is connected to it (as in the figure above, this happens if the search starts from node F).

```cpp
#include <bits/stdc++.h>
using namespace std;

const int CHSZ = 52;  // Character-set size.
int out[CHSZ + 1];   // The out-degree can only be one.
int lpid[CHSZ + 1];  // Cycle ID: unknown -> -1, not a cycle -> 0, cycle -> 1, 2, 3, ...
enum LP_STAT { UNKNOWN = -1, NOT_ABS_LP = 0 };
deque<int> vised_dq;   // Store information while finding cycles.
bool vised[CHSZ + 1];  // Store information while finding cycles.

set<int> in_nds[CHSZ + 1]; // Incoming nodes; the in-degree can be multiple.
int in1_cnt = 0; // Number of nodes with in-degree 1.

int abs_lp_cnt = 0;  // Number of absolute cycles, namely cycles with no tree attached.
int diff_chs = 0;

void init() {
    memset(out, 0, sizeof(out));
    fill(lpid, lpid + CHSZ + 1, UNKNOWN);
    vised_dq.clear();
    memset(vised, 0, sizeof(vised));
    for (int i = 0; i <= CHSZ; i++) in_nds[i].clear();
    in1_cnt = 0;
    abs_lp_cnt = 0;
    diff_chs = 0;
}

inline int ch2id(char x) {
    // Convert a character to an ID.
    if (x >= 'a' && x <= 'z') return x - 'a' + 1;
    if (x >= 'A' && x <= 'Z') return x - 'A' + 27;
    return -1;
}

bool check_loop_connect_to_tree() {
    for (int cur : vised_dq) 
        if (in_nds[cur].size() >= 2) 
            // A tree is connected to this cycle.
            return true;
    return false;
}

void fill_lpid_in_vised_dq(int val) {
    for (int cur : vised_dq)
        lpid[cur] = val;
    vised_dq.clear();
}

void mark_loop(int cur) {
    if (vised[cur] && vised_dq.front() != cur) {
        // A cycle entered from a tree is not an absolute cycle.
        fill_lpid_in_vised_dq(NOT_ABS_LP);
        return;
    }
    vised[cur] = true;
    if (out[cur] == cur) {
        // No outgoing edge; a chain has been found.
        fill_lpid_in_vised_dq(NOT_ABS_LP);
        return;
    }

    if (vised_dq.size() && vised_dq.front() == cur) {
        // A cycle has been found.
        if (!check_loop_connect_to_tree()) {
            // If no tree is connected to the cycle.
            abs_lp_cnt++;
            fill_lpid_in_vised_dq(abs_lp_cnt);
        } else {
            fill_lpid_in_vised_dq(NOT_ABS_LP);
        }
        return;
    }
    vised_dq.push_back(cur);
    mark_loop(out[cur]);
}

void solve(const string& origs, const string& tars) {
    // Original string -> target string.
    init();
    for (int i = 0; i < origs.size(); i++) {
        int och = ch2id(origs[i]);
        int tch = ch2id(tars[i]);
        if (out[och] && out[och] != tch) {
            // If the original string already has a character to transform,
            // but it is not the target string's character, this creates a many-to-one conflict.
            cout << -1 << '\n';
            return;
        }
        if (!out[och]) {
            out[och] = tch;
            in_nds[tch].insert(och);
            if (och != tch) 
                diff_chs++;
        }
    }
    for (int i = 1; i <= CHSZ; i++) {
        if (in_nds[i].size() == 1) 
            in1_cnt++; // Count nodes with in-degree 1.
    }
    for (int i = 1; i <= CHSZ; i++) {
        if (out[i] && lpid[i] == UNKNOWN) {
            // Mark a cycle.
            vised_dq.clear();
            memset(vised, 0, sizeof(vised));
            mark_loop(i);
        }
    }
    if (origs != tars && in1_cnt == CHSZ) {
        // Determine whether all characters are in cycles by counting nodes with in-degree 1.
        cout << -1 << '\n';
        return;
    }
    cout << diff_chs + abs_lp_cnt << '\n';
}

int main() {
    int t;
    cin >> t;
    while (t--) {
        string origs, tars;
        cin >> origs >> tars;
        solve(origs, tars);
    }
}
```
