export const LLM_MODELS = [
  "minimax/minimax-m2.5",
  "stepfun/step-3.5-flash:free",
  "deepseek/deepseek-v3.2",
  "google/gemini-3-flash-preview",
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-opus-4.6",
  "openrouter/hunter-alpha",
  "google/gemini-2.5-flash",
  "moonshotai/kimi-k2.5",
  "x-ai/grok-4.1-fast",
  "google/gemini-2.5-flash-lite",
  "arcee-ai/trinity-large-preview:free",
  "openai/gpt-oss-120b",
  "anthropic/claude-sonnet-4.5",
  "xiaomi/mimo-v2-flash",
  "z-ai/glm-5",
  "openai/gpt-5-nano",
  "google/gemini-3.1-pro-preview",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-4.1",
  "meta-llama/llama-4-maverick",
  "Custom",
];

export const QWEN_MODEL_ID = "alibaba/qwen3.5-plus-multimodal";
export const QWEN_MODEL_LABEL = "Alibaba Qwen3.5 Plus";

const DEFAULT_LLM_MODEL = "anthropic/claude-opus-4.6";
const DISPLAY_NODE_IDS = ["38", "39", "40", "41"];
const IMAGE_NODE_IDS = ["36", "42", "43"];
const IMAGE_INPUT_NAMES = ["image", "image2", "image3"];
const QWEN_SAVE_OUTPUT_NODE_ID = "50";
const MAX_CONTEXT_CHARS = 36000;
const MAX_MESSAGE_CHARS = 8000;

export const DEFAULT_OPTIONS = {
  model: DEFAULT_LLM_MODEL,
  customModelName: "",
  systemPrompt:
    "You are FloyoGPT, a precise coding and multimodal assistant. Answer in clean Markdown. Put runnable code in fenced code blocks with the correct language label.",
  temperature: 1,
  reasoning: true,
  topP: 0.8,
  maxTokens: 0,
  enableThinking: true,
};

function clampNumber(value, min, max, fallback) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numericValue));
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function truncateMiddle(value, maxLength) {
  const text = cleanText(value);
  if (text.length <= maxLength) {
    return text;
  }
  const headLength = Math.floor(maxLength * 0.58);
  const tailLength = Math.max(0, maxLength - headLength - 42);
  return `${text.slice(0, headLength)}\n\n[...middle omitted for context size...]\n\n${text.slice(-tailLength)}`;
}

function normalizeRequestedModel(value) {
  const requestedModel = cleanText(value);
  if (requestedModel === QWEN_MODEL_ID || requestedModel === QWEN_MODEL_LABEL) {
    return QWEN_MODEL_ID;
  }
  if (LLM_MODELS.includes(requestedModel)) {
    return requestedModel;
  }
  return DEFAULT_OPTIONS.model;
}

function normalizeMediaItem(item = {}) {
  const id = cleanText(item.id);
  const inputPath = cleanText(item.inputPath ?? item.input_path);
  const url = cleanText(item.url ?? item.presignedUrl ?? item.presigned_url);
  const mimeType = cleanText(item.mimeType ?? item.mime_type).toLowerCase();
  const fileName = cleanText(item.fileName ?? item.file_name);
  const declaredKind = cleanText(item.kind).toLowerCase();
  const kind = declaredKind || (mimeType.startsWith("video/") ? "video" : mimeType.startsWith("image/") ? "image" : "");

  if ((!inputPath && !url) || !["image", "video"].includes(kind)) {
    return null;
  }

  return {
    id,
    inputPath,
    url,
    mimeType,
    fileName,
    kind,
  };
}

export function normalizeMedia(media = []) {
  if (!Array.isArray(media)) {
    return [];
  }

  const normalized = [];
  let imageCount = 0;
  let videoCount = 0;

  for (const item of media) {
    const normalizedItem = normalizeMediaItem(item);
    if (!normalizedItem) {
      continue;
    }

    if (normalizedItem.kind === "image") {
      if (imageCount >= IMAGE_NODE_IDS.length) {
        continue;
      }
      imageCount += 1;
    }

    if (normalizedItem.kind === "video") {
      if (videoCount >= 1) {
        continue;
      }
      videoCount += 1;
    }

    normalized.push(normalizedItem);
  }

  return normalized;
}

export function normalizeOptions(options = {}) {
  const model = normalizeRequestedModel(options.model);
  return {
    model,
    customModelName: cleanText(options.customModelName ?? options.custom_model_name),
    systemPrompt: cleanText(options.systemPrompt ?? options.system_prompt) || DEFAULT_OPTIONS.systemPrompt,
    temperature: clampNumber(options.temperature, 0, 2, DEFAULT_OPTIONS.temperature),
    reasoning: Boolean(options.reasoning ?? DEFAULT_OPTIONS.reasoning),
    topP: clampNumber(options.topP ?? options.top_p, 0, 1, DEFAULT_OPTIONS.topP),
    maxTokens: Math.round(clampNumber(options.maxTokens ?? options.max_tokens, 0, 100000, DEFAULT_OPTIONS.maxTokens)),
    enableThinking: Boolean(options.enableThinking ?? options.enable_thinking ?? options.reasoning ?? DEFAULT_OPTIONS.enableThinking),
  };
}

function normalizeLLMOptions(options = {}) {
  const normalizedOptions = normalizeOptions(options);
  return {
    ...normalizedOptions,
    model: LLM_MODELS.includes(normalizedOptions.model) ? normalizedOptions.model : DEFAULT_OPTIONS.model,
  };
}

function normalizeQwenOptions(options = {}) {
  const normalizedOptions = normalizeOptions(options);
  const requestedMaxTokens = Number(options.maxTokens ?? options.max_tokens);
  return {
    ...normalizedOptions,
    model: QWEN_MODEL_ID,
    maxTokens: requestedMaxTokens > 0 ? Math.round(clampNumber(requestedMaxTokens, 1, 65536, 2048)) : 2048,
  };
}

export function buildPromptFromMessages(messages = [], prompt = "") {
  const currentPrompt = cleanText(prompt);
  const normalizedMessages = Array.isArray(messages) ? messages.filter((message) => normalizeConversationMessage(message)) : [];

  if (!normalizedMessages.length && !currentPrompt) {
    return "";
  }

  const messagesForContext = [...normalizedMessages];
  const lastMessage = messagesForContext[messagesForContext.length - 1];
  const lastMessageContent = cleanText(lastMessage?.content);
  if (currentPrompt && lastMessageContent !== currentPrompt) {
    messagesForContext.push({
      role: "user",
      content: currentPrompt,
    });
  }

  if (!messagesForContext.length) {
    return currentPrompt;
  }

  const formattedMessages = messagesForContext.map(formatConversationMessage).filter(Boolean);
  const selectedMessages = [];
  let usedChars = 0;
  let omittedCount = 0;

  for (let index = formattedMessages.length - 1; index >= 0; index -= 1) {
    const formatted = formattedMessages[index];
    const nextLength = usedChars + formatted.length + (selectedMessages.length ? 2 : 0);
    if (nextLength > MAX_CONTEXT_CHARS && selectedMessages.length) {
      omittedCount = index + 1;
      break;
    }
    selectedMessages.unshift(formatted);
    usedChars = nextLength;
    if (usedChars >= MAX_CONTEXT_CHARS) {
      omittedCount = index;
      break;
    }
  }

  const omittedNotice = omittedCount > 0 ? `[${omittedCount} older turn${omittedCount === 1 ? "" : "s"} omitted to fit the context budget.]\n\n` : "";
  const context = `${omittedNotice}${selectedMessages.join("\n\n")}`;

  return [
    "You are continuing the same FloyoGPT chat. Use the conversation context below to preserve continuity across model switches.",
    "Do not mention this context block unless the user asks about it. Answer the latest user message directly.",
    "",
    "<conversation_context>",
    context,
    "</conversation_context>",
  ].join("\n");
}

function normalizeConversationMessage(message = {}) {
  if (!message || typeof message !== "object") {
    return null;
  }
  const role = message.role === "assistant" ? "assistant" : message.role === "user" ? "user" : "";
  if (!role) {
    return null;
  }
  const content = cleanText(message.content);
  const attachments = normalizeAttachmentSummaries(message.attachments);
  if (!content && !attachments.length) {
    return null;
  }
  return {
    role,
    content,
    attachments,
  };
}

function normalizeAttachmentSummaries(attachments = []) {
  if (!Array.isArray(attachments)) {
    return [];
  }
  return attachments
    .map((attachment) => {
      const kind = cleanText(attachment?.kind) || "file";
      const fileName = cleanText(attachment?.fileName ?? attachment?.file_name) || "uploaded media";
      const mimeType = cleanText(attachment?.mimeType ?? attachment?.mime_type);
      return `${kind}: ${fileName}${mimeType ? ` (${mimeType})` : ""}`;
    })
    .filter(Boolean)
    .slice(0, 4);
}

function formatConversationMessage(message, index) {
  const normalized = normalizeConversationMessage(message);
  if (!normalized) {
    return "";
  }
  const role = normalized.role === "assistant" ? "Assistant" : "User";
  const content = truncateMiddle(normalized.content, MAX_MESSAGE_CHARS);
  const attachmentText = normalized.attachments.length ? `\nAttached media: ${normalized.attachments.join("; ")}` : "";
  return `Turn ${index + 1} - ${role}\n${content || "[No text message]"}${attachmentText}`;
}

export function getWorkflowSelection({ options = {}, media = [] } = {}) {
  const normalizedOptions = normalizeOptions(options);
  const normalizedMedia = normalizeMedia(media);
  const hasMedia = normalizedMedia.length > 0;
  const useQwen = hasMedia || normalizedOptions.model === QWEN_MODEL_ID;

  return {
    type: useQwen ? "qwen" : "llm",
    model: useQwen ? QWEN_MODEL_ID : normalizedOptions.model,
    modelLabel: useQwen ? QWEN_MODEL_LABEL : normalizedOptions.model,
    lockedByMedia: hasMedia,
  };
}

export function buildLLMWorkflow({ prompt, options = {}, name } = {}) {
  const normalizedOptions = normalizeLLMOptions(options);
  const promptValue = cleanText(prompt);

  return {
    name: cleanText(name) || "FloyoGPT LLM",
    workflow: {
      "53": {
        inputs: {
          prompt: promptValue,
          model: normalizedOptions.model,
          system_prompt: normalizedOptions.systemPrompt,
          temperature: normalizedOptions.temperature,
          reasoning: normalizedOptions.reasoning,
          max_tokens: normalizedOptions.maxTokens,
          custom_model_name: normalizedOptions.customModelName,
        },
        class_type: "LLM_floyo",
        _meta: {
          title: "LLM (Floyo API)",
        },
      },
      "56": {
        inputs: {
          video_url: ["53", 0],
          filename: "floyo_llm_answer",
          output_dir: "",
        },
        class_type: "SaveVideoURL",
        _meta: {
          title: "Save LLM Answer",
        },
      },
    },
  };
}

export function buildQwenWorkflow({ prompt, options = {}, media = [], name } = {}) {
  const normalizedOptions = normalizeQwenOptions(options);
  const normalizedMedia = normalizeMedia(media);
  const promptValue = cleanText(prompt);
  const images = normalizedMedia.filter((item) => item.kind === "image");
  const video = normalizedMedia.find((item) => item.kind === "video");
  const workflow = {};

  workflow["35"] = {
    inputs: {
      prompt: promptValue,
      system_prompt: normalizedOptions.systemPrompt,
      temperature: normalizedOptions.temperature,
      top_p: normalizedOptions.topP,
      max_tokens: normalizedOptions.maxTokens,
      enable_thinking: normalizedOptions.enableThinking,
      input_video_url: video?.url || video?.inputPath || "",
    },
    class_type: "AlibabaQwen35Plus_floyo",
    _meta: {
      title: "Alibaba Qwen3.5 Plus (Floyo API)",
    },
  };

  images.forEach((image, index) => {
    const nodeId = IMAGE_NODE_IDS[index];
    const inputName = IMAGE_INPUT_NAMES[index];

    workflow[nodeId] = {
      inputs: {
        image: image.inputPath,
      },
      class_type: "LoadImage",
      _meta: {
        title: `Load Image ${index + 1}`,
      },
    };

    workflow["35"].inputs[inputName] = [nodeId, 0];
  });

  DISPLAY_NODE_IDS.forEach((nodeId, index) => {
    workflow[nodeId] = {
      inputs: {
        output: "",
        source: ["35", index],
      },
      class_type: "Display Any (rgthree)",
      _meta: {
        title: "Display Any (rgthree)",
      },
    };
  });

  workflow[QWEN_SAVE_OUTPUT_NODE_ID] = {
    inputs: {
      video_url: ["35", 0],
      filename: "floyo_qwen_answer",
      output_dir: "",
    },
    class_type: "SaveVideoURL",
    _meta: {
      title: "Save Qwen Answer",
    },
  };

  return {
    name: cleanText(name) || "FloyoGPT Qwen",
    workflow,
  };
}

export function buildFloyoGPTWorkflow({ prompt, options = {}, media = [], name } = {}) {
  const selection = getWorkflowSelection({ options, media });
  if (selection.type === "qwen") {
    return buildQwenWorkflow({ prompt, options: { ...options, model: QWEN_MODEL_ID }, media, name });
  }
  return buildLLMWorkflow({ prompt, options, name });
}
