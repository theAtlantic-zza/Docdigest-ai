<div align="center">

# DocDigest — AI Document Analyzer & Job Fit Assistant

**From raw documents to hiring-ready insights.**

Upload `txt / md / pdf` → generate structured analysis → chat follow-ups → export results.

![Node.js](https://img.shields.io/badge/Node.js-≥18-3c873a?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)
![Status](https://img.shields.io/badge/Status-In%20Progress-6ea8fe)

</div>

![Home](screenshots/home.png)
![Resume Analysis](screenshots/resume-analysis.png)
![Job Fit](screenshots/job-fit-analysis.png)

## ✨ What is this

DocDigest is a **local-first AI document analyzer** designed for resume workflows and high-signal reading.
Instead of producing one generic summary, it helps you **understand**, **improve**, and **match** a resume to a target role — and lets you keep asking follow-up questions on top of the current document context.

Built to feel like a small product you can actually demo, not a one-off script.（英文为主，少量中文注释）

## 🚀 Key Capabilities

### 📄 Document Understanding

- Upload & extract text from `txt / md / pdf`
- Generate **Summary**, **Key Points**, and **Outline**
- Render AI output as Markdown for readability

### 💼 Resume & Job Fit

- Resume improvement suggestions (actionable edits, structure, clarity)
- **Job fit analysis (岗位匹配分析)** with a **Target role** input
  - match score & rationale
  - strengths, gaps, and recommended next steps

### 💬 Interactive Analysis

- Chat-style follow-ups based on the **current document + current analysis**
- Session-only chat history (no server persistence)

### 📤 Shareable Output

- Copy result to clipboard
- Export **raw Markdown** / **plain text**
- Local analysis history stored in `localStorage` (open/switch/clear)

## 🧠 How it works

1. **Upload** a document (`txt / md / pdf`)
2. **Parse** text locally on the server (PDF via `pdf-parse`)
3. **Send** the document context to DashScope / Qwen for analysis
4. **Render** Markdown output and enable export / follow-up chat

## 📸 Demo

The README screenshots above are expected at:

- `screenshots/home.png`
- `screenshots/resume-analysis.png`
- `screenshots/job-fit-analysis.png`

## ⚡ Getting Started

```bash
cd docdigest
npm install
cp .env.example .env
npm start
```

Open `http://localhost:3000`.

## 🛠 Tech Stack

- Node.js
- Express
- Vanilla HTML/CSS/JS
- DashScope / 通义千问 API (Qwen compatible-mode Chat)
- pdf-parse

## 📦 Project Structure

```text
docdigest/
  server.js                # upload, summarize, chat
  public/
    index.html             # UI
    style.css              # styling
    main.js                # client logic (history/chat/export)
  .env.example
  LICENSE
  README.md
  screenshots/
```

## Environment Variables

Create `.env`:

```env
DASHSCOPE_API_KEY=your_api_key_here
PORT=3000
```

- `DASHSCOPE_API_KEY` (required): DashScope API key
- `PORT` (optional): default `3000`

## 🎯 Use Cases

- Resume optimization: rewrite bullets, improve clarity, surface strengths
- Job matching: evaluate fit against a target role and plan next actions
- Document summarization: turn long notes into an outline + key points

## 🗺 Roadmap

- Deployment: Docker / one-click run
- Chat with document: better multi-turn memory per document
- More file types (e.g., docx) and improved extraction quality
- Multi-model support (configurable provider/model)
- Streaming responses for long outputs

## 📄 License

MIT — see [`LICENSE`](LICENSE).

