import {
  Archive,
  Bot,
  Boxes,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Code2,
  Copy,
  Cpu,
  FileJson,
  Film,
  FolderOpen,
  Image as ImageIcon,
  KeyRound,
  LibraryBig,
  Loader2,
  MessageSquarePlus,
  Mic,
  PanelLeft,
  Paperclip,
  Pencil,
  RotateCcw,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

const SETTINGS_STORAGE_KEY = "floyo-llm-codex-settings";
const CONVERSATIONS_STORAGE_KEY = "floyo-llm-codex-conversations";
const SESSION_ACCESS_TOKEN_STORAGE_KEY = "floyo-llm-codex-session-access-token";
const SESSION_ACCESS_ACCOUNT_STORAGE_KEY = "floyo-llm-codex-session-access-account";
const LEGACY_ACCESS_TOKEN_STORAGE_KEY = "floyo-llm-codex-access-token";
const LEGACY_ACCESS_ACCOUNT_STORAGE_KEY = "floyo-llm-codex-access-account";
const DEFAULT_ACCOUNT_ID = "guest";
const FLOYO_ACCESS_INSTRUCTIONS_URL =
  "https://shared.archbee.space/public/PREVIEW-WejOAlhAmyJ3PP37IK_LR/PREVIEW-eANCv0feHV1nQbGY0KMmo";
const LEGACY_DEFAULT_SYSTEM_PROMPT =
  "You are Floyo Codex, a precise coding and multimodal assistant. Answer directly, keep code runnable, and mention assumptions when needed.";
const QWEN_MODEL_ID = "alibaba/qwen3.5-plus-multimodal";
const QWEN_MODEL_LABEL = "Alibaba Qwen3.5 Plus";

const FALLBACK_MODELS = [
  "anthropic/claude-opus-4.6",
  "anthropic/claude-sonnet-4.6",
  "google/gemini-2.5-flash",
  "openai/gpt-4.1",
  "deepseek/deepseek-v3.2",
  "Custom",
];

const DEFAULT_SETTINGS = {
  model: "anthropic/claude-opus-4.6",
  customModelName: "",
  systemPrompt:
    "You are FloyoGPT, a precise multimodal assistant. Answer in clean Markdown. Put runnable code in fenced code blocks with the correct language label.",
  temperature: 1,
  reasoning: true,
  topP: 0.8,
  enableThinking: true,
  maxTokens: 0,
};

const PRESETS = [
  {
    id: "codex",
    label: "Codex",
    icon: Code2,
    patch: {
      systemPrompt:
        "You are FloyoGPT, a senior software engineering assistant. Give concrete implementation-ready answers in clean Markdown. Put every code snippet in fenced code blocks with the correct language label.",
      reasoning: true,
      enableThinking: true,
      temperature: 0.7,
    },
  },
  {
    id: "reason",
    label: "Reason",
    icon: Sparkles,
    patch: {
      systemPrompt:
        "You are FloyoGPT, a careful reasoning assistant. Think through complex tasks, make assumptions explicit, and answer in clean Markdown.",
      reasoning: true,
      enableThinking: true,
      temperature: 0.4,
    },
  },
  {
    id: "creative",
    label: "Creative",
    icon: MessageSquarePlus,
    patch: {
      systemPrompt: "You are FloyoGPT, a creative writing assistant. Give polished, structured, useful responses in clean Markdown.",
      reasoning: false,
      enableThinking: false,
      temperature: 1.2,
    },
  },
  {
    id: "json",
    label: "JSON",
    icon: Braces,
    patch: {
      systemPrompt: "Return only valid JSON. Do not include markdown fences, comments, or extra prose.",
      reasoning: false,
      enableThinking: false,
      temperature: 0,
    },
  },
];

const QUICK_PROMPTS = [
  "Write Python code for a centered star pyramid.",
  "Create a launch plan for a Floyo API product.",
  "Compare Claude Opus, Sonnet, Gemini, and GPT for coding use.",
];

const PRIMARY_NAV_ITEMS = [
  { label: "New chat", icon: MessageSquarePlus, active: true },
  { label: "Search chats", icon: Search },
  { label: "Library", icon: LibraryBig },
  { label: "Archived chats", icon: Archive },
  { label: "Apps", icon: Boxes },
  { label: "Agents", icon: Bot, badge: "New" },
  { label: "Deep research", icon: Sparkles },
  { label: "Codex", icon: Code2 },
  { label: "GPTs", icon: Cpu },
  { label: "Projects", icon: FolderOpen },
];

const FEATURED_MODEL_OPTIONS = [
  {
    label: "Auto",
    model: "anthropic/claude-opus-4.6",
    description: "Balanced default",
  },
  {
    label: "Qwen Vision",
    model: QWEN_MODEL_ID,
    description: "Text, image, and video",
    enableThinking: true,
  },
  {
    label: "Thinking",
    model: "anthropic/claude-opus-4.6",
    description: "Reasoning on",
    reasoning: true,
  },
  {
    label: "Pro",
    model: "anthropic/claude-sonnet-4.6",
    description: "Strong writing and code",
  },
  {
    label: "Instant",
    model: "google/gemini-2.5-flash-lite",
    description: "Fastest lightweight mode",
  },
];

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

function createSeedMessage() {
  return {
    id: "seed",
    role: "assistant",
    content: "FloyoGPT ready.",
    createdAt: Date.now(),
  };
}

function createConversation(title = "New chat") {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [createSeedMessage()],
  };
}

function cleanTitle(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "New chat";
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}

function modelDisplayName(model) {
  if (model === QWEN_MODEL_ID) {
    return QWEN_MODEL_LABEL;
  }
  if (model === "Custom") {
    return "Custom";
  }
  const shortName = String(model || "")
    .split("/")
    .pop()
    .replace(/[-_]/g, " ")
    .replace(/:free$/i, " free")
    .trim();
  if (!shortName) {
    return "Model";
  }
  return shortName.replace(/\b\w/g, (character) => character.toUpperCase());
}

function uniqueModels(models = []) {
  return [...new Set(models.filter(Boolean))];
}

function normalizeSavedSettings(saved) {
  const systemPrompt =
    !saved?.systemPrompt || saved.systemPrompt === LEGACY_DEFAULT_SYSTEM_PROMPT
      ? DEFAULT_SETTINGS.systemPrompt
      : saved.systemPrompt;
  const model = saved?.model && saved.model !== "undefined" ? saved.model : DEFAULT_SETTINGS.model;
  return {
    ...DEFAULT_SETTINGS,
    ...(saved || {}),
    model,
    systemPrompt,
    topP: Number.isFinite(Number(saved?.topP ?? saved?.top_p)) ? Number(saved.topP ?? saved.top_p) : DEFAULT_SETTINGS.topP,
    enableThinking: Boolean(saved?.enableThinking ?? saved?.enable_thinking ?? saved?.reasoning ?? DEFAULT_SETTINGS.enableThinking),
    reasoning: Boolean(saved?.reasoning ?? saved?.enableThinking ?? DEFAULT_SETTINGS.reasoning),
    imagePaths: undefined,
    inputVideoUrl: undefined,
  };
}

function readSavedSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") {
      return DEFAULT_SETTINGS;
    }
    return normalizeSavedSettings(saved);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function conversationStorageKey(accountId = DEFAULT_ACCOUNT_ID) {
  return `${CONVERSATIONS_STORAGE_KEY}:${accountId || DEFAULT_ACCOUNT_ID}`;
}

function readSavedConversations(accountId = DEFAULT_ACCOUNT_ID) {
  try {
    const key = conversationStorageKey(accountId);
    let saved = JSON.parse(localStorage.getItem(key) || "[]");
    if ((!Array.isArray(saved) || saved.length === 0) && accountId === DEFAULT_ACCOUNT_ID) {
      saved = JSON.parse(localStorage.getItem(CONVERSATIONS_STORAGE_KEY) || "[]");
    }
    if (!Array.isArray(saved) || saved.length === 0) {
      return [createConversation()];
    }
    return saved
      .filter((conversation) => conversation && Array.isArray(conversation.messages))
      .map((conversation) => ({
        ...conversation,
        title: conversation.title || "New chat",
        updatedAt: conversation.updatedAt || Date.now(),
      }))
      .slice(0, 24);
  } catch {
    return [createConversation()];
  }
}

function clearSavedAccess() {
  try {
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_ACCESS_ACCOUNT_STORAGE_KEY);
  } catch {
    // Legacy access tokens are intentionally removed from persistent storage.
  }
}

function tokenLooksLikeFloyoKey(value = "") {
  return String(value || "").trim().startsWith("flo_");
}

function writeSessionAccess(token, accountId = DEFAULT_ACCOUNT_ID) {
  try {
    sessionStorage.setItem(SESSION_ACCESS_TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem(SESSION_ACCESS_ACCOUNT_STORAGE_KEY, accountId || DEFAULT_ACCOUNT_ID);
  } catch {
    // Some private browser contexts can block sessionStorage.
  }
}

function clearSessionAccess() {
  try {
    sessionStorage.removeItem(SESSION_ACCESS_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_ACCESS_ACCOUNT_STORAGE_KEY);
  } catch {
    // Some private browser contexts can block sessionStorage.
  }
}

function readSavedAccessToken() {
  clearSavedAccess();
  try {
    return sessionStorage.getItem(SESSION_ACCESS_TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function readInitialAccessState() {
  clearSavedAccess();
  let accountId = DEFAULT_ACCOUNT_ID;
  try {
    accountId = sessionStorage.getItem(SESSION_ACCESS_ACCOUNT_STORAGE_KEY) || DEFAULT_ACCOUNT_ID;
  } catch {
    accountId = DEFAULT_ACCOUNT_ID;
  }
  const conversations = readSavedConversations(accountId);
  return {
    accountId,
    conversations,
    activeConversationId: conversations[0]?.id,
  };
}

async function apiRequest(path, options = {}, accessToken = "") {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { "X-Floyo-App-Token": accessToken } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || data.error || `Request failed with ${response.status}`);
    error.status = response.status;
    error.details = data.details;
    throw error;
  }

  return data;
}

function copyText(value) {
  return navigator.clipboard.writeText(value);
}

function formatFileSize(bytes = 0) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function mediaKindFromMime(mimeType = "") {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

function createPendingAttachment(file) {
  const kind = mediaKindFromMime(file.type);
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    kind,
    previewUrl: kind === "image" || kind === "video" ? URL.createObjectURL(file) : "",
    status: "ready",
  };
}

function serializeAttachment(attachment, patch = {}) {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    kind: attachment.kind,
    previewUrl: attachment.previewUrl,
    status: attachment.status,
    inputPath: attachment.inputPath,
    url: attachment.url,
    ...patch,
  };
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function StatusPill({ config, accessVerified, requiresAccessToken }) {
  const ready = requiresAccessToken ? accessVerified : config?.hasApiKey;
  return (
    <span className={classNames("status-pill", ready ? "ready" : "blocked")}>
      {ready ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      {ready ? "API key active" : "API key required"}
    </span>
  );
}

function AccessGate({ accessToken, accessDenied, isCheckingAccess, onVerifyAccessToken, onCancel }) {
  const [draftToken, setDraftToken] = useState(accessToken);

  useEffect(() => {
    setDraftToken(accessToken);
  }, [accessToken]);

  return (
    <div className="access-gate" role="dialog" aria-modal="true" aria-label="Floyo app access">
      <form
        className="access-card"
        onSubmit={(event) => {
          event.preventDefault();
          onVerifyAccessToken(draftToken);
        }}
      >
        <div className="access-mark">
          <Check size={22} />
        </div>
        <h2>FloyoGPT access</h2>
        <p>
          Enter a valid Floyo API key or app access token to continue this request. The key is checked with a tiny secure Floyo upload before the request runs.{" "}
          <a href={FLOYO_ACCESS_INSTRUCTIONS_URL} target="_blank" rel="noreferrer">
            Setup instructions
          </a>
        </p>
        <p className="access-note">Your key is stored only in this browser tab session. You can change it from the header at any time.</p>
        <input
          name="accessToken"
          type="password"
          value={draftToken}
          placeholder="Enter Floyo API key or app access token"
          onChange={(event) => setDraftToken(event.target.value)}
          autoFocus
        />
        {accessDenied ? <span className="access-error">Invalid Floyo API key or app access token.</span> : null}
        <button type="submit" disabled={!draftToken.trim() || isCheckingAccess}>
          {isCheckingAccess ? "Checking..." : "Continue"}
        </button>
        <button type="button" className="access-secondary-button" onClick={onCancel} disabled={isCheckingAccess}>
          Cancel
        </button>
      </form>
    </div>
  );
}

function RunProgress({ phase = "thinking" }) {
  const labels = {
    uploading: {
      title: "Uploading",
      detail: "Securely uploading media to Floyo inputs.",
    },
    thinking: {
      title: "Thinking",
      detail: "The selected model is reading the context and planning the answer.",
    },
    processing: {
      title: "Running workflow",
      detail: "Floyo is executing the selected workflow through the API.",
    },
    writing: {
      title: "Writing",
      detail: "Formatting the final response for the chat.",
    },
  };
  const orderedSteps = ["uploading", "thinking", "processing", "writing"];
  const activeIndex = Math.max(0, orderedSteps.indexOf(phase));
  const state = labels[phase] || labels.thinking;

  return (
    <div className="run-progress">
      <div className="run-progress-main">
        <span className="progress-orb" />
        <div>
          <div className="progress-title">
            {state.title}
            <span className="typing-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
          <p>{state.detail}</p>
        </div>
      </div>
      <div className="progress-steps" aria-label="Run progress">
        {orderedSteps.map((step, index) => (
          <span key={step} className={classNames(index <= activeIndex && "active", index === activeIndex && "current")}>
            {labels[step].title}
          </span>
        ))}
      </div>
    </div>
  );
}

function languageLabel(language = "") {
  const normalized = language.toLowerCase().replace(/[^a-z0-9#+.-]/g, "");
  const labels = {
    bash: "bash",
    sh: "shell",
    shell: "shell",
    zsh: "zsh",
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    python: "python",
    json: "json",
    html: "html",
    css: "css",
    md: "markdown",
    markdown: "markdown",
    txt: "text",
    text: "text",
  };
  return labels[normalized] || normalized || "text";
}

function extractText(value) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(extractText).join("");
  }
  if (value && typeof value === "object" && "props" in value) {
    return extractText(value.props.children);
  }
  return "";
}

function CodeBlock({ code, language, children, onCopy }) {
  const [copied, setCopied] = useState(false);
  const label = languageLabel(language);

  const handleCopyCode = async () => {
    await onCopy(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{label}</span>
        <button type="button" onClick={handleCopyCode} title="Copy code">
          <Copy size={14} />
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre className="code-block-body">
        <code className={language ? `language-${language}` : undefined}>{children || code}</code>
      </pre>
    </div>
  );
}

function MarkdownContent({ content, onCopy }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a({ href, children, ...props }) {
            return (
              <a href={href} target="_blank" rel="noreferrer" {...props}>
                {children}
              </a>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          code({ inline, className = "", children, node, ...props }) {
            const code = extractText(children).replace(/\n$/, "");
            const language = /language-([^\s]+)/.exec(className)?.[1] || "";
            const spansMultipleLines = node?.position?.start?.line !== node?.position?.end?.line;
            const isInline = inline || (!language && !code.includes("\n") && !spansMultipleLines);

            if (isInline) {
              return (
                <code className="inline-code" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock code={code} language={language} onCopy={onCopy}>
                {children}
              </CodeBlock>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function AttachmentList({ attachments = [], onRemove }) {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className="attachment-list">
      {attachments.map((attachment) => {
        const isImage = attachment.kind === "image";
        const isVideo = attachment.kind === "video";
        return (
          <div key={attachment.id || attachment.inputPath || attachment.fileName} className="attachment-chip">
            <div className="attachment-preview">
              {isImage && attachment.previewUrl ? <img src={attachment.previewUrl} alt="" /> : null}
              {isVideo && attachment.previewUrl ? <video src={attachment.previewUrl} muted playsInline /> : null}
              {!attachment.previewUrl ? isVideo ? <Film size={17} /> : <ImageIcon size={17} /> : null}
            </div>
            <div className="attachment-info">
              <strong>{attachment.fileName || "Uploaded media"}</strong>
              <span>
                {attachment.kind || "file"} · {formatFileSize(attachment.sizeBytes)}
                {attachment.status ? ` · ${attachment.status}` : ""}
              </span>
            </div>
            {onRemove ? (
              <button type="button" className="icon-button ghost attachment-remove" onClick={() => onRemove(attachment.id)} title="Remove file">
                <X size={14} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Message({
  message,
  onCopy,
  onEditStart,
  editingMessageId,
  editingText,
  setEditingText,
  onEditCancel,
  onEditSubmit,
  isRunning,
}) {
  const isAssistant = message.role === "assistant";
  const isEditing = !isAssistant && editingMessageId === message.id;

  return (
    <article className={classNames("message", message.role)}>
      <div className="message-avatar">
        {isAssistant ? <img className="floyo-robo-avatar" src="/floyo-robo-avatar.svg" alt="Floyo robo" /> : <UserRound size={18} />}
      </div>
      <div className={classNames("message-body", isEditing && "editing")}>
        <div className="message-meta">
          <span>{isAssistant ? "FloyoGPT" : "You"}</span>
          {message.status ? <span className={`run-status ${message.status}`}>{message.status}</span> : null}
          {message.runId ? <span className="run-id">{message.runId}</span> : null}
          {message.loading ? <Loader2 className="spin" size={15} /> : null}
        </div>
        {message.loading && !message.content ? (
          <RunProgress phase={message.phase} />
        ) : isEditing ? (
          <div className="message-edit-box">
            <textarea
              value={editingText}
              rows={4}
              onChange={(event) => setEditingText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  onEditSubmit(message.id);
                }
              }}
              autoFocus
            />
            <div className="message-edit-actions">
              <button type="button" onClick={onEditCancel}>
                Cancel
              </button>
              <button type="button" className="edit-send-button" disabled={!editingText.trim() || isRunning} onClick={() => onEditSubmit(message.id)}>
                {isRunning ? <Loader2 className="spin" size={15} /> : <Send size={15} />}
                Send
              </button>
            </div>
          </div>
        ) : isAssistant ? (
          <MarkdownContent content={message.content} onCopy={onCopy} />
        ) : (
          <>
            <pre className="message-content">{message.content}</pre>
            <AttachmentList attachments={message.attachments || []} />
          </>
        )}
        {Array.isArray(message.outputs) && message.outputs.length > 0 ? (
          <div className="output-list">
            {message.outputs.map((output, index) => {
              const fileName = output["file name"] || output.file_name || output.id || `output-${index + 1}`;
              const url = output["presigned url"] || output.presigned_url || output.url;
              return (
                <a key={`${fileName}-${index}`} href={url || "#"} target="_blank" rel="noreferrer">
                  {fileName}
                </a>
              );
            })}
          </div>
        ) : null}
        {!isAssistant && !isEditing ? (
          <div className="message-actions user-actions">
            <button type="button" onClick={() => onEditStart(message)} title="Edit message">
              <Pencil size={15} />
              Edit
            </button>
          </div>
        ) : null}
        {isAssistant && message.content ? (
          <div className="message-actions">
            <button type="button" onClick={() => onCopy(message.content)} title="Copy response">
              <Copy size={15} />
              Copy
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function SliderField({ label, value, min, max, step, onChange }) {
  return (
    <label className="field compact">
      <span>{label}</span>
      <div className="slider-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </label>
  );
}

function ModelPicker({ settings, modelOptions, effectiveModel, mediaLocked, onModelSelect, onToggleReasoning }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const availableModels = uniqueModels([...(modelOptions || []), QWEN_MODEL_ID]);
  const visibleModels = mediaLocked ? [QWEN_MODEL_ID] : availableModels;
  const featuredOptions = FEATURED_MODEL_OPTIONS.filter((option) => visibleModels.includes(option.model));
  const featuredModels = new Set(featuredOptions.map((option) => option.model));
  const remainingModels = visibleModels.filter((model) => !featuredModels.has(model));
  const isQwenEffective = effectiveModel === QWEN_MODEL_ID;
  const thinkingEnabled = isQwenEffective ? settings.enableThinking : settings.reasoning;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const selectModel = (model, patch = {}) => {
    if (!mediaLocked || model === QWEN_MODEL_ID) {
      onModelSelect(model, patch);
    }
    setOpen(false);
  };

  return (
    <div className="model-picker" ref={pickerRef}>
      <button
        type="button"
        className={classNames("model-trigger", mediaLocked && "locked")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{modelDisplayName(effectiveModel === "Custom" ? settings.customModelName || "Custom" : effectiveModel)}</span>
        <ChevronDown size={15} />
      </button>

      {open ? (
        <div className="model-menu" role="listbox">
          {mediaLocked ? <div className="model-lock-note">Media attached. Qwen multimodal is required for this request.</div> : null}
          <div className="model-menu-section-label">{mediaLocked ? "Multimodal model" : "Latest"}</div>
          <div className="model-menu-list">
            {featuredOptions.map((option) => {
              const active = effectiveModel === option.model;
              return (
                <button
                  key={`${option.label}-${option.model}`}
                  type="button"
                  className={classNames("model-option", active && "active")}
                  onClick={() =>
                    selectModel(option.model, {
                      ...(option.reasoning === undefined ? {} : { reasoning: option.reasoning }),
                      ...(option.enableThinking === undefined ? {} : { enableThinking: option.enableThinking }),
                    })
                  }
                  role="option"
                  aria-selected={active}
                >
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  {active ? <Check size={18} /> : null}
                </button>
              );
            })}
          </div>

          {remainingModels.length ? (
            <>
              <div className="model-menu-divider" />
              <div className="model-menu-section-label">All Floyo models</div>
              <div className="model-menu-list compact">
                {remainingModels.map((model) => {
                  const active = effectiveModel === model;
                  return (
                    <button
                      key={model}
                      type="button"
                      className={classNames("model-option", active && "active")}
                      onClick={() => selectModel(model)}
                      role="option"
                      aria-selected={active}
                    >
                      <span>
                        <strong>{modelDisplayName(model)}</strong>
                        <small>{model}</small>
                      </span>
                      {active ? <Check size={18} /> : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          <div className="model-menu-divider" />
          <button type="button" className="model-option reasoning-option" onClick={onToggleReasoning}>
            <span>
              <strong>{isQwenEffective ? "Thinking" : "Reasoning"}</strong>
              <small>{thinkingEnabled ? "On for deeper answers" : "Off for faster answers"}</small>
            </span>
            <span className={classNames("reasoning-switch", thinkingEnabled && "on")}>
              <i />
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SidebarNavButton({ item, onClick }) {
  const Icon = item.icon;
  return (
    <button type="button" className={classNames("sidebar-nav-button", item.active && "active")} onClick={onClick}>
      <Icon size={19} />
      <span>{item.label}</span>
      {item.badge ? <small>{item.badge}</small> : null}
    </button>
  );
}

function HistorySidebar({ conversations, activeConversationId, onSelect, onNew, onDelete, onReset }) {
  return (
    <aside className="history-sidebar">
      <div className="sidebar-brand">
        <h1>FloyoGPT</h1>
        <button type="button" className="icon-button ghost" title="Collapse sidebar">
          <PanelLeft size={18} />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="FloyoGPT navigation">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <SidebarNavButton key={item.label} item={item} onClick={item.label === "New chat" ? onNew : undefined} />
        ))}
      </nav>

      <div className="history-list" aria-label="Recent chats">
        <h2>Recents</h2>
        {conversations.slice(0, 8).map((conversation) => (
          <div
            key={conversation.id}
            className={classNames("history-row", activeConversationId === conversation.id && "active")}
          >
            <button type="button" onClick={() => onSelect(conversation.id)}>
              <span>{conversation.title}</span>
              <small>{Math.max(0, conversation.messages.length - 1)} messages</small>
            </button>
            <button type="button" className="icon-button ghost" onClick={() => onDelete(conversation.id)} title="Delete chat">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-account">
        <button type="button" className="sidebar-reset" onClick={onReset}>
          <RotateCcw size={15} />
          Reset current
        </button>
        <div className="workspace-chip">
          <span>F</span>
          <div>
            <strong>Floyo</strong>
            <small>API workspace</small>
          </div>
        </div>
      </div>
    </aside>
  );
}

function AdvancedPanel({
  settings,
  setSettings,
  activePreset,
  setActivePreset,
  config,
  models,
  effectiveModel,
  mediaLocked,
  workflowPreview,
  lastRun,
  onPreviewWorkflow,
  onCopy,
  onClose,
}) {
  const update = useCallback(
    (patch) => {
      setSettings((current) => ({ ...current, ...patch }));
    },
    [setSettings],
  );
  const payload = workflowPreview || lastRun?.workflow || null;
  const json = payload ? JSON.stringify(payload, null, 2) : "";
  const modelOptions = uniqueModels([...(models?.length ? models : FALLBACK_MODELS), QWEN_MODEL_ID]);
  const usesQwen = effectiveModel === QWEN_MODEL_ID;
  return (
    <aside className="advanced-panel">
      <div className="panel-head">
        <div>
          <h2>Advanced</h2>
          <p>{config?.hasApiKey ? "Secure Floyo API" : "API key required"}</p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} title="Close advanced settings">
          <X size={16} />
        </button>
      </div>

      <div className="panel-section">
        <div className="section-title">
          <Settings2 size={15} />
          Model
        </div>
        {mediaLocked ? (
          <div className="fixed-model-card locked">
            <Sparkles size={17} />
            <div>
              <strong>{QWEN_MODEL_LABEL}</strong>
              <span>Media is attached, so Qwen multimodal is required.</span>
            </div>
          </div>
        ) : (
          <>
            <label className="field compact">
              <span>Model selection</span>
              <select value={settings.model} onChange={(event) => update({ model: event.target.value })}>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model === QWEN_MODEL_ID ? QWEN_MODEL_LABEL : model}
                  </option>
                ))}
              </select>
            </label>
            {settings.model === "Custom" ? (
              <label className="field compact">
                <span>Custom model name</span>
                <input
                  type="text"
                  placeholder="provider/model-name"
                  value={settings.customModelName}
                  onChange={(event) => update({ customModelName: event.target.value })}
                />
              </label>
            ) : null}
          </>
        )}
      </div>

      <div className="panel-section">
        <div className="section-title">
          <Sparkles size={15} />
          Presets
        </div>
        <div className="preset-grid">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                className={classNames("preset-button", activePreset === preset.id && "active")}
                onClick={() => {
                  setActivePreset(preset.id);
                  update(preset.patch);
                }}
              >
                <Icon size={16} />
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel-section">
        <div className="section-title">
          <Bot size={15} />
          Node settings
        </div>
        <SliderField label="Temperature" value={settings.temperature} min={0} max={2} step={0.1} onChange={(temperature) => update({ temperature })} />
        {usesQwen ? <SliderField label="Top P" value={settings.topP} min={0} max={1} step={0.05} onChange={(topP) => update({ topP })} /> : null}
        <label className="field compact">
          <span>Max tokens</span>
          <input
            type="number"
            min={0}
            max={100000}
            step={1}
            value={settings.maxTokens}
            onChange={(event) => update({ maxTokens: Number(event.target.value) })}
          />
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={usesQwen ? settings.enableThinking : settings.reasoning}
            onChange={(event) => update(usesQwen ? { enableThinking: event.target.checked } : { reasoning: event.target.checked })}
          />
          <span>{usesQwen ? "Thinking" : "Reasoning"}</span>
        </label>
      </div>

      <div className="panel-section">
        <div className="section-title">
          <Code2 size={15} />
          System prompt
        </div>
        <textarea
          value={settings.systemPrompt}
          onChange={(event) => update({ systemPrompt: event.target.value })}
          rows={7}
        />
      </div>

      <div className="panel-section workflow-section">
        <div className="section-title row-between">
          <span>
            <FileJson size={15} />
            Workflow JSON
          </span>
          <button type="button" className="icon-button" disabled={!json} onClick={() => onCopy(json)} title="Copy JSON">
            <Clipboard size={15} />
          </button>
        </div>
        <button type="button" className="wide-button" onClick={onPreviewWorkflow}>
          <FileJson size={16} />
          Preview workflow
        </button>
        <pre className="json-panel">{json || "Workflow JSON will appear here."}</pre>
      </div>
    </aside>
  );
}

export default function App() {
  const initialAccessState = useMemo(readInitialAccessState, []);
  const [config, setConfig] = useState(null);
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [settings, setSettings] = useState(readSavedSettings);
  const [activePreset, setActivePreset] = useState("codex");
  const [accessAccountId, setAccessAccountId] = useState(initialAccessState.accountId);
  const [conversations, setConversations] = useState(initialAccessState.conversations);
  const [activeConversationId, setActiveConversationId] = useState(initialAccessState.activeConversationId);
  const [draft, setDraft] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [workflowPreview, setWorkflowPreview] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [notice, setNotice] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingText, setEditingText] = useState("");
  const [accessToken, setAccessToken] = useState(readSavedAccessToken);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessVerified, setAccessVerified] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [showAccessPrompt, setShowAccessPrompt] = useState(false);
  const [pendingAccessAction, setPendingAccessAction] = useState(null);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0],
    [activeConversationId, conversations],
  );
  const messages = activeConversation?.messages || [];
  const visibleMessages = useMemo(
    () => messages.filter((message) => message.id !== "seed"),
    [messages],
  );
  const isEmptyChat = visibleMessages.length === 0;
  const requiresAccessToken = Boolean(config?.requiresAccessToken);
  const isAccessLocked = requiresAccessToken && !accessVerified;
  const modelOptions = useMemo(() => uniqueModels([...(models?.length ? models : FALLBACK_MODELS), QWEN_MODEL_ID]), [models]);
  const mediaLocked = pendingAttachments.length > 0;
  const effectiveModel = mediaLocked ? QWEN_MODEL_ID : settings.model || DEFAULT_SETTINGS.model;
  const usesQwenWorkflow = effectiveModel === QWEN_MODEL_ID;
  const effectiveModelLabel = modelDisplayName(effectiveModel === "Custom" ? settings.customModelName || "Custom" : effectiveModel);

  useEffect(() => {
    apiRequest("/api/config")
      .then((nextConfig) => {
        setConfig(nextConfig);
        const serverModels = Array.isArray(nextConfig.models) && nextConfig.models.length ? nextConfig.models : FALLBACK_MODELS;
        setModels(uniqueModels([...serverModels, nextConfig.qwenModel?.id || QWEN_MODEL_ID]));
        if (nextConfig.defaults) {
          setSettings((current) => ({ ...nextConfig.defaults, ...current }));
        }
      })
      .catch((error) => setNotice(error.message));
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(conversationStorageKey(accessAccountId), JSON.stringify(conversations));
  }, [accessAccountId, conversations]);

  const loadAccountConversations = useCallback((accountId) => {
    const nextConversations = readSavedConversations(accountId);
    setConversations(nextConversations);
    setActiveConversationId(nextConversations[0]?.id);
    setDraft("");
    setEditingMessageId("");
    setEditingText("");
    setLastRun(null);
    setWorkflowPreview(null);
  }, []);

  const verifyAccessToken = useCallback(async (tokenValue) => {
    const nextToken = String(tokenValue || "").trim();
    if (!nextToken) {
      setAccessVerified(false);
      setAccessDenied(true);
      return false;
    }

    setIsCheckingAccess(true);
    setAccessDenied(false);

    try {
      const verification = await apiRequest(
        "/api/access/verify",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
        nextToken,
      );
      const nextAccountId = verification.accountId || DEFAULT_ACCOUNT_ID;
      setAccessToken(nextToken);
      setAccessAccountId(nextAccountId);
      writeSessionAccess(nextToken, nextAccountId);
      if (nextAccountId !== accessAccountId) {
        loadAccountConversations(nextAccountId);
      }
      setAccessVerified(true);
      setShowAccessPrompt(false);
      return true;
    } catch (error) {
      if (error.status === 404 && tokenLooksLikeFloyoKey(nextToken)) {
        setAccessToken(nextToken);
        setAccessAccountId(DEFAULT_ACCOUNT_ID);
        writeSessionAccess(nextToken, DEFAULT_ACCOUNT_ID);
        setAccessVerified(true);
        setShowAccessPrompt(false);
        setAccessDenied(false);
        setNotice("API key saved for this session. The next request will validate it with Floyo.");
        window.setTimeout(() => setNotice(""), 3200);
        return true;
      }
      setAccessVerified(false);
      setAccessDenied(true);
      return false;
    } finally {
      setIsCheckingAccess(false);
    }
  }, [accessAccountId, loadAccountConversations]);

  useEffect(() => {
    if (!config) {
      return undefined;
    }
    if (!requiresAccessToken) {
      setAccessVerified(true);
      setAccessDenied(false);
      return undefined;
    }
    if (accessVerified) {
      return undefined;
    }
    if (!accessToken.trim()) {
      setAccessVerified(false);
      return undefined;
    }

    let isCancelled = false;
    setIsCheckingAccess(true);
    setAccessDenied(false);

    apiRequest(
      "/api/access/verify",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
      accessToken,
    )
      .then((verification) => {
        if (!isCancelled) {
          const nextAccountId = verification.accountId || DEFAULT_ACCOUNT_ID;
          setAccessAccountId(nextAccountId);
          writeSessionAccess(accessToken, nextAccountId);
          if (nextAccountId !== accessAccountId) {
            loadAccountConversations(nextAccountId);
          }
          setAccessVerified(true);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          if (error.status === 404 && accessToken.trim() && tokenLooksLikeFloyoKey(accessToken)) {
            setAccessVerified(true);
            setAccessDenied(false);
            return;
          }
          setAccessVerified(false);
          setAccessDenied(true);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsCheckingAccess(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [accessAccountId, accessToken, accessVerified, config, loadAccountConversations, requiresAccessToken]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const requestSettings = useMemo(
    () => ({
      model: effectiveModel,
      customModelName: settings.customModelName,
      systemPrompt: settings.systemPrompt,
      temperature: settings.temperature,
      topP: settings.topP,
      reasoning: settings.reasoning,
      enableThinking: settings.enableThinking,
      maxTokens: settings.maxTokens,
    }),
    [effectiveModel, settings],
  );

  const showNotice = useCallback((value) => {
    setNotice(value);
    window.setTimeout(() => setNotice(""), 3200);
  }, []);

  const handleCopy = useCallback(
    async (value) => {
      await copyText(value);
      showNotice("Copied");
    },
    [showNotice],
  );

  const promptForAccess = useCallback((action) => {
    setPendingAccessAction(action);
    setAccessDenied(false);
    setShowAccessPrompt(true);
  }, []);

  const handleChangeAccessKey = useCallback(() => {
    clearSessionAccess();
    setAccessToken("");
    setAccessVerified(false);
    setAccessDenied(false);
    setAccessAccountId(DEFAULT_ACCOUNT_ID);
    loadAccountConversations(DEFAULT_ACCOUNT_ID);
    setPendingAccessAction(null);
    setShowAccessPrompt(true);
  }, [loadAccountConversations]);

  const handleModelSelect = useCallback((model, patch = {}) => {
    setSettings((current) => ({
      ...current,
      ...patch,
      model,
    }));
  }, []);

  const toggleThinking = useCallback(() => {
    setSettings((current) => {
      const currentEffectiveModel = pendingAttachments.length > 0 ? QWEN_MODEL_ID : current.model || DEFAULT_SETTINGS.model;
      if (currentEffectiveModel === QWEN_MODEL_ID) {
        return { ...current, enableThinking: !current.enableThinking };
      }
      return { ...current, reasoning: !current.reasoning };
    });
  }, [pendingAttachments.length]);

  const updateActiveMessages = useCallback(
    (updater, titleSource = "") => {
      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== activeConversationId) {
            return conversation;
          }
          const nextMessages = typeof updater === "function" ? updater(conversation.messages) : updater;
          const shouldRename = conversation.title === "New chat" && titleSource;
          return {
            ...conversation,
            title: shouldRename ? cleanTitle(titleSource) : conversation.title,
            messages: nextMessages,
            updatedAt: Date.now(),
          };
        }),
      );
    },
    [activeConversationId],
  );

  const createNewChat = useCallback(() => {
    const conversation = createConversation();
    setConversations((current) => [conversation, ...current].slice(0, 24));
    setActiveConversationId(conversation.id);
    setDraft("");
    setPendingAttachments((current) => {
      current.forEach((attachment) => attachment.previewUrl && URL.revokeObjectURL(attachment.previewUrl));
      return [];
    });
    setEditingMessageId("");
    setEditingText("");
    setLastRun(null);
    setWorkflowPreview(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const deleteChat = useCallback(
    (conversationId) => {
      setConversations((current) => {
        if (current.length === 1) {
          const replacement = createConversation();
          setActiveConversationId(replacement.id);
          return [replacement];
        }
        const next = current.filter((conversation) => conversation.id !== conversationId);
        if (conversationId === activeConversationId) {
          setActiveConversationId(next[0]?.id);
        }
        return next;
      });
    },
    [activeConversationId],
  );

  const resetCurrentChat = useCallback(() => {
    updateActiveMessages([createSeedMessage()]);
    setDraft("");
    setPendingAttachments((current) => {
      current.forEach((attachment) => attachment.previewUrl && URL.revokeObjectURL(attachment.previewUrl));
      return [];
    });
    setEditingMessageId("");
    setEditingText("");
    setLastRun(null);
    setWorkflowPreview(null);
  }, [updateActiveMessages]);

  const addFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
      if (!files.length) {
        showNotice("Upload an image or video file.");
        return;
      }

      showNotice("Media attached. Qwen multimodal is selected for this request.");
      setPendingAttachments((current) => {
        const next = [...current, ...files.map(createPendingAttachment)];
        const images = [];
        const videos = [];
        for (const attachment of next) {
          if (attachment.kind === "image" && images.length < 3) {
            images.push(attachment);
          }
          if (attachment.kind === "video" && videos.length < 1) {
            videos.push(attachment);
          }
        }
        return [...images, ...videos].slice(0, 4);
      });
    },
    [showNotice],
  );

  const removePendingAttachment = useCallback((attachmentId) => {
    setPendingAttachments((current) => {
      const removed = current.find((attachment) => attachment.id === attachmentId);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return current.filter((attachment) => attachment.id !== attachmentId);
    });
  }, []);

  const uploadAttachment = useCallback(
    async (attachment) => {
      const formData = new FormData();
      formData.append("file", attachment.file, attachment.fileName);
      formData.append("path", "/api/uploads");
      formData.append("filename", attachment.fileName);
      formData.append("on_conflict", "rename");
      const result = await apiRequest(
        "/api/files/upload",
        {
          method: "POST",
          body: formData,
        },
        accessToken,
      );
      return {
        ...serializeAttachment(attachment),
        ...(result.file || {}),
        status: "uploaded",
      };
    },
    [accessToken],
  );

  const previewWorkflow = useCallback(async ({ skipAccessCheck = false, promptOverride = "" } = {}) => {
    if (isAccessLocked && !skipAccessCheck) {
      promptForAccess({ type: "preview", prompt: draft.trim() });
      return;
    }
    const prompt = promptOverride || draft.trim() || "Describe the uploaded media.";
    let preview;
    try {
      preview = await apiRequest(
        "/api/workflow/preview",
        {
          method: "POST",
          body: JSON.stringify({
            prompt,
            messages: messages.filter((message) => message.id !== "seed" && !message.loading),
            options: requestSettings,
            media: [],
          }),
        },
        accessToken,
      );
    } catch (error) {
      if (error.status === 401) {
        clearSessionAccess();
        setAccessToken("");
        setAccessVerified(false);
        setAccessDenied(true);
        promptForAccess({ type: "preview" });
        return;
      }
      throw error;
    }
    setWorkflowPreview(preview);
    setShowAdvanced(true);
  }, [accessToken, draft, isAccessLocked, messages, promptForAccess, requestSettings]);

  const runFloyoPrompt = useCallback(
    async ({ prompt, history, pendingMessageId, userMessageId, attachments = [], workflowOptions = requestSettings }) => {
      setIsRunning(true);
      let processingTimer = null;

      try {
        const uploadedAttachments = [];
        if (attachments.length) {
          updateActiveMessages((current) =>
            current.map((message) =>
              message.id === pendingMessageId
                ? {
                    ...message,
                    phase: "uploading",
                    status: "uploading",
                  }
                : message,
            ),
          );

          for (const attachment of attachments) {
            const uploaded = await uploadAttachment(attachment);
            uploadedAttachments.push(uploaded);
            updateActiveMessages((current) =>
              current.map((message) =>
                message.id === userMessageId
                  ? {
                      ...message,
                      attachments: (message.attachments || []).map((item) =>
                        item.id === attachment.id ? serializeAttachment(uploaded, { status: "uploaded" }) : item,
                      ),
                    }
                  : message,
              ),
            );
          }
        }

        processingTimer = window.setTimeout(() => {
          updateActiveMessages((current) =>
            current.map((message) =>
              message.id === pendingMessageId && message.loading
                ? {
                    ...message,
                    phase: "processing",
                    status: "processing",
                  }
                : message,
            ),
          );
        }, 900);

        const result = await apiRequest(
          "/api/chat",
          {
            method: "POST",
            body: JSON.stringify({
            prompt,
            messages: history,
            options: workflowOptions,
              media: uploadedAttachments.map((attachment) => ({
                id: attachment.id,
                inputPath: attachment.inputPath,
                url: attachment.url,
                mimeType: attachment.mimeType,
                fileName: attachment.fileName,
                kind: attachment.kind,
              })),
              waitForCompletion: true,
              pollTimeoutMs: 180000,
            }),
          },
          accessToken,
        );

        if (processingTimer) window.clearTimeout(processingTimer);
        const answer = result.answer || "No text response was returned.";
        setLastRun(result);
        setWorkflowPreview(result.workflow);
        updateActiveMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? {
                  ...message,
                  content: "",
                  loading: true,
                  phase: "writing",
                  status: "writing",
                  runId: result.runId,
                  outputs: result.outputs,
                }
              : message,
          ),
        );
        await sleep(Math.min(1100, Math.max(520, answer.length * 3)));
        updateActiveMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? {
                  ...message,
                  content: answer,
                  loading: false,
                  phase: "done",
                  status: result.status,
                }
              : message,
          ),
        );
      } catch (error) {
        if (processingTimer) window.clearTimeout(processingTimer);
        if (error.status === 401) {
          clearSessionAccess();
          setAccessToken("");
          setAccessVerified(false);
          setAccessDenied(true);
          setShowAccessPrompt(true);
        }
        updateActiveMessages((current) =>
          current.map((message) =>
            message.id === pendingMessageId
              ? {
                  ...message,
                  content: error.message,
                  loading: false,
                  phase: "failed",
                  status: "failed",
                }
              : message,
          ),
        );
      } finally {
        setIsRunning(false);
        inputRef.current?.focus();
      }
    },
    [accessToken, requestSettings, updateActiveMessages, uploadAttachment],
  );

  const sendMessage = useCallback(async ({ skipAccessCheck = false, promptOverride = "" } = {}) => {
    const attachments = pendingAttachments;
    const prompt = promptOverride || draft.trim() || (attachments.length ? "Describe the uploaded media." : "");
    if ((!prompt && !attachments.length) || isRunning) {
      return;
    }
    if (isAccessLocked && !skipAccessCheck) {
      promptForAccess({ type: "send", prompt });
      return;
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      attachments: attachments.map((attachment) => serializeAttachment(attachment, { status: "queued" })),
      createdAt: Date.now(),
    };
    const pendingMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      loading: true,
      phase: "thinking",
      status: "thinking",
      createdAt: Date.now(),
    };
    const history = [...messages.filter((message) => message.id !== "seed" && !message.loading), userMessage];

    setDraft("");
    setPendingAttachments([]);
    setEditingMessageId("");
    setEditingText("");
    updateActiveMessages((current) => [...current, userMessage, pendingMessage], prompt);
    await runFloyoPrompt({
      prompt,
      history,
      pendingMessageId: pendingMessage.id,
      userMessageId: userMessage.id,
      attachments,
      workflowOptions: requestSettings,
    });
  }, [
    draft,
    isAccessLocked,
    isRunning,
    messages,
    pendingAttachments,
    promptForAccess,
    runFloyoPrompt,
    updateActiveMessages,
  ]);

  const startEditingMessage = useCallback((message) => {
    if (isRunning) {
      return;
    }
    setEditingMessageId(message.id);
    setEditingText(message.content);
  }, [isRunning]);

  const cancelEditingMessage = useCallback(() => {
    setEditingMessageId("");
    setEditingText("");
  }, []);

  const submitEditedMessage = useCallback(
    async (messageId, { skipAccessCheck = false } = {}) => {
      const prompt = editingText.trim();
      if (!prompt || isRunning) {
        return;
      }
      if (isAccessLocked && !skipAccessCheck) {
        promptForAccess({ type: "edit", messageId });
        return;
      }

      const messageIndex = messages.findIndex((message) => message.id === messageId);
      if (messageIndex < 0) {
        return;
      }

      const editedMessage = {
        ...messages[messageIndex],
        content: prompt,
        editedAt: Date.now(),
      };
      const baseMessages = [
        ...messages.slice(0, messageIndex).filter((message) => !message.loading),
        editedMessage,
      ];
      const pendingMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        loading: true,
        phase: "thinking",
        status: "thinking",
        createdAt: Date.now(),
      };
      const history = baseMessages.filter((message) => message.id !== "seed" && !message.loading);

      setEditingMessageId("");
      setEditingText("");
      setLastRun(null);
      setWorkflowPreview(null);
      updateActiveMessages([...baseMessages, pendingMessage], prompt);
      await runFloyoPrompt({ prompt, history, pendingMessageId: pendingMessage.id });
    },
    [
      editingText,
      isAccessLocked,
      isRunning,
      messages,
      promptForAccess,
      runFloyoPrompt,
      updateActiveMessages,
    ],
  );

  useEffect(() => {
    if (!accessVerified || !pendingAccessAction) {
      return;
    }

    const action = pendingAccessAction;
    setPendingAccessAction(null);

    if (action.type === "send") {
      void sendMessage({ skipAccessCheck: true, promptOverride: action.prompt || "" });
    }

    if (action.type === "preview") {
      void previewWorkflow({ skipAccessCheck: true, promptOverride: action.prompt || "" });
    }

    if (action.type === "edit" && action.messageId) {
      void submitEditedMessage(action.messageId, { skipAccessCheck: true });
    }
  }, [accessVerified, pendingAccessAction, previewWorkflow, sendMessage, submitEditedMessage]);

  return (
    <div className={classNames("app-shell", showAdvanced && "advanced-open")}>
      <HistorySidebar
        conversations={conversations}
        activeConversationId={activeConversation?.id}
        onSelect={(conversationId) => {
          setActiveConversationId(conversationId);
          setDraft("");
          setPendingAttachments((current) => {
            current.forEach((attachment) => attachment.previewUrl && URL.revokeObjectURL(attachment.previewUrl));
            return [];
          });
          setEditingMessageId("");
          setEditingText("");
          setWorkflowPreview(null);
          setLastRun(null);
        }}
        onNew={createNewChat}
        onDelete={deleteChat}
        onReset={resetCurrentChat}
      />

      <section className={classNames("chat-shell", isEmptyChat && "empty-chat")}>
        <header className="chat-header">
          <div>
            <h2>{isEmptyChat ? "FloyoGPT" : activeConversation?.title || "New chat"}</h2>
            <p>{mediaLocked ? `${QWEN_MODEL_LABEL} · Media request` : `${effectiveModelLabel} · ${usesQwenWorkflow ? "Multimodal" : "LLM"}`}</p>
          </div>
          <div className="chat-header-actions">
            <StatusPill config={config} accessVerified={accessVerified} requiresAccessToken={requiresAccessToken} />
            {requiresAccessToken ? (
              <button type="button" className="icon-button ghost" onClick={handleChangeAccessKey} title="Change API key">
                <KeyRound size={17} />
              </button>
            ) : null}
            <button type="button" className={classNames("pill-button", showAdvanced && "active")} onClick={() => setShowAdvanced((value) => !value)}>
              <Settings2 size={16} />
              Advanced
            </button>
          </div>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          {isEmptyChat ? (
            <div className="empty-state">
              <h1>What's on the agenda today?</h1>
            </div>
          ) : (
            visibleMessages.map((message) => (
              <Message
                key={message.id}
                message={message}
                onCopy={handleCopy}
                onEditStart={startEditingMessage}
                editingMessageId={editingMessageId}
                editingText={editingText}
                setEditingText={setEditingText}
                onEditCancel={cancelEditingMessage}
                onEditSubmit={submitEditedMessage}
                isRunning={isRunning}
              />
            ))
          )}
          {isEmptyChat ? (
            <button type="button" className="knowledge-chip" onClick={() => setDraft(QUICK_PROMPTS[1])}>
              <Sparkles size={17} />
              Floyo knowledge
            </button>
          ) : null}
        </div>

        <form
          className={classNames("composer", isDraggingFiles && "dragging")}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDraggingFiles(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingFiles(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsDraggingFiles(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDraggingFiles(false);
            addFiles(event.dataTransfer.files);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
        >
          <div className="composer-box">
            <button type="button" className="composer-plus-button" onClick={() => fileInputRef.current?.click()} title="Attach image or video">
              <Paperclip size={21} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden-file-input"
              accept="image/*,video/*"
              multiple
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <div className="composer-input-stack">
              <AttachmentList attachments={pendingAttachments.map((attachment) => serializeAttachment(attachment))} onRemove={removePendingAttachment} />
              <textarea
                ref={inputRef}
                value={draft}
                rows={1}
                placeholder="Ask anything"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
              />
            </div>
            <div className="composer-actions">
              <ModelPicker
                settings={settings}
                modelOptions={modelOptions}
                effectiveModel={effectiveModel}
                mediaLocked={mediaLocked}
                onModelSelect={handleModelSelect}
                onToggleReasoning={toggleThinking}
              />
              <button
                type="button"
                className={classNames("reasoning-toggle-button", (usesQwenWorkflow ? settings.enableThinking : settings.reasoning) && "active")}
                onClick={toggleThinking}
                aria-pressed={usesQwenWorkflow ? settings.enableThinking : settings.reasoning}
                title={usesQwenWorkflow ? (settings.enableThinking ? "Turn thinking off" : "Turn thinking on") : (settings.reasoning ? "Turn reasoning off" : "Turn reasoning on")}
              >
                <span />
                {usesQwenWorkflow ? (settings.enableThinking ? "Thinking on" : "Thinking off") : (settings.reasoning ? "Reasoning on" : "Reasoning off")}
              </button>
              <button type="button" className="icon-button ghost composer-icon" onClick={() => setShowAdvanced(true)} title="Node settings">
                <SlidersHorizontal size={18} />
              </button>
              <button type="button" className="icon-button ghost composer-icon" title="Voice input">
                <Mic size={19} />
              </button>
              <button type="button" className="icon-button" onClick={previewWorkflow} title="Preview workflow JSON">
                <FileJson size={17} />
              </button>
              <button type="submit" className="send-button" disabled={(!draft.trim() && !pendingAttachments.length) || isRunning} title="Run workflow">
                {isRunning ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
              </button>
            </div>
          </div>
          <div className="drop-hint">
            <Sparkles size={14} />
            {mediaLocked ? "Media locked to Qwen" : effectiveModelLabel} · Temperature {settings.temperature}
            {usesQwenWorkflow ? ` · Top P ${settings.topP}` : ""} · Max tokens {settings.maxTokens || "auto"} · Context on
          </div>
        </form>
      </section>

      <AdvancedPanel
        settings={settings}
        setSettings={setSettings}
        activePreset={activePreset}
        setActivePreset={setActivePreset}
        config={config}
        models={modelOptions}
        effectiveModel={effectiveModel}
        mediaLocked={mediaLocked}
        workflowPreview={workflowPreview}
        lastRun={lastRun}
        onPreviewWorkflow={previewWorkflow}
        onCopy={handleCopy}
        onClose={() => setShowAdvanced(false)}
      />

      {showAccessPrompt ? (
        <AccessGate
          accessToken={accessToken}
          accessDenied={accessDenied}
          isCheckingAccess={isCheckingAccess}
          onVerifyAccessToken={verifyAccessToken}
          onCancel={() => {
            setShowAccessPrompt(false);
            setPendingAccessAction(null);
            setAccessDenied(false);
          }}
        />
      ) : null}

      {notice ? <div className="toast">{notice}</div> : null}
    </div>
  );
}
