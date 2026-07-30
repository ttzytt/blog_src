# hexo-plotly 插件实现说明

本文记录把博客内的 Plotly 脚本迁移为通用 Hexo 插件时采用的结构、Hexo
扩展点和发布边界。

## 为什么做成插件

原实现同时依赖站点 `scripts/`、Butterfly 的 i18n 对象、主题目录中的 CSS/JS
和 `source/js/vendor`。它适合单一博客，但安装到其他 Hexo 站点时需要手动
复制文件，也很难判断哪些能力属于主题、哪些属于图表。

新实现位于 `packages/hexo-plotly`，通过标准 `hexo-` 包名被 Hexo 加载。
主题只消费最终 HTML/CSS，不参与注册 tag、生成 vendor 资源或选择语言。

## 使用的 Hexo 扩展点

- Tag：注册异步 `{% plotly %}`，在文章渲染阶段读取并内联图表代码。
- Generator：生成运行时、CSS、Plotly、MathJax 和 locale 路由。
- `after_render:html` Filter：确认页面实际使用 Plotly 后，向 `</head>`
  前注入一次加载器。
- Processor：当 `source_dir` 中被引用的图表依赖变化时，使对应文章缓存
  失效。
- `before_generate` Filter：根据 Post/Page 的原始正文重建依赖关系。
- Hexo 生命周期：退出时关闭站点根目录内额外创建的精确目录 watcher。

Generator 返回路由而不是把资源复制到 `source/`，因此不会与 Hexo source
数据库中的同名文件竞争，也避免过去的
`Trying to "create" ..., but the file already exists!` 警告。

## 主题解耦

插件不访问 `hexo.theme.i18n`，不注入 Butterfly 模板，也不使用
Font Awesome。公共样式全部带 `hexo-plotly-` 前缀，颜色通过 CSS 变量公开。
亮暗模式仅使用常见 DOM 信号与系统媒体查询。

某些主题会给 range input 的冒泡事件绑定页面特效。插件为此提供
`stop_input_propagation`，但默认关闭；这是显式兼容开关，不是对主题结构的
硬编码。

## 多语言解耦

语言分三层：

1. 插件公共提示来自包内 `locales/*.yml`，可由 `plotly.i18n` 覆盖；
2. 图表专用文字来自与 `.js` 相邻的 `.i18n.yml`；
3. Plotly modebar 使用官方 `plotly.js-locales`。

图表 JavaScript 只读 `chartI18n`，不需要了解 Hexo 站点如何组织中英文源文件。
插件根据 tag、文章和站点语言做选择。locale npm 包是 CommonJS 数据模块，
Generator 会序列化数据并生成 `Plotly.register(...)` 浏览器脚本。

## 资源和 fallback

Plotly 与 MathJax 的本地文件直接取自固定版本 npm 依赖，避免手工下载文件
与 `package.json` 版本漂移。默认 CDN 仍为当前博客指定的 Plotly 3.7.0
jsDelivr 地址。所有本地 URL 使用 Hexo `url_for`，支持 `/en/` 等 root。

Plotly 的 CDN → 本地 → 无超时 CDN 重试是特殊策略。MathJax 和 locale
只做 CDN → 本地；如果它们失败，插件会给出明确降级或错误信息。

## 实时预览的限制

Hexo 的 source/theme Box 能自动监听自身目录，却不会监听任意仓库目录。
因此插件对 source 内外采用两条路径：

- source 内：Processor 参与 Hexo 原有处理循环；
- source 外：只监听实际引用文件所在目录，变化后失效 Post/Page，再触发
  Hexo 当前 watch 循环使用的 `processAfter` 事件。

依赖失效是必要的：图表代码在文章渲染时已内联，浏览器刷新不会自行重新读取
源 `.js`。外部 watcher 使用内部事件，是实现中最需要随 Hexo 大版本复查的
部分；`watch: false` 可以关闭它，而不影响普通构建。

## 测试与发布

插件单元测试覆盖：

- 子目录 root 和自定义资源目录；
- 路径穿越与文件扩展名；
- 图表/公共/Plotly locale 回退；
- 翻译键一致性；
- 图表依赖发现与 Post/Page 缓存失效；
- 浏览器 locale 包装；
- loader 参数和 tag 选项。

发布前还应执行中文、英文草稿构建，检查每页只有一个 loader，并运行：

```powershell
npm test --prefix packages/hexo-plotly
npm run check --prefix packages/hexo-plotly
npm pack --dry-run --prefix packages/hexo-plotly
git diff --check
```

正式发布 npm 之前还需要决定包名所有权、仓库 URL、版本策略、变更日志和 CI
发布凭据。当前 `file:packages/hexo-plotly` 安装方式已经可以在本博客中完整
使用，不要求先发布到 npm。
