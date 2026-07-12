---
title: "Treap Notes"
date: 2022-06-13 22:56:57
updated: 2022-07-01 00:39:32
tags:
- Data Structures
- Trees
- Balanced Trees
- Treap
categories:
- Study Notes
keywords:
description:
top_img: "linear-gradient(to right, #2c3e50, #4ca1af)"
comments:
cover: /img/treap/rotate.svg
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/06/treap_note/).
{% endnote %}

# Some rambling

I recently discovered how easily I forget algorithms I studied before. Suffix automata, AC automata, plug DP, and many others have almost completely disappeared from memory. Even KMP and network flow become hazy after I have not implemented them for a long time. I am simply not good enough. I therefore thought that I could take notes while learning and read those notes whenever I forget something.

That idea produced this post. Study-note articles will not initially be as detailed as solution articles because they are mainly for my own use. If I have time, I may later write tutorial-style versions.

Update on 2022/6/19: I copied over the article I wrote for OI-Wiki. It now feels detailed enough to serve as a tutorial, although the non-rotating treap section still needs to be added.

Update on 2022/7/1: I copied over the OI-Wiki sections on non-rotating treaps and their interval operations. I wrote almost all of those operations. To see the precise contributors, consult the OI-Wiki GitHub page.

Because of the image colors, I recommend viewing this article with dark mode disabled.

---

# Introduction

A treap, or tree heap, is a **weakly balanced binary search tree**. It simultaneously satisfies binary-search-tree and heap properties, hence the combined name tree plus heap.

The binary-search-tree property is:

- The value, $\textit{val}$, of a left child is greater than the parent.
- The value of a right child is smaller than the parent, although the directions can of course be reversed consistently.

The heap property is:

- A child's $\textit{priority}$ is greater or smaller than the parent's, depending on whether the structure is a min-heap or max-heap.

Using one field for both requirements would make them conflict. A treap therefore adds a separate random $\textit{priority}$ to each search-tree node. The $\textit{val}$ fields satisfy search-tree order, while the priorities satisfy heap order.

The following is an example treap using a min-heap, so the root has the smallest priority.

<div align=center width=70%>
  <img width=70% src="/img/treap/treap.svg" >
</div>

Why go to this trouble and assign random heap values?

First consider the weakness of a plain binary search tree. To insert a node, recursively begin at the root. If the new value is smaller than the current value, recurse left; otherwise recurse right.

When an empty child is found, attach the new node on the corresponding side.

If inserted values arrive in random order, the resulting tree tends to be “wide,” as in the treap diagram above, with many nodes on each level.

Its height is then close to $\log_2 n$, where $n$ is the node count, and a query also takes about $\log_2 n$ recursive levels.

That complexity holds only for suitably random input. Insert the following ordered sequence into a plain search tree:

```
1 2 3 4 5
```
The tree becomes extremely thin because every new node is greater than the preceding nodes and is placed as a right child:

<div align=center width=50%>
  <img width=50% src= "/img/treap/search_tree_chain.svg">
</div>

The search tree has degenerated into a linked list, and query complexity has changed from logarithmic to linear.

Treaps solve exactly this problem. Random priorities and heap maintenance effectively shuffle the insertion order, keeping the search tree near its ideal expected complexity and avoiding a chain.

I do not know a rigorous proof that randomization keeps the **expected** height at $\log_2 n$, but we can understand it intuitively.

A node's priority directly influences its depth. Recall that in a min-heap, a child priority is greater than its parent's. Nodes at shallow levels, especially the root, therefore have smaller priorities.

In a plain search tree, earlier inserted nodes are also more likely to remain shallow. Thinking of priority as a randomized insertion order helps explain how a treap shuffles the original order.

Insertion must preserve both search-tree and heap properties. Two techniques do this: rotations, and split/merge. They give rotating treaps and non-rotating, or split-merge, treaps.

# Rotating Treap

A **rotating treap** maintains balance with rotations similar to those in an AVL tree. Left and right rotations adjust node depths according to heap priority without violating search-tree order.

For ordinary balanced-tree problems, a rotating treap has a relatively small constant factor. Ordered data can defeat a plain BST, but assigning every node a random `rand()` priority prevents adversarial order. Insertions and deletions rotate only when required by those priorities; other operations resemble ordinary BST operations.

Most tree structures can be implemented with pointers or array indices. The following sections explain the pointer implementation in detail.

{% note info %}
In this code, `rank` represents the priority field discussed above. The maintained heap is a min-heap, with smaller priorities above larger ones.
{% endnote %}

## Implementation

This implementation supports the operations from the [Luogu template problem](https://www.luogu.com.cn/problem/P3369). It is intended for contests, so it is not wrapped in generic templates.

The code also refers extensively to [this article](https://article.itxueyuan.com/dRlRJ).

### Node structure

``` cpp
struct Node {
    Node *ch[2];// Addresses of the two children
    int val, rank;
    int rep_cnt;// Number of occurrences of the current value
    int siz;    //
    Node(int val) : val(val), rep_cnt(1), siz(1) {
        ch[0] = ch[1] = nullptr;
        rank = rand();
        // rank is assigned randomly during initialization
    }

    void upd_siz() {
        // Recalculate siz after rotations and deletions
        siz = rep_cnt;
        if (ch[0] != nullptr) siz += ch[0]->siz;
        if (ch[1] != nullptr) siz += ch[1]->siz;
    }
};
```
### Rotation

Rotation is one of the treap's central operations. It changes node depths to restore heap order while preserving the search-tree property.

Left and right rotation can be distinguished by two clear properties:

- Without changing search-tree order, the child opposite the rotation direction becomes the new root. A left rotation raises the right child.
- After rotation, the child on the rotation side is the old root. After a left rotation, the new root's left child is the previous root.

Left and right rotations are inverses, as shown below.

![](/img/treap/rotate.svg)

```cpp
enum rot_type { LF = 1, RT = 0 };
void _rotate(Node *&cur, rot_type dir) {  // dir is the direction: 0 right, 1 left
        // cur is a reference to a pointer, so changing it updates the caller's variable.
        // If cur is another tree's child, following that parent's ch will also reach the new root.
        
        // The following comments describe a left rotation.
        Node *tmp = cur->ch[dir];// Make C the root
                                 // tmp temporarily points to the node that becomes the new root
        
        /* Left rotation: make the right child the root
         *         A                 C
         *        / \               / \
         *       B  C    ---->     A   E
         *         / \            / \
         *        D   E          B   D
         */
        cur->ch[dir] = tmp->ch[!dir];  // Make D the right child of A
        tmp->ch[!dir] = cur;           // Make A the left child of C
        tmp->upd_siz(), cur->upd_siz();// Update size information
        cur = tmp;                     // Assign the temporary C tree to the current root; cur is a reference
    }
```

### Insertion

Insertion follows an ordinary search tree, with rotations added to preserve heap order.

```cpp
void _insert(Node *&cur, int val) {
        if (cur == nullptr) {
            // Create the node when it does not exist
            cur = new Node(val);
            return;
        } else if (val == cur->val) {
            // Increment the repetition count when the value already exists
            cur->rep_cnt++;
            cur->siz++;
        } else if (val < cur->val) {
            // Preserve BST order: smaller values go left and larger values go right
            _insert(cur->ch[0], val);
            if (cur->ch[0]->rank < cur->rank) {
                // The root priority must always be smallest.
                // The new left child has smaller priority, so raise it to the root.
                _rotate(cur, RT); // Raising the left child requires a right rotation
            }
            cur->upd_siz(); // Insertion changes the subtree size
        } else {
            _insert(cur->ch[1], val);
            if (cur->ch[1]->rank < cur->rank) {
                _rotate(cur, LF);
            }
            cur->upd_siz();
        }
    }
```

### Deletion

Deletion uses several cases. Tree size changes after removal and must be updated. If the target has both left and right subtrees, choose which child becomes the parent according to the smaller priority.

```cpp
void _del(Node *&cur, int val) {
        if (val > cur->val) {
            _del(cur->ch[1], val);
            // Larger values are in the right subtree and smaller values in the left
            cur->upd_siz();
        } else if (val < cur->val) {
            _del(cur->ch[0], val);
            cur->upd_siz();
        } else {
            if (cur->rep_cnt > 1) {
                // If the value is repeated, simply reduce its count
                cur->rep_cnt--, cur->siz--;
                return;
            }
            uint8_t state = 0;
            state |= (cur->ch[0] != nullptr);
            state |= ((cur->ch[1] != nullptr) << 1);
            // 00: no children; 01: left only; 10: right only; 11: both
            Node *tmp = cur;
            switch (state) {
                case 0:
                    delete cur;
                    cur = nullptr;
                    // With no children, delete the node directly
                    break;
                case 1:  // Left child but no right child
                    cur = tmp->ch[0];
                    // Make the left child the root and delete the old root.
                    // tmp was copied from cur, while cur itself is a reference.
                    delete tmp;
                    break;
                case 2:  // Right child but no left child
                    cur = tmp->ch[1];
                    delete tmp;
                    break;
                case 3:
                    rot_type dir =
                        cur->ch[0]->rank < cur->ch[1]->rank ? RT : LF;// dir selects the lower-priority child
                    _rotate(cur, dir);  // Raise the child with smaller priority; RT is 0 and LF is 1,
                                        // the reverse of their actual child indices
                    _del(cur->ch[!dir], val);// After rotation, the old root lies on the rotation side,
                                             // so continue deleting that original root.
                                             // A target high in the tree is repeatedly rotated downward
                                             // until it has at most one child and can be removed.
                    cur->upd_siz();
                    // Deletion changes the subtree size
                    break;
            }
        }
    }
```

### Query rank by value

The rank of `val` within the subtree rooted at `cur` is the number of nodes whose values are smaller, plus one.

```cpp
int _query_rank(Node *cur, int val) {
        int less_siz = cur->ch[0] == nullptr ? 0 : cur->ch[0]->siz;
        // Number of nodes in this tree smaller than val
        if (val == cur->val)
            // The current node is the queried value
            return less_siz + 1;
        else if (val < cur->val) {
            if (cur->ch[0] != nullptr)
                return _query_rank(cur->ch[0], val);
            else
                return 1;  // With no left subtree, a smaller query has rank one
        } else {
            if (cur->ch[1] != nullptr)
                // If the query is larger, the left subtree and current node are both smaller.
                // Add their sizes to the rank found recursively in the right subtree.
                return less_siz + cur->rep_cnt + _query_rank(cur->ch[1], val);
            else
                return cur->siz + 1;
                // With no right subtree, return the entire tree size plus one
        }
    }
```

### Query value by rank

To find a value by rank, first decide which part of the tree contains that rank:

| Left subtree | Root/current node | Right subtree |
|---|---|---|
|The rank is at most the left-subtree size.|The rank is greater than the left size and at most the left size plus the root's repetition count.|All other ranks lie in the right subtree.|

When recursing right, convert the original rank into a rank relative to the right subtree by subtracting the left-subtree size and root repetition count.

Imagine the nodes as a sorted array or number line:

```
1 -> |left-subtree nodes|root|right-subtree nodes| -> n
                           ^
                           queried rank
                     convert to a right-subtree-relative rank
1 -> |right-subtree nodes| -> n
       ^
       queried rank
```
The conversion simply subtracts everything preceding the right subtree.

```cpp
int _query_val(Node *cur, int rank) {
        // Query the value of the node at rank
        int less_siz = cur->ch[0] == nullptr ? 0 : cur->ch[0]->siz; 
        // less_siz is the left-subtree size
        if (rank <= less_siz) 
            return _query_val(cur->ch[0], rank);
        else if (rank <= less_siz + cur->rep_cnt)
            return cur->val;
        else
            return _query_val(cur->ch[1], rank - less_siz - cur->rep_cnt);// See the explanation above
    }
```

### Query the first node smaller than val

This implementation uses the class field `q_prev_tmp`.

It is updated only when `val` is greater than the current node. Returning it therefore returns the value from the last node found smaller than `val` before the traversal crosses to greater values.

```cpp
int _query_prev(Node *cur, int val) {
        if (val <= cur->val) {
            // The current value is still at least val, so search left
            if (cur->ch[0] != nullptr) return _query_prev(cur->ch[0], val);
        } else {
            // q_prev_tmp is updated only in this branch
            q_prev_tmp = cur->val;
            // This node is smaller than val, but may not be the largest such node; continue right
            if (cur->ch[1] != nullptr) _query_prev(cur->ch[1], val);
            // Later recursion may not update q_prev_tmp. It therefore remains the cur->val
            // from the final visit to this branch.
            return q_prev_tmp;
        }
        return -1145;
    }
```

### Query the first node greater than val

This is nearly identical to the predecessor query, with comparison directions reversed.

```cpp
int _query_nex(Node *cur, int val) {
        if (val >= cur->val) {
            if (cur->ch[1] != nullptr) return _query_nex(cur->ch[1], val);
        } else {
            q_nex_tmp = cur->val;
            if (cur->ch[0] != nullptr) _query_nex(cur->ch[0], val);
            return q_nex_tmp;
        }
        return -1145;
    }
```
# Non-Rotating Treap

The operations of a non-rotating treap naturally support sequences, persistence, and similar features.

A **non-rotating treap**, also called a split-merge treap or FHQ treap, has only two core operations: **split** and **merge**. Many other operations can be expressed more conveniently through these two primitives.

## Split

### Split by value

The split operation accepts a root pointer $\textit{cur}$ and key $\textit{key}$. It returns two treaps. Every value in the first is at most key, while every value in the second is greater than key.

If `cur->val <= key`, then `cur` and its entire left subtree belong to the first output. Some of its right subtree may also be at most key, so recursively split the right subtree. Attach the smaller returned portion as `cur`'s right child; then every node under `cur` belongs to the first output, and the remaining right portion becomes the second output.

Conversely, if `cur->val > key`, `cur` and its entire right subtree belong to the second output. Recursively split the left subtree, attach the greater returned portion as `cur`'s left child, and return the smaller remainder as the first output.

The diagram shows the `cur->val <= key` case.[^2]

![](/img/treap/treap-none-rot-split-by-val.svg)

```cpp
pair<Node *, Node *> split(Node *cur, int key) {
  if (cur == nullptr) return {nullptr, nullptr};
  if (cur->val <= key) {
    // cur and its left subtree certainly belong to the first result
    auto temp = split(cur->ch[1], key);
    // Part of its right subtree may also be at most key
    cur->ch[1] = temp.first;
    // Attach the at-most-key portion as cur's right subtree, so every node under cur
    // belongs to the first treap; the remaining right portion becomes the second
    cur->upd_siz();
    // Splitting changes subtree sizes
    return {cur, temp.second};
  } else {
    // Symmetric to the case above
    auto temp = split(cur->ch[0], key);
    cur->ch[0] = temp.second;
    cur->upd_siz();
    return {temp.first, cur};
  }
}
```

### Split by rank

This resembles the value-by-rank query from the rotating treap more than value-based splitting.

The function accepts `cur` and rank `rk`, returning three treaps.

Every node in the first has rank below `rk`; the second contains the single node at rank `rk`; the third contains all greater ranks. Equal values are stored through the node's `cnt`, so the middle treap still needs only one node.

The key step is locating rank `rk` relative to `cur`, exactly as in the detailed rotating-treap rank query above. The recursive restructuring also closely resembles value splitting.

```cpp
#define _3 second.second
#define _2 second.first

pair<Node *, pair<Node *, Node *>> split_by_rk(Node *cur, int rk) {
  if (cur == nullptr) return {nullptr, {nullptr, nullptr}};
  int ls_siz = cur->ch[0] == nullptr ? 0 : cur->ch[0]->siz;
  if (rk <= ls_siz) {
    // The node at rank rk lies in the left subtree
    auto temp = split_by_rk(cur->ch[0], rk);
    cur->ch[0] = temp._3;  // Every rank in the third returned treap exceeds rk
    // After assigning temp._3 as the left child, every node under cur has rank above rk
    cur->upd_siz();
    return {temp.first, {temp._2, cur}};
  } else if (rk <= ls_siz + cur->cnt) {
    // The current node itself has rank rk
    Node *lt = cur->ch[0];
    Node *rt = cur->ch[1];
    cur->ch[0] = cur->ch[1] = nullptr;
    // The second treap must contain only one node, so clear its children
    return {lt, {cur, rt}};
  } else {
    // The node at rank rk lies in the right subtree
    // The recursion is symmetric
    auto temp = split_by_rk(cur->ch[1], rk - ls_siz - cur->cnt);
    cur->ch[1] = temp.first;
    cur->upd_siz();
    return {cur, {temp._2, temp._3}};
  }
}
```

## Merge

Merge accepts the root pointers $u$ and $v$ of two treaps, under the precondition that every value in $u$ is at most every value in $v$. Usually both were produced by splitting one treap, so this condition is easy to satisfy.

A rotating treap uses rotations to preserve heap priority without breaking search order. A non-rotating treap obtains the same result through merge.

Since the inputs are already ordered, merge only decides which root goes above the other. Under a min-heap, the smaller priority must be above.

If `u->priority < v->priority`, u becomes the new root. Because every v value is larger, merge v with u's right subtree. Otherwise, v becomes the root and u merges with v's left subtree.

```cpp
Node *merge(Node *u, Node *v) {
  // Each input already satisfies BST order,
  // and every value in u is smaller than every value in v.
  // Merge therefore needs to preserve heap order; this is a min-heap.
  if (u == nullptr && v == nullptr) return nullptr;
  if (u != nullptr && v == nullptr) return u;
  if (v != nullptr && u == nullptr) return v;

  if (u->prio < v->prio) {
    // u has smaller priority and becomes the parent
    u->ch[1] = merge(u->ch[1], v);
    // Since v is greater than u, merge it into u's right subtree
    u->upd_siz();
    return u;
  } else {
    // v has smaller priority and becomes the parent
    v->ch[0] = merge(u, v->ch[0]);
    // Since u is smaller than v, merge it into v's left subtree
    v->upd_siz();
    return v;
  }
}
```

## Insertion

Basic operations on a non-rotating treap can use ordinary BST traversal or split and merge. Split/merge implementations are generally more concise but slightly slower.[^3] All operations below use split and merge to illustrate the technique.

Insertion exploits the fact that splitting by `val` places every value at most `val` in the first treap:

$$
T_1 \le val\\
T_2 > val
$$

Split $T_1$ again by $val-1$:

$$
T_{1\ \text{left}} \le val - 1\\
T_{1\ \text{right}} > val - 1 \ \And \ T_{1\ \text{right}} \le val
$$

The final upper bound follows from the original condition on $T_1$. For integer node values, $T_{1\ \text{right}}$ can contain only value `val`.

If that node exists, increment its count; otherwise create it. Finally merge all pieces in sorted order so the treap remains available for later operations.

```cpp
void insert(int val) {
  auto temp = split(root, val);
  // Split the complete tree by val.
  // The split implementation places values equal to val in the left result.
  auto l_tr = split(temp.first, val - 1);
  // l_tr.first is at most val-1; an equal-to-val node must be in l_tr.second
  Node *new_node;
  if (l_tr.second == nullptr) {
    // Create the node if absent; otherwise increment its repetition count.
    new_node = new Node(val);
  } else {
    l_tr.second->cnt++;
    l_tr.second->upd_siz();
  }
  Node *l_tr_combined =
      merge(l_tr.first, l_tr.second == nullptr ? new_node : l_tr.second);
  // Merge T_1 left and T_1 right
  root = merge(l_tr_combined, temp.second);
  // Merge T_1 and T_2
}
```

## Deletion

Deletion isolates the node equal to `val` through the same two splits. Decrement its count when duplicates remain; otherwise delete the node, then merge the pieces.

```cpp
void del(int val) {
  auto temp = split(root, val);
  auto l_tr = split(temp.first, val - 1);
  if (l_tr.second->cnt > 1) {
    // If the repetition count exceeds one, simply decrement it
    l_tr.second->cnt--;
    l_tr.second->upd_siz();
    l_tr.first = merge(l_tr.first, l_tr.second);
  } else {
    if (temp.first == l_tr.second) {
      // T_1 may contain only this node, so set its pointer to null after deletion
      temp.first = nullptr;
    }
    delete l_tr.second;
    l_tr.second = nullptr;
  }
  root = merge(l_tr.first, temp.second);
}
```

## Query rank by value

Rank is the number of values smaller than the query plus one. Splitting by `val - 1` puts exactly those smaller integer values into the first treap:

$$T_1 \le val - 1$$

```cpp
int qrank_by_val(Node* cur, int val) {
  auto temp = split(cur, val - 1);
  int ret = (temp.first == nullptr ? 0 : temp.first->siz) + 1;  // Add one by definition
  root = merge(temp.first, temp.second);  // Merge the pieces back together
  return ret;
}
```

## Query value by rank

`split_by_rk()` returns three treaps, and the second contains only the node whose rank equals `rk`. Return its value and merge the three pieces again.

```cpp
int qval_by_rank(Node *cur, int rk) {
  auto temp = split_by_rk(cur, rk);
  int ret = temp._2->val;
  root = merge(temp.first, merge(temp._2, temp._3));
  return ret;
}
```

## Query the first node smaller than val

Transform this into finding the largest-ranked node among all values smaller than `val`. Split by `val - 1`, then query the final rank of the first treap.

```cpp
int qprev(int val) {
  auto temp = split(root, val - 1);
  // temp.first contains the values smaller than val
  int ret = qval_by_rank(temp.first, temp.first->siz);
  // Query the largest value among all nodes smaller than val
  root = merge(temp.first, temp.second);
  return ret;
}
```

## Query the first node greater than val

Similarly, split by `val`. Every node in the second treap is greater, so query rank one, its minimum value.

```cpp
int qnex(int val) {
  auto temp = split(root, val);
  int ret = qval_by_rank(temp.second, 1);
  // Query the smallest value among all nodes greater than val
  root = merge(temp.first, temp.second);
  return ret;
}
```

## Build

Note: I did not write this subsection. See the OI-Wiki GitHub page for attribution. I may later add a detailed Cartesian-tree construction explanation.

We want to turn a sequence $\{a_n\}$ of $n$ nodes into a treap.

The straightforward method inserts each node. For a value v, split the existing treap into values at most v and greater than v, create the new node, and merge the three pieces in order. Each insertion costs $O(\log n)$, for $O(n\log n)$ total.

Some problems repeatedly insert an ordered sequence and require $O(n)$ construction.

Method one recursively chooses each interval midpoint as its root and assigns priorities deliberately so the result satisfies heap order. This guarantees $O(\log n)$ height.

Method two also chooses interval midpoints but gives nodes random priorities. The height remains $O(\log n)$ although heap order may not hold initially. This can still be useful because priorities in a non-rotating treap mainly randomize `merge`, rather than being the sole guarantee of height.

Method three observes that a treap is a Cartesian tree and uses its $O(n)$ monotonic-stack construction, maintaining the right spine.

## Interval Operations on a Non-Rotating Treap

### Building the sequence

A major advantage over rotating treaps is support for interval operations. Using the [literary balanced-tree template](https://loj.ac/problem/105), we will implement interval reversal.

> Maintain an ordered sequence and support reversing an interval. For example, reversing $[2,4]$ in $5\ 4\ 3\ 2\ 1$ produces $5\ 2\ 3\ 4\ 1$. Both the initial length and number of reversals are at most $10^5$.

Insert the sequence indices into the treap in order. An inorder traversal—left subtree, current node, right subtree—then reproduces the sequence.[^4]

Inserting increasing values into a plain BST creates a right chain, whose inorder traversal naturally outputs the original increasing sequence.

<div align=center width=50%>
  <img width=50% src="/img/treap/search_tree_chain.svg" >
</div>

In a treap, merge also adjusts the structure according to priority. Why does inorder traversal still preserve the sequence?

The [monotonic-stack construction of a Cartesian tree](https://oi-wiki.org/ds/cartesian-tree/) provides an intuitive explanation.

Let the newly inserted node be u. Because values are inserted increasingly, every new node joins the right spine, the chain obtained by repeatedly taking right children from the root.

Priorities along that spine increase under the min-heap rule. Find the first node v on the spine whose priority exceeds u's and replace that position with u.

u is greater than every previous value, so v and its subtree become u's left subtree; u initially has no right subtree.

u is necessarily visited last in inorder traversal because it is the final node on the right spine. Thus, insertion order remains the traversal order.

The diagram shows insertion of node 5 after inserting nodes 1 through 4:

![](/img/treap/treap-none-rot-seg-build.svg)

### Interval reversal

To reverse $[l,r]$, split the tree into $[1,l-1]$, $[l,r]$, and $[r+1,n]$, then reverse the middle treap.[^4]

Reversal swaps every left and right child inside that subtree. The following diagram shows reversals of $[3,4]$ and $[3,5]$ in the preceding treap:

![](/img/treap/treap-none-rot-seg-flip-ex.svg)

Swapping every node immediately would require $r-l$ changes per reversal. With up to $10^5$ operations, this is too slow; combined with locating the interval in $O(\log n)$, it is no better than brute force.

The problem asks only for the final sequence, so exchanges need not happen immediately. Use the lazy-tag technique familiar from segment trees. Mark the subtree root to mean that all descendant left and right children must eventually be exchanged.

Segment trees push lazy tags during updates and queries because the requested range may not match the tagged range. Pushing ensures queried or updated values are correct.

The same applies here. Split into three trees, mark the middle, and merge them again. Because the next split range may not match a pending reversal, push tags before changing child links during split. Merge also changes child relationships, so push before merging.

Put another way, whenever split or merge is about to change a node's children, propagate its tag **before**, not after, the modification. Otherwise the original children that should receive the tag have already been replaced and the target of propagation is lost.[^5]

<!-- TODO: add a diagram explaining why split and merge must push tags -->

The following code refers to [^4]. Only differences from an ordinary non-rotating treap are discussed.

### Push down tags

The lazy flag means every child pair in this subtree needs to be exchanged. If a child already has the flag, a second reversal cancels the first. Otherwise, toggle the flag on that child.

```cpp
// pushdown is a Node member function, and to_rev is the lazy flag
inline void pushdown() {
  swap(ch[0], ch[1]);
  if (ch[0] != nullptr) ch[0]->to_rev ^= 1;
  if (ch[1] != nullptr) ch[1]->to_rev ^= 1;
  to_rev = false;
}

inline void check_tag() {
  if (to_rev) pushdown();
}
```

### Split

After reversals, node `val` no longer satisfies BST order, as shown in the reversal diagram. We cannot use it to choose a recursion direction.

This split therefore resembles rank splitting and uses subtree sizes, or the node's original position in the sequence. Every node in the first result has position at most `sz`, and every node in the second has a greater position.

```cpp
#define siz(_) (_ == nullptr ? 0 : _->siz)

pair<Node*, Node*> split(Node* cur, int sz) {
  // Split according to subtree size
  if (cur == nullptr) return {nullptr, nullptr};
  cur->check_tag();
  // Push tags before splitting
  if (sz <= siz(cur->ch[0])) {
    auto temp = split(cur->ch[0], sz);
    cur->ch[0] = temp.second;
    cur->upd_siz();
    return {temp.first, cur};
  } else {
    auto temp = split(cur->ch[1],
                      sz - siz(cur->ch[0]) -
                          1);  // This rank conversion is explained in the rotating-treap query
    cur->ch[1] = temp.first;
    cur->upd_siz();
    return {cur, temp.second};
  }
}
```

### Merge

The only new requirement is to push lazy tags before merging.

```cpp
Node *merge(Node *sm, Node *bg) {
  // small, big
  if (sm == nullptr && bg == nullptr) return nullptr;
  if (sm != nullptr && bg == nullptr) return sm;
  if (sm == nullptr && bg != nullptr) return bg;
  sm->check_tag(), bg->check_tag();
  if (sm->prio < bg->prio) {
    sm->ch[1] = merge(sm->ch[1], bg);
    sm->upd_siz();
    return sm;
  } else {
    bg->ch[0] = merge(sm, bg->ch[0]);
    bg->upd_siz();
    return bg;
  }
}
```

### Reverse an interval

Split out $[1,l-1]$, $[l,r]$, and $[r+1,n]$, toggle the middle tag, and merge the pieces.

```cpp
void seg_rev(int l, int r) {
  // less and more are named relative to l
  auto less = split(root, l - 1);
  // Positions at most l-1 are in less.first
  auto more = split(less.second, r - l + 1);
  // The first r-l+1 elements beginning at l
  more.first->to_rev = true;
  root = merge(less.first, merge(more.first, more.second));
}
```

### Print with inorder traversal

Remember to push pending tags before printing.

```cpp
void print(Node* cur) {
  if (cur == nullptr) return;
  cur->check_tag();
  // Inorder traversal: left subtree, current node, right subtree
  print(cur->ch[0]);
  cout << cur->val << " ";
  print(cur->ch[1]);
}
```

# Complete Code

{% tabs Complete Code %}

<!-- tab Rotating—commented -->
```cpp
/*Date: 22 - 06-11 23 29
PROBLEM_NUM: P3369 [Template] Ordinary Balanced Tree*/
#include <bits/stdc++.h>
using namespace std;
#define pause system("pause")

struct Node {
    Node *ch[2];
    int val, rank;
    int rep_cnt;
    int siz;
    Node(int val) : val(val), rep_cnt(1), siz(1) {
        ch[0] = ch[1] = nullptr;
        rank = rand();
    }

    void upd_siz() {
        siz = rep_cnt;
        if (ch[0] != nullptr) siz += ch[0]->siz;
        if (ch[1] != nullptr) siz += ch[1]->siz;
    }
};

class Treap {
   private:
    Node *root;
    enum rot_type { LF = 1, RT = 0 };
    int q_prev_tmp = 0, q_nex_tmp = 0;
    void _rotate(Node *&cur, rot_type dir) {  // 0 for right rotation, 1 for left rotation
        Node *tmp = cur->ch[dir];
        // tmp points to the node that becomes the new root, the right child for a left rotation
        // Make C the root
        /* Left rotation: make the right child the root
         *         A                 C
         *        / \               / \
         *       B  C    ---->     A   E
         *         / \            / \
         *        D   E          B   D
         */
        cur->ch[dir] = tmp->ch[!dir];
        // Make D the right child of A
        tmp->ch[!dir] = cur;
        // Make A the left child of C

        tmp->upd_siz(), cur->upd_siz();
        cur = tmp;
    }

    void _insert(Node *&cur, int val) {
        if (cur == nullptr) {
            cur = new Node(val);
            return;
        } else if (val == cur->val) {
            cur->rep_cnt++;
            cur->siz++;
        } else if (val < cur->val) {
            _insert(cur->ch[0], val);
            if (cur->ch[0]->rank < cur->rank) {
                // The root priority must always be smallest.
                // Raise the left child to the root.
                _rotate(cur, RT);
            }
            cur->upd_siz();
        } else {
            _insert(cur->ch[1], val);
            if (cur->ch[1]->rank < cur->rank) {
                _rotate(cur, LF);
            }
            cur->upd_siz();
        }
    }

    void _del(Node *&cur, int val) {
        if (val > cur->val) {
            _del(cur->ch[1], val);
            cur->upd_siz();
        } else if (val < cur->val) {
            _del(cur->ch[0], val);
            cur->upd_siz();
        } else {
            if (cur->rep_cnt > 1) {
                cur->rep_cnt--, cur->siz--;
                return;
            }
            uint8_t state = 0;
            state |= (cur->ch[0] != nullptr);
            state |= ((cur->ch[1] != nullptr) << 1);
            // 00: no children; 01: left only; 10: right only; 11: both
            Node *tmp = cur;
            switch (state) {
                case 0:
                    delete cur;
                    cur = nullptr;
                    break;
                case 1:  // Left child but no right child
                    cur = tmp->ch[0];
                    // Make the left child the root
                    delete tmp;
                    break;
                case 2:  // Right child but no left child
                    cur = tmp->ch[1];
                    delete tmp;
                    break;
                case 3:
                    rot_type dir =
                        cur->ch[0]->rank < cur->ch[1]->rank ? RT : LF;
                    // dir selects the child with smaller priority
                    _rotate(cur, dir);  // Raise the child with smaller priority
                    // After rotation, the old root lies on the rotation side
                    _del(cur->ch[!dir], val);
                    cur->upd_siz();
                    break;
            }
        }
    }

    int _query_rank(Node *cur, int val) {
        // Query the rank of val in the subtree rooted at cur:
        // the number of nodes smaller than val plus one
        int less_siz = cur->ch[0] == nullptr ? 0 : cur->ch[0]->siz;
        // Number of nodes in this tree smaller than val
        if (val == cur->val)
            return less_siz + 1;
        else if (val < cur->val) {
            if (cur->ch[0] != nullptr)
                return _query_rank(cur->ch[0], val);
            else
                return 1;  // A value below the minimum has rank one
        } else {
            if (cur->ch[1] != nullptr)
                return less_siz + cur->rep_cnt + _query_rank(cur->ch[1], val);
            else
                return cur->siz + 1;
        }
    }

    int _query_val(Node *cur, int rank) {
        // Query the value at rank
        DEBUG("qval: %d\n", cur->val);
        int less_siz = cur->ch[0] == nullptr ? 0 : cur->ch[0]->siz;
        if (rank <= less_siz)
            return _query_val(cur->ch[0], rank);
        else if (rank <= less_siz + cur->rep_cnt)
            return cur->val;
        else
            return _query_val(cur->ch[1], rank - less_siz - cur->rep_cnt);
    }

    int _query_prev(Node *cur, int val) {
        // Find the largest node smaller than val
        if (val <= cur->val) {
            if (cur->ch[0] != nullptr) return _query_prev(cur->ch[0], val);
        } else {
            q_prev_tmp = cur->val;
            // The current node is smaller than val, but may not be the largest,
            // so continue searching the right subtree
            if (cur->ch[1] != nullptr) _query_prev(cur->ch[1], val);
            return q_prev_tmp;
        }
        return -1145;
    }

    int _query_nex(Node *cur, int val) {
        // Find the smallest node greater than val
        if (val >= cur->val) {
            if (cur->ch[1] != nullptr) return _query_nex(cur->ch[1], val);
        } else {
            q_nex_tmp = cur->val;
            if (cur->ch[0] != nullptr) _query_nex(cur->ch[0], val);
            return q_nex_tmp;
        }
        return -1145;
    }

   public:
    void insert(int val) { _insert(root, val); }
    void del(int val) { _del(root, val); }
    int query_rank(int val) { return _query_rank(root, val); }
    int query_val(int rank) { return _query_val(root, rank); }
    int query_prev(int val) { return _query_prev(root, val); }
    int query_nex(int val) { return _query_nex(root, val); }
};

Treap tr;

int main() {
    srand(0);
    int t;
    scanf("%d", &t);
    while (t--) {
        int mode;
        int num;
        scanf("%d%d", &mode, &num);
        switch (mode) {
            case 1:
                tr.insert(num);
                break;
            case 2:
                tr.del(num);
                break;
            case 3:
                printf("%d\n", tr.query_rank(num));
                break;
            case 4:
                printf("%d\n", tr.query_val(num));
                break;
            case 5:
                printf("%d\n", tr.query_prev(num));
                break;
            case 6:
                printf("%d\n", tr.query_nex(num));
                break;
        }
    }
    pause;
}
```
<!-- endtab -->

<!-- tab Rotating—array -->
```cpp
#include <bits/stdc++.h>
using namespace std;
struct Node {
    Node *ch[2];
    int val, rank;
    int rep_cnt;
    int siz;
    Node(int val) : val(val), rep_cnt(1), siz(1) {
        ch[0] = ch[1] = nullptr;
        rank = rand();
    }

    void upd_siz() {
        siz = rep_cnt;
        if (ch[0] != nullptr) siz += ch[0]->siz;
        if (ch[1] != nullptr) siz += ch[1]->siz;
    }
};

class Treap {
private:
    Node *root;
    enum rot_type { LF = 1, RT = 0 };
    int q_prev_tmp = 0, q_nex_tmp = 0;
    void _rotate(Node *&cur, rot_type dir) {  // 0 for right rotation, 1 for left rotation
        Node *tmp = cur->ch[dir];
        cur->ch[dir] = tmp->ch[!dir];
        tmp->ch[!dir] = cur;
        tmp->upd_siz(), cur->upd_siz();
        cur = tmp;
    }

    void _insert(Node *&cur, int val) {
        if (cur == nullptr) {
            cur = new Node(val);
            return;
        } else if (val == cur->val) {
            cur->rep_cnt++;
            cur->siz++;
        } else if (val < cur->val) {
            _insert(cur->ch[0], val);
            if (cur->ch[0]->rank < cur->rank) {
                _rotate(cur, RT);
            }
            cur->upd_siz();
        } else {
            _insert(cur->ch[1], val);
            if (cur->ch[1]->rank < cur->rank) {
                _rotate(cur, LF);
            }
            cur->upd_siz();
        }
    }

    void _del(Node *&cur, int val) {
        if (val > cur->val) {
            _del(cur->ch[1], val);
            cur->upd_siz();
        } else if (val < cur->val) {
            _del(cur->ch[0], val);
            cur->upd_siz();
        } else {
            if (cur->rep_cnt > 1) {
                cur->rep_cnt--, cur->siz--;
                return;
            }
            uint8_t state = 0;
            state |= (cur->ch[0] != nullptr);
            state |= ((cur->ch[1] != nullptr) << 1);
            // 00: no children; 01: left only; 10: right only; 11: both
            Node *tmp = cur;
            switch (state) {
                case 0:
                    delete cur;
                    cur = nullptr;
                    break;
                case 1:  // Left child but no right child
                    cur = tmp->ch[0];
                    delete tmp;
                    break;
                case 2:  // Right child but no left child
                    cur = tmp->ch[1];
                    delete tmp;
                    break;
                case 3:
                    rot_type dir =
                        cur->ch[0]->rank < cur->ch[1]->rank ? RT : LF;
                    _rotate(cur, dir);
                    _del(cur->ch[!dir], val);
                    cur->upd_siz();
                    break;
            }
        }
    }

    int _query_rank(Node *cur, int val) {
        int less_siz = cur->ch[0] == nullptr ? 0 : cur->ch[0]->siz;
        if (val == cur->val)
            return less_siz + 1;
        else if (val < cur->val) {
            if (cur->ch[0] != nullptr)
                return _query_rank(cur->ch[0], val);
            else
                return 1;
        } else {
            if (cur->ch[1] != nullptr)
                return less_siz + cur->rep_cnt + _query_rank(cur->ch[1], val);
            else
                return cur->siz + 1;
        }
    }

    int _query_val(Node *cur, int rank) {
        int less_siz = cur->ch[0] == nullptr ? 0 : cur->ch[0]->siz;
        if (rank <= less_siz)
            return _query_val(cur->ch[0], rank);
        else if (rank <= less_siz + cur->rep_cnt)
            return cur->val;
        else
            return _query_val(cur->ch[1], rank - less_siz - cur->rep_cnt);
    }

    int _query_prev(Node *cur, int val) {
        if (val <= cur->val) {
            if (cur->ch[0] != nullptr) return _query_prev(cur->ch[0], val);
        } else {
            q_prev_tmp = cur->val;
            if (cur->ch[1] != nullptr) _query_prev(cur->ch[1], val);
            return q_prev_tmp;
        }
        return -1145;
    }

    int _query_nex(Node *cur, int val) {
        if (val >= cur->val) {
            if (cur->ch[1] != nullptr) return _query_nex(cur->ch[1], val);
        } else {
            q_nex_tmp = cur->val;
            if (cur->ch[0] != nullptr) _query_nex(cur->ch[0], val);
            return q_nex_tmp;
        }
        return -1145;
    }

public:
    void insert(int val) { _insert(root, val); }
    void del(int val) { _del(root, val); }
    int query_rank(int val) { return _query_rank(root, val); }
    int query_val(int rank) { return _query_val(root, rank); }
    int query_prev(int val) { return _query_prev(root, val); }
    int query_nex(int val) { return _query_nex(root, val); }
};

Treap tr;

int main() {
    srand(0);
    int t;
    scanf("%d", &t);
    while (t--) {
        int mode;
        int num;
        scanf("%d%d", &mode, &num);
        switch (mode) {
            case 1:
                tr.insert(num);
                break;
            case 2:
                tr.del(num);
                break;
            case 3:
                printf("%d\n", tr.query_rank(num));
                break;
            case 4:
                printf("%d\n", tr.query_val(num));
                break;
            case 5:
                printf("%d\n", tr.query_prev(num));
                break;
            case 6:
                printf("%d\n", tr.query_nex(num));
                break;
        }
    }
}
```
<!-- endtab -->

<!-- tab Non-rotating interval treap -->
```cpp
// author: (ttzytt)[ttzytt.com]
#include <bits/stdc++.h>
using namespace std;

// Reference: https://www.cnblogs.com/Equinox-Flower/p/10785292.html
struct Node {
    Node* ch[2];
    int val, prio;
    int cnt;
    int siz;
    bool to_rev = false;  // Every node under this subtree needs to be reversed

    Node(int _val) : val(_val), cnt(1), siz(1) {
    ch[0] = ch[1] = nullptr;
    prio = rand();
    }

    inline int upd_siz() {
    siz = cnt;
    if (ch[0] != nullptr) siz += ch[0]->siz;
    if (ch[1] != nullptr) siz += ch[1]->siz;
    return siz;
    }

    inline void pushdown() {
    swap(ch[0], ch[1]);
    if (ch[0] != nullptr) ch[0]->to_rev ^= 1;
    // If a child was already marked, two reversals cancel. Otherwise,
    // push the reversal tag to that child.
    if (ch[1] != nullptr) ch[1]->to_rev ^= 1;
    to_rev = false;
    }

    inline void check_tag() {
    if (to_rev) pushdown();
    }
};

struct Seg_treap {
    Node* root;
#define siz(_) (_ == nullptr ? 0 : _->siz)

    pair<Node*, Node*> split(Node* cur, int sz) {
    // Split according to subtree size
    if (cur == nullptr) return {nullptr, nullptr};
    cur->check_tag();
    if (sz <= siz(cur->ch[0])) {
        // The left subtree alone contains enough nodes
        auto temp = split(cur->ch[0], sz);
        // Not all of the left subtree is needed; temp.second is excluded
        cur->ch[0] = temp.second;
        cur->upd_siz();
        return {temp.first, cur};
    } else {
        // Use the left subtree, current node, and part of the right subtree
        auto temp = split(cur->ch[1], sz - siz(cur->ch[0]) - 1);
        cur->ch[1] = temp.first;
        cur->upd_siz();
        return {cur, temp.second};
    }
    }

    Node* merge(Node* sm, Node* bg) {
    // small, big
    if (sm == nullptr && bg == nullptr) return nullptr;
    if (sm != nullptr && bg == nullptr) return sm;
    if (sm == nullptr && bg != nullptr) return bg;
    sm->check_tag(), bg->check_tag();
    if (sm->prio < bg->prio) {
        sm->ch[1] = merge(sm->ch[1], bg);
        sm->upd_siz();
        return sm;
    } else {
        bg->ch[0] = merge(sm, bg->ch[0]);
        bg->upd_siz();
        return bg;
    }
    }

    void insert(int val) {
    auto temp = split(root, val);
    auto l_tr = split(temp.first, val - 1);
    Node* new_node;
    if (l_tr.second == nullptr) new_node = new Node(val);
    Node* l_tr_combined =
        merge(l_tr.first, l_tr.second == nullptr ? new_node : l_tr.second);
    root = merge(l_tr_combined, temp.second);
    }

    void seg_rev(int l, int r) {
    // less and more are named relative to l
    auto less = split(root, l - 1);
    // Every position at most l-1 is in less.first
    auto more = split(less.second, r - l + 1);
    // Extract the first r-l+1 elements beginning at l
    more.first->to_rev = true;
    root = merge(less.first, merge(more.first, more.second));
    }

    void print(Node* cur) {
    if (cur == nullptr) return;
    cur->check_tag();
    print(cur->ch[0]);
    cout << cur->val << " ";
    print(cur->ch[1]);
    }
};

Seg_treap tr;

int main() {
    srand(time(0));
    int n, m;
    cin >> n >> m;
    for (int i = 1; i <= n; i++) tr.insert(i);
    while (m--) {
    int l, r;
    cin >> l >> r;
    tr.seg_rev(l, r);
    }
    tr.print(tr.root);
}

```

<!-- endtab -->

{% endtabs %}

[^2]: The design of this diagram refers to the illustration in the [Wikipedia treap article](https://en.wikipedia.org/wiki/Treap).

[^3]: <https://charleswu.site/archives/1051>

[^4]: <https://www.cnblogs.com/Equinox-Flower/p/10785292.html>

[^5]: <https://www.luogu.com.cn/blog/85514/fhq-treap-xue-xi-bi-ji>
