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
  const decodedFilename = Buffer.from(req.file.originalname, "latin1").toString(
    "utf8"
  );

  if (!isAllowed(decodedFilename)) {
    return res.status(400).json({ error: "只支持 .txt、.md 和 .pdf" });
  }

  try {
    const ext = path.extname(decodedFilename).toLowerCase();
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
      filename: decodedFilename,
      text
    });
  } catch (err) {
    res.status(500).json({
      error: "解析文件失败",
      detail: err && err.message ? err.message : String(err)
    });
  }
});

app.post("/ocr", async (req, res) => {
  const apiKey = (req.body && req.body.userApiKey) || "";
  const baseUrl =
    (req.body && req.body.baseUrl) ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const imageDataUrl = (req.body && req.body.imageDataUrl) || "";

  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return res.status(400).json({ error: "Missing user API key" });
  }
  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    return res.status(400).json({ error: "baseUrl 不能为空" });
  }
  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "未收到图片数据" });
  }

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  try {
    const resp = await axios.post(
      endpoint,
      {
        model: "qwen-vl-ocr-latest",
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: imageDataUrl } },
              {
                type: "text",
                text:
                  'Extract ALL text from the image. Return ONLY valid JSON: {"text":"..."}',
              },
            ],
          },
        ],
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    const content =
      resp.data &&
      resp.data.choices &&
      resp.data.choices[0] &&
      resp.data.choices[0].message &&
      resp.data.choices[0].message.content;

    if (!content) return res.status(500).json({ error: "OCR 返回内容为空" });

    // Try strict JSON first, fallback to raw text
    let text = "";
    try {
      const raw = String(content).trim();
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const candidate = fenced && fenced[1] ? fenced[1].trim() : raw;
      const first = candidate.indexOf("{");
      const last = candidate.lastIndexOf("}");
      const jsonText =
        first >= 0 && last > first ? candidate.slice(first, last + 1) : candidate;
      const parsed = JSON.parse(jsonText);
      text = parsed && typeof parsed.text === "string" ? parsed.text : "";
    } catch {
      text = String(content);
    }

    text = (text || "").trim();
    if (!text) return res.status(422).json({ error: "OCR 未识别到文本" });
    res.json({ text });
  } catch (err) {
    const status = err && err.response && err.response.status;
    const detail = err && err.response && err.response.data;
    const message =
      (detail && (detail.message || detail.error || detail.msg)) ||
      (err && err.message) ||
      "调用 OCR 失败";
    res.status(500).json({ error: "OCR 失败", status, message, detail });
  }
});

app.post("/summarize", async (req, res) => {
  const apiKey = (req.body && req.body.userApiKey) || "";
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return res.status(400).json({ error: "Missing user API key" });
  }

  const text = (req.body && req.body.text) || "";
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text 不能为空" });
  }
  const type = (req.body && req.body.type) || "summary";
  const jobTitle = (req.body && req.body.jobTitle) || "";

  let instruction = "请用一段话总结以下内容：";
  if (type === "summary") instruction = "请用一段话总结以下内容：";
  if (type === "bullets") instruction = "请用 bullet points 列出以下内容的重点：";
  if (type === "outline") instruction = "请为以下内容生成结构化大纲：";
  if (type === "resume") instruction = "请基于以下内容，给出简历优化建议（用 bullet points，聚焦表达、结构与可量化成果）：";
  if (type === "job_match") {
    if (typeof jobTitle !== "string" || !jobTitle.trim()) {
      return res.status(400).json({ error: "jobTitle 不能为空" });
    }
    instruction =
      "请基于以下简历/文档内容，并结合目标岗位，输出一份“岗位匹配分析”。\n" +
      "要求使用 Markdown，至少包含以下小节：\n" +
      "1) 岗位匹配度判断（0-100 分 + 1-2 句理由）\n" +
      "2) 简历中的优势点（bullet points）\n" +
      "3) 与岗位的差距（bullet points）\n" +
      "4) 修改建议（按优先级排序）\n" +
      "5) 下一步行动建议（1-3 条可执行动作）";
  }

  try {
    const resp = await axios.post(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        model: "qwen-turbo",
        messages: [
          { role: "system", content: "你是一个擅长提炼要点的中文助手。" },
          {
            role: "user",
            content:
              type === "job_match"
                ? `${instruction}\n\n【目标岗位】\n${jobTitle}\n\n【文档内容】\n${text}`
                : `${instruction}\n\n${text}`
          }
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

app.post("/chat", async (req, res) => {
  const apiKey = (req.body && req.body.userApiKey) || "";
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return res.status(400).json({ error: "Missing user API key" });
  }

  const currentDocumentText = (req.body && req.body.currentDocumentText) || "";
  const currentAnalysisResult = (req.body && req.body.currentAnalysisResult) || "";
  const userQuestion = (req.body && req.body.userQuestion) || "";

  if (typeof currentDocumentText !== "string" || !currentDocumentText.trim()) {
    return res.status(400).json({ error: "currentDocumentText 不能为空" });
  }
  if (typeof userQuestion !== "string" || !userQuestion.trim()) {
    return res.status(400).json({ error: "userQuestion 不能为空" });
  }
  if (typeof currentAnalysisResult !== "string") {
    return res.status(400).json({ error: "currentAnalysisResult 必须是字符串" });
  }

  const context = [
    "你是一个中文 AI 文档分析助手。你需要基于用户上传的文档内容回答追问。",
    "回答要求：清晰、可执行、尽量结构化；如信息不足请说明需要补充什么。",
    "",
    "【当前文档内容】",
    currentDocumentText,
    "",
    currentAnalysisResult.trim() ? "【当前分析结果】\n" + currentAnalysisResult : "",
    "",
    "【用户问题】",
    userQuestion
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const resp = await axios.post(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        model: "qwen-turbo",
        messages: [
          { role: "system", content: "你是一个擅长提炼要点的中文助手。" },
          { role: "user", content: context }
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

    const reply =
      resp.data &&
      resp.data.choices &&
      resp.data.choices[0] &&
      resp.data.choices[0].message &&
      resp.data.choices[0].message.content;

    if (!reply) return res.status(500).json({ error: "未获取到回复" });
    res.json({ reply });
  } catch (err) {
    const status = err && err.response && err.response.status;
    const detail = err && err.response && err.response.data;
    const message =
      (detail && (detail.message || detail.error || detail.msg)) ||
      (err && err.message) ||
      "调用通义千问失败";
    res.status(500).json({ error: "提问失败", status, message, detail });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});

