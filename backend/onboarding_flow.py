"""
AI-driven onboarding: warm conversation + structured capture of height/weight
and a short set of official lifestyle questionnaire items (Part A basics).
"""
from __future__ import annotations

import json
import re
import unicodedata
import uuid
from dataclasses import dataclass, field
from datetime import date
from typing import Dict, Literal, Optional, Tuple, cast

from database import conn
from models import PatientProfile

from CRUD.official_questionnaire import upsert_official_answer
from official_q.catalog import INITIAL_ONBOARDING_QIDS, get_question
from official_q.conversational import (
    conversational_acknowledge_and_ask,
    scripted_question_line,
    transition_after_demographics,
)
from official_q.llm_utils import invoke_chat as _invoke_chat
from official_q.parse_answer import parse_answer

OFFICIAL_ONBOARDING_QIDS: Tuple[str, ...] = tuple(INITIAL_ONBOARDING_QIDS)

ONBOARDING_SESSIONS: Dict[str, "OnboardingSession"] = {}


@dataclass
class OnboardingSession:
    session_id: str
    patient_id: int
    language: Literal["he", "en"] = "he"
    phase: Literal["demographics", "official", "done"] = "demographics"
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    official_index: int = 0
    history: list = field(default_factory=list)


def _norm_lang(language: Optional[str]) -> Literal["he", "en"]:
    if not language:
        return "he"
    s = str(language).lower().strip().replace("_", "-")
    if s in ("en", "english", "en-us", "en-gb"):
        return "en"
    return "he"


def _normalize_user_text(text: str) -> str:
    """NFKC + collapse odd spaces so '155 cm and 45 kg' parses reliably."""
    t = unicodedata.normalize("NFKC", text or "")
    t = t.replace("\u00a0", " ").replace("\u202f", " ")
    t = re.sub(r"\s+", " ", t.strip())
    return t


def _is_meta_smalltalk(msg: str, lang: Literal["he", "en"]) -> bool:
    """Greetings / repeat / confusion — not an answer to the current intake field."""
    t = (msg or "").strip()
    if not t:
        return False
    if lang == "en":
        tl = re.sub(r"[^\w\s]", "", t.lower()).strip()
        if tl in {"hi", "hey", "hello", "yo", "repeat", "again", "help", "what", "huh"}:
            return True
        low = t.lower()
        return bool(
            re.search(r"\b(repeat|again)\b", low)
            or re.search(r"say that again|one more time", low)
            or re.search(r"\b(don'?t|do not) understand\b", low)
            or re.search(r"\bnot working\b", low)
        )
    return bool(re.search(r"שלום|היי|חזור|עוד פעם|לא הבנתי|מה\s*$|עזרה", t))


def _demographics_noise_no_digits(msg: str, lang: Literal["he", "en"]) -> bool:
    """Small talk before sharing height/weight (no digits in message)."""
    if re.search(r"\d", msg or ""):
        return False
    return _is_meta_smalltalk(msg, lang)


def _loose_height_weight_pair(text: str) -> Tuple[Optional[float], Optional[float]]:
    """
    When cm/kg labels are mistyped (wrong keyboard), still pick two plausible metrics in order.
    """
    nums: list[float] = []
    for m in re.finditer(r"(?<![0-9])(\d{2,3}(?:\.\d+)?)\b", text or ""):
        nums.append(float(m.group(1)))
        if len(nums) >= 6:
            break
    for i in range(len(nums) - 1):
        a, b = nums[i], nums[i + 1]
        if 80 <= a <= 250 and 30 <= b <= 300:
            return a, b
        if 80 <= b <= 250 and 30 <= a <= 300:
            return b, a
    return None, None


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


def _contains_hebrew(text: str) -> bool:
    return bool(re.search(r"[\u0590-\u05FF]", text or ""))


def _looks_english_only_no_hebrew(text: str) -> bool:
    """True if text looks like English prose with no Hebrew (short tokens like cm/kg are OK)."""
    t = (text or "").strip()
    if not t or _contains_hebrew(t):
        return False
    # Any word-like Latin run (4+) implies English sentence, not just units/numbers.
    return bool(re.search(r"[A-Za-z]{4,}", t))


def _coerce_onboarding_language(text: str, lang: Literal["he", "en"]) -> str:
    """Drop LLM output that ignores LANGUAGE rule."""
    t = (text or "").strip()
    if not t:
        return ""
    if lang == "en" and _contains_hebrew(t):
        return ""
    if lang == "he" and _looks_english_only_no_hebrew(t):
        return ""
    return t


def opening_message(lang: Literal["he", "en"] = "he") -> str:
    system = (
        _lang_rule(lang)
        + "You are a warm, brief health onboarding coach for an app called Healthy Visit. "
        "Write a friendly greeting (2–3 short sentences) and naturally ask for the person's "
        "height in centimeters and weight in kilograms. Sound human and supportive, not clinical. "
        "Do not mention questionnaires or scoring."
    )
    user = "Start the conversation."
    out = _invoke_chat(system, user, temperature=0.7)
    out = _coerce_onboarding_language(out or "", lang)
    if out:
        return out
    if lang == "he":
        return (
            "שלום — ברוכים הבאים ל-Healthy Visit. "
            "נשמח לקבל את הגובה שלכם בסנטימטרים ואת המשקל בקילוגרמים — אפשר לכתוב בבת אחת."
        )
    return (
        "Hi — welcome to Healthy Visit. I'm here to get a quick sense of how you're doing. "
        "Could you share your height (in cm) and your weight (in kg)? You can type them in one message."
    )


def _json_scalar_to_float(val: object) -> Optional[float]:
    """Accept JSON numbers, numeric strings, and strings like '155cm' / '72.5 kg'."""
    if val is None or isinstance(val, bool):
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        s = val.strip().lower().replace(",", ".")
        m = re.search(r"(\d+(?:\.\d+)?)", s)
        if not m:
            return None
        try:
            return float(m.group(1))
        except ValueError:
            return None
    return None


def _parse_demographics_json(raw: str) -> Tuple[Optional[float], Optional[float], str]:
    """Try to parse LLM JSON for height_cm, weight_kg, reply."""
    if not raw or not str(raw).strip():
        return None, None, ""
    t = str(raw).strip()
    if "```" in t:
        t = re.sub(r"^```(?:json)?\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    try:
        data = json.loads(t)
        if not isinstance(data, dict):
            return None, None, ""
        reply = str(data.get("reply") or "").strip()
        height = _json_scalar_to_float(data.get("height_cm"))
        weight = _json_scalar_to_float(data.get("weight_kg"))
        return height, weight, reply
    except Exception:
        return None, None, ""


def _regex_extract_numbers(text: str) -> Tuple[Optional[float], Optional[float]]:
    """
    Find height (cm) and weight (kg). Units are required so '155cm' is not read as kg.
    Uses (?<![0-9]) instead of \\b before digits so 'גובה155cm' and similar still match.
    """
    height = weight = None
    if not (text or "").strip():
        return None, None
    t = text.strip()
    t_lower = t.lower().replace(",", ".")
    # Common combined form in one phrase (english connectors like "and" / "&" allowed between).
    pair_m = re.search(
        r"(?<![0-9])(\d{2,3})\s*(?:cm|cms|centimet(?:er|re)s?|ס״מ|ס\"מ|ס'\s*מ|סמ)\b"
        r".{0,48}?"
        r"(?<![0-9])(\d{2,3}(?:\.\d+)?)\s*(?:kg|kgs|kilo(?:s|grams?)?|ק״ג|ק\"ג|ק'\s*ג|קג)\b",
        t_lower,
        flags=re.DOTALL,
    )
    if pair_m:
        h0, w0 = float(pair_m.group(1)), float(pair_m.group(2))
        if 80 <= h0 <= 250 and 30 <= w0 <= 300:
            return h0, w0
    # Hebrew / English cm markers (order: longer tokens first where helpful)
    cm_pat = (
        r"(?<![0-9])(\d{2,3})\s*(?:"
        r"cm\b|cms\b|centimet(?:er|re)s?\b|"
        r"ס״מ|ס\"מ|ס'\s*מ|סמ\b"
        r")"
    )
    kg_pat = (
        r"(?<![0-9])(\d{2,3}(?:\.\d+)?)\s*(?:"
        r"kg\b|kgs\b|kilo(?:s|grams?)?\b|"
        r"ק״ג|ק\"ג|ק'\s*ג|קג\b"
        r")"
    )
    for m in re.finditer(cm_pat, t_lower):
        h = float(m.group(1))
        if 80 <= h <= 250:
            height = h
            break
    # Hebrew kg often appears in original casing; search both lower and original for ק״ג etc.
    for src in (t_lower, t):
        for m in re.finditer(kg_pat, src):
            w = float(m.group(1))
            if 30 <= w <= 300:
                weight = w
                break
        if weight is not None:
            break
    if height is None or weight is None:
        lh, lw = _loose_height_weight_pair(t)
        if lh is not None and lw is not None:
            height, weight = lh, lw
    return height, weight


def _post_height_weight_handoff(sess: OnboardingSession, lang: Literal["he", "en"]) -> str:
    """First official question after height+weight are known (transition text)."""
    qid = OFFICIAL_ONBOARDING_QIDS[0]
    q = get_question(qid)
    hc, wk = sess.height_cm, sess.weight_kg
    if hc is None or wk is None:
        return ""
    combined = ""
    if q:
        combined = _coerce_onboarding_language(
            transition_after_demographics(float(hc), float(wk), q, lang, temperature=0.65),
            lang,
        )
        combined = _finalize_reply_script(combined or "", lang)
    if not combined:
        ack_line = "תודה על השיתוף." if lang == "he" else "Thanks for sharing that."
        intro = _coerce_onboarding_language(_official_intro_ai(lang), lang) or (
            "נהדר — נשאל כמה פרטים קצרים כדי להכיר אותך טוב יותר לפני המפגש."
            if lang == "he"
            else "Great — we'll ask a few short background questions before your visit."
        )
        first_ask = (
            scripted_question_line(q, lang)
            if q
            else (
                "איך נוח לך לשתף את תאריך הלידה?"
                if lang == "he"
                else "When were you born, roughly (day/month/year is fine)?"
            )
        )
        combined = f"{ack_line}\n\n{intro}\n\n{first_ask}"
    return _finalize_reply_script(combined, lang)


def _finalize_reply_script(text: str, lang: Literal["he", "en"]) -> str:
    """Last pass: remove any Hebrew lines from English replies (model sometimes echoes catalog)."""
    if lang != "en":
        return (text or "").strip()
    lines = [ln for ln in (text or "").split("\n") if not _contains_hebrew(ln)]
    return "\n".join(lines).strip()


def demographics_turn(
    sess: OnboardingSession, user_message: str
) -> Tuple[str, bool]:
    """
    Returns (assistant_message, transition_to_official).
    """
    lang = cast(Literal["he", "en"], sess.language)
    um = _normalize_user_text(user_message)

    if _demographics_noise_no_digits(um, lang):
        if lang == "en":
            return (
                "Happy to chat — when you're ready, send your height in cm and weight in kg in one line "
                "(example: 170 cm and 70 kg). If you use the wrong keyboard layout, strange letters around the numbers are OK as long as the digits are readable.",
                False,
            )
        return (
            "שמחים לשוחח — כשמתאים, שלחו בשורה אחת גובה בס״מ ומשקל בק״ג "
            "(למשל 170 ס״מ ו־70 ק״ג).",
            False,
        )

    rh, rw = _regex_extract_numbers(um)

    # Do not depend on the demographics LLM when cm+kg are explicit — models often return bad JSON
    # and a misleading "please send again" reply even though the numbers are valid.
    if (
        rh is not None
        and rw is not None
        and 80 <= rh <= 250
        and 30 <= rw <= 300
    ):
        sess.height_cm = float(rh)
        sess.weight_kg = float(rw)
        _upsert_profile_partial(sess.patient_id, sess.height_cm, sess.weight_kg)
        return _post_height_weight_handoff(sess, lang), True

    system = (
        _lang_rule(lang)
        + """You are a warm onboarding coach. The patient is sharing height/weight or clarifying.
You must respond with ONLY a JSON object (no markdown), keys:
- "reply": string, your short friendly message (1-3 sentences), in the required language only.
- "height_cm": number or null (height in centimeters, 80-250 if known).
- "weight_kg": number or null (weight in kilograms, 30-300 if known).

Use plain numbers for height_cm and weight_kg (e.g. 155 and 62.5), never strings — the server also parses the patient's text directly.

If the user gave only one value, acknowledge and ask naturally for the other.
If both are unclear, ask again gently."""
    )
    user = (
        f"Known so far: height_cm={sess.height_cm}, weight_kg={sess.weight_kg}.\n"
        f"Patient message: {um}\n"
        "Extract any new numbers. Update reply accordingly."
    )
    raw = _invoke_chat(system, user, temperature=0.35)
    h, w, reply = _parse_demographics_json(raw or "")

    # If the patient typed explicit cm and kg, trust that over the model (models often swap or mis-read).
    if rh is not None and rw is not None:
        h, w = rh, rw
    else:
        if h is not None and not (80 <= h <= 250):
            h = None
        if w is not None and not (30 <= w <= 300):
            w = None
        if h is None:
            h = rh
        if w is None:
            w = rw

    if h is not None and not (80 <= h <= 250):
        h = None
    if w is not None and not (30 <= w <= 300):
        w = None

    if h is not None and 80 <= h <= 250:
        sess.height_cm = h
    if w is not None and 30 <= w <= 300:
        sess.weight_kg = w

    reply = _coerce_onboarding_language(reply, lang)
    if not reply or reply.strip() == um or reply.strip() == (user_message or "").strip():
        missing_h = sess.height_cm is None
        missing_w = sess.weight_kg is None
        if missing_h and missing_w:
            reply = (
                "תודה — אפשר לציין גובה בס״מ ומשקל בק״ג (למשל 170 ס״מ ו־70 ק״ג)?"
                if lang == "he"
                else "Thanks — could you share your height in cm and weight in kg (for example 170 cm and 70 kg)?"
            )
        elif missing_h:
            reply = (
                "קיבלתי את המשקל — אפשר עדיין לציין גובה בס״מ?"
                if lang == "he"
                else "Got the weight — could you also share your height in cm?"
            )
        else:
            reply = (
                "קיבלתי את הגובה — אפשר עדיין לציין משקל בק״ג?"
                if lang == "he"
                else "Got the height — could you also share your weight in kg?"
            )

    # Persist partial profile
    if sess.height_cm is not None or sess.weight_kg is not None:
        _upsert_profile_partial(sess.patient_id, sess.height_cm, sess.weight_kg)

    ready = sess.height_cm is not None and sess.weight_kg is not None
    if ready:
        return _post_height_weight_handoff(sess, lang), True

    return reply, False


def _official_intro_ai(lang: Literal["he", "en"]) -> str:
    system = (
        _lang_rule(lang)
        + "Write one short friendly sentence transitioning to a few simple background questions. "
        "No bullet points."
    )
    out = _invoke_chat(system, "Transition from demographics to short background questions.", temperature=0.6)
    out = _coerce_onboarding_language(out or "", lang)
    if out:
        return out
    return (
        "נהדר — נשאל כמה פרטים קצרים כדי להכיר אותך טוב יותר לפני המפגש."
        if lang == "he"
        else "Great — we'll ask a few short background questions before your visit."
    )


def _upsert_profile_partial(patient_id: int, height_cm: Optional[float], weight_kg: Optional[float]) -> None:
    row = conn.execute(
        PatientProfile.select().where(PatientProfile.c.patient_id == patient_id)
    ).fetchone()
    vals = {}
    if height_cm is not None:
        vals["height_cm"] = height_cm
    if weight_kg is not None:
        vals["weight_kg"] = weight_kg
    if not vals:
        return
    if row:
        conn.execute(
            PatientProfile.update().values(**vals).where(PatientProfile.c.id == row[0])
        )
    else:
        conn.execute(
            PatientProfile.insert().values(patient_id=patient_id, **vals, onboarding_completed=False)
        )
    conn.commit()


def _mark_onboarding_done(patient_id: int) -> None:
    row = conn.execute(
        PatientProfile.select().where(PatientProfile.c.patient_id == patient_id)
    ).fetchone()
    today = date.today()
    if row:
        keys = list(PatientProfile.c.keys())
        d = dict(zip(keys, row))
        upd = {"onboarding_completed": True}
        if d.get("study_start_date") is None:
            upd["study_start_date"] = today
        conn.execute(
            PatientProfile.update()
            .values(**upd)
            .where(PatientProfile.c.id == row[0])
        )
    else:
        conn.execute(
            PatientProfile.insert().values(
                patient_id=patient_id,
                onboarding_completed=True,
                study_start_date=today,
            )
        )
    conn.commit()


def official_turn(sess: OnboardingSession, user_message: str) -> Tuple[str, bool]:
    """Process answer for current official onboarding question; return (message, done)."""
    lang = cast(Literal["he", "en"], sess.language)
    um_in = (user_message or "").strip()

    qid = OFFICIAL_ONBOARDING_QIDS[sess.official_index]
    q = get_question(qid)
    if not q:
        sess.phase = "done"
        _mark_onboarding_done(sess.patient_id)
        return _farewell_ai(cast(Literal["he", "en"], sess.language)), True

    if q and _is_meta_smalltalk(um_in, lang):
        sq = scripted_question_line(q, lang)
        if lang == "en":
            body = "I'm still on this question — here's what I need:\n\n" + sq
        else:
            body = "עדיין באותה שאלה — זה מה שצריך:\n\n" + sq
        return body, False

    parsed = parse_answer(q, um_in)
    upsert_official_answer(sess.patient_id, qid, parsed, date.today())

    sess.official_index += 1
    if sess.official_index >= len(OFFICIAL_ONBOARDING_QIDS):
        sess.phase = "done"
        _mark_onboarding_done(sess.patient_id)
        farewell = _farewell_ai(cast(Literal["he", "en"], sess.language))
        return farewell, True

    next_qid = OFFICIAL_ONBOARDING_QIDS[sess.official_index]
    nq = get_question(next_qid)
    if nq:
        ack = conversational_acknowledge_and_ask(
            um_in, nq, lang, temperature=0.65
        )
        ack = _coerce_onboarding_language(ack, lang)
        ack = _finalize_reply_script(ack, lang)
        if not ack.strip():
            ack = (
                ("תודה ששיתפת.\n\n" if lang == "he" else "Thanks for sharing.\n\n")
                + scripted_question_line(nq, lang)
            )
            ack = _coerce_onboarding_language(ack, lang) or (
                (
                    "תודה ששיתפת.\n\nאפשר עוד משפט או שניים במילים שלך — כל ניסוח שמספר את המידע מספיק."
                    if lang == "he"
                    else "Thanks for sharing.\n\nCould you tell me a bit more in your own words?"
                )
            )
    else:
        ack = (
            "תודה ששיתפת — נמשיך לשאלה הבאה כשהמערכת תעודכן."
            if lang == "he"
            else "Thanks for sharing — we'll continue once the next question is available."
        )
    return ack, False


def _farewell_ai(lang: Literal["he", "en"]) -> str:
    system = (
        _lang_rule(lang)
        + "Write a short warm closing (2 sentences): onboarding is done, they can sign in, "
        "and over the next three weeks the app will ask a few gentle questions from time to time — "
        "they can answer whenever they feel ready."
    )
    out = _invoke_chat(system, "Done.", temperature=0.6)
    out = _coerce_onboarding_language(out or "", lang)
    if out:
        return out
    return (
        "זה הכול לעכשיו — אפשר להמשיך להתחבר לאפליקציה. בשלושת השבועות הקרובים "
        "יופיעו מדי פעם שאלות קצרות; אפשר לענות כשמתאים לך."
        if lang == "he"
        else (
            "That's it for now — you can sign in. Over the next three weeks you'll see "
            "a few gentle questions from time to time; answer whenever you're ready."
        )
    )


def start_session(patient_id: int, language: str = "he") -> Tuple[str, str, Literal["he", "en"]]:
    lang = _norm_lang(language)
    sid = str(uuid.uuid4())
    sess = OnboardingSession(session_id=sid, patient_id=patient_id, language=lang)
    ONBOARDING_SESSIONS[sid] = sess
    msg = opening_message(lang)
    sess.history.append({"role": "assistant", "content": msg})
    return sid, msg, lang


def handle_message(session_id: str, user_message: str) -> Tuple[str, bool]:
    sess = ONBOARDING_SESSIONS.get(session_id)
    if not sess:
        raise ValueError("session_not_found")
    # Language is fixed for the session from /onboarding/start only.
    if sess.phase == "done":
        lang = cast(Literal["he", "en"], sess.language)
        return (
            "סיימת את ההיכרות — אפשר להתחבר."
            if lang == "he"
            else "You've already finished onboarding. You can sign in."
        ), True

    user_message = (user_message or "").strip()
    if not user_message:
        lang = cast(Literal["he", "en"], sess.language)
        return (
            "כתבו תשובה קצרה." if lang == "he" else "Please type a short answer."
        ), False

    sess.history.append({"role": "user", "content": user_message})

    if sess.phase == "demographics":
        reply, go_official = demographics_turn(sess, user_message)
        if go_official:
            sess.phase = "official"
            sess.history.append({"role": "assistant", "content": reply})
            return reply, False

        sess.history.append({"role": "assistant", "content": reply})
        return reply, False

    reply, done = official_turn(sess, user_message)
    sess.history.append({"role": "assistant", "content": reply})
    return reply, done


def get_session(session_id: str) -> Optional[OnboardingSession]:
    return ONBOARDING_SESSIONS.get(session_id)


def sync_dashboard_metrics(patient_id: int) -> dict:
    """
    Ensure today's DailyMetrics row exists so the patient dashboard can render.
    Score reflects progress through the official questionnaire (0–100) when available.
    """
    from datetime import date

    from models import DailyMetrics

    from CRUD.official_questionnaire import answered_question_ids
    from official_q.catalog import PRIMARY_ORDER

    today = date.today()
    row = conn.execute(
        DailyMetrics.select()
        .where(DailyMetrics.c.patient_id == patient_id)
        .where(DailyMetrics.c.date == today)
    ).fetchone()

    answered = answered_question_ids(patient_id)
    primary_set = set(PRIMARY_ORDER)
    answered_primary = len(answered & primary_set)
    total = max(1, len(PRIMARY_ORDER))
    score = 100.0 * answered_primary / total if answered_primary else None

    created = False
    if row:
        if score is not None:
            conn.execute(
                DailyMetrics.update()
                .values(score=round(score, 2))
                .where(DailyMetrics.c.id == row[0])
            )
            conn.commit()
    else:
        conn.execute(
            DailyMetrics.insert().values(patient_id=patient_id, date=today, score=score)
        )
        conn.commit()
        created = True

    from CRUD.official_questionnaire import refresh_lifestyle_radar_snapshot

    refresh_lifestyle_radar_snapshot(patient_id, today)
    return {"created": created, "score": score}


def persist_onboarding_session(session_id: Optional[str], patient_id: int) -> None:
    """
    Flush in-memory session demographics to PatientProfile (height/weight) if present,
    then sync today's metric row so partial onboarding data appears on the dashboard.
    """
    sess = ONBOARDING_SESSIONS.get(session_id) if session_id else None
    if sess and sess.patient_id == patient_id:
        if sess.height_cm is not None or sess.weight_kg is not None:
            _upsert_profile_partial(patient_id, sess.height_cm, sess.weight_kg)
    sync_dashboard_metrics(patient_id)
