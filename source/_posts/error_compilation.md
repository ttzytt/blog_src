---
title: "杂项问题集合"
date: 2022-06-20 01:52:32
updated: 2022-10-15 20:05:43
tags:
- 报错
- 2022
categories:
- 不知道咋分类
keywords:
description:
top_img: 'linear-gradient(to right, #2c3e50, #4ca1af)'
comments:
cover: false
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

在这里放一些写程序时报的一些错（或者配置环境之类的很杂的问题），这样下次遇到了可以直接来这里看：

按照语言分类，每个错误前面会有发生的时间。

# cpp
## 用 thread 创建线程，并且函数是非静态时

2022/6/20

如果用 `std::thread()` 创建线程，并且传入函数指针是非静态的，需要这么写：

```cpp
thread(&class_name::func_name, this, arg1, arg2, other_args...);
```

因为对于每个实例，这个函数是不一样的，所以只有传入 `this` 指针，执行这个线程时才知道具体是执行哪个实例的函数。

# 其他
## 编译 riscv 工具链时，因为没有安装 curses，编译出的 riscv64-unknown-elf-gdb 没有 tui 模式

2022/7/12

今天太无语了，本来花了好久时间编译，然后准备打开 qemu 和 riscv64-unknown-elf-gdb 单步 xv6 的内核，结果输入一个 `layout split`，居然告诉我 `Undefined command: "layout".  Try "help".`。

然后又尝试在开启 gdb 时输入一个 `-tui` 参数，居然显示 `riscv64-unknown-elf-gdb: TUI mode is not supported` 。

网上查了一圈之后发现是因为没有安装 curses，但是为啥我别的 gdb 就可以啊？？

于是就只能下载 curses 之后重新编译一遍了，而且这个编译速度贼慢。。。。

之后终于能成功使用 `layout` 了。

![](/img/报错集合/gdb_tui.png)

# vscode
## WSL 环境下使用 vscode 误删除文件后在 windows 回收站中找不到

这应该是一个 bug？（见这个[链接](https://github.com/microsoft/vscode/issues/108731)）。如果在 windows 环境下的 vscode 中删除一个文件，被删除的文件会自动被移动到回收站，不过 WSL 下相当于直接 `rm` 了，不可恢复。

这时候就需要用些奇怪的方法了，我们知道 vscode 有个很好的功能叫时间线（timeline），通过这个功能可以查看到以前版本的文件。虽然我们把文件删除了没法查看时间线，但是缓存还是在的，在 WSL 中，这些缓存存在 `/root/.vscode-server/data/User/History` 这个文件夹中。不过文件名全都是乱码，可能需要花点时间找。

最后感谢 stackoverflow 这个[回答](https://stackoverflow.com/questions/41265844/restore-a-deleted-file-in-the-visual-studio-code-recycle-bin) 下 "@iutlu" 的评论，要不然今天中午写的东西就要重写一遍了。 
