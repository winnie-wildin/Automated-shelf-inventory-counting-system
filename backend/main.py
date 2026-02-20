"""
FastAPI backend for the Shelf Inventory Counter.
Supports two analysis modes: quick (fast, lighter model) and thorough (detailed, bigger model).
"""

import base64
import logging
from typing import Annotated, Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from openrouter_client import (
    analyze_images_with_vlm,
    parse_analysis_response,
    MODELS,
    MODEL_OPTIONS,
    VALID_MODEL_IDS,
)
from prompts import build_counting_prompt

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Shelf Inventory Counter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_IMAGES = 5
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

# Default models per mode (when user doesn't pick one)
MODE_DEFAULTS = {
    "quick": "google/gemini-2.0-flash-001",
    "thorough": "qwen/qwen3-vl-30b-a3b-thinking",
}


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/api/models")
async def list_models():
    return {"models": MODEL_OPTIONS, "default": MODELS["primary"]}


@app.post("/api/analyze")
async def analyze_shelf(
    images: Annotated[list[UploadFile], File(description="One or more shelf images")],
    model: Annotated[Optional[str], Form()] = None,
    mode: Annotated[str, Form()] = "thorough",
):
    """
    Accepts shelf images, optional model id, and mode (quick|thorough).
    Quick mode: concise prompt, faster model, lower max_tokens.
    Thorough mode: detailed prompt, bigger model, full analysis.
    """
    if mode not in ("quick", "thorough"):
        mode = "thorough"

    if not images:
        raise HTTPException(status_code=400, detail="At least one image is required")

    if len(images) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMAGES} images allowed")

    # Resolve model: user pick > mode default
    chosen_model = model if model and model in VALID_MODEL_IDS else None
    default_model = MODE_DEFAULTS.get(mode, MODELS["primary"])

    # Validate and convert each image to base64
    data_uris: list[str] = []
    for img in images:
        if img.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File '{img.filename}' must be an image (JPEG, PNG, or WebP)",
            )
        contents = await img.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, detail=f"File '{img.filename}' exceeds 10MB limit"
            )
        b64 = base64.b64encode(contents).decode("utf-8")
        data_uris.append(f"data:{img.content_type};base64,{b64}")

    prompt = build_counting_prompt(image_count=len(data_uris), mode=mode)
    max_tokens = 2048 if mode == "quick" else 4096

    raw_response = None
    used_model = None

    # Try user's chosen model first
    if chosen_model:
        try:
            raw_response = await analyze_images_with_vlm(
                data_uris, prompt, chosen_model, max_tokens=max_tokens
            )
            used_model = chosen_model
        except Exception as err:
            logger.warning("Chosen model %s failed: %s. Falling back.", chosen_model, err)

    # Fall back to mode default
    if raw_response is None:
        try:
            raw_response = await analyze_images_with_vlm(
                data_uris, prompt, default_model, max_tokens=max_tokens
            )
            used_model = default_model
        except Exception as primary_err:
            logger.warning("Default model failed, trying fallback: %s", primary_err)
            try:
                raw_response = await analyze_images_with_vlm(
                    data_uris, prompt, MODELS["fallback"], max_tokens=max_tokens
                )
                used_model = MODELS["fallback"]
            except Exception as fallback_err:
                logger.error("Fallback model also failed: %s", fallback_err)
                raise HTTPException(status_code=500, detail=str(fallback_err)) from fallback_err

    analysis = parse_analysis_response(raw_response)

    return {
        "success": True,
        "analysis": analysis,
        "image_count": len(data_uris),
        "mode": mode,
        "model_used": used_model,
        "raw_response": raw_response,
    }
