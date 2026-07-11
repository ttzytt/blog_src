---
title: 《复杂》中遗传算法的 C++ 实现
date: 2022-06-30 00:00:00
updated: 2022-07-10 00:00:00
tags:
- 遗传算法
- 2022
- 《复杂》
categories:
- 实验记录
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments:
cover: /img/遗传算法_复杂/crossover.jpg
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
# 背景
大概一年多之前看了《复杂》这本书，最近因为一个比赛又想起了书里面介绍过的遗传算法，书里提供了详细的思路，所以想自己实现以下。

关于《复杂》这本书：不过多介绍内容，看完了只感觉非常牛逼，下面的介绍摘自豆瓣，自己加了一些标点符号：
>蚂蚁在组成群体时为何会表现出如此的精密性和具有目的性？数以亿计的神经元是如何产生出像意识这样极度复杂的事物？是什么在引导免疫系统、互联网、全球经济和人类基因组等自组织结构？这些都是复杂系统科学尝试回答的迷人而令人费解的问题的一部分。

>理解复杂系统需要有全新的方法。需要超越传统的科学还原论，并重新划定学科的疆域。借助于圣塔菲研究所的工作经历和交叉学科方法，复杂系统的前沿科学家米歇尔以清晰的思路介绍了复杂系统的研究，横跨生物、技术和社会学等领域，并探寻复杂系统的普遍规律，与此同时，她还探讨了复杂性与进化、人工智能、计算、遗传、信息处理等领域的关系。

书中讲的问题大概是这样的：

有一个机器人罗比，它生活在一个 $10\times 10$ 的网格中。这个网格中散落着许多易拉罐，罗比需要在有限的动作中收集尽可能多的易拉罐。罗比的初始位置在 $(0, 0)$ 它只能看到自己周围的四个格子，和自己所在的格子的情况，每个格子一共有三种可能，有易拉罐，无易拉罐，和墙。罗比能做的动作有七种：向四个不同方向移动，随机移动，捡起罐子，和不动。

![网格示意图](/img/遗传算法_复杂/robin_grid.png)

# 思路
## 基因编码规则
首先需要确定我们想要进化的是什么，因为罗比只能看到周围的格子，然后根据这个几个格子的情况做出动作，所以这就是我们想进化的策略。我们可以把不同的策略表示成一个字符串的形式，它的长度为 $3^5$ 的，包含从 $0 \sim 6$ 的数字。其中 $0 \sim 6$ 表示的是七种不同的动作，而这个长为 $3^5 (243)$ 的字符串中的每一个位置代表了罗比看到的不同的情形。其中，$3^5$ 中的 $3$ 代表的是三种不同的格子，$5$ 就是罗比能看到的格子的数量。

这个字符串就代表了一个情形到动作的映射，每次罗比看到周围五个格子后可以检查这个映射，然后做出动作。而我们要进化的就是这个字符串，或者说，基因。

不过呢，在实际实现的时候，我用了一个 `map` 来实现这个映射，~~绝对不是我懒得写字符串的这些处理~~。

## 适应度
适应度是我们用来衡量不同策略好坏的，在遗传算法中，合理的适应度可以加速进化的过程。书中给出的适应度的计算方法是这样的：

| 捡到一个罐子 | 撞墙 | 没有罐子却做了捡罐子的动作 |
| ------------ | ---- | -------------------------- |
| $+10$        | $-5$ | $-1$                       |

## 进化过程
首先需要随机的生成一个初始群体，书中给出的是 $200$ 个个体。

然后计算群体中每一个个体的适应度，根据适应度（适应度越高的越容易被选中）让两个不同的基因“繁殖”。为了这个策略的适用性，这里的适应度会随机出很多个地图，然后在每个地图中都计算适应度，最后去平均。

产生下一代。“繁殖” 的实现参考了生物学中的染色体交换（chromosomal crossover），大概是下图的样子：

<div align=center width=40%>
  <img width=40% src="/img/遗传算法_复杂/crossover.jpg" >
</div>


也就是说随机的选择一个中间点，子代基因的前半部分来自一个父代，后半部分的来自另外一个。此外，还可以在染色体交叉的过程中引入变异，让子代的基因有一定概率发生变化，这也是为了给我们的基因池引入更多的变化。

# 具体实现
## 定义的一些常量

```cpp
const int MAP_SIZ = 10;      //地图大小
const float CAN_RATE = 0.5;  //是罐子的概率
//地图设置

const int SUC_CLCT_PT = 10;  //成功捡起罐子的适应度变化
const int ERR_CLCT_PT = -1;  //没有罐子却做了捡罐子的动作
const int HIT_WALL_PT = -5;  //撞墙
//适应度设置

const int MOV_LIM = 200;       //一共能做多少动作
const int POP_CNT = 500;       //群体数量
const int GEN_CNT = 1000;      //代数
const float MUT_RATE = 0.005;  //每一个位点的变异概率
const int MAP_REP = 50;        //计算适应度时用多少个地图
//演化的一些设置

enum GRD_DIR { DIRNONE = -1, CUR, UP, DN, RT, LF }; // 不同的方向
const int DIR_CNT = 5;

enum GRD_OBJ { OBJNONE = -1, EPT, WAL, CAN }; // 不同类型的格子
const int OBJ_CNT = 3;

enum ACTION {
    // 罗比的不同动作
    ACTNONE = -1,
    MV_UP,
    MV_DN,
    MV_RT,
    MV_LF,
    MV_RND,
    CLCT_CAN,
    HALT
};
const int ACTION_CNT = 7;
```

## 定义的几个类
### Obj_in_dir

`Obj_in_dir` 定义了一个格子相对于罗比的方向和格子的类型。其中，重载的小于号主要用于 `map` （`map` 的内部实现是红黑树，也是一种查找树，所以需要对比大小）。

其中定义了几种构造函数，比较有用的是第二个，也就是通过罗比所在的坐标和此格相对于罗比的方向来初始化。

```cpp
typedef vector<vector<bool>> Map_t;
Map_t cur_map;

inline bool is_wall(int x, int y, Map_t* mp) {
    auto [n, m] = make_pair((*mp).size(), (*mp).front().size());
    if (x >= n || x < 0 || y >= m || y < 0)
        return true;
    else
        return false;
}

inline GRD_OBJ get_obj_inpos(int x, int y, Map_t* mp) {
    GRD_OBJ obj;
    int n = mp->size();
    int m = mp->front().size();
    if (is_wall(x, y, mp))
        obj = WAL;
    else if ((*mp)[x][y])
        obj = CAN;
    else if (!(*mp)[x][y])
        obj = EPT;

    return obj;
}

struct Obj_in_dir { 
    GRD_DIR dir;
    GRD_OBJ obj;
    const bool operator<(Obj_in_dir b) const {
        if (dir != b.dir) return dir < b.dir;
        return obj < b.obj;
    }
    const bool operator==(Obj_in_dir b) const {
        return dir == b.dir && obj == b.obj;
    }
    const bool operator!=(Obj_in_dir b) const {
        return dir != b.dir || obj != b.obj;
    }
    Obj_in_dir(GRD_DIR _dir, GRD_OBJ _obj) : dir(_dir), obj(_obj) {}

    Obj_in_dir(int x, int y, GRD_DIR _dir, Map_t* mp) {
        dir = _dir;
        switch (dir) {
            case CUR:
                obj = get_obj_inpos(x, y, mp);
                break;
            case UP:
                obj = get_obj_inpos(x - 1, y, mp);
                break;
            case DN:
                obj = get_obj_inpos(x + 1, y, mp);
                break;
            case RT:
                obj = get_obj_inpos(x, y + 1, mp);
                break;
            case LF:
                obj = get_obj_inpos(x, y - 1, mp);
                break;
        }
    }
    Obj_in_dir() {
        dir = DIRNONE;
        obj = OBJNONE;
    }
};
```

### Srndng

`Srndng` 也就是 Surrounding，代表了罗比周围的情形，之后我们会定义一个 `map`，把罗比周围的情形映射到一个动作上，而这个 `map` 就代表了不同的策略或者说基因。

其中注意第一个构造函数，传入坐标和地图的指针后，就能初始化罗比当前看到的情形。
```cpp
struct Srndng {
    Obj_in_dir objs[5];
    const bool operator<(Srndng b) const {
        for (int i = 0; i < 5; i++) {
            if (objs[i] != b.objs[i]) return objs[i] < b.objs[i];
        }
        return false;
    }

    Srndng(int x, int y, Map_t* mp) {
        for (int i = 0; i < 5; i++) {
            objs[i] = Obj_in_dir(x, y, GRD_DIR(i), mp);
        }
    }
    Srndng() {
        for (int i = 0; i < 5; i++)
            objs[i].dir = DIRNONE, objs[i].obj = OBJNONE;
    }
};
```

下面是一些被重命名的类型：
```cpp
typedef map<Srndng, ACTION> Gene_t;     // 把情形映射到动作，就是我们定义的基因 
typedef pair<Gene_t, float> Gene_res_t; // gene result type 基因和其对应的适应度
typedef vector<Gene_res_t> Gene_pool_t; // 一个群体的基因池
```

## 用到的一些函数
### 地图生成器
地图生成器，地图指针传进来之后需要先 `resize`，然后根据之前定义的罐子出现的概率，生成地图。
```cpp
void mp_generator(Map_t* mp, int n = MAP_SIZ, int m = MAP_SIZ) {
    srand(time(0));
    mp->resize(n);
    for (int i = 0; i < n; i++) {
        (*mp)[i].resize(m);
    }
    for (auto& row : *mp) {
        for (auto&& unit : row) {
            //注意这里用两个 && 是因为 unit 是布尔类的
            //而这里的 && 是一个右值引用（右值是不能被取地址的）
            //所以我们改变了 unit，那 mp 这个地图里的值也会改变
            unit = (rand() * 1.0 <= CAN_RATE * RAND_MAX);
        }
    }
}
```

### 随机生成一个基因

主要用于产生第一代的个体

这里我用了递归的方式去生成这个基因。实际上就是去枚举罗比可能会遇到的不同情形，如果发现一种情形已经生成完了（周围的格子都被确定了）那就直接随机一个动作出来。
```cpp
void gene_generator_once(Gene_t* ret_gene, Srndng* ret_srndng, GRD_DIR cur_dir) {
    if (cur_dir >= DIR_CNT) {
        //发现已经枚举完一种情形了，就随机生成一个动作
        (*ret_gene)[*ret_srndng] = ACTION(rand() % ACTION_CNT);
        return;
    }
    for (int i = 0; i < OBJ_CNT; i++) {
        (*ret_srndng).objs[cur_dir] = Obj_in_dir(GRD_DIR(cur_dir), GRD_OBJ(i));
        gene_generator_once(ret_gene, ret_srndng, GRD_DIR(cur_dir + 1));
    }
}
```

### 用两个基因繁殖子代
首先先随机出一个合并点，这个点前的基因来自 $pa$，后面的来自 $pb$，然后直接把父母基因根据这个合并点复制到子代基因上。

如前文，复制过程中可以模拟基因的变异，所以我们要根据前面定义的变异概率随机一下，然后判断是否变异。

```cpp
void gene_combine(Gene_t* pa, Gene_t* pb, Gene_t* child) {
    int cmb_pos =
        round(double(rand() * 1.0 / RAND_MAX * 1.0) * double(pa->size()));
    int cur_idx = 0;
    for (auto [key, val] : *pa) {
        // pa 是一个map，这里的语法是结构化绑定，key 就是 map 里 pair 的 .first，val 就是 .second
        if (cur_idx > cmb_pos) break;                     // 合并点前的都是 pa，反之亦然
        if ((rand() * 1.0 / RAND_MAX * 1.0) <= MUT_RATE)  // 判断是否变异
            (*child)[key] = ACTION(rand() % (ACTION_CNT));// 变异的话直接给他随机一个动作
        else
            (*child)[key] = val;
        cur_idx++;
    }
    cur_idx = 0;
    for (auto [key, val] : *pb) {
        if (cur_idx > cmb_pos) {
            if ((rand() * 1.0 / RAND_MAX * 1.0) <= MUT_RATE)
                (*child)[key] = ACTION(rand() % (ACTION_CNT));
            else
                (*child)[key] = val;
        }
        cur_idx++;
    }
}
```

### 获取移动之后的坐标
这就没啥好解释了，接受罗比当前的坐标，和准备要做的动作，输出一个移动之后的坐标。因为有两种动作不是移动，所以如果接受到这样的参数就会抛出一个 `invalid_argument`。

```cpp
inline pair<int, int> get_pos_after_mv(int x, int y, ACTION mv) {
    switch (mv) {
        case MV_UP:
            return {x - 1, y};
            break;
        case MV_DN:
            return {x + 1, y};
            break;
        case MV_LF:
            return {x, y - 1};
            break;
        case MV_RT:
            return {x, y + 1};
            break;
        case MV_RND:
            return get_pos_after_mv(x, y, ACTION(rand() % 4));
            break;
        case CLCT_CAN: //捡起易拉罐
            throw invalid_argument("not a move");
            return {x, y};
            break;
        case HALT:
            throw invalid_argument("not a move");
            return {x, y};
            break;
    }
}
```

### 对一个基因计算特定地图下的适应度
直接模拟罗比的移动就好了，需要注意的是，如果罗比撞墙了，我们需要把它弹回来。
```cpp
inline bool is_mov(ACTION act) { return act <= 4; }

int calc_fitness(Gene_t* gene, Map_t* mp) {
    int cur_x = 0, cur_y = 0;
    int fit = 0;
    for (int cur_mov = 1; cur_mov <= MOV_LIM; cur_mov++) {
        Srndng cur_srnd(cur_x, cur_y, mp);  // 传入罗比的坐标和当前地图，来确定罗比周围的情形
        ACTION cur_act = (*gene)[cur_srnd]; // 根绝这个基因，获取应作的动作
        
        if (is_mov(cur_act)) {
            // 如果这个动作是会移动的，就计算移动之后的位置
            tie(cur_x, cur_y) = get_pos_after_mv(cur_x, cur_y, cur_act);
            // 这里的 tie 其实跟结构化绑定是差不多的，但是好像
            // 这里的结构化绑定只能写成 auto[cur_x, cur_y] = funct()
            // 这样就只能新建两个变量了，如果你知道如何不新建变量的结构化绑定
            // 可以在评论区说下
        }

        if (is_wall(cur_x, cur_y, mp)) {
            fit += HIT_WALL_PT;
            //撞墙了
            auto [n, m] = make_pair((*mp).size(), (*mp).front().size());
            //把罗比弹回来
            if (cur_x < 0) cur_x = 0;
            if (cur_y < 0) cur_y = 0;
            if (cur_x >= n) cur_x = n - 1;
            if (cur_y >= m) cur_y = m - 1;
        } else if (cur_act == CLCT_CAN) {
            if ((*mp)[cur_x][cur_y]) {
                // 如果有罐子还捡了
                fit += SUC_CLCT_PT;
                (*mp)[cur_x][cur_y] = false;
                // 这里需要标注罐子已经被捡了
            } else
                fit += ERR_CLCT_PT;
        }
    }
    return fit;
}
```

### 一次性生成整个群体的基因

基本就是把前面的单个基因套了个壳
```cpp
void gene_generator(Gene_pool_t* pool, int cnt) {
    while (cnt--) {
        Gene_t temp_gene;
        Srndng temp_srnd;
        gene_generator_once(&temp_gene, &temp_srnd, GRD_DIR(0));
        pool->push_back({temp_gene, 0});
    }
}
```

### 根据元素的权值随机选取数组中的元素

传入两个参数，数组中每个元素（或者说下标）的权重，和要选择的元素。

这个东西的思路主要是这样的，我们知道 `rand()` 函数会产生一个 $0 \sim \text{RAND\_MAX}$ 的均匀分布的随机数。那么我们只要根据给定的权值规定好每个下标对应的范围，如果 `rand()` 给的值是这个范围内的，就选择这个元素。

比如，假设我们的 $\text{RAND\_MAX}$ 是 $9$，然后 `possi` 数组等于 $[4, 3, 2, 1]$ 那么就可以得出下面的映射范围：

$$
1 \to [0, 3]\\
2 \to [4, 6]\\
3 \to [7, 8]\\
4 \to [9, 9]\\

\footnotesize{注：这里的 1, 2, 3 等代表元素的下标，不是权重}
$$

这样，权重高的元素就有更大的概率被选中。

接下来要把每个下标对应的范围放入一个 `map` 中。我们定义下标 $i$ 的映射范围的下界为 $dn_i$，比如在上面的例子中 $dn_1 = 0$。我们在这个 `map` 中就可以建立一个 $dn_i \to i$ 的映射。

如在上面的中，这个映射就是。

$$
0 \to 1 \\
4 \to 2 \\
7 \to 3 \\
9 \to 4 \\
$$

接下来，如果我们用 `rand()` 函数得出了一个随机值 $rnd$，我们就可以用 `map` 的 `upper_bound(key)` 函数找到第一个这个 `map` 中键值大于 $key$ 的位置，那么这个位置的前一个位置就是我们需要的下标。

举个例子，如果我们的 $rnd = 5$，那么，根据上面的映射，第一个大于这个数的键就是 $7$，而 $7$ 的上一个就是 $4$，对应的值是 $2$，所以我们选中了第二个元素。

根据前面下标到范围的映射，$2$ 这个下标对应了 $[4, 6]$，我们的 $rnd = 5$，所以确实应该选 $2$ 这个下标

```cpp
vector<int> choose_by_weight(vector<float>& possi, int cnt) {
    vector<int> ret;
    ret.reserve(cnt);
    double tot = 0;
    for (float cur : possi) {
        tot += cur;
        //计算权值的和
    }
    map<int, int> choose_rg;
    int lst = 0;
    for (int i = 0; i < possi.size(); i++) {
        int len = lround(possi[i] * 1.0 / tot * 1.0 * (RAND_MAX * 1.0));
        //计算这个范围的长度
        if (len == 0) continue;
        choose_rg[lst] = i;
        lst = lst + len;
    }
    choose_rg[IINF] = possi.size();
    while (ret.size() < cnt) { // 选 cnt 个，放到 ret 里
        int rd = rand();
        int rd_idx = (--choose_rg.upper_bound(rd))->second; 
        // 用 upper_bound() 找到第一个比 key 大的，然后找这个前面的元素
        ret.push_back(rd_idx);
        // 再把这个元素对应的值 push 进去
    }
    return ret;
}
```

## 进化

我们开两个群体的类（`Gene_pool_t`），其中一个代表当前的，还有一个是子代的。

和前面讲的一样，我们首先计算群体中每一个个体的适应度，然后根据适应度选出父母，繁殖出下一代，把这个过程重复 $1000$ 次，就能得到一个不错的策略了。

```cpp
void evolve(int cur_gen) {
    if (cur_gen != 1) {
        temp_pool.clear();  // 新的一代是放进 temp 里的
    }

    for_each(cur_pool.begin(), cur_pool.end(),
             [](Gene_res_t& a) { a.second = 0; });
    // 重置 cur_pool 的适应度

    for (int m = 0; m < MAP_REP; m++) {
        mp_generator(&cur_map);   // 重置地图
        Map_t temp_map = cur_map; // 因为计算适应性时，会影响生成的地图（比如捡起一个罐子），所以现在先复制一下。计算另一个个体时再复制回去。
        for (int i = 0; i < POP_CNT; i++) {
            cur_pool[i].second += calc_fitness(&cur_pool[i].first, &cur_map);
            cur_map = temp_map;
        }
    }
    for (auto& res : cur_pool) {
        res.second /= (MAP_REP * 1.0); // 取平均
    }
    //计算出池中每个基因的概率
    float tot_fit = 0;
    float mx_fit = numeric_limits<float>::min();
    for (auto cur : cur_pool) {
        tot_fit += cur.second;
        mx_fit = max(mx_fit, cur.second);
    }
    fileout << mx_fit << ",";
    cout << cur_gen <<" "<<mx_fit<<"\n";

    sort(cur_pool.begin(), cur_pool.end(),
         [](Gene_res_t& a, Gene_res_t& b) { return a.second < b.second; });

    vector<float> possi;
    const float TOT_ELE = (0.0 + (POP_CNT - 1) * 1.0) * POP_CNT * 1.0 / 2.0;
    for (int i = 0; i < cur_pool.size(); i++) {
        possi.push_back(i * 1.0 * sqrt(i * 1.0)); //每个基因的权重，如果适应性越高，权重也应该更高，这个权重的函数可以自己改
    }
    auto chosen = choose_by_weight(possi, POP_CNT * 2);

    temp_pool.clear();
    while (chosen.size()) {
        int fir = chosen.back();
        chosen.pop_back();
        int sec = chosen.back();
        chosen.pop_back();
        Gene_t child;
        gene_combine(&cur_pool[fir].first, &cur_pool[sec].first, &child);
        //产生下一代
        temp_pool.push_back({child, 0});
    }
    swap(cur_pool, temp_pool);
}

int main() {
    fileout.open("./out");
    gene_generator(&cur_pool, POP_CNT);  //创建初始基因
    for (int i = 1; i <= GEN_CNT; i++) {
        evolve(i);
    }
    system("python ./plotting.py"); // 最后画图
    
}
```

# 结果
下图使用 matplotlib 画出，源码如下：

```python
from matplotlib import lines, pyplot as plt
import csv

GEN_CNT = 1000
FONTSIZ = 23

plt.rcParams['font.sans-serif'] = ['SimHei']
plt.rcParams['axes.unicode_minus'] = False

x = []
for i in range(GEN_CNT):
    x.append(i)
y = []
with open(".//out", 'r') as csvfile:
    result = csv.reader(csvfile, delimiter=',')
    for row in result:
        for col in row:
            y.append(float(col))
            
print(y)
mxfit = 0.0
for cur in y:
    mxfit = max(mxfit, cur)
    
plt.figure(figsize = (20, 40.0/3.0));
plt.yticks(fontproperties = 'Iosevka', size = 20)
plt.xticks(fontproperties = 'Iosevka', size = 20)
plt.plot(x, y)
plt.hlines(mxfit, 0, 1000, colors='g', linestyles="dashed", label="最大适应度=" + str(mxfit))
plt.xlabel("代数", fontsize = FONTSIZ)
plt.ylabel("每代最大适应度", fontsize = FONTSIZ)
plt.legend(fontsize = FONTSIZ)
plt.savefig(fname="ga_result.svg",format="svg")
plt.show()
```

![](/img/遗传算法_复杂/ga_result.svg)

可以看到虽然有波动，但是整体的趋势还是上升的。最好策略的适应度也达到了 $590$，这是一个非常理想的分数，因为地图中平均就只有 $50$ 个罐子，这个 $590$ 可能是随机出来的地图刚好有比较多的罐子，然后一共捡了 $59$ 个。

# 源码

```cpp
/*Date: 22 - 06-29 00 38
PROBLEM_NUM: */
// #define FDEBUG
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
const int MAP_SIZ = 10;
const float CAN_RATE = 0.5;  //是罐子的概率
//地图设置

const int SUC_CLCT_PT = 10;
const int ERR_CLCT_PT = -1;
const int HIT_WALL_PT = -5;
//奖励设置

const int MOV_LIM = 200;
const int POP_CNT = 500;
const int GEN_CNT = 1000;
const float MUT_RATE = 0.005;  //每一个位点的变异概率
const int MAP_REP = 50;        //计算适应度时用多少个地图
//演化的一些设置

const int THREAD_CNT = 10;

enum GRD_DIR { DIRNONE = -1, CUR, UP, DN, RT, LF };
const int DIR_CNT = 5;
enum GRD_OBJ { OBJNONE = -1, EPT, WAL, CAN };
const int OBJ_CNT = 3;
enum ACTION {
    ACTNONE = -1,
    MV_UP,
    MV_DN,
    MV_RT,
    MV_LF,
    MV_RND,
    CLCT_CAN,
    HALT
};
const int ACTION_CNT = 7;

typedef vector<vector<bool>> Map_t;
Map_t cur_map;

inline bool is_wall(int x, int y, Map_t* mp) {
    auto [n, m] = make_pair((*mp).size(), (*mp).front().size());
    if (x >= n || x < 0 || y >= m || y < 0)
        return true;
    else
        return false;
}

inline GRD_OBJ get_obj_inpos(int x, int y, Map_t* mp) {
    GRD_OBJ obj;
    int n = mp->size();
    int m = mp->front().size();
    if (is_wall(x, y, mp))
        obj = WAL;
    else if ((*mp)[x][y])
        obj = CAN;
    else if (!(*mp)[x][y])
        obj = EPT;

    return obj;
}

struct Obj_in_dir {
    GRD_DIR dir;
    GRD_OBJ obj;
    const bool operator<(Obj_in_dir b) const {
        if (dir != b.dir) return dir < b.dir;
        return obj < b.obj;
    }
    const bool operator==(Obj_in_dir b) const {
        return dir == b.dir && obj == b.obj;
    }
    const bool operator!=(Obj_in_dir b) const {
        return dir != b.dir || obj != b.obj;
    }
    Obj_in_dir(GRD_DIR _dir, GRD_OBJ _obj) : dir(_dir), obj(_obj) {}

    Obj_in_dir(int x, int y, GRD_DIR _dir, Map_t* mp) {
        dir = _dir;
        switch (dir) {
            case CUR:
                obj = get_obj_inpos(x, y, mp);
                break;
            case UP:
                obj = get_obj_inpos(x - 1, y, mp);
                break;
            case DN:
                obj = get_obj_inpos(x + 1, y, mp);
                break;
            case RT:
                obj = get_obj_inpos(x, y + 1, mp);
                break;
            case LF:
                obj = get_obj_inpos(x, y - 1, mp);
                break;
        }
    }
    Obj_in_dir() {
        dir = DIRNONE;
        obj = OBJNONE;
    }
};

struct Srndng {
    Obj_in_dir objs[5];
    const bool operator<(Srndng b) const {
        for (int i = 0; i < 5; i++) {
            if (objs[i] != b.objs[i]) return objs[i] < b.objs[i];
        }
        return false;
    }

    Srndng(int x, int y, Map_t* mp) {
        for (int i = 0; i < 5; i++) {
            objs[i] = Obj_in_dir(x, y, GRD_DIR(i), mp);
        }
    }
    Srndng() {
        for (int i = 0; i < 5; i++)
            objs[i].dir = DIRNONE, objs[i].obj = OBJNONE;
    }
};

typedef map<Srndng, ACTION> Gene_t;
typedef pair<Gene_t, float> Gene_res_t;  // 基因对应的适应度
typedef vector<Gene_res_t> Gene_pool_t;

void mp_generator(Map_t* mp, int n = MAP_SIZ, int m = MAP_SIZ) {
    srand(time(0));
    mp->resize(n);
    for (int i = 0; i < n; i++) {
        (*mp)[i].resize(m);
    }
    for (auto& row : *mp) {
        for (auto&& unit : row) {
            unit = (rand() * 1.0 <= CAN_RATE * RAND_MAX);
        }
    }
}

Map_t* mp_generator(int n = MAP_SIZ, int m = MAP_SIZ) {
    auto mp = new Map_t(n);
    mp_generator(mp);
    return mp;
}

void gene_generator_once(Gene_t* ret_gene, Srndng* ret_srndng,
                         GRD_DIR cur_dir) {
    if (cur_dir >= DIR_CNT) {
        (*ret_gene)[*ret_srndng] = ACTION(rand() % ACTION_CNT);
        return;
    }
    for (int i = 0; i < OBJ_CNT; i++) {
        (*ret_srndng).objs[cur_dir] = Obj_in_dir(GRD_DIR(cur_dir), GRD_OBJ(i));
        gene_generator_once(ret_gene, ret_srndng, GRD_DIR(cur_dir + 1));
    }
}

void gene_combine(Gene_t* pa, Gene_t* pb, Gene_t* child) {
    int cmb_pos =
        round(double(rand() * 1.0 / RAND_MAX * 1.0) * double(pa->size()));
    int cur_idx = 0;
    for (auto [key, val] : *pa) {
        if (cur_idx > cmb_pos) break;
        if ((rand() * 1.0 / RAND_MAX * 1.0) <= MUT_RATE)
            (*child)[key] = ACTION(rand() % (ACTION_CNT));
        else
            (*child)[key] = val;
        cur_idx++;
    }
    cur_idx = 0;
    for (auto [key, val] : *pb) {
        if (cur_idx > cmb_pos) {
            if ((rand() * 1.0 / RAND_MAX * 1.0) <= MUT_RATE)
                (*child)[key] = ACTION(rand() % (ACTION_CNT));
            else
                (*child)[key] = val;
        }
        cur_idx++;
    }
}

Gene_t* gene_combine(Gene_t* pa, Gene_t* pb) {
    auto child = new Gene_t;
    gene_combine(pa, pb, child);
    return child;
}

inline pair<int, int> get_pos_after_mv(int x, int y, ACTION mv) {
    switch (mv) {
        case MV_UP:
            return {x - 1, y};
            break;
        case MV_DN:
            return {x + 1, y};
            break;
        case MV_LF:
            return {x, y - 1};
            break;
        case MV_RT:
            return {x, y + 1};
            break;
        case MV_RND:
            return get_pos_after_mv(x, y, ACTION(rand() % 4));
            break;
        case CLCT_CAN:
            throw invalid_argument("not a move");
            return {x, y};
            break;
        case HALT:
            throw invalid_argument("not a move");
            return {x, y};
            break;
    }
}

inline bool is_mov(ACTION act) { return act <= 4; }

int calc_fitness(Gene_t* gene, Map_t* mp) {
    int cur_x = 0, cur_y = 0;
    int fit = 0;
    for (int cur_mov = 1; cur_mov <= MOV_LIM; cur_mov++) {
        Srndng cur_srnd(cur_x, cur_y, mp);
        ACTION cur_act = (*gene)[cur_srnd];
        if (is_mov(cur_act)) {
            tie(cur_x, cur_y) = get_pos_after_mv(cur_x, cur_y, cur_act);
        }
        if (is_wall(cur_x, cur_y, mp)) {
            fit += HIT_WALL_PT;
            auto [n, m] = make_pair((*mp).size(), (*mp).front().size());
            if (cur_x < 0) cur_x = 0;
            if (cur_y < 0) cur_y = 0;
            if (cur_x >= n) cur_x = n - 1;
            if (cur_y >= m) cur_y = m - 1;
        } else if (cur_act == CLCT_CAN) {
            if ((*mp)[cur_x][cur_y]) {
                fit += SUC_CLCT_PT;
                (*mp)[cur_x][cur_y] = false;
            } else
                fit += ERR_CLCT_PT;
        }
    }
    return fit;
}

void gene_generator(Gene_pool_t* pool, int cnt) {
    while (cnt--) {
        Gene_t temp_gene;
        Srndng temp_srnd;
        gene_generator_once(&temp_gene, &temp_srnd, GRD_DIR(0));
        pool->push_back({temp_gene, 0});
    }
}

Gene_pool_t cur_pool, temp_pool;

void calc_popfit_mul_th() {
    thread* calc_fit_th[THREAD_CNT];
    const int PER_TH = POP_CNT / THREAD_CNT;
    for (int i = 0; i < THREAD_CNT; i++) {
        calc_fit_th[i] = new thread([i]() {
            for (int j = i * PER_TH; j < (i + 1) * PER_TH; j++)
                cur_pool[j].second = calc_fitness(&cur_pool[j].first, &cur_map);
        });
    }
    for (int i = 0; i < THREAD_CNT; i++) {
        calc_fit_th[i]->join();
    }
}

vector<int> choose_by_weight(vector<float>& possi, int cnt) {
    vector<int> ret;
    ret.reserve(cnt);
    double tot = 0;
    for (float cur : possi) {
        tot += cur;
    }
    map<int, int> choose_rg;
    int lst = 0;
    for (int i = 0; i < possi.size(); i++) {
        int len = lround(possi[i] * 1.0 / tot * 1.0 * (RAND_MAX * 1.0));
        if (len == 0) continue;
        choose_rg[lst] = i;
        lst = lst + len; //下一个的下标
    }
    choose_rg[IINF] = possi.size();
    while (ret.size() < cnt) {
        int rd = rand();
        int rd_idx = (--choose_rg.upper_bound(rd))->second;
        ret.push_back(rd_idx);
    }
    return ret;
}

ofstream fileout;

void evolve(int cur_gen) {
    if (cur_gen != 1) {
        temp_pool.clear();  // 新的一代是放进 temp 里的
    }

    for_each(cur_pool.begin(), cur_pool.end(),
             [](Gene_res_t& a) { a.second = 0; });

    for (int m = 0; m < MAP_REP; m++) {
        mp_generator(&cur_map);
        Map_t temp_map = cur_map;
        for (int i = 0; i < POP_CNT; i++) {
            cur_pool[i].second += calc_fitness(&cur_pool[i].first, &cur_map);
            cur_map = temp_map;
        }
    }
    for (auto& res : cur_pool) {
        res.second /= (MAP_REP * 1.0);
    }
    float tot_fit = 0;
    float mx_fit = numeric_limits<float>::min();
    for (auto cur : cur_pool) {
        tot_fit += cur.second;
        mx_fit = max(mx_fit, cur.second);
    }
    fileout << mx_fit << ",";
    cout << cur_gen <<" "<<mx_fit<<"\n";

    sort(cur_pool.begin(), cur_pool.end(),
         [](Gene_res_t& a, Gene_res_t& b) { return a.second < b.second; });

    vector<float> possi;
    const float TOT_ELE = (0.0 + (POP_CNT - 1) * 1.0) * POP_CNT * 1.0 / 2.0;
    for (int i = 0; i < cur_pool.size(); i++) {
        possi.push_back(i * 1.0 * sqrt(i * 1.0));
        // possi.push_back(i);
    }
    auto chosen = choose_by_weight(possi, POP_CNT * 2);

    temp_pool.clear();
    while (chosen.size()) {
        int fir = chosen.back();
        chosen.pop_back();
        int sec = chosen.back();
        chosen.pop_back();
        Gene_t child;
        gene_combine(&cur_pool[fir].first, &cur_pool[sec].first, &child);
        DEBUG("fir: %d sec: %d\n", fir, sec);
        temp_pool.push_back({child, 0});
    }

    swap(cur_pool, temp_pool);
}

int main() {
    fileout.open("./out");
    gene_generator(&cur_pool, POP_CNT);  //创建初始基因
    for (int i = 1; i <= GEN_CNT; i++) {
        evolve(i);
    }
    system("python ./plotting.py");
    pause;
}
```
