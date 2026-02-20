# Automated Shelf Inventory Counting System

AI-powered system that counts products on retail shelves from photographs using Vision Language Models (VLMs). Supports multi-angle image upload, freehand/rectangle cropping, and two analysis modes (Quick & Thorough).

## Features

- **VLM-Powered Counting** — Uses models like Qwen3-VL, Gemini Flash, InternVL3 via OpenRouter API
- **Multi-Angle Support** — Upload up to 5 images of the same shelf from different angles for improved accuracy
- **Quick & Thorough Modes** — Fast ballpark count or detailed per-product inventory breakdown
- **Image Cropping** — Freehand lasso and rectangle crop tools to isolate shelf sections before analysis
- **Model Selector** — Choose from multiple VLMs with speed indicators (fast / medium / slow)
- **Product-Level Inventory** — Identifies products by brand, counts each, and maps to shelf locations
- **Occlusion Estimation** — Estimates hidden products behind the front row

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python |
| AI Models | Qwen3-VL, Qwen2.5-VL, Gemini Flash, InternVL3, Kimi VL (via OpenRouter) |
| Infrastructure | Docker Compose |

## Live Demo

- **Frontend**: [automated-shelf-inventory-counting.vercel.app](https://automated-shelf-inventory-counting.vercel.app)
- **Backend API**: [automated-shelf-inventory-counting-system.onrender.com](https://automated-shelf-inventory-counting-system.onrender.com/health)

> Note: Render free tier sleeps after 15 min of inactivity. First request may take ~30s to wake up.

## Quick Start (Local)

### Prerequisites
- Docker & Docker Compose
- OpenRouter API key ([get one free](https://openrouter.ai))

### Setup

1. Clone the repo:
```bash
git clone https://github.com/winnie-wildin/Automated-shelf-inventory-counting-system.git
cd Automated-shelf-inventory-counting-system
```

2. Create the backend env file:
```bash
echo "OPENROUTER_API_KEY=your_key_here" > backend/.env
```

3. Run with Docker Compose:
```bash
docker compose up --build -d
```

4. Open [http://localhost:3000](http://localhost:3000)

## Architecture

See [architecture.md](architecture.md) for detailed Mermaid diagrams covering system architecture, data flow, and project structure.

```
├── frontend/              # Next.js app (port 3000)
│   ├── src/
│   │   ├── app/           # Main page + layout
│   │   ├── components/    # ImageUpload, CropModal, ResultsPanel, Header
│   │   └── types/         # TypeScript type definitions
│   └── Dockerfile
├── backend/               # FastAPI app (port 8000)
│   ├── main.py            # API endpoints (/api/analyze, /api/models)
│   ├── openrouter_client.py  # VLM API client + JSON parser
│   ├── prompts.py         # Prompt templates (quick/thorough/multi-angle)
│   └── Dockerfile
└── docker-compose.yml
```

## Analysis Modes

| Mode | Prompt | Default Model | Speed | Best For |
|------|--------|--------------|-------|----------|
| ⚡ Quick | Concise, minimal instructions | Gemini 2.0 Flash | ~3–8s | Fast ballpark count |
| 🔍 Thorough | Detailed row-by-row instructions | Qwen3-VL 30B (Thinking) | ~15–60s | Accurate per-product inventory |
