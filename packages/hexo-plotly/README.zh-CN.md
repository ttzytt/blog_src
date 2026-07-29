# hexo-plotly

这是一个与主题解耦的 Hexo Plotly 标签插件，提供按文章加载、Plotly
3.7.0 本地回退、可选 MathJax、图表多语言、共享控件和实时预览依赖追踪。

## 安装与使用

```sh
npm install hexo-plotly
```

文章 Front Matter：

```yaml
plotly: true
plotly_mathjax: true # 仅当图表或外部控件含 TeX 时使用
```

嵌入站点根目录内可信的 JavaScript：

```text
{% plotly chart-id source/graph_code/post/chart.js 420 %}
```

高度可省略，图表文件也不强制放在 `graph_code`。插件会拒绝绝对路径、
越出站点根目录的路径、非 `.js` 文件，以及通过符号链接越界的路径。

图表代码可直接使用：

- `target`：图表容器；
- `Plotly`：Plotly API；
- `HexoPlotly`：共享主题、坐标轴、滑块和 MathJax 辅助函数；
- `BlogPlotly`：兼容旧图表的别名；
- `chartI18n`：当前语言的共享文案和图表专用文案。

图表代码会被内联到页面，应当只嵌入经过审查的可信代码。

## 多语言

一张图只维护一份 JavaScript，文字放在相邻文件：

```text
source/graph_code/post/chart.js
source/graph_code/post/chart.i18n.yml
```

```yaml
default: zh-CN
zh-CN:
  amplitude: 振幅
en:
  amplitude: Amplitude
```

所有语言必须提供完全相同的一组字符串键。插件依次参考 tag 的
`lang=...`、文章的 `lang`/`language` 和 Hexo 当前语言。图表通过
`chartI18n.text.amplitude` 读取文字；Plotly 自带的 modebar 文字也会加载
对应官方语言包。

## 配置

```yaml
plotly:
  asset_dir: assets/hexo-plotly
  cdn_url: https://cdn.jsdelivr.net/npm/plotly.js@3.7.0/dist/plotly.min.js
  mathjax_cdn_url: https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js
  locale_cdn_template: https://cdn.plot.ly/plotly-locale-{locale}-latest.js
  timeout_ms: 10000
  watch: true
  require_front_matter: true
  stop_input_propagation: false
```

插件自动生成与依赖版本一致的 Plotly、MathJax 和语言包本地资源。
Plotly 首先请求 CDN，超时或失败后请求本地文件；本地仍失败时再次请求
CDN，最后一次不限制等待时间。MathJax 与语言包使用 CDN 优先、本地回退。

`asset_dir` 是生成路由，不要求源文件位于某个主题目录，并且会尊重
`root: /en/` 之类的子目录配置。`stop_input_propagation` 仅用于兼容会监听
滑块冒泡事件的主题。

## 主题解耦

插件不读取主题配置，也不修改主题模板。亮暗模式使用标准媒体查询和常见
HTML 属性/类检测；颜色均来自 `--hexo-plotly-*` CSS 变量，主题可以覆盖这些
变量实现精确适配。加载动画是纯 CSS，不依赖 Font Awesome。

## 实时预览

在 `hexo server` 或 `hexo generate --watch` 中，插件追踪文章引用的 `.js`
和相邻 `.i18n.yml`。文件变化后，对应 Post/Page 的渲染缓存会失效，随后由
Hexo 重新生成。位于 `source_dir` 内的文件复用 Hexo 自带 watcher；站点根目录
内的其他引用目录由插件按需监听，不会扫描或监听整个仓库。

Hexo 的公开 Box API 只直接覆盖 source/theme 目录，因此外部目录通知使用了
Hexo 当前的内部重新生成事件。这部分最容易受 Hexo 大版本变化影响，插件测试
会覆盖依赖发现和失效逻辑。

完整 API、配置项和示例见英文 [README](README.md)。
