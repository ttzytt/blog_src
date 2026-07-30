# Hexo 中的 Plotly 集成

博客现在通过本地包 `packages/hexo-plotly` 集成 Plotly 3.7.0。插件负责
Hexo tag、按页资源注入、本地 fallback、MathJax、公共样式、多语言和预览
依赖追踪；文章目录只保留图表本身的数据与渲染逻辑。

## 文章配置

只有需要交互图表的文章才启用 Plotly：

```yaml
plotly: true
```

如果 Plotly 标题、坐标轴、图例、注释或图表外部控件包含 TeX，再启用：

```yaml
plotly: true
plotly_mathjax: true
```

`plotly_mathjax` 只控制 Plotly 及其外部控件使用的 MathJax。正文仍由
`katex: true` 或 Butterfly 的正文公式配置处理，两者不会重复加载同一个库。

## 嵌入外部图表代码

文章通过 tag 嵌入 JavaScript：

```text
{% plotly chart-id source/graph_code/post-name/chart.js 420 %}
```

- 第一个参数是页面内唯一的 DOM id。
- 第二个参数是相对博客根目录的 `.js` 文件路径。
- 第三个参数是图表高度，单位为像素，可以省略。
- 文件不强制位于 `graph_code`，但建议按文章建立子目录。
- 路径必须留在博客根目录中；插件也会检查符号链接解析后的真实路径。
- JavaScript 会在构建时内联，因此只能引用可信代码。

图表文件可以使用 `target`、`Plotly`、`HexoPlotly` 和 `chartI18n`。
`BlogPlotly` 暂时保留为 `HexoPlotly` 的兼容别名，所以现有图表无需一次性改名。

## 图表多语言

每张图只维护一份 JavaScript。可翻译文字放在同目录、同名的
`.i18n.yml`：

```text
source/graph_code/post-name/chart.js
source/graph_code/post-name/chart.i18n.yml
```

```yaml
default: zh-CN
zh-CN:
  dutyCycle: 占空比
  timeConstant: 时间常数
en:
  dutyCycle: Duty cycle
  timeConstant: Time constant
```

插件按以下顺序选择语言：

1. tag 的 `lang=...`；
2. 文章 Front Matter 的 `lang` 或 `language`；
3. 当前 Hexo 配置的 `language`；
4. 翻译文件的 `default`。

地区语言会尝试回退到基础语言。一般让中英文构建自动选择即可；确有覆盖
需求时可以写：

```text
{% plotly chart-id source/graph_code/post-name/chart.js 420 lang=en %}
```

图表脚本从 `chartI18n.text` 读取专用文案，从 `chartI18n.common` 读取
坐标切换和控件分隔符等公共文案。所有语言必须提供相同的扁平字符串键，
缺键或嵌套值会在构建阶段报错。公式中的 `\text{...}` 也属于可见文字，
应放入可翻译字符串，不能只翻译公式外的标题。

插件还会按站点语言加载 Plotly 官方 locale，使 modebar 一并本地化。
`plotly.js-locales` 的 npm 源文件是 CommonJS 模块，生成器会把本地副本包装成
浏览器可执行的 `Plotly.register(...)`，而不是直接复制源文件。

## 加载流程

1. 只在文章 `plotly: true` 或页面实际包含 Plotly tag 时注入插件资源。
2. 同一页面无论有多少张图，只注入一次共享 CSS、运行时和 Plotly。
3. Plotly 优先请求配置的 jsDelivr 3.7.0；10 秒超时或失败后加载插件生成的
   同版本本地文件。本地仍失败时再次请求 CDN，最后一次不设置超时。
4. 仅在 `plotly_mathjax: true` 时加载 MathJax 3.2.2，使用 CDN 优先、
   本地回退。
5. 非英文页面使用同样策略加载 Plotly modebar locale。
6. 图表完成渲染后移除纯 CSS 加载动画；异常时显示当前语言的失败提示。

本地 Plotly、MathJax、locale、CSS 和运行时都由插件 Generator 生成到
`assets/hexo-plotly/`。它们不属于 Butterfly，换主题时不需要迁移文件。
资源 URL 使用 Hexo 的 `url_for` 生成，所以英文站的 `/en/` 前缀也正确。

MathJax SVG 使用 `fontCache: 'local'`。这里的 `local` 表示每个公式 SVG
携带自己的字形定义，不是指从本地加载 MathJax。Plotly 会复制公式 SVG；
页面级 `global` 字形缓存可能让复制后的公式丢失字形引用。

## 公共主题和控件

`packages/hexo-plotly/assets/hexo-plotly.js` 提供：

- `getColors()`：读取 `--hexo-plotly-*` CSS 变量；
- `baseLayout()`：统一透明背景与文字颜色；
- `axis()`：统一坐标轴、网格和零线；
- `createRangeControls()`：创建图表外部滑块；
- `initializeMathChart()`：先排版外部 MathJax，再初始化 Plotly；
- `axisScaleButtons()`：创建对数/线性坐标切换按钮；
- `observeTheme()`：主题变化后通知图表重新渲染。

样式位于 `packages/hexo-plotly/assets/hexo-plotly.css`。它不读取 Butterfly
配置，而是识别常见亮暗主题属性/类和 `prefers-color-scheme`；主题需要更精确
的配色时，覆盖 `--hexo-plotly-*` 变量即可。加载动画不依赖 Font Awesome。

`stop_input_propagation: true` 是当前博客针对 Butterfly power-mode 效果的
兼容配置，不是插件对所有主题的默认假设。

## 实时预览与重新渲染

tag 会把图表 JavaScript 内联进文章 HTML。仅仅刷新浏览器只能重新请求 Hexo
当前生成的 HTML；如果 Hexo 复用了文章的旧渲染缓存，刷新本身不会读入新的
图表文件。

插件因此建立了“图表文件 → Post/Page”的依赖表：

- `source_dir` 中的 `.js` 或 `.i18n.yml` 变化由 Hexo source watcher 捕获；
- 其他位于博客根目录内的引用目录由插件按需监听；
- 变化后把对应文章的 `content`、`excerpt` 和 `more` 置为待重新渲染；
- Hexo server 随后重新生成，LiveReload 或手动刷新即可看到新图。

Hexo 公开的 Box watcher 只直接面向 source/theme。外部目录完成失效后需要
触发 Hexo 当前内部使用的 `processAfter` 事件，因此这是插件中最依赖 Hexo
内部行为的部分。如果未来 Hexo 大版本改变该事件，最坏情况是外部目录不能
自动刷新；构建与 `source_dir` 内图表仍可正常工作。

## 当前文章中的图表约定

频率轴图表默认使用对数坐标，并用 `axisScaleButtons()` 提供对数/线性切换。
重绘前从 `target.layout.xaxis.type` 读取当前状态，滑块和主题切换不会把用户
强制送回默认坐标类型。

“周期平均功率随占空比变化”绘制实际曲线、线性参考
\(P_{\mathrm{ref}}D\) 和平方参考 \(P_{\mathrm{ref}}D^2\)。低频时接近线性
极限，高频时接近平方极限。

`power_landscape.js` 用归一化功率
\(\overline P/P_{\mathrm{ref}}=F(D,f\tau)\) 生成 Ribbon 和等高线图。
两图的 \(f\tau\) 轴都可切换坐标类型，Ribbon 用 `uirevision` 保留相机状态。

## 本地验证

```powershell
npm test --prefix packages/hexo-plotly
npm run check --prefix packages/hexo-plotly
node --check source/graph_code/LR_system_PWM/average_power.js
git diff --check
```

验证未发布文章时：

```powershell
npm run clean
npx hexo generate --config _config.yml,config-zh.yml --draft --bail
```

还要单独验证英文配置的 `/en/` 资源 URL和图表文案。完成草稿验证后执行正常
多语言构建，避免 `public` 残留未发布页面：

```powershell
npm run clean
npm run build
```
