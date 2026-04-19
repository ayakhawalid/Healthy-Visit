"""
10-axis lifestyle radar aligned with questionnaire/מערכת_ניקוד (Excel 'גרף רדאר' sheet).
Scores are 0–100 where higher = better for the patient (Excel-style), or null if unknown.

This module is a first pass: it uses answered items when possible; full Excel formulas
can replace the stubs later without changing API shape.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

# Order matches Excel radar table (10 rows)
RADAR_AXES: List[Dict[str, Any]] = [
    {"key": "nutrition", "label_he": "תזונה", "target": 80},
    {"key": "physical_activity", "label_he": "פעילות גופנית", "target": 80},
    {"key": "sleep", "label_he": "שינה", "target": 80},
    {"key": "stress", "label_he": "ניהול סטרס", "target": 80},
    {"key": "mental_health", "label_he": "בריאות נפשית", "target": 80},
    {"key": "social_support", "label_he": "תמיכה חברתית", "target": 80},
    {"key": "controlled_eating", "label_he": "אכילה מבוקרת", "target": 80},
    {"key": "smoke_free", "label_he": "ללא עישון", "target": 80},
    {"key": "alcohol_free", "label_he": "ללא אלכוהול", "target": 80},
    {"key": "motivation", "label_he": "מוטיבציה", "target": 80},
]


def _load_answers_map(rows: List[Any]) -> Dict[str, Dict[str, Any]]:
    """rows: list of dicts with question_id + value_json, or SQLAlchemy RowMapping."""
    out: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        if hasattr(r, "_mapping"):
            d = dict(r._mapping)
        elif isinstance(r, dict):
            d = r
        elif isinstance(r, (list, tuple)) and len(r) >= 4:
            d = {"question_id": r[2], "value_json": r[3]}
        else:
            continue
        qid = str(d.get("question_id", ""))
        raw = d.get("value_json")
        if not qid or raw is None:
            continue
        try:
            out[qid] = json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            continue
    return out


def _num(ans: Dict[str, Any]) -> Optional[float]:
    v = ans.get("value")
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    return None


def _single_idx(ans: Dict[str, Any]) -> Optional[int]:
    if "index" in ans and isinstance(ans["index"], (int, float)):
        return int(ans["index"])
    return None


def _stub_nutrition(a: Dict[str, Dict[str, Any]]) -> Optional[float]:
    keys = [str(i) for i in range(24, 44)]
    if not any(k in a for k in keys):
        return None
    # Crude: more veg/fruit/fish/olive yes, fewer sugar/red meat — until I-MEDAS scoring is ported
    pts = 50.0
    if "24" in a and _single_idx(a["24"]) == 0:
        pts += 10
    for k in ("25", "26", "28"):
        n = _num(a.get(k, {}))
        if n is not None:
            pts += min(8, n * 1.5)
    if "33" in a:
        n = _num(a["33"])
        if n is not None:
            pts -= min(15, n * 2)
    if "35" in a:
        n = _num(a["35"])
        if n is not None:
            pts -= min(12, n * 3)
    return max(0.0, min(100.0, pts))


def _stub_activity(a: Dict[str, Dict[str, Any]]) -> Optional[float]:
    if not any(k in a for k in ("49", "50", "51", "52", "53", "54")):
        return None
    days = _num(a.get("49", {})) or 0
    strength = _num(a.get("51", {})) or 0
    sit = _num(a.get("52", {})) or 8
    flex_days = _num(a.get("54", {})) or 0
    score = days * 10 + strength * 5 + flex_days * 4 - max(0, sit - 8) * 5
    return max(0.0, min(100.0, 35 + score))


def _stub_sleep(a: Dict[str, Dict[str, Any]]) -> Optional[float]:
    if not any(k in a for k in ("57", "58", "59", "60", "62", "63")):
        return None
    hrs = _num(a.get("60", {}))
    base = 55.0
    if hrs is not None:
        if 7 <= hrs <= 9:
            base += 30
        elif 6 <= hrs < 7 or 9 < hrs <= 10:
            base += 15
        else:
            base += 5
    if "62" in a:
        idx = _single_idx(a["62"])
        if idx is not None:
            base -= idx * 8
    if "63" in a:
        idx = _single_idx(a["63"])
        if idx is not None:
            base -= idx * 5
    return max(0.0, min(100.0, base))


def _stub_pss(a: Dict[str, Dict[str, Any]]) -> Optional[float]:
    ids = ("77", "78", "79", "80", "81")
    if not any(i in a for i in ids):
        return None
    s = 0
    c = 0
    for i in ids:
        idx = _single_idx(a.get(i, {}))
        if idx is None:
            continue
        # 78, 80 are positively worded in PSS — stub: treat all as stress higher = worse for simplicity
        if i in ("78", "80"):
            s += 4 - idx
        else:
            s += idx
        c += 1
    if not c:
        return None
    avg = s / c
    return max(0.0, min(100.0, 100 - (avg / 4) * 100))


def _stub_phq(a: Dict[str, Dict[str, Any]]) -> Optional[float]:
    if not any(i in a for i in ("83", "84", "85", "86")):
        return None
    tot = 0
    c = 0
    for i in ("83", "84", "85", "86"):
        idx = _single_idx(a.get(i, {}))
        if idx is None:
            continue
        tot += idx
        c += 1
    if not c:
        return None
    avg = tot / c
    return max(0.0, min(100.0, 100 - (avg / 3) * 100))


def _stub_social(a: Dict[str, Dict[str, Any]]) -> Optional[float]:
    if not any(i in a for i in ("87", "88", "89")):
        return None
    pts = []
    for i in ("87", "88", "89"):
        idx = _single_idx(a.get(i, {}))
        if idx is None:
            continue
        if i == "87":
            pts.append((3 - idx) / 3 * 100)
        else:
            pts.append(idx / 4 * 100)
    if not pts:
        return None
    return max(0.0, min(100.0, sum(pts) / len(pts)))


def _stub_tfeq_control(a: Dict[str, Dict[str, Any]]) -> Optional[float]:
    if not any(i in a for i in ("44", "45", "46", "47", "48")):
        return None
    # Higher uncontrolled / emotional eating = lower score (very rough)
    u = 0
    c = 0
    for i in ("44", "45", "47"):
        idx = _single_idx(a.get(i, {}))
        if idx is None:
            continue
        u += idx - 1
        c += 1
    for i in ("46", "48"):
        idx = _single_idx(a.get(i, {}))
        if idx is None:
            continue
        u += 4 - idx
        c += 1
    if not c:
        return None
    return max(0.0, min(100.0, 100 - (u / (c * 3)) * 100))


def _stub_smoking(a: Dict[str, Dict[str, Any]]) -> Optional[float]:
    if "65" not in a:
        return None
    idx = _single_idx(a["65"])
    if idx is None:
        return None
    if idx == 0:
        return 100.0
    if idx == 1:
        return 75.0
    return 25.0


def _stub_alcohol(a: Dict[str, Dict[str, Any]]) -> Optional[float]:
    if "70" not in a:
        return None
    idx = _single_idx(a["70"])
    if idx is None:
        return None
    return max(0.0, min(100.0, 100 - idx * 18))


def _stub_motivation(a: Dict[str, Dict[str, Any]]) -> Optional[float]:
    if "101" not in a:
        return None
    idx = _single_idx(a["101"])
    if idx is None:
        return None
    return max(0.0, min(100.0, idx / 4 * 100))


def compute_radar_from_answers(answers_by_qid: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    a = answers_by_qid
    calculators = {
        "nutrition": lambda: _stub_nutrition(a),
        "physical_activity": lambda: _stub_activity(a),
        "sleep": lambda: _stub_sleep(a),
        "stress": lambda: _stub_pss(a),
        "mental_health": lambda: _stub_phq(a),
        "social_support": lambda: _stub_social(a),
        "controlled_eating": lambda: _stub_tfeq_control(a),
        "smoke_free": lambda: _stub_smoking(a),
        "alcohol_free": lambda: _stub_alcohol(a),
        "motivation": lambda: _stub_motivation(a),
    }
    out: List[Dict[str, Any]] = []
    for axis in RADAR_AXES:
        key = axis["key"]
        fn = calculators.get(key)
        score = fn() if fn else None
        out.append(
            {
                "key": key,
                "label_he": axis["label_he"],
                "target": axis["target"],
                "score": score,
            }
        )
    return out


def radar_for_patient_rows(answer_rows: List[Any]) -> List[Dict[str, Any]]:
    m = _load_answers_map(answer_rows)
    return compute_radar_from_answers(m)
