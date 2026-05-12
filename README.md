# batch-run

一个本地 npm scripts 管理工具，支持通过命令行配置多个项目，并从 CLI 或本地 Web 页面一键打开 Git Bash 执行项目脚本。

## 安装

```bash
npm install -g batch-run
```

本地开发：

```bash
npm install
npm run build
npm link
```

## 使用

```bash
br
```

常用命令：

```bash
br add      # 新增项目
br list     # 查看项目
br run      # 选择项目和 package.json scripts 后执行
br ui       # 打开本地 Web 管理页面
br config   # 设置 Git Bash 路径和 Web 端口
br remove   # 删除项目
```

## 配置

项目配置存储在用户电脑的应用配置目录中，不写入被管理项目。

每个项目配置包含：

- 项目名称
- 项目根路径

工具会在执行时实时读取项目根路径下的 `package.json`，并展示其中的 `scripts`。

## Web 页面

运行：

```bash
br ui
```

工具会启动 `127.0.0.1` 上的本地服务并打开浏览器。页面支持：

- 查看已配置项目
- 新增项目
- 读取项目 `package.json` 中的 `scripts`
- 点击按钮后打开 Git Bash 窗口执行对应脚本

## Windows + Git Bash

当前版本优先支持 Windows + Git Bash。默认会自动检测：

```text
C:\Program Files\Git\git-bash.exe
C:\Program Files (x86)\Git\git-bash.exe
```

如果自动检测失败，可以运行：

```bash
br config
```

手动填写 `git-bash.exe` 路径。
