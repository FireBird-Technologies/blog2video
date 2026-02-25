---
title: Blog2Video
emoji: 🎬
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
short_description: Convert blog posts to AI explainer videos (DSPy, Remotion)
---

<p align="center">
  <img src="frontend/public/Banner.PNG" alt="Blog2Video Banner" />
</p>

<p align="center">
  🎬 <strong>Turn any blog post into a professional AI-powered explainer video in minutes.</strong>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=w3Vq8KhDzPU" target="_blank">
    ▶ Watch Product Demo
  </a>
</p>

---

## 🚀 What is Blog2Video?

**Blog2Video** is an AI-powered platform that converts blog posts into ready-to-publish explainer videos automatically.

Paste a blog URL and the system:

- 🧠 Extracts and understands the article content  
- ✍️ Generates a structured multi-scene video script using Claude (via DSPy)  
- 🎙 Produces realistic AI voiceover with ElevenLabs  
- 🎬 Auto-generates Remotion-based animated video scenes  
- 💬 Lets you refine everything through an AI chat editor  
- 🎞 Exports a production-ready video  

It eliminates hours of manual scripting, voice recording, editing, and animation work — enabling creators, startups, and marketers to repurpose written content into engaging video content instantly.

---

## Architecture

- **Backend** -- FastAPI + SQLAlchemy (SQLite by default, PostgreSQL-ready)
- **Frontend** -- React + Tailwind CSS (Vite)
- **Video Engine** -- Remotion (React-based video generation)
- **AI Pipeline** -- DSPy with Anthropic Claude for script generation, scene code generation, and a reflexion-based chat editor
- **Voiceover** -- ElevenLabs Text-to-Speech
- **Auth** -- Google OAuth 2.0 + JWT sessions
- **Billing** -- Stripe subscriptions (Free: 1 video, Pro: $20/mo for 100 videos)

## Quick Start

### 1. Prerequisites

- Python 3.11+
- Node.js 18+
- npm or yarn
- A Google Cloud project with OAuth credentials
- A Stripe account with a $20/mo price created

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env with ALL required keys (see Environment Variables below)

# Start the server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Edit .env with your Google Client ID

npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies API calls to the backend.

### 4. Remotion Setup

```bash
cd remotion-video
npm install
```

Remotion Studio is launched from the app when you click "Launch Studio" on a project.

### 5. Stripe Webhook (for local dev)

```bash
stripe listen --forward-to localhost:8000/api/billing/webhook
```

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in `.env`.

## Workflow

1. **Sign in** with Google on the landing page
2. **Create a project** -- Enter a blog URL on the dashboard
3. **Scrape** -- Extracts text and images from the blog
4. **Generate Script** -- DSPy creates a multi-scene video script from the content
5. **Generate Scenes** -- DSPy generates Remotion component code for each scene + ElevenLabs voiceover
6. **Edit via Chat** -- Use the AI chatbot to refine the script with natural language (reflexion-based QA)
7. **Launch Studio** -- Open Remotion Studio to preview, tweak, and render the final video
8. **Upgrade** -- Hit your free video limit? Upgrade to Pro via Stripe Checkout

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for TTS |
| `ELEVENLABS_VOICE_ID` | ElevenLabs voice ID (default: Rachel) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for the $20/mo Pro plan |
| `JWT_SECRET` | Secret key for JWT signing |
| `FRONTEND_URL` | Frontend URL for CORS and redirects |
| `DATABASE_URL` | SQLAlchemy DB URL (default: `sqlite:///./blog2video.db`) |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID (same as backend) |

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:5173` to Authorized JavaScript origins
4. Add `http://localhost:5173` to Authorized redirect URIs
5. Copy the Client ID to both `backend/.env` and `frontend/.env`

## Stripe Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a Product called "Blog2Video Pro"
3. Create a Price: $20/month recurring
4. Copy the Price ID (starts with `price_`) to `STRIPE_PRO_PRICE_ID`
5. Copy your API keys to the `.env` file
6. For local webhooks: `stripe listen --forward-to localhost:8000/api/billing/webhook`

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/google` | No | Google OAuth login, returns JWT |
| GET | `/api/auth/me` | Yes | Get current user info |

### Billing
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/billing/checkout` | Yes | Create Stripe Checkout session |
| POST | `/api/billing/portal` | Yes | Create Stripe Customer Portal session |
| GET | `/api/billing/status` | Yes | Get billing/usage status |
| POST | `/api/billing/webhook` | No* | Stripe webhook handler |

### Projects
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/projects` | Yes | Create project (counts toward limit) |
| GET | `/api/projects` | Yes | List user's projects |
| GET | `/api/projects/{id}` | Yes | Get project details |
| DELETE | `/api/projects/{id}` | Yes | Delete a project |

### Pipeline
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/projects/{id}/scrape` | Yes | Scrape blog content |
| POST | `/api/projects/{id}/generate-script` | Yes | Generate video script |
| POST | `/api/projects/{id}/generate-scenes` | Yes | Generate Remotion code + voiceover |
| PUT | `/api/projects/{id}/scenes/{sid}` | Yes | Update a scene manually |
| POST | `/api/projects/{id}/chat` | Yes | Chat-based script editing |
| POST | `/api/projects/{id}/launch-studio` | Yes | Launch Remotion Studio |
| POST | `/api/projects/{id}/render` | Yes | Render video via CLI |

## Tech Stack

- **FastAPI** -- Async Python web framework
- **SQLAlchemy 2.0** -- ORM with mapped columns
- **DSPy** -- Declarative AI pipeline framework
- **Anthropic Claude** -- LLM for content generation
- **ElevenLabs** -- Text-to-speech API
- **Remotion** -- React-based video creation
- **React 18** -- Frontend UI
- **Tailwind CSS** -- Utility-first styling
- **Vite** -- Frontend build tool
- **Google OAuth 2.0** -- Authentication
- **Stripe** -- Subscription billing
- **PyJWT** -- JWT token handling

## HuggingFace Spaces

This Space runs as a **Docker** container on port **7860**. Add these secrets in your Space **Settings → Repository secrets**:

| Secret | Required | Description |
|--------|----------|--------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `ELEVENLABS_API_KEY` | Yes | ElevenLabs API key for TTS |
| `ELEVENLABS_VOICE_ID` | No | ElevenLabs voice ID (default: Rachel) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Yes | Stripe Price ID for Pro plan |
| `JWT_SECRET` | Yes | Secret for JWT signing |

Set `FRONTEND_URL` in **Variables** to your frontend URL (e.g. `https://your-frontend.pages.dev`) for CORS and redirects.
