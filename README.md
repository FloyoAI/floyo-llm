# FloyoGPT

ChatGPT/Codex-style local app for running Floyo `LLM_floyo` text workflows and the `AlibabaQwen35Plus_floyo` multimodal workflow through the Floyo API.

## Setup

```bash
cd /Users/ritik/Desktop/Floyo/API-NODES/floyo-llm-codex
npm install
cp .env.example .env
```

Add your default server key in `.env`:

```bash
FLOYO_API_KEY=your_key_here
FLOYO_API_BASE_URL=https://api.floyo.ai
FLOYO_CDN_URL=https://cdn.floyo.ai
APP_ACCESS_TOKEN=long_random_private_token
PORT=8788
```

Run:

```bash
npm run dev
```

Open:

```text
http://localhost:5174
```

The local API server runs on `http://localhost:8788`.

## Supported Workflow Inputs

- `prompt`
- `model`
- `system_prompt`
- `temperature`
- `reasoning`
- `top_p`
- `max_tokens`
- `enable_thinking`
- image uploads through Floyo CDN `/upload`, passed into Qwen through `LoadImage`
- video uploads through Floyo CDN `/upload`, passed into Qwen through `input_video_url`

Text-only requests use the selected `LLM_floyo` model by default. Users can manually select Alibaba Qwen3.5 Plus for text-only multimodal-style reasoning. When an image or video is attached, the app automatically locks the request to Alibaba Qwen3.5 Plus and hides other model choices until the media is removed. The server enforces the same rule, so media requests cannot accidentally run through the text-only LLM workflow.

## Response Formatting

Assistant responses render with GitHub-flavored Markdown, including headings, lists, tables, links, inline code, and fenced code blocks. Code blocks include syntax highlighting, a language label, and a per-snippet copy button.

## Conversation Context

Every request includes the current chat history as a structured context block, so model switches keep continuity across previous user and assistant turns. The server packs the latest turns first and keeps the payload within a bounded context budget. Previous media is summarized in the transcript, while only media attached to the current request is sent as an active Qwen image/video input.

## Vercel

Set these environment variables in Vercel before production use:

```bash
FLOYO_API_KEY=your_key_here
FLOYO_API_BASE_URL=https://api.floyo.ai
FLOYO_CDN_URL=https://cdn.floyo.ai
APP_ACCESS_TOKEN=long_random_private_token
```

The app includes Vercel serverless API wrappers under `api/`, so the frontend can call `/api/chat`, `/api/config`, `/api/files/upload`, and run status endpoints after deployment. In production, users can unlock a request with either `APP_ACCESS_TOKEN` or a Floyo API key. Floyo keys are validated by a tiny secure Floyo CDN upload before the pending request continues. API keys are kept in memory only and are not persisted across page refreshes.

## API Flow

1. Frontend keeps the token in memory only, then sends it with the chat and settings to the Express server.
2. Server verifies app access tokens locally or validates the supplied Floyo API key with a small Floyo CDN upload.
3. Browser image/video files are uploaded through the server to Floyo CDN `/upload`.
4. Server builds a bounded current-chat context block from previous turns.
5. Server builds either `LLM_floyo` or Qwen workflow JSON. Media requests always build Qwen JSON using uploaded `input_path` values and presigned video URLs.
6. Server posts to `POST /runs` with the configured key or user-provided Floyo key.
7. Server polls `GET /runs/:id`.
8. Server returns status, text candidates, outputs, raw run data, and the generated workflow JSON.
