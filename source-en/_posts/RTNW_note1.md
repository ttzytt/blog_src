---
title: "Ray Tracing in One Weekend Notes (Part 1)"
date: 2022-10-20 00:00:00
updated: 2022-10-22 17:19:33
tags:
- Ray Tracing
- Computer Graphics
- RTNW
- Perlin Noise
- BVH
categories:
- Study Notes
keywords:
description:
top_img: "/img/光追/next_week/final_scene.png"
comments:
cover: "/img/光追/next_week/final_scene.png"
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
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/10/RTNW_note1/).
{% endnote %}

# `bvh_node`

A bounding-volume hierarchy recursively partitions objects into two groups. During intersection, a ray first tests the node’s bounding box; only a hit descends to its children. This turns a linear scan of all objects into a much smaller traversal.

# Spherical texture coordinates

For a unit-sphere hit point, longitude and latitude map to $(u,v)$. A checker texture can then alternate colors according to the parity of the integer cell. The book applies the checker to the complete sphere; applying it only at the surface requires evaluating the texture at the hit point rather than in the volume.

# Perlin noise

Perlin noise assigns random gradients to lattice points and interpolates their dot products with a smooth fade curve. Summing several frequencies produces turbulence. The implementation question is whether the noise is sampled once per ray hit or accumulated through the whole volume; the former is appropriate for a surface texture.

# Instance transforms

An object can be translated or rotated by transforming the ray into object space, testing the original primitive, then transforming the hit point and normal back. Rotation uses the usual orthogonal matrices; normals use the inverse-transpose when non-uniform scaling is present. Keeping this conversion in a wrapper avoids duplicating primitive intersection code.

# Volumetric fog

Constant-density media randomly scatter a ray before it reaches the next surface. The hit distance is sampled from an exponential distribution and compared with the boundary distance. This makes participating media a simple alternative to explicit volume integration.

# Multithreading

The image can be divided into rows or tiles and rendered by worker threads. Each pixel is independent, so synchronization is only needed for the work queue and final image output.
