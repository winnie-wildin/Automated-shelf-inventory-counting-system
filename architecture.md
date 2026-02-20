## System Architecture

```mermaid
flowchart TB
    subgraph User["👤 User"]
        Upload["Upload Shelf Images<br/>(1–5 angles)"]
        Crop["Freehand / Rectangle<br/>Crop Tool"]
    end

    subgraph Docker["🐳 Docker Compose"]
        subgraph FE["Frontend — Next.js :3000"]
            Page["page.tsx<br/>State Management"]
            IU["ImageUpload.tsx<br/>Multi-angle Upload<br/>Drag & Drop"]
            CM["CropModal.tsx<br/>Freehand Lasso<br/>Rectangle Crop"]
            RP["ResultsPanel.tsx<br/>Product Inventory Table<br/>Per-Shelf Breakdown"]
            Header["Header.tsx"]
        end

        subgraph BE["Backend — FastAPI :8000"]
            API["POST /api/analyze<br/>main.py"]
            Prompts["prompts.py<br/>Single / Multi-angle<br/>Prompt Builder"]
            ORC["openrouter_client.py<br/>API Client + JSON Parser"]
        end
    end

    subgraph External["☁️ External"]
        OR["OpenRouter API<br/>openrouter.ai/api/v1"]
        subgraph Models["Vision Language Models"]
            Primary["Qwen3-VL-235B-A22B<br/>(Primary — Thinking)"]
            Fallback["Qwen3-VL-30B-A3B<br/>(Fallback — Thinking)"]
        end
    end

    Upload --> IU
    IU --> CM
    CM --> IU
    IU --> Page

    Page -->|"FormData<br/>(multipart images)"| API
    API -->|"Validate & Base64<br/>Encode Images"| Prompts
    Prompts -->|"Built Prompt"| ORC
    ORC -->|"HTTP POST<br/>Images + Prompt"| OR
    OR --> Primary
    Primary -.->|"Fail"| Fallback
    Primary -->|"JSON Response"| ORC
    Fallback -->|"JSON Response"| ORC
    ORC -->|"Parsed Analysis"| API
    API -->|"JSON Response"| Page
    Page --> RP

    style Docker fill:#0d1117,stroke:#30363d,color:#fff
    style FE fill:#1a1f2e,stroke:#3b82f6,color:#fff
    style BE fill:#1a1f2e,stroke:#22c55e,color:#fff
    style External fill:#1a1f2e,stroke:#f59e0b,color:#fff
    style Models fill:#1e1b2e,stroke:#a855f7,color:#fff
```

### Data Flow

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Next.js Frontend
    participant BE as FastAPI Backend
    participant OR as OpenRouter API
    participant VLM as Qwen3-VL

    U->>FE: Upload 1–5 shelf images
    opt Crop
        U->>FE: Freehand/rect crop per image
        FE->>FE: Canvas mask → cropped JPEG blob
    end
    U->>FE: Click "Count Products"
    FE->>BE: POST /api/analyze (multipart FormData)

    BE->>BE: Validate file types & sizes
    BE->>BE: Convert images → base64 data URIs
    BE->>BE: Select prompt (single vs multi-angle)

    BE->>OR: POST chat/completions (images + prompt)
    OR->>VLM: Forward to Qwen3-VL-235B
    VLM-->>OR: Thinking + JSON response
    OR-->>BE: Raw model output

    BE->>BE: Strip <think> tags
    BE->>BE: Extract & parse JSON
    BE->>BE: Structure: shelves, products, counts

    BE-->>FE: JSON {analysis, success, image_count}

    FE->>FE: Render ResultsPanel
    FE-->>U: Visible count, hidden estimate,<br/>product inventory, per-shelf breakdown
```

### Project Structure

```mermaid
graph LR
    subgraph Root["📁 Project Root"]
        DC["docker-compose.yml"]
        subgraph FDir["📁 frontend/"]
            DF1["Dockerfile"]
            Src["src/app/page.tsx"]
            Comp["src/components/*"]
            Types["src/types/analysis.ts"]
        end
        subgraph BDir["📁 backend/"]
            DF2["Dockerfile"]
            Main["main.py"]
            ORC2["openrouter_client.py"]
            PR["prompts.py"]
            Env[".env (API key)"]
        end
    end

    DC --> FDir
    DC --> BDir

    style Root fill:#0d1117,stroke:#30363d,color:#fff
    style FDir fill:#1a1f2e,stroke:#3b82f6,color:#fff
    style BDir fill:#1a1f2e,stroke:#22c55e,color:#fff
```
