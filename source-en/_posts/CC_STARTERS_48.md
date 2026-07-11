---
title: CC (CodeChef) STARTERS 48 Solutions
date: 2022-07-20 21:58:10
updated: 2024-04-07 21:02:18
tags:
- CodeChef
- Heaps
- Trees
- Bit Manipulation
categories:
- Solutions
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments:
cover: /img/Codechef_logo.png
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
lang: en
---

{% note danger simple %}
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/07/CC_STARTERS_48/).
{% endnote %}

# Accurate XOR
## Approach
[Problem link](https://www.codechef.com/problems-old/TREEXOR)

This problem uses a property of XOR. When XORing multiple consecutive 0s or 1s, only an odd number of 1s makes the result 1.

If there are an even number of 1s, every 1 can always be paired with another 1 so that their XOR becomes 0. The occurrence of 0 does not affect the final result, so if there are an even number of 1s, the final result is always 0.

> The Xor-value of a node is defined as the bitwise XOR of all the binary values present in the subtree of that node.

This sentence in the statement says that the XOR value of a tree is the XOR sum of every node under that tree.

In other words, let the current tree's root be $r$, and let $r$ have $x$ child nodes (including indirect children, such as children in its subtrees), whose values are $c_1 \sim c_x$. Then the XOR value of $r$ is:

$$
\operatorname{XOR}(r) =  c_1 \oplus c_2 \ldots \oplus c_{x - 1} \oplus c_x
$$

Because every child node has a value of either 1 or 0, the property above tells us that if the current tree's XOR value is 1, then an odd number of nodes in all its subtrees have value 1, and vice versa.

That is, if the XOR value of tree $r$ is 1:

$$
\sum_{x=1}^{n}c_x \bmod 2 = 1
$$

The problem requires $k$ subtrees to have an XOR value of 1. Therefore, for every child node in these $k$ subtrees, the sum of their values must be odd.

Let $\text{odcnt}_i$ be the number of child nodes with value 1 in tree $i$. Let the current tree be $r$, and suppose we still need $kl$ trees to have an XOR value of 1 (that is, some trees already have an XOR value of 1).

If $kl > 0$ and $\text{odcnt}_r \bmod 2 = 0$, meaning that an even number of its child nodes have value 1, we should set the value of this node to 1.

This is because $kl > 0$, so we need more trees with XOR value 1. Since this tree has an even number of child nodes with value 1, its XOR value is not 1. Changing the value of the tree itself to 1 changes its XOR value to 1, achieving our goal.

Conversely, if $kl = 0$, we do not need more trees with XOR value 1. However, if $\text{odcnt}_r \bmod 2 = 1$, meaning the sum of the values of all its child nodes is odd, we should set $r$ to 1.

This is because we do not want to produce more trees with XOR value 1. Setting $r$ to 1 makes the sum of the values of all its nodes even, and the XOR value of $r$ becomes $0$.

With these two conclusions, we can use DFS to find the answer.

## Code

```cpp
// tzyt
#include <bits/stdc++.h>
using namespace std;
#define ll long long
const int MAXN = 2e5 + 10;
vector<int> e[MAXN];
// k subtrees of odd size.
int od_cnt[MAXN];
int n, k;

void dfs(int cur, string& ans) {
    for (int nex : e[cur]) {
        dfs(nex, ans);
        od_cnt[cur] += od_cnt[nex];
    }
    if (k) {
        if ((od_cnt[cur] & 1) == 0) {  // An even number of nodes in the subtree have value 1.
            // Change it to an odd number.
            ans[cur] = '1';
            od_cnt[cur]++;
        }
        k--;
    } else { // The condition is already satisfied, but there may be one extra.
        if(od_cnt[cur] & 1){ // An odd number of child nodes have value 1.
            ans[cur] = '1';
            od_cnt[cur]++;
        }
    }
}

int main() {
    int t;
    cin >> t;
    while (t--) {
        
        cin >> n >> k;
        for_each(e + 1, e + 1 + n, [](vector<int>& a) { a.clear(); });
        string ans;
        ans.resize(n + 1);
        for_each(ans.begin(), ans.end(), [](char &a){a = '0';});
        fill(od_cnt + 1, od_cnt + 1 + n, 0); // Reset data.

        for (int i = 2; i <= n; i++) {
            int tmp;
            cin >> tmp;
            e[tmp].push_back(i);
        }

        dfs(1, ans); 
        for (int i = 1; i <= n; i++) {
            cout << ans[i];
        }
        cout << '\n';
    }
}
```

# Strict Permutation
## Approach
[Problem link](https://www.codechef.com/problems-old/STRPERM)

My original idea was to sort every constraint by position, and then by value if the positions were equal.

Then I would traverse every constraint and alternately insert each constraint and each unrestricted value (according to their values, because the problem asks for the lexicographically smallest result). The explanation here is probably unclear; the following was my previous code:

```cpp 
/*Date: 22 - 07-20 20 10
PROBLEM_NUM: */
#define FDEBUG
#if (defined FDEBUG) && (!defined ONLINE_JUDGE)
#define DEBUG(fmt, ...) fprintf(stderr, fmt, ##__VA_ARGS__)
#define DWHILE(cnd, blk) \
    while (cnd) blk
#define DFOR(ini, cnd, itr, blk) \
    for (ini; cnd; itr) blk
#else
#define DEBUG(fmt, ...)
#define DWHILE(cnd, blk)
#define DFOR(ini, cnd, itr, blk)
#endif

#include <bits/stdc++.h>
using namespace std;
#define ll long long
#define pause system("pause")
#define IINF 0x3f3f3f3f
#define rg register
// keywords:

struct Constrain {
    int val, pos;
    bool operator<(Constrain b) const {
        if (pos != b.pos) return pos < b.pos;
        return val < b.val;
    }
    bool operator>(Constrain b) const { return b < *this; }
};

int main() {
    int t;
    cin >> t;
    while (t--) {
        int n, m;
        cin >> n >> m;
        priority_queue<Constrain, vector<Constrain>, greater<Constrain>> pq;
        vector<int> ans;
        ans.reserve(n);
        set<int> ncons;
        for (int i = 1; i <= n; i++) {
            ncons.insert(i);
        }
        for (int i = 0; i < m; i++) {
            Constrain tmp;
            cin >> tmp.val >> tmp.pos;
            pq.push(tmp);
            ncons.erase(tmp.val);
        }
        while (pq.size()) {
            auto tp = pq.top();
            pq.pop();
            bool used = false;
            if (ans.size() >= tp.pos) {
                goto FAIL;
            }
            
            while (ans.size() < tp.pos - 1) {
                int ist = *ncons.begin();
                if (tp.val < ist) {
                    ans.push_back(tp.val);
                    used = true;
                } else {
                    ans.push_back(ist);
                    ncons.erase(ist);
                }
            }
            if (!used) {
                ans.push_back(tp.val);
            }
        }
        while (ncons.size()) {
            int ist = *ncons.begin();
            ans.push_back(ist);
            ncons.erase(ist);
        }

    SUCC:
        for (int cur : ans) {
            cout << cur << ' ';
        }
        cout << '\n';
        continue;
    FAIL:
        cout << "-1\n";
    }
    pause;
}
```

This reckless approach causes a problem. Suppose we sort the constraints as described above and call them $c_{1 \sim m}$.

Then the number in $c_i$ can only appear in the interval $(c_{i - 1}, c_i]$, which does not satisfy the problem's requirements. This is why it received so many WAs.

The correct solution is to calculate from back to front.

We maintain a max-heap $pq$ and traverse every position (the positions in the permutation) from back to front.

If the position of some constraint is the current position, we add the value of that constraint to $pq$. For every position traversed, we can then directly take the top element from $pq$ and put it into the answer.

Therefore, we can take the value of a constraint from $pq$ only when the current position is smaller than the constraint's position, so every element taken from $pq$ is valid.

At the same time, these elements are also the largest possible. Since we traverse from back to front, this ensures that the resulting permutation is lexicographically smallest.

Finally, we need to consider when to output -1. Since $pq$ stores every element that is valid for the current position, if nothing can be taken from $pq$, then no valid permutation can be produced.

One final point: for numbers without any constraints, we can add them to $pq$ at the beginning, or equivalently, their constraint position is $n$.

## Code

```cpp 
// tzyt
#include <bits/stdc++.h>
using namespace std;
// keywords:
int main() {
    int t;
    cin >> t;
    while (t--) {
        int n, m;
        cin >> n >> m;
        vector<int> lim(n + 1, n), ans(n + 1);  
        // By default, only the position before n is required (there is no constraint).
        vector<vector<int>> lislim(n + 1);
        // lislim[i] stores all values whose constraint position is i.
        for (int i = 1; i <= m; i++) {
            int val, pos;
            cin >> val >> pos;
            lim[val] = pos;
        }
        for (int i = 1; i <= n; i++) {
            lislim[lim[i]].push_back(i);
        }
        priority_queue<int> pq;
        for (int i = n; i >= 1; i--) {
            for (int cur : lislim[i]) {
                // Reaching a constraint point makes new numbers available.
                pq.push(cur);
            }
            if (pq.empty()) { // Empty means there is no valid element.
                goto FAIL;
            }
            ans[i] = pq.top();
            pq.pop();
        }
    SUCC:
        for (int i = 1; i <= n; i++) {
            cout << ans[i] << ' ';
        }
        cout << '\n';
        continue;
    FAIL:
        cout << "-1\n";
    }
}
```
