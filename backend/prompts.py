"""
Prompt templates for the shelf inventory counting VLM.
Two modes: quick (fast, concise) and thorough (detailed, multi-angle).
"""


def build_counting_prompt(image_count: int = 1, mode: str = "thorough") -> str:
    if mode == "quick":
        return _build_quick_prompt()
    if image_count > 1:
        return _build_multi_angle_prompt(image_count)
    return _build_single_image_prompt()


# ---- Quick mode (minimal prompt, fast response) ----

_QUICK_JSON = """{
  "total_visible_count": <number>,
  "shelves": [
    {"shelf_number": 1, "count": <number>, "description": "<what's here>"}
  ],
  "products": [
    {"name": "<product name>", "count": <number>, "shelf_numbers": [1]}
  ],
  "estimated_hidden_count": <number>,
  "estimated_total_count": <number>,
  "confidence": "<low|medium|high>",
  "notes": "<brief notes>"
}"""


def _build_quick_prompt() -> str:
    return f"""Count every product on this shelf. Be fast and concise.

For each shelf level, count left to right. Identify products by brand where readable.

Return ONLY JSON:

```json
{_QUICK_JSON}
```

Count now."""


# ---- Thorough mode (detailed prompts) ----

_JSON_SCHEMA = """{
  "total_visible_count": <number>,
  "shelves": [
    {
      "shelf_number": 1,
      "count": <number>,
      "description": "<brief description of what's on this shelf>"
    }
  ],
  "products": [
    {
      "name": "<product brand and type, e.g. 'Dove Body Wash' or 'Unknown red bottle'>",
      "count": <number of this product visible>,
      "shelf_numbers": [<list of shelf numbers where this product appears>]
    }
  ],
  "estimated_hidden_count": <number>,
  "estimated_total_count": <number>,
  "confidence": "<low|medium|high>",
  "notes": "<any observations about the shelf arrangement, lighting, or counting challenges>"
}"""

_JSON_SCHEMA_FSTRING = """\
{{
  "total_visible_count": <number>,
  "shelves": [
    {{
      "shelf_number": 1,
      "count": <number>,
      "description": "<brief description of what's on this shelf>"
    }}
  ],
  "products": [
    {{
      "name": "<product brand and type, e.g. 'Dove Body Wash' or 'Unknown red bottle'>",
      "count": <number of this product visible>,
      "shelf_numbers": [<list of shelf numbers where this product appears>]
    }}
  ],
  "estimated_hidden_count": <number>,
  "estimated_total_count": <number>,
  "confidence": "<low|medium|high>",
  "notes": "<observations>"
}}"""


def _build_single_image_prompt() -> str:
    return f"""You are an expert retail inventory counting assistant. Analyze this shelf image and count every individual product unit visible.

## Instructions
1. Divide the image into distinct shelf levels (top to bottom).
2. For each shelf, count products carefully row-by-row, left to right.
3. Count EVERY individual unit — even partially visible ones at edges.
4. Identify each product by brand name and type where the label is readable. For unreadable labels, describe the product (e.g. "Unknown green bottle", "White box with blue stripe").
5. Group identical products together and count how many of each exist.
6. Estimate how many products might be hidden behind the front row based on shelf depth and visible stacking patterns.
7. Be precise. Do NOT round or approximate — count each item.

## Output Format
Return ONLY a JSON object in this exact format (no extra text outside the JSON):

```json
{_JSON_SCHEMA}
```

Where:
- total_visible_count = sum of all visible products across all shelves
- products = list of unique products identified, with their counts and shelf locations (sorted by count, highest first)
- estimated_hidden_count = estimated products behind the front row (0 if single row)
- estimated_total_count = total_visible_count + estimated_hidden_count
- confidence = your confidence in the count accuracy

Count now."""


def _build_multi_angle_prompt(image_count: int) -> str:
    return f"""You are an expert retail inventory counting assistant. You are given {image_count} images of the SAME shelf taken from different angles.

## Instructions
1. Cross-reference ALL {image_count} images to get the most accurate count.
2. Different angles may reveal products hidden or partially occluded in other views.
3. Divide the shelf into distinct shelf levels (top to bottom).
4. For each shelf, count products carefully row-by-row, left to right.
5. Count EVERY individual unit — even partially visible ones at edges.
6. Identify each product by brand name and type where the label is readable. For unreadable labels, describe the product (e.g. "Unknown green bottle").
7. Group identical products together and count how many of each exist across all angles.
8. Use the side-angle views to estimate depth (how many products are stacked behind the front row).
9. Be precise. Do NOT round or approximate — count each item.
10. If two angles show different counts for the same shelf, use the HIGHER count.

## Output Format
Return ONLY a JSON object in this exact format (no extra text outside the JSON):

```json
{_JSON_SCHEMA_FSTRING}
```

Where:
- total_visible_count = sum of all products visible across ALL angles combined
- products = list of unique products identified, with their counts and shelf locations (sorted by count, highest first)
- estimated_hidden_count = estimated products still hidden even after considering all angles
- estimated_total_count = total_visible_count + estimated_hidden_count
- confidence = your confidence in the count accuracy (multi-angle should generally be higher)

Count now."""


def build_verification_prompt(previous_count: int) -> str:
    return f"""You are an expert retail inventory counting assistant. A previous analysis counted {previous_count} visible products in this image.

Please independently verify this count:
1. Count every shelf level separately, row by row, left to right.
2. Pay special attention to edges and partially visible products.
3. Identify products by brand name where readable.
4. Note any products that might have been missed or double-counted.

Return ONLY a JSON object:

```json
{_JSON_SCHEMA_FSTRING}
```

Count now."""
