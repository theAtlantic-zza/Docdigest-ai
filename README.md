# DocDigest — AI Document Analyzer & Job Fit Insights

**One-liner:** Upload a resume/document (`txt/md/pdf`), run AI analysis (summary/bullets/outline/resume tips/job-fit), chat follow-ups, and export results — with local history.

## Overview

DocDigest is a lightweight, local-first AI document analysis tool built with Node.js + Express and vanilla HTML/CSS/JS.  
It focuses on **practical resume analysis + job fit insights** (岗位匹配分析), and stays easy to run for demos and portfolio links.

## Screenshots

> Add the following files to enable screenshots in GitHub.

![Home](screenshots/home.png)
![Resume analysis](screenshots/resume-analysis.png)
![Job fit analysis](screenshots/job-fit-analysis.png)

## Key Features

- **Upload & parse**: `txt / md / pdf`
- **Analysis modes**
  - Summary
  - Bullet points
  - Outline
  - Resume improvement suggestions
  - **Job fit analysis (岗位匹配分析)** with a target role input
- **Chat follow-ups**: ask more questions based on the current document (session-only)
- **Local history**: saved in `localStorage` (no database)
- **Markdown rendering** for AI output
- **Export & copy**
  - Copy result to clipboard
  - Export raw Markdown
  - Export plain text

## Tech Stack

- **Backend**: Node.js, Express
- **AI API**: DashScope (Qwen, compatible-mode Chat Completions)
- **PDF parsing**: `pdf-parse`
- **Frontend**: Vanilla HTML/CSS/JS
- **Markdown rendering**: `marked` (CDN)

## Local Setup

```bash
cd docdigest
npm install
cp .env.example .env
```

Edit `.env`:

```env
DASHSCOPE_API_KEY=your_api_key_here
PORT=3000
```

Run:

```bash
npm start
```

Open `http://localhost:3000`.

## Environment Variables

- `DASHSCOPE_API_KEY` (required): your DashScope API key
- `PORT` (optional): server port, default `3000`

## Example Use Cases

- **Resume review**: summarize, extract strengths, suggest improvements
- **Job fit analysis**: input a target role and get match score, gaps, and next actions
- **Document digest**: quickly outline long notes or reports

## Roadmap

- [ ] Streaming responses (better UX for long outputs)
- [ ] Safer markdown rendering (sanitization)
- [ ] Better chat context management (multi-turn memory per document)
- [ ] Share/export a single analysis as a standalone file

## License

MIT — see [`LICENSE`](LICENSE).

