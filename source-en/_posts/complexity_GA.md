---
title: C++ Implementation of the Genetic Algorithm in *Complexity*
date: 2022-06-30 00:00:00
updated: 2022-07-10 00:00:00
tags:
- Genetic Algorithms
- 2022
- "Complexity"
categories:
- Lab Records
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

{% note danger simple %}
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/06/complexity_GA/).
{% endnote %}

# Background

I read the book *Complexity* a little over a year ago. A recent competition reminded me of the genetic algorithm introduced in the book. Since the book provides a detailed line of thought, I wanted to implement it myself.

About *Complexity*: I will not introduce its contents at length. My only feeling after finishing it was that it was amazing. The following introduction is excerpted from Douban, with some punctuation added by me:

> Why do ants behave with such precision and purpose when they form a colony? How do hundreds of millions of neurons produce something as extraordinarily complex as consciousness? What guides self-organizing structures such as the immune system, the Internet, the global economy, and the human genome? These are some of the fascinating and puzzling questions that the science of complex systems attempts to answer.

> Understanding complex systems requires entirely new methods. It requires going beyond traditional scientific reductionism and redrawing the boundaries between disciplines. Drawing on her work at the Santa Fe Institute and its interdisciplinary methods, leading complexity scientist Mitchell clearly introduces research into complex systems across biology, technology, sociology, and other fields, searching for universal laws of complex systems. At the same time, she explores the relationships between complexity and evolution, artificial intelligence, computation, genetics, information processing, and other fields.

The problem discussed in the book is roughly as follows.

There is a robot named Robby that lives in a $10\times10$ grid. Many cans are scattered around the grid, and Robby must collect as many cans as possible within a limited number of actions. Robby starts at $(0,0)$. It can see only the four cells around it and the cell it currently occupies. Every cell has one of three possible states: containing a can, containing no can, or being a wall. Robby can perform seven actions: move in any of the four directions, move randomly, pick up a can, or remain still.

![Grid illustration](/img/遗传算法_复杂/robin_grid.png)

# Idea

## Gene-Encoding Rules

First, we need to determine what we want to evolve. Robby can only observe the surrounding cells and then choose an action based on those cells, so the strategy mapping observations to actions is what we want to evolve. Different strategies can be represented as strings of length $3^5$ containing digits from 0 through 6. The digits 0 through 6 represent the seven possible actions. Each position in the length-$3^5=243$ string represents a different situation visible to Robby. The 3 in $3^5$ represents the three possible cell states, and 5 is the number of cells Robby can see.

This string represents a mapping from situations to actions. Every time Robby sees the five surrounding cells, it checks the mapping and performs the corresponding action. The object we evolve is this string—or, in other words, the gene.

In the actual implementation, however, I used a `map` to implement the mapping—~~definitely not because I was too lazy to write the string-processing code~~.

## Fitness

Fitness measures the quality of different strategies. In a genetic algorithm, a reasonable fitness definition can accelerate evolution. The book calculates fitness as follows:

| Pick up a can | Hit a wall | Try to pick up a can where none exists |
| --- | --- | --- |
| $+10$ | $-5$ | $-1$ |

These values reward the behavior we ultimately want—successfully collecting cans—while penalizing invalid or wasteful actions. Consequently, a strategy that navigates toward cans and collects them reliably receives a higher score than one that repeatedly collides with walls or attempts to collect cans from empty cells.

## Evolution Process

First, randomly generate an initial population. The book uses 200 individuals.

Next, calculate the fitness of every individual in the population, and use the fitness values to select two different genes to “reproduce”; genes with greater fitness are more likely to be selected. To make the strategy broadly applicable, fitness is evaluated on many randomly generated maps and then averaged. Testing only one map could make a gene perform well merely because it happened to suit that particular arrangement of cans, rather than because it represents a generally useful strategy.

The reproduction process creates the next generation. Its implementation is based on chromosomal crossover in biology, approximately as shown below:

<div align=center width=40%>
  <img width=40% src="/img/遗传算法_复杂/crossover.jpg" >
</div>

That is, a midpoint is selected randomly. The first half of the child's gene comes from one parent, and the second half comes from the other. Mutation can also be introduced during chromosomal crossover, giving each position in the child's gene a certain probability of changing. This introduces more variation into the gene pool.

# Concrete Implementation

## Constants

```cpp
const int MAP_SIZ = 10;      // Map size
const float CAN_RATE = 0.5;  // Probability that a cell contains a can
// Map settings

const int SUC_CLCT_PT = 10;  // Fitness change for successfully collecting a can
const int ERR_CLCT_PT = -1;  // Attempting to collect a can where none exists
const int HIT_WALL_PT = -5;  // Hitting a wall
// Fitness settings

const int MOV_LIM = 200;       // Total number of permitted actions
const int POP_CNT = 500;       // Population size
const int GEN_CNT = 1000;      // Number of generations
const float MUT_RATE = 0.005;  // Mutation probability at each position
const int MAP_REP = 50;        // Number of maps used to calculate fitness
// Evolution settings

enum GRD_DIR { DIRNONE = -1, CUR, UP, DN, RT, LF }; // Different directions
const int DIR_CNT = 5;

enum GRD_OBJ { OBJNONE = -1, EPT, WAL, CAN }; // Different cell types
const int OBJ_CNT = 3;

enum ACTION {
    // Robby's different actions
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

## Classes

### `Obj_in_dir`

`Obj_in_dir` defines the direction of a cell relative to Robby and the type of object in that cell. The overloaded less-than operator is used mainly by `map`. A `map` is internally implemented as a red-black tree, which is a kind of search tree, so its keys must be comparable.

Several constructors are defined. The second is particularly useful: it initializes the cell from Robby's current coordinates and the cell's direction relative to Robby.

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

### `Srndng`

`Srndng`, meaning “Surrounding,” represents the situation around Robby. Later, we define a `map` that maps each surrounding situation to an action. That `map` represents a strategy, or gene.

Pay particular attention to the first constructor. Given coordinates and a pointer to a map, it initializes the situation currently visible to Robby.

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

The following are several renamed types:

```cpp
typedef map<Srndng, ACTION> Gene_t;     // Mapping from situations to actions: the defined gene
typedef pair<Gene_t, float> Gene_res_t; // Gene result type: a gene and its fitness
typedef vector<Gene_res_t> Gene_pool_t; // Gene pool for one population
```

## Functions

### Map Generator

The map generator first calls `resize` on the supplied map pointer, then generates the map according to the previously defined probability that a can appears.

```cpp
void mp_generator(Map_t* mp, int n = MAP_SIZ, int m = MAP_SIZ) {
    srand(time(0));
    mp->resize(n);
    for (int i = 0; i < n; i++) {
        (*mp)[i].resize(m);
    }
    for (auto& row : *mp) {
        for (auto&& unit : row) {
            // Two ampersands are used because unit is of a Boolean class.
            // Here, && is an rvalue reference (an rvalue cannot have its address taken).
            // Therefore, changing unit also changes the corresponding value in map mp.
            unit = (rand() * 1.0 <= CAN_RATE * RAND_MAX);
        }
    }
}
```

### Randomly Generate One Gene

This is used mainly to generate individuals in the first generation.

I use recursion to generate the gene. It simply enumerates every different situation Robby might encounter. When a complete situation has been generated—that is, every surrounding cell has been determined—it directly chooses a random action.

```cpp
void gene_generator_once(Gene_t* ret_gene, Srndng* ret_srndng, GRD_DIR cur_dir) {
    if (cur_dir >= DIR_CNT) {
        // A complete situation has been enumerated; generate a random action.
        (*ret_gene)[*ret_srndng] = ACTION(rand() % ACTION_CNT);
        return;
    }
    for (int i = 0; i < OBJ_CNT; i++) {
        (*ret_srndng).objs[cur_dir] = Obj_in_dir(GRD_DIR(cur_dir), GRD_OBJ(i));
        gene_generator_once(ret_gene, ret_srndng, GRD_DIR(cur_dir + 1));
    }
}
```

### Reproduce a Child from Two Genes

First, randomly choose a crossover point. The gene before this point comes from $pa$, and the portion after it comes from $pb$. Then copy the parent genes directly into the child's gene according to this crossover point.

As discussed above, mutation can be simulated during copying. We therefore generate a random value according to the previously defined mutation probability and determine whether a mutation occurs.

```cpp
void gene_combine(Gene_t* pa, Gene_t* pb, Gene_t* child) {
    int cmb_pos =
        round(double(rand() * 1.0 / RAND_MAX * 1.0) * double(pa->size()));
    int cur_idx = 0;
    for (auto [key, val] : *pa) {
        // pa is a map. This is structured binding: key is pair.first and val is pair.second.
        if (cur_idx > cmb_pos) break;                     // Before the crossover point use pa; after it use pb.
        if ((rand() * 1.0 / RAND_MAX * 1.0) <= MUT_RATE)  // Determine whether mutation occurs.
            (*child)[key] = ACTION(rand() % (ACTION_CNT));// On mutation, assign a random action directly.
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

### Obtain the Coordinates After Moving

There is little to explain here. The function accepts Robby's current coordinates and the action it is about to perform, then returns the coordinates after movement. Two actions are not movement actions; receiving either of them causes an `invalid_argument` exception to be thrown.

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
        case CLCT_CAN: // Pick up a can
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

### Calculate a Gene's Fitness on a Particular Map

Simply simulate Robby's movement. One detail requires attention: if Robby hits a wall, we need to bounce it back into the map.

```cpp
inline bool is_mov(ACTION act) { return act <= 4; }

int calc_fitness(Gene_t* gene, Map_t* mp) {
    int cur_x = 0, cur_y = 0;
    int fit = 0;
    for (int cur_mov = 1; cur_mov <= MOV_LIM; cur_mov++) {
        Srndng cur_srnd(cur_x, cur_y, mp);  // Use Robby's coordinates and the map to determine its surroundings.
        ACTION cur_act = (*gene)[cur_srnd]; // Obtain the action to perform from the gene.
        
        if (is_mov(cur_act)) {
            // If this action moves, calculate the position after movement.
            tie(cur_x, cur_y) = get_pos_after_mv(cur_x, cur_y, cur_act);
            // tie is similar to structured binding, but it seems that structured binding here
            // can only be written as auto[cur_x, cur_y] = funct(), which creates two new variables.
            // If you know how to use structured binding without creating new variables,
            // please explain it in the comments.
        }

        if (is_wall(cur_x, cur_y, mp)) {
            fit += HIT_WALL_PT;
            // Robby hit a wall.
            auto [n, m] = make_pair((*mp).size(), (*mp).front().size());
            // Bounce Robby back into the map.
            if (cur_x < 0) cur_x = 0;
            if (cur_y < 0) cur_y = 0;
            if (cur_x >= n) cur_x = n - 1;
            if (cur_y >= m) cur_y = m - 1;
        } else if (cur_act == CLCT_CAN) {
            if ((*mp)[cur_x][cur_y]) {
                // A can exists and Robby picked it up.
                fit += SUC_CLCT_PT;
                (*mp)[cur_x][cur_y] = false;
                // Mark the can as already collected.
            } else
                fit += ERR_CLCT_PT;
        }
    }
    return fit;
}
```

### Generate the Entire Population at Once

This basically wraps the preceding single-gene generator in another function.

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

### Randomly Select Array Elements According to Their Weights

The function receives two parameters: the weight of every element, or index, in an array, and the number of elements to select.

The main idea is as follows. The `rand()` function generates a uniformly distributed random integer from 0 through `RAND_MAX`. We need only assign a range to each index according to its weight. If the value produced by `rand()` lies in that range, select the corresponding element.

For example, suppose `RAND_MAX` is 9 and the `possi` array is $[4,3,2,1]`. We obtain the following mapping of indices to ranges:

$$
1 \to [0,3]\\
2 \to [4,6]\\
3 \to [7,8]\\
4 \to [9,9]\\

\footnotesize{Note: 1,2,3, and so on denote element indices here, not weights.}
$$

Elements with greater weights therefore have a greater probability of being selected.

Next, put the range corresponding to every index into a `map`. Define the lower bound of the range mapped to index $i$ as $dn_i$; for example, $dn_1=0$ above. The map can then establish a mapping $dn_i\to i$.

For the preceding example, this mapping is:

$$
0 \to 1\\
4 \to 2\\
7 \to 3\\
9 \to 4
$$

If `rand()` produces a random value $rnd$, we can use `map::upper_bound(key)` to find the first key in the map greater than $key$. The preceding position is the index we need.

For example, if $rnd=5$, the first key greater than this value in the mapping above is 7. The entry before 7 has key 4 and value 2, so the second element is selected.

According to the earlier index-to-range mapping, index 2 corresponds to $[4,6]$. Since $rnd=5$, index 2 should indeed be selected.

```cpp
vector<int> choose_by_weight(vector<float>& possi, int cnt) {
    vector<int> ret;
    ret.reserve(cnt);
    double tot = 0;
    for (float cur : possi) {
        tot += cur;
        // Calculate the sum of the weights.
    }
    map<int, int> choose_rg;
    int lst = 0;
    for (int i = 0; i < possi.size(); i++) {
        int len = lround(possi[i] * 1.0 / tot * 1.0 * (RAND_MAX * 1.0));
        // Calculate the length of this range.
        if (len == 0) continue;
        choose_rg[lst] = i;
        lst = lst + len;
    }
    choose_rg[IINF] = possi.size();
    while (ret.size() < cnt) { // Select cnt elements and put them into ret.
        int rd = rand();
        int rd_idx = (--choose_rg.upper_bound(rd))->second; 
        // Use upper_bound() to find the first element greater than key, then take its predecessor.
        ret.push_back(rd_idx);
        // Push the value corresponding to that element.
    }
    return ret;
}
```

## Evolution

Create two population objects of type `Gene_pool_t`. One represents the current population, and the other represents its children.

As described earlier, first calculate the fitness of every individual in the population. Select parents according to fitness, reproduce the next generation, and repeat this process 1,000 times to obtain a good strategy.

```cpp
void evolve(int cur_gen) {
    if (cur_gen != 1) {
        temp_pool.clear();  // The new generation is placed in temp.
    }

    for_each(cur_pool.begin(), cur_pool.end(),
             [](Gene_res_t& a) { a.second = 0; });
    // Reset the fitness values in cur_pool.

    for (int m = 0; m < MAP_REP; m++) {
        mp_generator(&cur_map);   // Reset the map.
        Map_t temp_map = cur_map; // Fitness evaluation modifies the generated map (for example, by collecting
                                  // a can), so copy it now and restore it before evaluating another individual.
        for (int i = 0; i < POP_CNT; i++) {
            cur_pool[i].second += calc_fitness(&cur_pool[i].first, &cur_map);
            cur_map = temp_map;
        }
    }
    for (auto& res : cur_pool) {
        res.second /= (MAP_REP * 1.0); // Take the average.
    }
    // Calculate the probability for each gene in the pool.
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
        possi.push_back(i * 1.0 * sqrt(i * 1.0)); // Weight of each gene; higher fitness should give a larger
                                                  // weight. This weighting function can be changed.
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
        // Produce the next generation.
        temp_pool.push_back({child, 0});
    }
    swap(cur_pool, temp_pool);
}

int main() {
    fileout.open("./out");
    gene_generator(&cur_pool, POP_CNT);  // Create the initial genes.
    for (int i = 1; i <= GEN_CNT; i++) {
        evolve(i);
    }
    system("python ./plotting.py"); // Draw the graph at the end.
    
}
```

# Results

The following graph was drawn with Matplotlib. Its source is:

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
# [generated by LLM] The preceding Chinese label means "maximum fitness=".
plt.xlabel("代数", fontsize = FONTSIZ)
# [generated by LLM] The preceding Chinese label means "generation number".
plt.ylabel("每代最大适应度", fontsize = FONTSIZ)
# [generated by LLM] The preceding Chinese label means "maximum fitness in each generation".
plt.legend(fontsize = FONTSIZ)
plt.savefig(fname="ga_result.svg",format="svg")
plt.show()
```

![](/img/遗传算法_复杂/ga_result.svg)

Although the graph fluctuates, its overall trend is upward. The best strategy reached a fitness of 590. This is a very good score because a map contains only 50 cans on average. The randomly generated map for this score may simply have contained more cans than usual, allowing the robot to collect 59 cans in total.

# Source Code

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
const float CAN_RATE = 0.5;  // Probability that a cell contains a can
// Map settings

const int SUC_CLCT_PT = 10;
const int ERR_CLCT_PT = -1;
const int HIT_WALL_PT = -5;
// Reward settings

const int MOV_LIM = 200;
const int POP_CNT = 500;
const int GEN_CNT = 1000;
const float MUT_RATE = 0.005;  // Mutation probability at each position
const int MAP_REP = 50;        // Number of maps used to calculate fitness
// Evolution settings

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
typedef pair<Gene_t, float> Gene_res_t;  // Fitness corresponding to a gene
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
        lst = lst + len; // Index of the next range
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
        temp_pool.clear();  // The new generation is placed in temp.
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
    gene_generator(&cur_pool, POP_CNT);  // Create the initial genes.
    for (int i = 1; i <= GEN_CNT; i++) {
        evolve(i);
    }
    system("python ./plotting.py");
    pause;
}
```
