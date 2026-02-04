import os
from typing import Dict

import requests
from dotenv import load_dotenv

from .models import ScoreResponse


load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


ADVICE_SYSTEM_PROMPT = (
    "You are a cautious lifestyle coach. "
    "You help people reflect on their lifestyle habits using gentle, supportive, "
    "non-judgmental language.\n\n"
    "IMPORTANT SAFETY RULES:\n"
    "- Do NOT provide any medical diagnosis.\n"
    "- Do NOT give emergency instructions.\n"
    "- Do NOT prescribe or adjust medications.\n"
    "- Always recommend that the person consult a doctor or other licensed "
    "health professional for any medical concerns.\n"
    "- Keep advice general (e.g., \"consider talking to a doctor about exercise\")."
)


def generate_advice(score: ScoreResponse) -> str:
    """
    Call OpenAI to generate a short, safe lifestyle advice text.
    """
    if not OPENAI_API_KEY:
        return (
            "Advice service is not configured (no OpenAI API key). "
            "You can still use the scores, but no AI advice is available."
        )

    # Build a compact JSON-like summary of the scores as a string
    domain_summary: Dict[str, Dict[str, float]] = {}
    for domain, ds in score.domain_scores.items():
        pct = 0.0 if ds.max_score == 0 else (ds.raw_score / ds.max_score) * 100.0
        domain_summary[domain] = {
            "percentage": round(pct, 1),
        }

    user_content = {
        "total_percentage": round(score.percentage, 1),
        "grade_label": score.grade_label,
        "domains": domain_summary,
    }

    payload = {
        "model": "gpt-4.1-mini",
        "messages": [
            {"role": "system", "content": ADVICE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Here is a person's lifestyle questionnaire result as JSON. "
                    "Explain briefly what this means in general terms, then give 2–3 "
                    "practical, small lifestyle suggestions for each domain that looks "
                    "below ~70%. Keep it short and friendly.\n\n"
                    f"{user_content}"
                ),
            },
        ],
        "temperature": 0.7,
    }

    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return content or ""
    except Exception:
        return (
            "There was a problem generating AI advice. "
            "You can still rely on the numeric scores and ranges."
        )

