#!/usr/bin/env python3
"""Generate one science-and-nature article and update the static website index."""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
ARTICLES_DIR = ROOT / "articles"
INDEX_FILE = ARTICLES_DIR / "index.json"
TIMEZONE = ZoneInfo("Asia/Colombo")
CATEGORIES = [
    ("Animals", "animal biology, behaviour, adaptations, habitats and conservation"),
    ("Plants & Trees", "plant biology, trees, photosynthesis, reproduction and ecology"),
    ("Dinosaurs", "dinosaur species, evolution, anatomy, fossils and prehistoric ecosystems"),
    ("Microorganisms", "bacteria, archaea, fungi, protozoa, microscopic algae and viruses"),
]
MODEL = os.getenv("OPENAI_MODEL", "gpt-5-mini")


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value[:70] or "daily-discovery"


def read_index():
    if not INDEX_FILE.exists():
        return []
    try:
        data = json.loads(INDEX_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def response_text(payload):
    # Responses may contain multiple output items; collect all output_text blocks.
    parts = []
    for item in payload.get("output", []):
        if item.get("type") == "message":
            for block in item.get("content", []):
                if block.get("type") == "output_text":
                    parts.append(block.get("text", ""))
    if not parts:
        raise RuntimeError("The API response did not contain output text.")
    return "\n".join(parts).strip()


def generate_article(api_key, date_string, category, topic_guidance, previous_titles):
    previous = "\n".join(f"- {title}" for title in previous_titles[-60:]) or "- None yet"
    instructions = (
        "You are the science editor of a careful, accessible educational website. "
        "Write accurate, original, engaging science education for general readers. "
        "Do not invent studies, quotations, statistics, species facts, or citations. "
        "Distinguish established evidence from uncertainty. Avoid sensational claims. "
        "Return only valid JSON matching the requested object shape."
    )
    prompt = f"""
Create one substantial educational article for the category "{category}".
Topic scope: {topic_guidance}
Publication date: {date_string}
Avoid repeating these recent article titles:
{previous}

Choose a specific, interesting topic not already covered. Write in clear English.
Target 650-850 words. Include:
- a concise, informative title (not clickbait)
- a 2-3 sentence summary
- an engaging introduction
- 4 to 6 sections, each with a heading and 1-2 informative paragraphs
- 3 short "Did you know?" facts that are genuinely accurate
- a short conclusion
- 2-4 trustworthy further-reading URLs from established scientific, educational,
  museum, university, government, botanical or conservation organisations.
Only include URLs you are confident are real and relevant; if unsure, provide fewer.
Do not give medical, veterinary or conservation intervention advice.
For living organisms, use accepted common names and scientific names where useful.
For dinosaurs, explain uncertainty where fossil evidence is incomplete.

Return JSON with exactly these keys:
{{
  "title": "string",
  "category": "{category}",
  "summary": "string",
  "introduction": "string",
  "sections": [{{"heading": "string", "body": "string"}}],
  "facts": ["string", "string", "string"],
  "conclusion": "string",
  "further_reading": [{{"title": "string", "url": "https://..."}}]
}}
"""
    body = json.dumps({
        "model": MODEL,
        "instructions": instructions,
        "input": prompt,
        "max_output_tokens": 3000,
        "text": {"format": {"type": "json_object"}},
    }).encode("utf-8")
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI API returned HTTP {exc.code}: {details[:1200]}") from exc
    raw = response_text(payload)
    try:
        article = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"The model returned invalid JSON: {raw[:500]}") from exc
    required = ("title", "category", "summary", "introduction", "sections", "facts", "conclusion")
    if any(not article.get(key) for key in required):
        raise RuntimeError("The generated article is missing one or more required fields.")
    if not isinstance(article["sections"], list) or len(article["sections"]) < 3:
        raise RuntimeError("The generated article has too few sections.")
    if not isinstance(article["facts"], list) or len(article["facts"]) < 3:
        raise RuntimeError("The generated article has too few facts.")
    article["date"] = date_string
    article["category"] = category
    article["model"] = MODEL
    article["further_reading"] = [
        item for item in article.get("further_reading", [])
        if isinstance(item, dict)
        and str(item.get("url", "")).startswith("https://")
        and item.get("title")
    ][:4]
    return article


def main():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing OPENAI_API_KEY. Add it as a GitHub Actions repository secret.")

    now = datetime.now(TIMEZONE)
    date_string = now.date().isoformat()
    ARTICLES_DIR.mkdir(parents=True, exist_ok=True)
    index = read_index()

    # One article per Sri Lankan calendar day; reruns won't create duplicates.
    if any(item.get("date") == date_string for item in index):
        print(f"An article is already published for {date_string}; skipping.")
        return

    category, guidance = CATEGORIES[now.date().toordinal() % len(CATEGORIES)]
    previous_titles = [item.get("title", "") for item in index if item.get("title")]
    article = generate_article(api_key, date_string, category, guidance, previous_titles)

    slug = slugify(article["title"])
    filename = f"{date_string}-{slug}.json"
    article_path = ARTICLES_DIR / filename
    if article_path.exists():
        raise RuntimeError(f"Refusing to overwrite existing article: {filename}")

    article_path.write_text(
        json.dumps(article, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    entry = {
        "date": date_string,
        "title": article["title"],
        "category": category,
        "summary": article["summary"],
        "file": filename,
    }
    index.insert(0, entry)
    INDEX_FILE.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Published article data: {filename}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Daily article publishing failed: {error}", file=sys.stderr)
        raise
