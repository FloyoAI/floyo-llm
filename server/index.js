import dotenv from "dotenv";
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { z } from "zod";
import {
  buildFloyoGPTWorkflow,
  buildPromptFromMessages,
  DEFAULT_OPTIONS,
  getWorkflowSelection,
  LLM_MODELS,
  normalizeMedia,
  QWEN_MODEL_ID,
  QWEN_MODEL_LABEL,
} from "./workflow.js";
import {
  cancelRun,
  createRun,
  getFileMetadata,
  getPublicConfig,
  normalizeRunResult,
  pollRun,
  retrieveRun,
  uploadFileToFloyo,
  validateFloyoApiKey,
} from "./floyo.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const app = express();
const port = Number(process.env.PORT || 8788);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024),
  },
});

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use("/api", (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

function expectedAccessToken() {
  return String(process.env.APP_ACCESS_TOKEN || "").trim();
}

function configuredFloyoApiKey() {
  const apiKey = String(process.env.FLOYO_API_KEY || "").trim();
  return apiKey && apiKey !== "YOUR_FLOYO_API_KEY" ? apiKey : "";
}

function tokenFingerprint(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function accountIdFromFingerprint(fingerprint) {
  return `acct_${fingerprint.slice(0, 24)}`;
}

function tokenMatchesExpectedAccessToken(token) {
  const expectedToken = expectedAccessToken();
  return Boolean(expectedToken && timingSafeEquals(token, expectedToken));
}

function tokenMatchesConfiguredFloyoApiKey(token) {
  const apiKey = configuredFloyoApiKey();
  return Boolean(apiKey && timingSafeEquals(token, apiKey));
}

function tokenLooksLikeFloyoApiKey(token) {
  return String(token || "").trim().startsWith("flo_");
}

function timingSafeEquals(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function providedAccessToken(request) {
  const directToken = String(request.get("x-floyo-app-token") || "").trim();
  if (directToken) {
    return directToken;
  }

  const authorization = String(request.get("authorization") || "").trim();
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
}

async function resolveAccess(token, { validate = false } = {}) {
  const fingerprint = tokenFingerprint(token);
  const accountId = accountIdFromFingerprint(fingerprint);

  if (tokenMatchesExpectedAccessToken(token)) {
    if (!configuredFloyoApiKey()) {
      return {
        ok: false,
        status: 503,
        message: "FLOYO_API_KEY is required before the app access token can run Floyo workflows.",
        accountId,
        cached: false,
      };
    }

    const access = {
      ok: true,
      mode: "app",
      accountId,
      cached: false,
      floyoContext: {},
    };

    if (validate) {
      await validateFloyoApiKey(access.floyoContext);
    }

    return access;
  }

  if (tokenLooksLikeFloyoApiKey(token)) {
    const access = {
      ok: true,
      mode: tokenMatchesConfiguredFloyoApiKey(token) ? "configured_floyo_key" : "floyo_key",
      accountId,
      cached: false,
      floyoContext: {
        apiKey: token,
      },
    };

    if (validate) {
      await validateFloyoApiKey(access.floyoContext);
    }

    return access;
  }

  return {
    ok: false,
    status: 401,
    message: "Invalid access token or Floyo API key.",
    accountId,
    cached: false,
  };
}

function publicUploadMetadata(uploaded = {}, fallback = {}) {
  const mimeType = String(uploaded.mime_type || uploaded.mimeType || fallback.mimeType || "").toLowerCase();
  const inputPath = String(uploaded.input_path || uploaded.inputPath || "").trim();
  const fileName = String(uploaded.file_name || uploaded.fileName || fallback.fileName || "").trim();
  const kind = mimeType.startsWith("video/") ? "video" : mimeType.startsWith("image/") ? "image" : "file";

  return {
    id: uploaded.id,
    fileName,
    mimeType,
    sizeBytes: uploaded.size_bytes || uploaded.sizeBytes || fallback.sizeBytes || 0,
    inputPath,
    url: uploaded.presigned_url || uploaded.presignedUrl || uploaded.url || undefined,
    kind,
  };
}

function mapRunCreationError(error, selection = {}) {
  const isGenericCreateFailure =
    error?.status === 500 &&
    String(error?.data?.message || "").toLowerCase() === "failed to create run";

  if (!isGenericCreateFailure) {
    return error;
  }

  const workflowLabel = selection?.type === "qwen" ? "Qwen multimodal workflow" : "LLM workflow";
  const mapped = new Error(
    `${workflowLabel} could not be started with this key. The key is valid for upload, but Floyo rejected run creation. Check Partner Nodes wallet balance, team run permissions, and whether API nodes are available for this team.`,
  );
  mapped.status = 422;
  mapped.details = {
    code: "run_creation_rejected",
    originalStatus: error.status,
    originalMessage: error?.data?.message || error?.message || "Failed to create run",
    checks: [
      "Add balance to Partner Nodes wallet in Floyo",
      "Verify the API key belongs to the active team workspace",
      "Run the same workflow once in Floyo canvas and inspect failed status tooltip",
    ],
    docs: [
      "https://docs.floyo.ai/floyo-partner-nodes",
      "https://docs.floyo.ai/run-history-and-queue",
    ],
  };
  return mapped;
}

async function prepareMediaForWorkflow(media = [], floyoContext = {}) {
  const normalizedMedia = normalizeMedia(media);
  const prepared = [];

  for (const item of normalizedMedia) {
    if (item.kind !== "video" || item.url || !item.id) {
      prepared.push(item);
      continue;
    }

    const fileMetadata = await getFileMetadata(item.id, floyoContext);
    prepared.push({
      ...item,
      url: fileMetadata.presigned_url || fileMetadata.presignedUrl || fileMetadata.url || "",
    });
  }

  const missingVideoUrl = prepared.find((item) => item.kind === "video" && !item.url);
  if (missingVideoUrl) {
    const error = new Error("Video uploads need a Floyo presigned URL before they can be sent to Qwen.");
    error.status = 400;
    throw error;
  }

  return prepared;
}

async function requireAppAccess(request, response, next) {
  const token = providedAccessToken(request);

  if (!token) {
    response.status(401).json({
      error: "Unauthorized",
      message: "Enter a Floyo API key or app access token.",
    });
    return;
  }

  try {
    const access = await resolveAccess(token);
    if (!access.ok) {
      response.status(access.status || 401).json({
        error: access.status === 503 ? "Access token not configured" : "Unauthorized",
        message: access.message,
      });
      return;
    }

    request.floyoContext = access.floyoContext;
    request.accessAccountId = access.accountId;
    next();
  } catch (error) {
    next(error);
  }
}

const chatSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        attachments: z
          .array(
            z.object({
              fileName: z.string().optional(),
              file_name: z.string().optional(),
              mimeType: z.string().optional(),
              mime_type: z.string().optional(),
              kind: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  options: z
    .object({
      model: z.string().optional(),
      customModelName: z.string().optional(),
      custom_model_name: z.string().optional(),
      systemPrompt: z.string().optional(),
      system_prompt: z.string().optional(),
      reasoning: z.boolean().optional(),
      temperature: z.number().optional(),
      topP: z.number().optional(),
      top_p: z.number().optional(),
      enableThinking: z.boolean().optional(),
      enable_thinking: z.boolean().optional(),
      maxTokens: z.number().optional(),
      max_tokens: z.number().optional(),
    })
    .optional(),
  media: z
    .array(
      z.object({
        id: z.string().optional(),
        inputPath: z.string().optional(),
        input_path: z.string().optional(),
        url: z.string().optional(),
        presignedUrl: z.string().optional(),
        presigned_url: z.string().optional(),
        mimeType: z.string().optional(),
        mime_type: z.string().optional(),
        fileName: z.string().optional(),
        file_name: z.string().optional(),
        kind: z.enum(["image", "video", "file"]).optional(),
      }),
    )
    .optional(),
  waitForCompletion: z.boolean().optional(),
  pollTimeoutMs: z.number().int().min(10000).max(900000).optional(),
});

app.get("/api/config", (_request, response) => {
  response.json({
    ...getPublicConfig(),
    requiresAccessToken: Boolean(
      expectedAccessToken() || process.env.VERCEL || process.env.NODE_ENV === "production" || !configuredFloyoApiKey(),
    ),
    defaults: DEFAULT_OPTIONS,
    models: LLM_MODELS,
    qwenModel: {
      id: QWEN_MODEL_ID,
      label: QWEN_MODEL_LABEL,
    },
    defaultModel: DEFAULT_OPTIONS.model,
  });
});

app.post("/api/access/verify", async (request, response, next) => {
  try {
    const token = providedAccessToken(request);
    if (!token) {
      response.status(401).json({
        error: "Unauthorized",
        message: "Enter a Floyo API key or app access token.",
      });
      return;
    }

    const access = await resolveAccess(token, { validate: true });
    if (access.ok) {
      response.json({
        ok: true,
        mode: access.mode,
        accountId: access.accountId,
        cached: false,
      });
      return;
    }

    response.status(access.status || 401).json({
      error: access.status === 503 ? "Access token not configured" : "Unauthorized",
      message: access.message,
    });
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      response.status(401).json({
        error: "Unauthorized",
        message: "Invalid Floyo API key or app access token.",
      });
      return;
    }
    next(error);
  }
});

app.post("/api/files/upload", requireAppAccess, upload.single("file"), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({
        error: "Bad Request",
        message: "A file is required.",
      });
      return;
    }

    const mimeType = request.file.mimetype || "application/octet-stream";
    const isSupportedMedia = mimeType.startsWith("image/") || mimeType.startsWith("video/");
    if (!isSupportedMedia) {
      response.status(400).json({
        error: "Unsupported file type",
        message: "Upload an image or video file.",
      });
      return;
    }

    const formData = new FormData();
    const fileName = String(request.body?.filename || request.file.originalname || "upload").trim();
    formData.append("file", new Blob([request.file.buffer], { type: mimeType }), fileName);
    formData.append("path", String(request.body?.path || "/api/uploads"));
    formData.append("filename", fileName);
    formData.append("on_conflict", String(request.body?.on_conflict || "rename"));

    const uploaded = await uploadFileToFloyo(formData, request.floyoContext || {});
    response.json({
      ok: true,
      file: publicUploadMetadata(uploaded, {
        fileName,
        mimeType,
        sizeBytes: request.file.size,
      }),
      raw: uploaded,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/workflow/preview", requireAppAccess, async (request, response, next) => {
  try {
    const parsed = chatSchema.partial({ prompt: true }).parse({
      ...request.body,
      prompt: request.body?.prompt || "Describe the uploaded media.",
    });
    const prompt = buildPromptFromMessages(parsed.messages, parsed.prompt);
    const media = await prepareMediaForWorkflow(parsed.media, request.floyoContext || {});
    const workflowPayload = buildFloyoGPTWorkflow({
      prompt,
      options: parsed.options,
      media,
    });
    response.json({
      ...workflowPayload,
      selection: getWorkflowSelection({ options: parsed.options, media }),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat", requireAppAccess, async (request, response, next) => {
  try {
    const parsed = chatSchema.parse(request.body);
    const prompt = buildPromptFromMessages(parsed.messages, parsed.prompt);
    const floyoContext = request.floyoContext || {};
    const media = await prepareMediaForWorkflow(parsed.media, floyoContext);
    const selection = getWorkflowSelection({ options: parsed.options, media });
    const workflowPayload = buildFloyoGPTWorkflow({
      prompt,
      options: parsed.options,
      media,
    });

    let run;
    try {
      run = await createRun(workflowPayload, floyoContext);
    } catch (error) {
      throw mapRunCreationError(error, selection);
    }
    const shouldWait = parsed.waitForCompletion ?? true;
    const finalRun = shouldWait
      ? await pollRun(run.id, { timeoutMs: parsed.pollTimeoutMs || 180000, ...floyoContext })
      : await retrieveRun(run.id, floyoContext);
    const normalizedResult = await normalizeRunResult(finalRun, floyoContext);

    response.json({
      runId: run.id,
      workflow: workflowPayload,
      workflowType: selection.type,
      model: selection.model,
      modelLabel: selection.modelLabel,
      lockedByMedia: selection.lockedByMedia,
      ...normalizedResult,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/runs/:runId", requireAppAccess, async (request, response, next) => {
  try {
    const floyoContext = request.floyoContext || {};
    const run = await retrieveRun(request.params.runId, floyoContext);
    const normalizedResult = await normalizeRunResult(run, floyoContext);
    response.json({
      runId: request.params.runId,
      ...normalizedResult,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/runs/:runId/cancel", requireAppAccess, async (request, response, next) => {
  try {
    response.json(await cancelRun(request.params.runId, request.floyoContext || {}));
  } catch (error) {
    next(error);
  }
});

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(projectRoot, "dist");
  app.use(express.static(distPath));
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    response.status(400).json({
      error: error.name,
      message: error.code === "LIMIT_FILE_SIZE" ? "The uploaded file is too large." : error.message,
    });
    return;
  }

  const status = error.status || (error.name === "ZodError" ? 400 : 500);
  response.status(status).json({
    error: error.name || "Error",
    message: error.message || "Unexpected server error",
    details: error.issues || error.data || undefined,
  });
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`FloyoGPT Qwen server listening on http://localhost:${port}`);
  });
}

export default app;
