"""
OpenRouter API client for Vision-Language Model calls.
Handles sending images to Qwen3-VL models via OpenRouter's
OpenAI-compatible endpoint and parsing the response.
"""

import os
import re
import json
from typing import Any

import httpx

# Available VLM models on OpenRouter
# Each entry: id used in API calls → display label for the UI
MODELS = {
    "primary": "qwen/qwen2.5-vl-72b-instruct",
    "fallback": "qwen/qwen2.5-vl-32b-instruct",
}

# speed: fast ≈ 3-8s, medium ≈ 10-20s, slow ≈ 20-60s+
MODEL_OPTIONS = [
    # ── Fast models ──
    {"id": "google/gemini-2.0-flash-001",       "name": "Gemini 2.0 Flash",              "speed": "fast"},
    {"id": "qwen/qwen2.5-vl-3b-instruct",       "name": "Qwen2.5-VL 3B Instruct",        "speed": "fast"},
    {"id": "opengvlab/internvl3-2b",             "name": "InternVL3 2B",                   "speed": "fast"},
    # ── Medium models ──
    {"id": "qwen/qwen2.5-vl-32b-instruct",      "name": "Qwen2.5-VL 32B Instruct",       "speed": "medium"},
    {"id": "qwen/qwen2.5-vl-72b-instruct",      "name": "Qwen2.5-VL 72B Instruct",       "speed": "medium"},
    {"id": "opengvlab/internvl3-14b",            "name": "InternVL3 14B",                  "speed": "medium"},
    {"id": "google/gemini-2.5-flash-preview",    "name": "Gemini 2.5 Flash Preview",       "speed": "medium"},
    {"id": "meta-llama/llama-4-maverick",        "name": "Llama 4 Maverick",               "speed": "medium"},
    {"id": "moonshotai/kimi-vl-a3b-thinking",    "name": "Kimi VL A3B (Thinking)",         "speed": "medium"},
    # ── Slow (but thorough) models ──
    {"id": "qwen/qwen3-vl-30b-a3b-thinking",    "name": "Qwen3-VL 30B (Thinking)",        "speed": "slow"},
    {"id": "qwen/qwen3-vl-235b-a22b-thinking",  "name": "Qwen3-VL 235B (Thinking)",       "speed": "slow"},
]

VALID_MODEL_IDS = {m["id"] for m in MODEL_OPTIONS}

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


async def analyze_images_with_vlm(
    base64_images: list[str],
    prompt: str,
    model: str = MODELS["primary"],
    max_tokens: int = 4096,
) -> str:
    """
    Sends one or more images + prompt to OpenRouter's VLM endpoint.
    Multiple images are included as separate image_url content parts
    so the VLM can cross-reference different angles.

    Args:
        base64_images: List of base64 data URI strings
        prompt: Text prompt instructing the model what to analyze
        model: Which model to use (defaults to primary)

    Returns:
        Raw text response from the model

    Raises:
        ValueError: If API key is missing
        RuntimeError: If the API call fails
    """
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key or api_key == "your_api_key_here":
        raise ValueError("OPENROUTER_API_KEY is not configured. Add it to .env")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://shelf-inventory-counter.vercel.app",
        "X-Title": "Shelf Inventory Counter",
    }

    # Build content parts: one image_url per uploaded image, then the text prompt
    content_parts: list[dict[str, Any]] = [
        {"type": "image_url", "image_url": {"url": img}} for img in base64_images
    ]
    content_parts.append({"type": "text", "text": prompt})

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content_parts}],
        "max_tokens": max_tokens,
    }

    # Call OpenRouter's OpenAI-compatible chat completions endpoint
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(OPENROUTER_URL, headers=headers, json=payload)

    if response.status_code != 200:
        raise RuntimeError(
            f"OpenRouter API error ({response.status_code}): {response.text}"
        )

    data = response.json()
    raw_content = data.get("choices", [{}])[0].get("message", {}).get("content")

    if not raw_content:
        raise RuntimeError("No response content from VLM")

    return raw_content


def strip_thinking_tags(raw_response: str) -> str:
    """
    Strips <think>...</think> tags from thinking model output.
    Thinking models wrap their reasoning in these tags — we want
    only the final answer for parsing.

    Args:
        raw_response: Raw model output potentially containing think tags

    Returns:
        Clean response with thinking stripped out
    """
    return re.sub(r"<think>[\s\S]*?</think>", "", raw_response).strip()


def _sanitize_json(text: str) -> str:
    """Fix common VLM JSON mistakes that break json.loads()."""
    # Replace invalid \' escape (not valid in JSON) with plain '
    text = text.replace("\\'", "'")
    # Remove trailing commas before } or ]
    text = re.sub(r",\s*([}\]])", r"\1", text)
    # Strip control characters except \n \r \t
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return text


def _try_parse(text: str) -> dict[str, Any] | None:
    """Attempt json.loads with sanitization fallback."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    try:
        return json.loads(_sanitize_json(text))
    except json.JSONDecodeError:
        return None


def extract_json(text: str) -> dict[str, Any] | None:
    """
    Extracts a JSON block from the model's text response.
    Looks for ```json fences, raw { } blocks, and sanitizes common VLM errors.
    """
    # Try fenced json block first
    fenced = re.search(r"```json\s*([\s\S]*?)```", text)
    if fenced:
        result = _try_parse(fenced.group(1).strip())
        if result:
            return result

    # Try raw JSON object
    raw = re.search(r"\{[\s\S]*\}", text)
    if raw:
        result = _try_parse(raw.group(0))
        if result:
            return result

    return None


def parse_analysis_response(raw_response: str) -> dict[str, Any]:
    """
    Parses raw VLM output into a structured analysis dict.
    Handles both clean JSON responses and messy text that needs extraction.

    Args:
        raw_response: Raw text from the VLM (may include thinking tags)

    Returns:
        Structured analysis result dict
    """
    cleaned = strip_thinking_tags(raw_response)
    data = extract_json(cleaned)

    if data:
        shelves_raw = data.get("shelves", [])
        shelves = [
            {
                "shelf_number": int(s.get("shelf_number", i + 1)),
                "count": int(s.get("count", 0)),
                "description": str(s.get("description", "")),
            }
            for i, s in enumerate(shelves_raw)
        ]

        # Parse product-level inventory breakdown
        products_raw = data.get("products", [])
        products = [
            {
                "name": str(p.get("name", "Unknown")),
                "count": int(p.get("count", 0)),
                "shelf_numbers": [int(n) for n in p.get("shelf_numbers", [])],
            }
            for p in products_raw
            if isinstance(p, dict)
        ]
        # Sort by count descending for display
        products.sort(key=lambda p: p["count"], reverse=True)

        confidence = str(data.get("confidence", "medium"))
        if confidence not in ("low", "medium", "high"):
            confidence = "medium"

        return {
            "total_visible_count": int(data.get("total_visible_count", 0)),
            "shelves": shelves,
            "products": products,
            "estimated_hidden_count": int(data.get("estimated_hidden_count", 0)),
            "estimated_total_count": int(data.get("estimated_total_count", 0)),
            "confidence": confidence,
            "notes": str(data.get("notes", "")),
        }

    # Fallback: couldn't parse JSON, return raw text as notes
    return {
        "total_visible_count": 0,
        "shelves": [],
        "products": [],
        "estimated_hidden_count": 0,
        "estimated_total_count": 0,
        "confidence": "low",
        "notes": f"Could not parse structured response. Raw output:\n{cleaned}",
    }
