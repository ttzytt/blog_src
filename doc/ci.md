# CI 检查与部署

本文记录当前 GitHub Actions 工作流、多语言检查工具和 Hexo 构建发布流程。

## 工作流入口

工作流文件为 `.github/workflows/deploy.yml`，在以下情况运行：

- 向 `main` 分支推送；
- 从 GitHub Actions 页面手动触发 `workflow_dispatch`。

工作流只申请 `contents: read` 权限。部署目标仓库通过独立 SSH deploy key
写入，不依赖源仓库的写权限。

`concurrency.group` 固定为 `hexo-deployment`，并启用
`cancel-in-progress: true`。如果连续推送，新任务会取消尚未完成的旧部署，
避免旧版本最后覆盖新版本。

## 多语言 CI 工具

`ci_tools` 是独立的 Python 3.14 项目，依赖由 `uv.lock` 锁定。命令行入口为：

```powershell
uv --directory ci_tools run multilingual-ci check --project-root ..
```

工具从 `_config.yml` 和 `config-*.yml` 发现语言、`source_dir` 和文章路径，
按相对路径配对中文与英文 Markdown。`check` 命令组合五类检查：

1. `TaxonomyCheck`：根据 `translation-glossary-zh-en.csv` 检查标签和分类
   的中英文映射，并报告未使用映射。
2. `LanguageCoverageCheck`：检查每个相对路径是否存在所有语言版本。
3. `FrontMatterConsistencyCheck`：允许标题、标签、分类、关键词、描述和
   `lang` 本地化，其余 frontmatter 字段必须保持一致。
4. `ContentCompletenessCheck`：检查译文字符量以及代码块、图片、链接数量，
   防止不完整翻译通过 CI。
5. `PostFilenameCheck`：检查所有语言的 `_posts` Markdown 文件名，要求名称只由
   小写英文字母、数字和作为分隔符的单个连字符组成。

任一语言版本设置 `skip_multilingual_check: true` 时，该相对路径会整体跳过
前四项多语言检查。文件名属于仓库结构约束，不受该选项影响。它适合测试页或
明确不翻译的文章，不应作为普通错误的规避方式。

CI 在运行业务检查前还会执行：

```powershell
uv --directory ci_tools run ruff check src tests
uv --directory ci_tools run ruff format --check src tests
uv --directory ci_tools run mypy src tests
uv --directory ci_tools run pytest
```

这分别检查代码规范、格式、严格类型和自动化测试。

## 多语言 Hexo 构建

`npm run build` 调用 `scripts/build-multilingual.js`，而不是简单地连续覆盖同一个
`public` 目录。

构建脚本会：

1. 清理旧输出和临时配置。
2. 使用 `_config.yml,config-zh.yml` 将中文站构建到独立临时目录。
3. 在新的 Hexo 进程中使用 `_config.yml,config-en.yml` 构建英文站。
4. 修正英文 HTML 中应复用根目录的静态资源路径。
5. 将中文输出复制到 `public`，再把英文输出放到 `public/en`。
6. 无论成功或失败都清理临时目录、临时配置和 Hexo 数据库文件。

构建脚本还会扫描 Hexo 输出。即使 Hexo 进程返回退出码 0，只要日志包含
`ERROR` 或 `Process failed:`，整个构建仍会失败，避免部分文章静默缺失。

本项目的 Windows 工作目录已经启用按目录区分大小写，因此仅大小写不同的
旧 alias 和新的小写正文也能同时写入 `public`；Linux CI 原生支持这种目录。
如果将仓库重新克隆到另一个 Windows 目录，需要先为新目录启用大小写敏感，
否则这些路径会在本地构建时发生冲突。

## GitHub Actions 构建步骤

部署 job 依次执行：

1. `actions/checkout@v6` 检出源码。
2. `astral-sh/setup-uv` 安装 uv 和 Python 3.14，并缓存 Python 依赖。
3. `uv sync --project ci_tools --locked --dev` 安装锁定的运行及开发依赖。
4. 执行 ruff、mypy、pytest 和多语言内容检查。
5. `actions/setup-node@v6` 安装最新 Node.js LTS，并启用 npm 缓存。
6. `npm ci` 严格按照 `package-lock.json` 安装依赖。
7. `npm run check:plotly` 检查 `hexo-plotly` 语法并运行插件单元测试。
8. `npm run build` 生成中文站和英文站，同时完成插件的站点级集成验证。
9. 配置 `PAGES_DEPLOY_KEY`，克隆 `ttzytt/ttzytt.github.io`。
10. 使用 `rsync -a --delete` 将 `public` 同步到部署仓库。
11. 只有暂存区确实有变化时才创建部署提交并推送 `main`。

部署提交保留源提交标题、正文和 SHA，方便从生成站仓库追溯到源码提交。

## 必要的仓库配置

GitHub Actions secret `PAGES_DEPLOY_KEY` 必须保存一把能够写入
`ttzytt/ttzytt.github.io` 的私钥；对应公钥应作为部署仓库的可写 deploy key。

如果 key 缺失或权限不足，检查和 Hexo 构建仍可能成功，但克隆或推送部署仓库
时会失败。

## 本地复现

完整复现 CI 的主要检查：

```powershell
uv sync --project ci_tools --locked --dev
uv --directory ci_tools run ruff check src tests
uv --directory ci_tools run ruff format --check src tests
uv --directory ci_tools run mypy src tests
uv --directory ci_tools run pytest
uv --directory ci_tools run multilingual-ci check --project-root ..
npm ci
npm run check:plotly
npm run build
```

日常开发已经安装依赖时，可以使用仓库提供的快捷命令：

```powershell
npm run check:multilingual
npm run build
```

CI 会真正发布远端内容；本地执行上述命令只进行检查和构建，不会自动推送
部署仓库。
