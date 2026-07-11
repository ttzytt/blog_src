---
title: CC (Codechef) STARTERS 48 题解
date: 2022-07-20 21:58:10
updated: 2024-04-07 21:02:18
tags:
- Codechef
- 堆
- 树
- 位运算
categories:
- 题解
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
lang: zh-CN
---
# Accurate XOR
## 思路 
[题目链接](https://www.codechef.com/problems-old/TREEXOR)

这个题需要使用到一个异或的性质。我们可以发现，对多个 0 或 1 连续的异或时，只有出现奇数个 1 才能使运算结果为 1。

因为如果出现了偶数个 1，那么对于每一个 1，总是能找到另一个 1 让它们的异或值变为 0 。而 0 的出现不会影响最终的结果，所以如果出现了偶数个 1，最后的结果一定是 0 。

> The Xor-value of a node is defined as the bitwise XOR of all the binary values present in the subtree of that node.

题面中的这一句话表明，一个树的异或值被定义为该树下每个节点的异或和。

或者说，设当前树的根节点为 $r$，$r$ 有 $x$ 个子节点（包括不直接的，比如其子树的孩子），这些子节点的值是 $c_1 \sim c_x$。那么 $r$ 的异或值就是：

$$
\operatorname{XOR}(r) =  c_1 \oplus c_2 \ldots \oplus c_{x - 1} \oplus c_x
$$

因为每个子节点的值要么是 1 要么是 0 。我们根据上面提到的性质就可以知道，如果当前树的异或值为 1，那么其所有子树中，一定有奇数个的值为 1 ，反之亦然。

也就是说如果树 $r$ 的异或值为 1，那么：

$$
\sum_{x=1}^{n}c_x \bmod 2 = 1
$$

题目要求有 $k$ 个子树的异或值为 1。那么我们就可以确定，对于这 $k$ 个子树中的每个子节点，它们的值的和必须是奇数。

我们设 $\text{odcnt}_i$ 为树 $i$ 中有少个值为 1 的子节点，当前树为 $r$，并且现在还需要 $kl$ 个树的异或值为 1（也就是说已经有些树的异或值为 1 了）。

那么如果 $kl > 0$，并且 $\text{odcnt}_r \bmod 2 = 0$，也就是其所有子节点的值为 1 的有偶数个。那么我们应当把这个节点的值设成 1。

这是因为 $kl > 0$，我们还需要更多的树的异或值为 1，而当前这个树，因为其子节点的值为 1 的有偶数个，所以其异或值不是 1 。如果我们把这个树本身的值改为 1，其异或值就变为了 1，达到了我们让更多树的异或值为 1 的目标。

反过来讲，如果 $kl = 0$，我们不需要更多的树的异或值为 1 了，但是 $\text{odcnt}_r \bmod 2 = 1$，也就是其所有子节点的值的和为奇数，那么我们应该把 $r$ 设为 1 。

这是因为我们不想要产生更多异或值为 1 的树了，把 $r$ 设成 1 就可以把其所有节点的值的和变为偶数，$r$ 的异或值也会变为 $0$。

有了这两点结论，就可以使用 dfs 来找到答案了。

## 代码

```cpp
// tzyt
#include <bits/stdc++.h>
using namespace std;
#define ll long long
const int MAXN = 2e5 + 10;
vector<int> e[MAXN];
// k 个奇数大小的子树
int od_cnt[MAXN];
int n, k;

void dfs(int cur, string& ans) {
    for (int nex : e[cur]) {
        dfs(nex, ans);
        od_cnt[cur] += od_cnt[nex];
    }
    if (k) {
        if ((od_cnt[cur] & 1) == 0) {  // 子树里节点为 1 的是偶数个
            // 将其变为奇数个
            ans[cur] = '1';
            od_cnt[cur]++;
        }
        k--;
    } else { // 已经满足条件了，但是可能多一个出来
        if(od_cnt[cur] & 1){ // 子节点里为 1 的是奇数个
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
        fill(od_cnt + 1, od_cnt + 1 + n, 0); // 重置数据

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
## 思路 
[题目链接](https://www.codechef.com/problems-old/STRPERM)

我原来想的是，把每个限制按照位置排序，如果位置一样，就按照值排序。

然后再遍历每个限制，交错的插入每个限制和没被限制的值（根据它们的值，因为题目要求字典序最小）。这里说的估计不清楚，下面是我之前的代码：

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

这么瞎搞会造成一个问题，假设我们把每种限制按照之前说的方法排序，并且设这些限制为 $c_{1 \sim m}$

那么 $c_{i}$ 中的数字只会在 $(c_{i - 1}, c_{i}]$ 这个区间中出现，不符合题目要求。所以才会疯狂 WA。

正确的解法是从后往前的计算。

我们维护一个大根堆 $pq$，然后后往前遍历每个位置（就是题目的排列的位置）。

如果有些限制的位置就是当前遍历到的这个，那么我们就把这些限制的值加入 $pq$。然后对于每个遍历到的位置，就可以直接从 $pq$ 中取出栈顶的元素，放入答案中。

这样，只有当前的位置小于某个限制的位置，我们才可能从 $pq$ 中拿到这个限制的值，因此每个从 $pq$ 中拿到的元素都是合法的。

同时，在满足合法的同时，这些元素还是最大的，那么因为我们是从后往前遍历的，就确保了最后得到的排列字典序是最小的。

最后还需要考虑什么情况下输出 -1。因为 $pq$ 存的是所有这个位置合法的元素，那么如果 $pq$ 中拿不出任何东西了，就说明不能产生一个合法的排列。

最后，还有一点需要注意，对于那些没有任何限制的数字，我们可以在一开始就直接把他们加入 $pq$ 中，或者说这些数字的限制位置就是 $n$。
## 代码

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
        // 默认就是只要 n 前面就行（没有任何限制）
        vector<vector<int>> lislim(n + 1);
        // lislim[i] 储存所有限制位置为 i 的值
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
                // 到了某个限制的点，就会有新的数字可用
                pq.push(cur);
            }
            if (pq.empty()) { // 空的话就是没有合法元素了
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
