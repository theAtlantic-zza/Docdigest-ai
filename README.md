# DocDigest · AI 文档分析工具

一个轻量、可本地运行的 AI 文档分析工具：支持上传 `txt / md / pdf`，选择分析模式，一键生成结果；自动保存历史记录（`localStorage`），结果支持 Markdown 渲染。

## 功能

- 上传并解析：`txt / md / pdf`
- 4 种分析模式：
  - 摘要
  - 提取要点
  - 生成大纲
  - 简历优化建议
- AI 结果展示：Markdown 渲染
- 历史记录：自动保存、点击查看、新建分析、清空历史（仅保存在浏览器本地）

## 技术栈

- Node.js
- Express
- 原生 HTML / CSS / JS
- DashScope（通义千问 Compatible Mode Chat API）
- `pdf-parse`（PDF 文本提取）
- `marked`（前端 Markdown 渲染，CDN）

## 本地运行

1) 安装依赖

```bash
cd docdigest
npm install
```

2) 配置环境变量

复制示例文件并填入你的 Key：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
DASHSCOPE_API_KEY=your_api_key_here
PORT=3000
```

3) 启动

```bash
npm start
```

打开浏览器访问：`http://localhost:3000`

## 使用方式

1. 上传 `txt / md / pdf` 文件
2. 选择分析模式
3. 点击“生成结果”
4. 左侧历史记录会自动保存本次分析（可点击切换查看）

## 环境变量说明

- `DASHSCOPE_API_KEY`：必填，DashScope API Key
- `PORT`：可选，默认 `3000`

## 截图

你可以在仓库里添加截图，例如：

- `docs/screenshot-home.png`
- `docs/screenshot-history.png`

然后在这里替换为实际图片引用。

