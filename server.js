const path = require("path");
const express = require("express");
const multer = require("multer");
const { PDFParse } = require("pdf-parse");
const axios = require("axios");
require("dotenv").config({ override: true });

const app = express();
app.use(express.json({ limit: "2mb" }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB，够用的MVP限制
});

app.use(express.static(path.join(__dirname, "public")));

function isAllowed(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".txt" || ext === ".md" || ext === ".pdf";
}

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "未收到文件" });
  if (!isAllowed(req.file.originalname)) {
    return res.status(400).json({ error: "只支持 .txt、.md 和 .pdf" });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = "";

    if (ext === ".pdf") {
      try {
        const parser = new PDFParse({ data: req.file.buffer });
        const result = await parser.getText();
        await parser.destroy();
        text = result.text || "";
      } catch (e) {
        return res.status(500).json({
          error: "PDF 解析失败",
          detail: e && e.message ? e.message : String(e)
        });
      }
    } else {
      text = req.file.buffer.toString("utf8");
    }

    res.json({
      filename: req.file.originalname,
      text
    });
  } catch (err) {
    res.status(500).json({
      error: "解析文件失败",
      detail: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/summarize", async (req, res) => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "缺少 DASHSCOPE_API_KEY",
      hint: "请在 .env 中配置 DASHSCOPE_API_KEY，或通过环境变量注入"
    });
  }

  const text = (req.body && req.body.text) || "";
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text 不能为空" });
  }
  const type = (req.body && req.body.type) || "summary";

  let instruction = "请用一段话总结以下内容：";
  if (type === "summary") instruction = "请用一段话总结以下内容：";
  if (type === "bullets") instruction = "请用 bullet points 列出以下内容的重点：";
  if (type === "outline") instruction = "请为以下内容生成结构化大纲：";
  if (type === "resume") instruction = "请基于以下内容，给出简历优化建议（用 bullet points，聚焦表达、结构与可量化成果）：";

  try {
    const resp = await axios.post(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        model: "qwen-turbo",
        messages: [
          { role: "system", content: "你是一个擅长提炼要点的中文助手。" },
          { role: "user", content: `${instruction}\n\n${text}` }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    const summary =
      resp.data &&
      resp.data.choices &&
      resp.data.choices[0] &&
      resp.data.choices[0].message &&
      resp.data.choices[0].message.content;

    if (!summary) return res.status(500).json({ error: "未获取到摘要结果" });
    res.json({ summary });
  } catch (err) {
    const status = err && err.response && err.response.status;
    const detail = err && err.response && err.response.data;
    const message =
      (detail && (detail.message || detail.error || detail.msg)) ||
      (err && err.message) ||
      "调用通义千问失败";
    res.status(500).json({ error: "总结失败", status, message, detail });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});

