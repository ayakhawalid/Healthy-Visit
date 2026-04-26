"""Natural-language chat prompts derived from catalog QItem intent (parsing still uses QItem)."""
from __future__ import annotations

import re
from typing import Literal, Optional

from official_q.catalog import (
    OPTION_MEANINGS_EN,
    QItem,
    SCRIPT_QUESTION_EN,
    SCRIPT_QUESTION_HE,
    TOPIC_INTENT_EN,
)
from official_q.llm_utils import invoke_chat


def norm_chat_lang(language: Optional[str]) -> Literal["he", "en"]:
    if language and str(language).lower().strip() in ("en", "english"):
        return "en"
    return "he"


def _lang_rule(lang: Literal["he", "en"]) -> str:
    if lang == "he":
        return (
            "LANGUAGE: Write your entire reply in Hebrew only. "
            "Do not use English words or sentences (abbreviations cm, kg are allowed). "
            "Do not mix Hebrew and English in the same reply.\n"
        )
    return (
        "LANGUAGE: Write your entire reply in English only. "
        "Do not use Hebrew words or sentences. "
        "Do not mix English and Hebrew in the same reply.\n"
    )


def _q_spec_user_block(q: QItem, lang: Literal["he", "en"]) -> str:
    opts_line = ""
    if q.options:
        if lang == "en":
            gloss = OPTION_MEANINGS_EN.get(q.id)
            if gloss:
                opts_line = (
                    "Typical answer meanings in English (patient may paraphrase): "
                    f"{gloss}\n"
                )
            else:
                joined = ", ".join(q.options[:24])
                opts_line = (
                    "Closed-choice reference labels (internal; phrase in English for the patient): "
                    f"{joined}\n"
                )
        else:
            joined = ", ".join(q.options[:24])
            opts_line = (
                "Closed-choice labels (exact strings for later parsing; the patient may paraphrase): "
                f"{joined}\n"
            )
    if lang == "en":
        intent = TOPIC_INTENT_EN.get(q.id, "general background")
        return (
            f"question_id (internal): {q.id}\n"
            f"topic_to_ask_about (English — use this meaning only; do not write any Hebrew): {intent}\n"
            f"answer_shape: {q.kind}\n"
            f"{opts_line}"
        ).strip()
    return (
        f"question_id (internal): {q.id}\n"
        f"domain: {q.domain}\n"
        f"official_catalog_label_hebrew (meaning only — do not paste verbatim as the question): {q.hebrew}\n"
        f"answer_shape: {q.kind}\n"
        f"{opts_line}"
    ).strip()


def _sanitize_llm_reply(text: str, lang: Literal["he", "en"]) -> str:
    """Normalize replies: English mode drops any line containing Hebrew; Hebrew mode rejects English-only blobs."""
    t = (text or "").strip()
    if not t:
        return ""
    if lang == "en":
        lines = [ln for ln in t.split("\n") if not re.search(r"[\u0590-\u05FF]", ln)]
        t = "\n".join(lines).strip()
        if not t:
            return ""
    elif lang == "he" and re.search(r"[A-Za-z]{4,}", t) and not re.search(r"[\u0590-\u05FF]", t):
        return ""
    return t


def _fallback_question(_q: QItem, lang: Literal["he", "en"]) -> str:
    if lang == "he":
        # Avoid pasting catalog labels (e.g. "תאריך לידה") when the model call failed.
        return "אפשר לענות במשפט או שניים בניסוח חופשי? כל ניסוח שמספר את המידע מספיק."
    return "Could you share a quick answer in your own words? Anything close is fine."


def scripted_question_line(q: QItem, lang: Literal["he", "en"]) -> str:
    """Deterministic question text — used when the LLM is down and to avoid catalog-label echoes."""
    if lang == "en":
        return SCRIPT_QUESTION_EN.get(q.id) or _fallback_question(q, "en")
    scripted_he = SCRIPT_QUESTION_HE.get(q.id)
    if scripted_he:
        return scripted_he
    catalog_he = (q.hebrew or "").strip()
    if catalog_he:
        return catalog_he
    return _fallback_question(q, "he")


def conversational_question_for_item(
    q: QItem,
    lang: Literal["he", "en"],
    *,
    temperature: float = 0.65,
) -> str:
    system = (
        _lang_rule(lang)
        + "You help a lifestyle intake chat inside an app called Healthy Visit. "
        "The patient's reply will later be parsed into a structured field for their dietitian — "
        "your job is only to ask in warm, spoken language.\n\n"
        "Rules:\n"
        "- Output exactly ONE short question the way a supportive coach would type in chat — not a government form.\n"
        "- Do NOT use bare catalog labels as the whole question (e.g. \"full name\", \"שם מלא\", "
        "\"date of birth\", \"תאריך לידה\", \"gender\", \"מגדר\").\n"
        "- Use full sentences; a short lead-in is fine if it feels human.\n"
        "- The patient answers in free language. NEVER list the closed-choice options "
        "inside the question (no parentheses with words like \"never, sometimes, often\", "
        "no \"choose one of...\", no scale ranges like \"0–3\"). Just ask the question naturally "
        "and let them reply however they want.\n"
        "- Do not mention question numbers, JSON, scoring, or the word \"questionnaire\".\n"
        "- Output only the question text — no quotes, bullets, or numbering.\n"
    )
    user = "Turn this catalog item into your conversational question:\n\n" + _q_spec_user_block(q, lang)
    out = invoke_chat(system, user, temperature=temperature)
    if out:
        cleaned = _sanitize_llm_reply(out.strip(), lang)
        if cleaned:
            return cleaned
    return scripted_question_line(q, lang)


def conversational_acknowledge_and_ask(
    prev_answer: str,
    next_q: QItem,
    lang: Literal["he", "en"],
    *,
    temperature: float = 0.65,
) -> str:
    lang_name = "Hebrew" if lang == "he" else "English"
    system = (
        _lang_rule(lang)
        + "You are a warm coach for Healthy Visit lifestyle intake.\n"
        "Write at most 3 short sentences total:\n"
        "(1) One brief sentence acknowledging what the patient just said.\n"
        "(2) One natural conversational question for the next topic — full sentences, not form labels.\n"
        f"Capture the intent in fluent {lang_name}; do NOT paste the Hebrew catalog label verbatim.\n"
        "Do not mention questionnaires, parsing, or question IDs.\n"
    )
    user = (
        f"They answered (free text, may be messy):\n{prev_answer}\n\n"
        "Next item to cover (semantic spec — phrase naturally for the patient):\n" + _q_spec_user_block(next_q, lang)
    )
    out = invoke_chat(system, user, temperature=temperature)
    if out:
        cleaned = _sanitize_llm_reply(out.strip(), lang)
        if cleaned:
            return cleaned
    if lang == "he":
        return f"תודה ששיתפת. {scripted_question_line(next_q, 'he')}"
    return f"Thanks for sharing. {scripted_question_line(next_q, 'en')}"


def transition_after_demographics(
    height_cm: float,
    weight_kg: float,
    first_q: QItem,
    lang: Literal["he", "en"],
    *,
    temperature: float = 0.65,
) -> str:
    system = (
        _lang_rule(lang)
        + "You are a warm onboarding coach for Healthy Visit.\n"
        "The patient just shared height and weight. Write ONE message with exactly 3 short paragraphs, "
        "each separated by a single blank line:\n"
        "(1) Thank them briefly for sharing height and weight.\n"
        "(2) One sentence that you'll ask a few short background questions before their dietitian visit.\n"
        "(3) Ask the first background topic as a natural conversational question — not a form field label; "
        "do not use bare phrases like \"date of birth\" / \"תאריך לידה\" as the entire question.\n"
        "Do not mention scoring, JSON, or the word \"questionnaire\".\n"
    )
    user = (
        f"height_cm={height_cm}, weight_kg={weight_kg}.\n\n"
        "First catalog item to cover (semantic spec — phrase naturally):\n" + _q_spec_user_block(first_q, lang)
    )
    out = invoke_chat(system, user, temperature=temperature)
    if out:
        cleaned = _sanitize_llm_reply(out.strip(), lang)
        if cleaned:
            return cleaned
    if lang == "he":
        return (
            "תודה על השיתוף.\n\n"
            "נהדר — נשאל כמה פרטים קצרים לפני המפגש.\n\n"
            f"{scripted_question_line(first_q, 'he')}"
        )
    return (
        "Thanks for sharing.\n\n"
        "Great — we'll ask a few short background questions before your visit.\n\n"
        f"{scripted_question_line(first_q, 'en')}"
    )
