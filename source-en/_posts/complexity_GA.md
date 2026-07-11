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

More than a year after reading *Complexity*, I wanted to reproduce the genetic algorithm described in the book. The problem is a robot named Robby in a $10\times10$ grid. Cans are scattered on the grid; in a limited number of moves Robby should collect as many as possible. It starts at $(0,0)$, sees the four neighboring cells and its own cell, and each visible cell is a wall, an empty cell, or a cell containing a can. The seven actions are moving in four directions, moving randomly, picking up a can, and doing nothing.

![Grid illustration](/img/遗传算法_复杂/robin_grid.png)

# Idea

## Gene encoding

What evolves is the strategy mapping the five visible cells to an action. There are $3^5=243$ possible observations, so a gene can be a string of 243 digits, each in $0\ldots6$. In the implementation a `map` stores the same mapping. The five ternary digits are interpreted as one observation key.

## Fitness

Fitness measures how useful a strategy is. The book assigns these rewards:

| Event | Fitness change |
| --- | ---: |
| Pick up a can | $+10$ |
| Hit a wall | $-5$ |
| Try to pick up an absent can | $-1$ |

Each strategy is evaluated on many randomly generated maps and its average score is used, so it does not overfit one map.

## Evolution

Start with a population of 200 random genes. Select parents with probability proportional to fitness, choose a random crossover point, and combine the prefix of one parent with the suffix of the other. During crossover, mutate individual positions with a small probability to preserve diversity. The resulting children form the next generation.

# Implementation

The program uses constants such as `MAP_SIZ = 10` and `CAN_RATE = 0.5`. `Obj_in_dir` represents an object in one of the four directions; `Srndng` records Robby’s five-cell view. Helper routines generate maps and random genes, cross two genes, compute the position after an action, evaluate a gene on a map, create a whole population, and perform weighted random selection.

For every step of an evaluation, the current view is converted to a key, the gene supplies an action, and the score is updated according to the table above. After a generation is evaluated, the best individuals are retained and the rest are produced through weighted selection, crossover, and mutation. Repeating this process makes the average score rise while retaining occasional random changes.

# Results

The evolved strategies collect substantially more cans than a random strategy. The exact score depends on the random seed, number of maps, population size, and number of generations; running the supplied program prints the best individual and its average fitness.

# Source code

The complete C++ source is kept with the original project rather than reproduced here. The article’s code follows directly from the constants, classes, and helper functions described above.
