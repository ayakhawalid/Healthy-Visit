"""Map free-text patient replies to structured JSON for official questionnaire items."""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Optional

from official_q.catalog import QItem

try:
    from langchain_openai import ChatOpenAI
except ImportError:
    ChatOpenAI = None

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


def _llm(system: str, user: str) -> str:
    if not OPENAI_API_KEY or not ChatOpenAI:
        return ""
    try:
        os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
        r = llm.invoke(
            [{"role": "system", "content": system}, {"role": "user", "content": user}]
        )
        return (getattr(r, "content", None) or "").strip()
    except Exception:
        return ""


def _number_from_digits(msg: str) -> Optional[float]:
    m = re.search(r"(\d+(?:[.,]\d+)?)", msg.replace(",", "."))
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _parse_number_natural(q: QItem, msg: str) -> Dict[str, Any]:
    """
    Patients rarely type bare digits. Prefer LLM to infer one number from Hebrew/English
    (e.g. 'כוסיים', 'בערך שלוש פעמים', 'כמעט לא', 'הרבה מים', 'two or three').
    """
    direct = _number_from_digits(msg)
    if direct is not None:
        return {"kind": "number", "value": direct, "raw": msg}

    system = (
        "You convert a patient's natural-language answer into ONE number for a health questionnaire field.\n"
        "The question asks for a count or amount (meals, cups, portions per day/week, hours, minutes, days per week, etc.).\n"
        "Infer a reasonable numeric value from Hebrew or English, including words only (e.g. אפס/אף פעם/never -> 0; "
        "קצת/מעט/a little -> small positive; הרבה/המון/a lot -> larger; כוסיים/two glasses -> 2; חצי -> 0.5 when appropriate).\n"
        "If they give a range (e.g. 2–3), use the midpoint or a single best representative number.\n"
        "If the answer cannot be interpreted as any number, use null.\n"
        "Respond with ONLY valid JSON, one line: {\"value\": <number or null>} — no markdown, no explanation."
    )
    user = f"Question (Hebrew label): {q.hebrew}\nPatient answer:\n{msg}"
    raw = _llm(system, user)
    if not raw:
        return {"kind": "number", "value": None, "raw": msg}

    text = raw.strip()
    if "```" in text:
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "value" in data:
            v = data["value"]
            if v is None:
                return {"kind": "number", "value": None, "raw": msg}
            return {"kind": "number", "value": float(v), "raw": msg}
    except (json.JSONDecodeError, TypeError, ValueError):
        pass

    # Last resort: try to read a lone number from model output
    m = re.search(r"-?\d+(?:[.,]\d+)?", text.replace(",", "."))
    if m:
        try:
            return {"kind": "number", "value": float(m.group(0)), "raw": msg}
        except ValueError:
            pass
    return {"kind": "number", "value": None, "raw": msg}


def parse_answer(q: QItem, user_message: str) -> Dict[str, Any]:
    msg = (user_message or "").strip()
    if not msg:
        return {"kind": q.kind, "empty": True}

    # Always remember the patient's exact reply alongside the parsed value.
    # The parsed structure (chosen option index/labels) is what scoring uses;
    # `raw` is what the chat replay shows back to the patient so they see
    # their own words in the language they typed them, not the catalog's
    # Hebrew option labels (which can also be wrong when the LLM picks the
    # closest-but-not-exact option).
    if q.kind == "number":
        out = _parse_number_natural(q, msg)
        out.setdefault("raw", msg)
        return out

    if q.kind == "text":
        return {"kind": "text", "value": msg, "raw": msg}

    if q.kind == "single_choice" and q.options:
        out = _parse_single(q, msg)
        out["raw"] = msg
        return out

    if q.kind == "yes_no_detail" and q.options:
        base = _parse_single(q, msg)
        idx = int(base.get("index", 0))
        out = {"kind": "yes_no_detail", "index": idx, "detail": "", "raw": msg}
        if idx == 1 and len(msg) > 15:
            out["detail"] = msg
        return out

    if q.kind == "multi_choice" and q.options:
        out = _parse_multi(q, msg)
        out["raw"] = msg
        return out

    return {"kind": q.kind, "raw": msg}


def _parse_single(q: QItem, msg: str) -> Dict[str, Any]:
    opts = q.options or []
    options_text = "\n".join(f"{i}: {opt}" for i, opt in enumerate(opts))
    system = (
        "You map a patient's Hebrew or English free-text to one option index. "
        f"Respond with ONLY a single integer 0-{len(opts) - 1}."
    )
    user = f"Question: {q.hebrew}\nOptions:\n{options_text}\n\nPatient:\n{msg}"
    raw = _llm(system, user)
    try:
        token = (raw or "").strip().split()[0]
        idx = int(token)
        if 0 <= idx < len(opts):
            return {"kind": "single_choice", "index": idx, "label": opts[idx]}
    except (ValueError, IndexError):
        pass
    return {"kind": "single_choice", "index": max(0, len(opts) // 2), "label": opts[max(0, len(opts) // 2)]}


def _parse_multi(q: QItem, msg: str) -> Dict[str, Any]:
    opts = q.options or []
    options_text = "\n".join(f"{i}: {opt}" for i, opt in enumerate(opts))
    system = (
        "You map a patient's Hebrew or English answer to MULTIPLE option indices for a multi-select health question. "
        'Respond with ONLY a JSON array of integers, e.g. [0,3]. If they say "none" or "no", use [0] if index 0 is "לא".'
    )
    user = f"Question: {q.hebrew}\nOptions:\n{options_text}\n\nPatient:\n{msg}"
    raw = _llm(system, user)
    try:
        arr = json.loads(raw)
        if isinstance(arr, list):
            idxs = [int(x) for x in arr if isinstance(x, (int, float)) or (isinstance(x, str) and x.isdigit())]
            idxs = [i for i in idxs if 0 <= i < len(opts)]
            if not idxs:
                idxs = [0]
            return {"kind": "multi_choice", "indices": idxs, "labels": [opts[i] for i in idxs]}
    except Exception:
        pass
    return {"kind": "multi_choice", "indices": [0], "labels": [opts[0]] if opts else []}
