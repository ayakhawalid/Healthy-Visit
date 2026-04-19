"""Shared OpenAI chat helper for official questionnaire LLM features."""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Always load backend/.env even when uvicorn/python is started from the repo root (cwd != backend).
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_BACKEND_ROOT / ".env")
load_dotenv()

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

try:
    from langchain_openai import ChatOpenAI
except ImportError:
    ChatOpenAI = None


def openai_available() -> bool:
    return bool(OPENAI_API_KEY and ChatOpenAI)


def invoke_chat(system: str, user: str, temperature: float = 0.5) -> str:
    if not OPENAI_API_KEY:
        logger.warning("invoke_chat skipped: OPENAI_API_KEY is not set (set it in backend/.env).")
        return ""
    if not ChatOpenAI:
        logger.warning("invoke_chat skipped: langchain_openai ChatOpenAI not importable.")
        return ""
    try:
        os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=temperature)
        r = llm.invoke(
            [{"role": "system", "content": system}, {"role": "user", "content": user}]
        )
        return (getattr(r, "content", None) or "").strip()
    except Exception as e:
        logger.warning("invoke_chat failed (check OPENAI_API_KEY and network): %s", e)
        return ""
