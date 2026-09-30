# 草莓侦探

一个用于科普信号检测论的互动实验网站。参与者需要判断每盘草莓中是否存在坏草莓，完成 20 轮实验后，可以查看击中、漏报、虚报、正确拒绝、敏感性 d′ 和判断标准 c 等指标。

## 最简单的运行方法

直接双击仓库根目录中的 `index.html`，网站会在默认浏览器中打开。

这个文件已经把 HTML、CSS 和 JavaScript 合并到一起，不需要安装软件，也不需要启动服务器。草莓图形使用内嵌 SVG，因此离线打开也可以正常显示。

## 使用 VS Code 运行源码

可编辑的源码位于 `src` 文件夹：

- `src/index.html`：页面结构
- `src/styles.css`：页面样式
- `src/app.js`：界面交互和实验流程
- `src/core.js`：数据生成与信号检测论计算

由于源码使用了 JavaScript 模块，不建议直接双击 `src/index.html`。可以选择以下任一方式启动本地服务器。

### 方法一：使用 Python

在仓库根目录打开终端，运行：

```bash
python -m http.server 8000 --directory src
```

然后访问：

```text
http://localhost:8000
```

如果 Windows 中 `python` 命令不可用，可以尝试：

```bash
py -m http.server 8000 --directory src
```

### 方法二：使用 VS Code Live Server

1. 在 VS Code 中安装 Live Server 扩展。
2. 打开 `src/index.html`。
3. 点击右下角的 `Go Live`，或右键选择 `Open with Live Server`。

## 修改代码后重新生成可双击版本

需要安装 Node.js 18 或更高版本。

在仓库根目录运行：

```bash
npm run build
```

脚本会读取 `src` 中的源码，并重新生成根目录的 `index.html`。请不要直接修改生成后的根目录 `index.html`，否则下次构建时会被覆盖。

## 运行测试

```bash
npm test
```

测试会检查：

- 实验始终为 20 轮，其中 10 轮信号、10 轮噪声；
- 难度 d′ 会正确改变两类刺激的分布间距；
- 四种判断结果的分类正确；
- 信号检测论指标及概念实验室计算符合预期。

## 上传到 GitHub

1. 在 GitHub 新建一个仓库。
2. 将本文件夹中的全部文件上传到仓库根目录。
3. 提交并推送到 `main` 分支。

如果使用 Git 命令：

```bash
git init
git add .
git commit -m "Add Strawberry Detective experiment"
git branch -M main
git remote add origin 你的仓库地址
git push -u origin main
```

## 使用 GitHub Pages 发布

1. 打开 GitHub 仓库的 `Settings`。
2. 进入 `Pages`。
3. 在 `Build and deployment` 中选择 `Deploy from a branch`。
4. 选择 `main` 分支和 `/(root)` 目录，然后保存。

GitHub Pages 会直接使用根目录的 `index.html`。发布完成后，页面中会显示公开网址。

## 项目结构

```text
草莓侦探-GitHub仓库版/
├─ index.html                 # 可直接双击，也可供 GitHub Pages 使用
├─ README.md                  # 使用说明
├─ package.json               # 构建和测试命令
├─ test-core.mjs              # 核心逻辑测试
├─ scripts/
│  └─ build-standalone.mjs    # 将源码合并为根目录 index.html
└─ src/
   ├─ index.html              # 页面结构源码
   ├─ styles.css              # 样式源码
   ├─ app.js                  # 交互逻辑源码
   └─ core.js                 # 实验与计算逻辑源码
```

## 数据与隐私

网站不需要后端或数据库。实验数据只保存在当前浏览器页面的内存中，刷新或关闭页面后即清除。

