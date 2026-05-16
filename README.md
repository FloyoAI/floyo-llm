# FloyoGPT

An open-source ChatGPT-style web app powered by the [Floyo API](https://floyo.ai). Chat with 20+ leading LLMs, drop in an image or video, and get multimodal answers, all from one window.

**Live demo:** https://floyo-llm.vercel.app

## What you get

- Familiar chat interface with conversation history saved in your browser
- 20+ models to choose from (Claude, GPT, Gemini, DeepSeek, Grok, Qwen, and more), plus a Custom field for any model name
- Image and video uploads. The app automatically switches to Alibaba Qwen 3.5 Plus when you attach media
- Markdown answers with code highlighting and a one-click copy button on every code block
- System prompt, temperature, top_p, max tokens, and reasoning toggle, all editable in the UI

## Run it locally

Requires Node.js 18 or newer. Copy and paste:

```bash
git clone https://github.com/ritik-devsecops/floyo-llm.git
cd floyo-llm
npm install
npm run dev
```

Then open http://localhost:5174.

The first time you open the app, it asks for a Floyo API key. Paste your key (steps below) and you are done. **You do not need to create a `.env` file.**

## Get a Floyo API key

1. Sign up at https://floyo.ai
2. Open your dashboard and go to the **API Keys** section
3. Click **Create API Key**, give it a name, and copy the key. It starts with `flo_`
4. Paste it into the app when prompted

Full step-by-step guide: https://docs.floyo.ai/floyo-api

The key is kept in your browser memory only. It is never written to disk or sent to anyone except Floyo.

## Deploy to Vercel

1. Fork this repo
2. Open https://vercel.com and click **Import Project**
3. Pick your fork
4. Deploy. No environment variables are required.

Future pushes to `main` redeploy automatically (a GitHub Action is included).

Note: Vercel limits request bodies to about 4.5 MB. Larger video uploads may fail on production until Floyo CDN enables direct browser uploads. Local dev allows up to 25 MB.

## Advanced configuration (optional)

You only need this if you want to run the app with a single shared Floyo key on the server, instead of having each user paste their own. Most people should skip this section.

Create a `.env` file in the repo root with:

| Variable | Required | What it does |
| --- | --- | --- |
| `FLOYO_API_KEY` | Optional | Your Floyo API key. Used as the server default when a request comes with `APP_ACCESS_TOKEN` |
| `APP_ACCESS_TOKEN` | Optional | A long random string. Anyone who has it can use the server's `FLOYO_API_KEY`, so keep it secret |
| `FLOYO_API_BASE_URL` | Optional | Defaults to `https://api.floyo.ai` |
| `FLOYO_CDN_URL` | Optional | Defaults to `https://cdn.floyo.ai` |
| `PORT` | Optional | Local backend port. Defaults to `8788` |

For Vercel, add the same variables in **Project Settings, Environment Variables**.

If neither `FLOYO_API_KEY` nor `APP_ACCESS_TOKEN` are set, the app runs in "bring your own key" mode (recommended for public deployments).

## How it works

- **Frontend** (`src/`): React with Vite. API keys are kept in memory only, never written to disk.
- **Backend** (`server/`): Express. Builds Floyo workflow JSON, posts to `POST /runs`, polls until done.
- **Vercel wrappers** (`api/`): Tiny re-exports of the Express app so each route becomes a serverless function.
- **Workflow templates** (`data/`): Reference JSON for the two workflows the app drives (LLM text and Qwen multimodal).

When you attach an image or video, the backend uploads the file to Floyo CDN, then builds a Qwen multimodal workflow with that file as input. Text-only requests use whichever model you picked in the UI.

## Project structure

```
api/         Vercel serverless route files
server/      Express backend
src/         React frontend
data/        Workflow JSON templates
public/      Static assets
```

## Contributing

Issues and pull requests are welcome. If you build something on top of this, share it with us at https://floyo.ai.

## License

Add your own `LICENSE` file (MIT is a common choice for open source).
