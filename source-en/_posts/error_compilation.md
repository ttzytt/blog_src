---
title: "Collection of Miscellaneous Problems"
date: 2022-06-20 01:52:32
updated: 2022-10-15 20:05:43
tags:
- Error Reports
- 2022
categories:
- Uncategorized
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

{% note danger simple %}
The content below was generated entirely by machine translation. Please verify its accuracy. If anything is unclear, consult the [Chinese source version](/2022/06/error_compilation/).
{% endnote %}

I will put some errors encountered while writing programs here (or miscellaneous problems such as configuring environments), so that I can come directly here to look when I encounter them again:

They are classified by language, and the time when each error occurred will appear before it.

# C++
## Creating a Thread with `thread` When the Function Is Non-static

2022/6/20

If you use `std::thread()` to create a thread and the function pointer passed in is non-static, you need to write it like this:

```cpp
thread(&class_name::func_name, this, arg1, arg2, other_args...);
```

Because this function is different for each instance, only by passing in the `this` pointer can it know which instance's function should actually be executed when the thread runs.

# Other
## When Compiling the RISC-V Toolchain, `riscv64-unknown-elf-gdb` Had No TUI Mode Because Curses Was Not Installed

2022/7/12

Today was so exasperating. I had already spent a long time compiling it, and then I was preparing to open QEMU and `riscv64-unknown-elf-gdb` to step through the xv6 kernel. After entering `layout split`, it unexpectedly told me `Undefined command: "layout".  Try "help".`

Then I tried passing a `-tui` argument when starting GDB, and it unexpectedly displayed `riscv64-unknown-elf-gdb: TUI mode is not supported`.

After searching online for a while, I found that it was because curses was not installed, but why did my other GDB installations work???

So I could only download curses and compile it all over again, and the compilation was extremely slow....

Afterward, I could finally use `layout` successfully.

![](/img/报错集合/gdb_tui.png)

# VS Code
## Files Deleted Accidentally with VS Code in WSL Cannot Be Found in the Windows Recycle Bin

This should be a bug? (See this [link](https://github.com/microsoft/vscode/issues/108731).) If a file is deleted in VS Code under Windows, the deleted file is automatically moved to the Recycle Bin. Under WSL, however, it is equivalent to running `rm` directly and cannot be recovered.

At this point, some strange methods are needed. We know that VS Code has a very useful feature called Timeline, which can be used to view previous versions of a file. Although we cannot view the Timeline after deleting the file, the cache is still there. In WSL, these caches are stored in the `/root/.vscode-server/data/User/History` folder. However, all the filenames are garbled, so it may take some time to find the right one.

Finally, thanks to the comment by "@iutlu" under this Stack Overflow [answer](https://stackoverflow.com/questions/41265844/restore-a-deleted-file-in-the-visual-studio-code-recycle-bin); otherwise, I would have had to rewrite what I wrote at noon today.
