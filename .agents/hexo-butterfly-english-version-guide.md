# 为现有 Hexo Butterfly 博客添加英文版本

> 本文档用于指导 Codex 在现有 Hexo + Butterfly 博客中建立英文版本。  
> 本阶段只建立正确的多语言目录、配置、构建和导航结构；文章翻译由后续流程单独处理。

## 1. 目标

在保留现有中文站点的前提下，增加一个完整隔离的英文站点：

```text
中文站
https://ttzytt.com/
https://ttzytt.com/archives/
https://ttzytt.com/tags/
https://ttzytt.com/categories/
https://ttzytt.com/posts/<post-id>/

英文站
https://ttzytt.com/en/
https://ttzytt.com/en/archives/
https://ttzytt.com/en/tags/
https://ttzytt.com/en/categories/
https://ttzytt.com/en/posts/<post-id>/
```

英文站必须有独立的：

- 文章集合
- 首页和分页
- 归档
- 标签和分类
- 自定义页面
- 本地搜索索引
- RSS / Sitemap（如果现有站点启用了对应生成器）
- Butterfly 界面语言和导航菜单

不要只修改 `language: en`。该配置主要负责翻译 Butterfly 的界面文字，例如 `标签 → Tags`、`分类 → Categories`，不会自动翻译、复制或隔离文章内容。

---

## 2. Butterfly 官方文档站采用的结构

Butterfly 官方文档站使用两套内容源，而不是在同一个 `source` 中混合中英文文章。

官方仓库的核心结构可以概括为：

```text
.
├── source/                      # 中文内容
│   ├── _posts/
│   ├── tags/
│   ├── categories/
│   └── ...
│
├── source-en/                   # 英文内容
│   ├── _posts/
│   ├── tags/
│   ├── categories/
│   └── ...
│
├── _config.yml                  # 中文 Hexo 配置
├── config-en.yml                # 英文 Hexo 配置
│
├── _config.butterfly.yml        # 中文/默认 Butterfly 配置
└── config-butterfly-en.yml      # 官方仓库中的英文主题配置
```

官方英文 Hexo 配置的关键区别是：

```yaml
language: en

url: https://butterfly.js.org/en
root: /en/

source_dir: source-en
public_dir: public-en
```

因此中文和英文是两次独立的 Hexo 内容构建：

```text
source
  ↓
中文文章数据库
  ↓
中文首页、归档、标签、分类、页面

source-en
  ↓
英文文章数据库
  ↓
英文首页、归档、标签、分类、页面
```

标签和分类不需要特殊的多语言插件。Hexo 会从当前 `source_dir` 中文章的 Front Matter 收集标签和分类，因此两套内容源会自然生成两套互不混合的标签和分类。

### 本项目采用的调整

官方仓库将英文输出到 `public-en`。对于同一个 GitHub Pages 站点下的 `/en/`，推荐直接输出到：

```yaml
public_dir: public/en
```

这样最终只需要部署一个 `public/`：

```text
public/
├── index.html
├── archives/
├── tags/
├── categories/
├── posts/
│
└── en/
    ├── index.html
    ├── archives/
    ├── tags/
    ├── categories/
    └── posts/
```

---

## 3. 推荐目录结构

在现有仓库中保留中文目录，不要移动现有内容。

```text
.
├── source/                              # 现有中文内容，保持不变
│   ├── _posts/
│   ├── tags/
│   │   └── index.md
│   ├── categories/
│   │   └── index.md
│   ├── about/
│   │   └── index.md
│   └── ...
│
├── source-en/                           # 新建英文内容目录
│   ├── _posts/
│   ├── tags/
│   │   └── index.md
│   ├── categories/
│   │   └── index.md
│   ├── about/
│   │   └── index.md
│   └── ...
│
├── _config.yml                          # 现有中文 Hexo 配置
├── config-en.yml                        # 新建：英文覆盖配置
├── _config.butterfly.yml                # 现有 Butterfly 配置
├── package.json
└── ...
```

只创建当前站点实际使用的自定义页面。例如现有站点还有：

```text
source/link/
source/gallery/
source/messageboard/
```

则英文版本需要时再建立对应路径：

```text
source-en/link/
source-en/gallery/
source-en/messageboard/
```

路径尽量与中文版本一致，仅在站点根路径前增加 `/en/`。

---

## 4. 中文 Hexo 配置

保留现有 `_config.yml`，确认至少包含以下逻辑：

```yaml
language: zh-CN

url: https://ttzytt.com
root: /

source_dir: source
public_dir: public

theme: butterfly
```

不要为了英文站重命名或移动当前的 `source/`。

如果当前站点使用其他中文语言代码，例如 `zh-HK` 或 `zh-TW`，保持现状，不要无故修改。

---

## 5. 英文 Hexo 覆盖配置

新建根目录文件：

```text
config-en.yml
```

推荐只写与中文配置不同的部分，并在构建时与 `_config.yml` 合并：

```yaml
# English site overrides

language: en

url: https://ttzytt.com/en
root: /en/

source_dir: source-en

# 直接生成到主站 public/en，便于一次部署
public_dir: public/en
```

Hexo 支持合并多个配置文件，后面的文件覆盖前面的文件：

```bash
hexo generate --config _config.yml,config-en.yml
```

不要在逗号后加入空格。

### 英文专用 Butterfly 配置

Hexo 会自动读取根目录的：

```text
_config.butterfly.yml
```

但不会因为使用 `config-en.yml` 就自动读取任意命名的：

```text
config-butterfly-en.yml
```

因此，英文专用的 Butterfly 配置建议直接放在 `config-en.yml` 的 `theme_config` 下。`theme_config` 会覆盖 `_config.butterfly.yml` 中的对应项目。

示例：

```yaml
language: en

url: https://ttzytt.com/en
root: /en/

source_dir: source-en
public_dir: public/en

theme_config:
  menu:
    Home: / || fas fa-home

    Page||fas fa-compass:
      Archives: /archives/ || fas fa-archive
      Tags: /tags/ || fas fa-tags
      Categories: /categories/ || fas fa-folder-open

    Language||fas fa-language:
      English: / || fas fa-e
      中文: https://ttzytt.com/ || fas fa-c
```

注意：

- 英文配置中的 `Home: /`、`Archives: /archives/` 等路径参考 Butterfly 官方英文配置写法。
- 因为英文站配置了 `root: /en/`，Butterfly/Hexo 的 URL helper 会为英文站内部链接处理 `/en/` 根路径。
- 返回中文站建议使用完整绝对 URL：

```yaml
中文: https://ttzytt.com/ || fas fa-c
```

这样不会被英文站的 `root: /en/` 再次加前缀。

---

## 6. 中文站语言菜单

在现有 `_config.butterfly.yml` 的 `menu` 中加入普通的 Butterfly 多级菜单：

```yaml
menu:
  首页: / || fas fa-home

  页面||fas fa-compass:
    归档: /archives/ || fas fa-archive
    标签: /tags/ || fas fa-tags
    分类: /categories/ || fas fa-folder-open

  语言||fas fa-language:
    English: /en/ || fas fa-e
    中文: / || fas fa-c
```

Butterfly 官方文档站的语言切换也是普通导航菜单，不是专用 i18n 组件。

本阶段语言按钮只需要实现：

```text
中文站任意页面
  ↓ 点击 English
英文首页 /en/

英文站任意页面
  ↓ 点击 中文
中文首页 /
```

暂时不要实现“当前中文文章自动跳到对应英文文章”。该功能需要文章映射、统一 slug 或自定义字段，可在翻译流程确定后单独实现。

---

## 7. 标签和分类页面

### 中文入口页面

现有目录通常类似：

```text
source/tags/index.md
source/categories/index.md
```

示例：

```markdown
---
title: 标签
layout: tags
type: tags
---
```

```markdown
---
title: 分类
layout: categories
type: categories
---
```

### 英文入口页面

新建：

```text
source-en/tags/index.md
```

内容：

```markdown
---
title: Tags
layout: tags
type: tags
---
```

新建：

```text
source-en/categories/index.md
```

内容：

```markdown
---
title: Categories
layout: categories
type: categories
---
```

这些文件只负责创建：

```text
/en/tags/
/en/categories/
```

它们不定义具体标签和分类。

具体标签和分类来自英文文章 Front Matter：

```yaml
categories:
  - Control Systems

tags:
  - PWM
  - Electromagnets
  - Inductors
```

Hexo 会自动生成对应的标签和分类页面。

不要手动为每个标签或分类创建页面。

---

## 8. 英文文章的路径和 Front Matter

英文文章放在：

```text
source-en/_posts/
```

中文文章和英文文章建议使用相同的逻辑标识和相同的永久链接标识。

例如：

```text
source/_posts/lr-pwm.md
source-en/_posts/lr-pwm.md
```

中文：

```markdown
---
title: 高频 PWM 下 LR 电路的平均电流
date: 2026-07-10 12:00:00
categories:
  - 控制系统
tags:
  - PWM
  - 电感
abbrlink: a1b2c3d4
translation_key: lr-pwm
---

中文正文。
```

英文：

```markdown
---
title: Average Current of an LR Circuit Under High-Frequency PWM
date: 2026-07-10 12:00:00
categories:
  - Control Systems
tags:
  - PWM
  - Inductors
abbrlink: a1b2c3d4
translation_key: lr-pwm
---

English content.
```

### 永久链接必须保持对应

Codex 必须先检查当前博客的 `permalink` 配置。

如果当前博客使用：

```yaml
permalink: posts/:abbrlink/
```

则中英文版本应保留相同的：

```yaml
abbrlink: a1b2c3d4
```

最终得到：

```text
/posts/a1b2c3d4/
/en/posts/a1b2c3d4/
```

如果当前博客使用文件名、`slug` 或 Front Matter 中的 `permalink`，则保持相同的 slug 或 permalink。

目标是尽量形成：

```text
中文：
/posts/<same-id>/

英文：
/en/posts/<same-id>/
```

文章标题可以翻译，但不要随意改变用于 URL 的稳定标识。

### `translation_key`

`translation_key` 是可选的自定义字段，Hexo 和 Butterfly 默认不会处理它。

建议中英文对应文章使用相同值：

```yaml
translation_key: lr-pwm
```

未来可以用它实现：

- 当前文章语言切换
- `hreflang`
- 翻译完整性检查
- 中英文文章配对

---

## 9. 不要发布未翻译的中文文章副本

本阶段不要把所有中文文章直接复制到 `source-en/_posts/` 后作为英文页面发布。

错误做法：

```text
/en/posts/example/
```

页面标题和正文仍然是中文。

这会造成：

- 英文 URL 下出现中文内容
- 搜索索引语言混乱
- 重复内容
- 用户体验较差

在翻译流程完成前，可以：

1. 保持 `source-en/_posts/` 为空；
2. 只加入已经完成翻译的文章；
3. 或将尚未完成的英文文章设为草稿，不参与正式构建。

不要为了“路径先存在”而发布未翻译内容。

---

## 10. 其他页面

若中文站存在以下页面：

```text
source/about/index.md
source/link/index.md
source/gallery/index.md
```

英文版本放在相同相对路径：

```text
source-en/about/index.md
source-en/link/index.md
source-en/gallery/index.md
```

例如：

```text
/about/
→
/en/about/
```

英文 About 页面示例：

```markdown
---
title: About
date: 2026-07-10
type: about
---

English About content.
```

保留现有页面所需的 `layout`、`type`、`comments`、`top_img` 等 Butterfly Front Matter 字段，不要只复制标题而删除主题依赖字段。

---

## 11. 归档、搜索、RSS 和 Sitemap

### 归档

归档由 `hexo-generator-archive` 自动生成。

通常不需要创建：

```text
source-en/archives/index.md
```

只要英文构建使用：

```yaml
source_dir: source-en
root: /en/
```

就会生成：

```text
/en/archives/
```

### 本地搜索

如果当前配置包含：

```yaml
search:
  path: search.xml
  field: post
  content: true
  format: html
```

中文构建会生成：

```text
/search.xml
```

英文构建会生成：

```text
/en/search.xml
```

英文搜索只应包含英文内容。

### RSS

如果启用了 Feed 生成器，英文构建会在英文输出目录生成独立 Feed，例如：

```text
/en/atom.xml
```

### Sitemap

英文构建会生成独立 Sitemap，例如：

```text
/en/sitemap.xml
```

后续可以在搜索引擎管理工具中同时提交：

```text
https://ttzytt.com/sitemap.xml
https://ttzytt.com/en/sitemap.xml
```

本阶段不必实现 Sitemap index，但不要让英文 Sitemap 被中文构建覆盖。

---

## 12. 静态资源和图片

Codex 必须先检查当前博客的资源策略。

### 情况 A：共享根目录资源

例如文章使用：

```markdown
![diagram](/img/lr-pwm/diagram.png)
```

并且图片位于：

```text
source/img/lr-pwm/diagram.png
```

英文页面也可以继续引用：

```markdown
![diagram](/img/lr-pwm/diagram.png)
```

这会直接使用主站根目录的共享资源。

### 情况 B：文章资源文件夹

如果启用了：

```yaml
post_asset_folder: true
```

并存在：

```text
source/_posts/lr-pwm.md
source/_posts/lr-pwm/
```

则英文版本需要检查相对资源路径。

可以复制或同步到：

```text
source-en/_posts/lr-pwm.md
source-en/_posts/lr-pwm/
```

不要假设中文文章中的相对图片路径在 `source-en` 中自动可用。

### 要求

构建后检查英文页面中的：

- 图片
- CSS
- JavaScript
- 字体
- Mermaid / Chart.js 等资源
- 下载文件

不得出现 404。

---

## 13. 构建命令

在 `package.json` 中加入：

```json
{
  "scripts": {
    "build:zh": "hexo generate --config _config.yml",
    "build:en": "hexo generate --config _config.yml,config-en.yml --force",
    "build": "hexo clean && npm run build:zh && npm run build:en"
  }
}
```

执行：

```bash
npm run build
```

期望输出：

```text
public/
├── index.html
├── archives/
├── tags/
├── categories/
├── posts/
│
└── en/
    ├── index.html
    ├── archives/
    ├── tags/
    ├── categories/
    └── posts/
```

最终部署目标仍然只有：

```text
public/
```

不要只生成：

```text
public-en/
```

却忘记将其部署到：

```text
public/en/
```

### 本地预览

先完成双语构建：

```bash
npm run build
```

然后使用任意静态服务器以 `public/` 为根目录预览，例如：

```bash
npx serve public
```

需要检查：

```text
/
以及
/en/
```

Hexo 自带 `hexo server` 更适合预览单套配置；双语合并后的最终目录建议使用普通静态服务器预览。

---

## 14. GitHub Actions / GitHub Pages

现有部署流程中，将原来的：

```bash
npx hexo generate
```

替换为：

```bash
npm run build
```

继续部署：

```text
public/
```

不要分别部署 `public` 和 `public-en` 到同一个 Pages 分支，除非部署脚本明确负责合并目录。

构建顺序应为：

```text
npm ci
  ↓
npm run build
  ↓
部署 public/
```

---

## 15. Codex 实施要求

Codex 在修改前必须先检查：

1. 当前 Hexo 版本；
2. 当前 Butterfly 版本；
3. 当前 `_config.yml`；
4. 当前 `_config.butterfly.yml`；
5. 当前 `permalink` 规则；
6. 是否使用 `hexo-abbrlink`；
7. 是否启用 `post_asset_folder`；
8. 当前 GitHub Actions 或部署脚本；
9. 当前已有的 tags、categories、about 等页面；
10. 当前搜索、Feed 和 Sitemap 插件。

实施时遵守：

- 不移动现有中文 `source/`。
- 不改变现有中文文章 URL。
- 不安装 `hexo-generator-i18n`、`hexo-multilang` 等额外插件，除非现有项目有明确需求。
- 使用 `source/` 与 `source-en/` 隔离内容。
- 使用 `/` 与 `/en/` 隔离 URL。
- 使用普通 Butterfly 菜单实现第一阶段语言入口。
- 英文专用主题设置放入 `config-en.yml -> theme_config`，不要依赖未被构建命令显式加载的任意主题配置文件。
- 不自动翻译文章。
- 不发布未翻译的中文副本到英文 URL。
- 保持中英文对应文章的 URL 标识一致。
- 保持现有中文站构建和部署行为不变。

---

## 16. 验收清单

完成后逐项检查。

### 目录

- [ ] 存在 `source-en/`
- [ ] 存在 `source-en/_posts/`
- [ ] 存在 `source-en/tags/index.md`
- [ ] 存在 `source-en/categories/index.md`
- [ ] 存在 `config-en.yml`
- [ ] 最终生成 `public/en/index.html`

### 页面

- [ ] `/` 正常
- [ ] `/en/` 正常
- [ ] `/archives/` 正常
- [ ] `/en/archives/` 正常
- [ ] `/tags/` 正常
- [ ] `/en/tags/` 正常
- [ ] `/categories/` 正常
- [ ] `/en/categories/` 正常

### 内容隔离

- [ ] 中文首页只显示中文文章
- [ ] 英文首页只显示英文文章
- [ ] 中文归档不混入英文文章
- [ ] 英文归档不混入中文文章
- [ ] 中文标签和分类来自中文文章
- [ ] 英文标签和分类来自英文文章
- [ ] 英文搜索不返回中文文章

### 导航

- [ ] 中文导航存在 `English → /en/`
- [ ] 英文导航存在 `中文 → https://ttzytt.com/`
- [ ] 英文导航的 Home、Archives、Tags、Categories 均位于 `/en/` 下

### 路径和资源

- [ ] 现有中文文章 URL 没有变化
- [ ] 中英文对应文章使用相同稳定 URL 标识
- [ ] 英文页面 CSS 正常
- [ ] 英文页面 JavaScript 正常
- [ ] 英文文章图片无 404
- [ ] 英文搜索索引路径正确

### 部署

- [ ] CI 执行 `npm run build`
- [ ] Pages 部署目录仍为 `public/`
- [ ] 没有遗漏独立的 `public-en/`
- [ ] 线上 `/en/` 可以直接访问

---

## 17. 当前阶段不处理的内容

以下内容留给后续任务：

- 自动翻译文章
- 自动翻译标签和分类名称
- 当前文章一键切换到对应翻译
- `hreflang`
- Canonical 细化
- 自动检测缺失翻译
- 自动同步中英文 Front Matter
- 自动翻译流水线

当前任务只负责建立稳定、可维护、符合 Butterfly 官方双内容源思路的英文站基础结构。

---

## 参考

- Butterfly 官方文档站仓库：  
  <https://github.com/jerryc127/butterfly.js.org>

- Butterfly 主题仓库：  
  <https://github.com/jerryc127/hexo-theme-butterfly>

- Hexo Configuration：  
  <https://hexo.io/docs/configuration>

- Butterfly 官方英文文档：  
  <https://butterfly.js.org/en/>
