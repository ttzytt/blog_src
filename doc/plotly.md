# Hexo 中的 Plotly 集成

本文记录博客当前使用 Plotly 3.7.0 的方式，以及图表代码需要遵守的约定。

## 文章配置

只有需要交互图表的文章才启用 Plotly：

```yaml
plotly: true
```

如果 Plotly 的标题、坐标轴、图例、注释或外部控件包含 TeX，再单独启用：

```yaml
plotly: true
plotly_mathjax: true
```

`plotly_mathjax` 只控制 Plotly 使用的 MathJax。正文仍由
`katex: true` 或 Butterfly 自己的 `mathjax` 配置决定，两者互不替代。

## 嵌入外部图表代码

文章通过自定义 Hexo tag 嵌入 JavaScript 文件：

```text
{% plotly chart-id source/graph_code/post-name/chart.js 420 %}
```

- 第一个参数是当前页面唯一的 DOM id。
- 第二个参数是相对博客根目录的 `.js` 文件路径。
- 第三个参数是图表高度，单位为像素，可以省略。
- 文件不强制放在 `graph_code`，但按文章建立子目录便于维护。
- Hexo 在构建时读取并内联图表代码；修改图表文件后如果预览没有更新，
  需要先运行 `hexo clean`。

图表文件可以直接使用 `target`、`Plotly`、`BlogPlotly` 和
`chartI18n`。其中 `target` 是 tag 创建的图表容器。

## 图表多语言

每张图仍只维护一份 JavaScript。需要翻译的文字放在与图表脚本同目录、
同名的 `.i18n.yml` 中。例如：

```text
source/graph_code/post-name/chart.js
source/graph_code/post-name/chart.i18n.yml
```

翻译文件使用扁平键值结构：

```yaml
default: zh-CN
zh-CN:
  dutyCycle: 占空比
  timeConstant: 时间常数
en:
  dutyCycle: Duty cycle
  timeConstant: Time constant
```

构建时，Plotly tag 按以下顺序选择语言：

1. tag 的 `lang` 选项；
2. 文章 Front Matter 的 `lang` 或 `language`；
3. 当前 Hexo 配置的 `language`；
4. 翻译文件的 `default`。

地区语言会自动回退到基础语言，例如找不到 `en-US` 时继续尝试 `en`。
一般不需要在 tag 中指定语言；中英文站点使用各自配置构建时会自动选择。
只有需要覆盖文章或站点语言时才使用：

```text
{% plotly chart-id source/graph_code/post-name/chart.js 420 lang=en %}
```

图表脚本通过 `chartI18n.text` 读取专用文案，通过
`chartI18n.common` 读取共享文案：

```js
const { common, text } = chartI18n;

BlogPlotly.createRangeControls(target, [
  { label: text.dutyCycle, /* ... */ }
], {
  separator: common.controlSeparator
});

const buttons = BlogPlotly.axisScaleButtons({
  labels: {
    logarithmic: common.logarithmicScale,
    linear: common.linearScale
  }
});
```

共享的加载提示、失败提示、坐标切换按钮和控件分隔符定义在
`_config.yml` 的 `plotly_i18n` 中；单张图专有的标题、轴名、图例和控件名称
放在对应的 `.i18n.yml` 中。构建会检查同一翻译文件中的所有语言是否具有
相同的键，缺键或非字符串值会直接报错。翻译源文件只参与构建，不会复制到
公开站点。

## 加载流程

加载器位于 `scripts/plotly-tag.js`，主要流程如下：

1. 仅在 `plotly: true` 或页面实际包含 Plotly tag 时注入资源。
2. 加载共享样式 `plotly-blog.css` 和共享脚本
   `plotly-blog-theme.js`。
3. 优先从 jsDelivr 加载 Plotly 3.7.0；10 秒内未成功则切换到本地同版本
   文件。本地文件在 10 秒内也未成功时，再次请求 jsDelivr，最后一次不设置
   超时，但浏览器明确触发网络错误时仍会报告加载失败。
4. 仅在 `plotly_mathjax: true` 时加载 MathJax 3.2.2。MathJax 保持
   CDN 优先、本地回退的两阶段策略，每次最多等待 10 秒。
5. `window.plotlyMathReady` 始终等待 Plotly；启用 MathJax 时也等待
   MathJax 初始化完成。
6. 图表渲染完成后移除“图表加载中”提示；异常时显示本地化错误信息。

同一页面中的多张图共享 Plotly、MathJax、主题脚本和样式，不会为每张图
重复下载依赖。

MathJax 的 SVG 字形缓存使用 `fontCache: 'local'`。这里的 `local`
表示每个公式 SVG 携带自己的字形定义，不是指从本地加载 MathJax。
Plotly 会复制 MathJax 生成的 SVG；使用页面级 `global` 字形缓存时，
复制后的公式可能丢失字形引用。

## 共享主题和控件

`source/js/plotly-blog-theme.js` 提供以下公共能力：

- `getColors()`：读取亮色、暗色主题的 CSS 变量。
- `baseLayout()`：设置透明背景和统一文字颜色。
- `axis()`：生成统一的坐标轴标题、网格线和零线。
- `createRangeControls()`：创建图表外部的滑块控件。
- `initializeMathChart()`：先排版外部 MathJax 标签，再初始化 Plotly。
- `axisScaleButtons()`：生成对数坐标与线性坐标切换按钮。
- `observeTheme()`：主题变化后重新渲染图表。

图表专用数学、数据和 trace 应留在对应的图表文件中。跨文章复用的颜色、
控件结构或行为才放入共享 CSS 和共享脚本。

## 对数与线性坐标切换

当前电流—频率图和平均功率—频率图默认使用对数横轴，并在图内提供
“对数坐标”和“线性坐标”按钮。

重新渲染前从 `target.layout.xaxis.type` 读取当前类型，因此拖动滑块或
切换博客主题后，图表不会无条件跳回对数坐标。对数轴的 `range` 使用
以 10 为底的指数范围，线性轴则直接使用实际频率范围。

## 周期平均功率参考曲线

“周期平均功率随占空比变化”包含三条曲线：

- 实际周期平均功率 \(\bar P(D)\)；
- 线性参考 \(P_{\mathrm{ref}}D\)；
- 平方参考 \(P_{\mathrm{ref}}D^2\)。

令直流功耗 \(P_{\mathrm{ref}}=V_0^2/R\)。当 \(f\tau\) 很小时，系统在每个周期内
有更多时间接近稳态，平均功率趋近 \(P_{\mathrm{ref}}D\)；当 \(f\tau\) 很大时，
电流纹波减小，平均功率趋近 \(P_{\mathrm{ref}}D^2\)。实际曲线会随频率在这两种趋势
之间变化。

## 归一化 Ribbon 与等高线

周期平均功率除以直流功耗后可以写成：

\[
\frac{\bar P}{P_{\mathrm{ref}}}=F(D,f\tau).
\]

`power_landscape.js` 使用这个归一化形式生成两张互补的图：

- Ribbon plot 选取多个典型的 \(f\tau\)，用窄 `surface` trace 显示
  \(\bar P(D)/P_{\mathrm{ref}}\) 截面，同时标出低频的 \(D\) 极限和高频的
  \(D^2\) 极限。
- Contour plot 在 \(D\)-\(f\tau\) 平面上用颜色和等高线表示归一化功耗，
  便于从俯视角度读取整体分布。

两张图的 \(f\tau\) 轴默认采用对数坐标，并可用图内按钮切换为线性坐标。
Ribbon 的相机状态通过 `uirevision` 保留，主题变化后不会重置用户视角。

## 本地验证

先检查 JavaScript 语法和补丁空白：

```powershell
node --check scripts/plotly-tag.js
node --check source/js/plotly-blog-theme.js
node --check source/graph_code/LR_system_PWM/average_power.js
git diff --check
```

对于 `published: false` 的文章，使用草稿构建验证：

```powershell
npm run clean
npx hexo generate --config _config.yml,config-zh.yml --draft --bail
```

验证完应重新执行正常构建，以免 `public` 中残留未发布文章：

```powershell
npm run clean
npm run build
```
