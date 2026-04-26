"""
Machine catalog for שאלון הערכת התנהגויות בריאות (items 1–101).
Hebrew labels follow the official wording; types drive UI / parsing.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class QItem:
    id: str
    part: str
    domain: str
    hebrew: str
    kind: str
    options: Optional[List[str]] = None
    notes: str = ""


def _opts(*items: str) -> List[str]:
    return list(items)


def _build_questions() -> Dict[str, QItem]:
    m: Dict[str, QItem] = {}

    def add(
        qid: str,
        part: str,
        domain: str,
        he: str,
        kind: str,
        options: Optional[List[str]] = None,
        notes: str = "",
    ) -> None:
        m[qid] = QItem(
            id=qid,
            part=part,
            domain=domain,
            hebrew=he,
            kind=kind,
            options=options,
            notes=notes,
        )

    # חלק א׳
    add("1", "א", "פרטים כלליים", "שם מלא", "text")
    add("2", "א", "פרטים כלליים", "תאריך לידה", "text")
    add(
        "3",
        "א",
        "פרטים כלליים",
        "מגדר",
        "single_choice",
        _opts("זכר", "נקבה", "אחר"),
    )
    add(
        "4",
        "א",
        "פרטים כלליים",
        "מצב משפחתי",
        "single_choice",
        _opts("רווק/ה", "נשוי/אה", "גרוש/ה", "אלמן/ה", "חי/ה בזוגיות"),
    )
    add(
        "5",
        "א",
        "פרטים כלליים",
        "רמת השכלה",
        "single_choice",
        _opts("יסודית", "תיכונית", "על-תיכונית", "אקדמית"),
    )
    add(
        "6",
        "א",
        "פרטים כלליים",
        "עיסוק נוכחי",
        "single_choice",
        _opts("שכיר/ה", "עצמאי/ת", "לא עובד/ת", "פנסיונר/ית", "סטודנט/ית"),
    )
    add(
        "7",
        "א",
        "בריאות אישית",
        "האם אובחנת עם מחלה כרונית? (ניתן לסמן יותר מאחד)",
        "multi_choice",
        _opts(
            "לא",
            "סוכרת/טרום-סוכרת",
            "יתר לחץ דם",
            "מחלת לב כלילית",
            "אי ספיקת לב",
            "שבץ מוח",
            "מחלת כליות",
            "יתר שומנים בדם",
            "אסתמה/COPD",
            "מחלה אוטואימונית",
            "סרטן",
            "אחר",
        ),
    )
    add("7_other", "א", "בריאות אישית", "אם סימנת 'אחר' במחלות כרוניות — פרט/י", "text")
    add(
        "8",
        "א",
        "בריאות אישית",
        "האם אתה נוטל תרופות באופן קבוע?",
        "yes_no_detail",
        _opts("לא", "כן"),
    )
    add(
        "9",
        "א",
        "בריאות אישית",
        "האם אובחנת עם בעיה נפשית/רגשית?",
        "yes_no_detail",
        _opts("לא", "כן"),
    )
    add(
        "10",
        "א",
        "בריאות אישית",
        "האם ביצעת ניתוחים קודמים הקשורים למחלות כרוניות או למשקל?",
        "yes_no_detail",
        _opts("לא", "כן"),
    )
    add(
        "11",
        "א",
        "בריאות אישית",
        "האם אתה סובל מאלרגיות מזון ידועות?",
        "yes_no_detail",
        _opts("לא", "כן"),
    )
    fam = [
        (
            "12",
            "האם בני משפחה מדרגה ראשונה אובחנו עם מחלת לב כלילית לפני גיל 55 (גברים) או 65 (נשים)?",
        ),
        ("13", "האם בני משפחה מדרגה ראשונה אובחנו עם סוכרת מסוג 2?"),
        ("14", "האם בני משפחה מדרגה ראשונה אובחנו עם יתר לחץ דם?"),
        ("15", "האם בני משפחה מדרגה ראשונה אובחנו עם השמנת יתר?"),
        ("16", "האם בני משפחה מדרגה ראשונה אובחנו עם מחלת סרטן?"),
        ("17", "האם בני משפחה מדרגה ראשונה סבלו מבעיות נפשיות?"),
    ]
    for qid, he in fam:
        add(
            qid,
            "א",
            "היסטוריה משפחתית",
            he,
            "single_choice",
            _opts("לא ידוע", "לא", "כן"),
        )
    add("16_detail", "א", "היסטוריה משפחתית", "אם כן — פרט/י סוג סרטן", "text")
    add("17_detail", "א", "היסטוריה משפחתית", "אם כן — פרט/י", "text")

    # חלק ב׳ – תזונה כללית
    add("18", "ב", "תזונה", "כמה ארוחות אתה אוכל ביום בממוצע?", "number")
    add(
        "19",
        "ב",
        "תזונה",
        "האם אתה נוהג לדלג על ארוחת בוקר?",
        "single_choice",
        _opts("לעולם לא", "לפעמים (1–2 פעמים/שבוע)", "לעיתים קרובות (3+ פעמים/שבוע)", "תמיד"),
    )
    add("20", "ב", "תזונה", "כמה ארוחות בשבוע מחוץ לבית?", "number")
    add("21", "ב", "תזונה", "כמה כוסות מים (250 מ״ל) ביום?", "number")
    add(
        "22",
        "ב",
        "תזונה",
        "האם אתה נוהג לאכול בשעות הלילה (לאחר 21:00)?",
        "single_choice",
        _opts("לעולם לא", "לפעמים", "לעיתים קרובות", "כמעט תמיד"),
    )
    add("23", "ב", "תזונה", "כמה כוסות משקאות עם קפאין ביום?", "number")

    # I-MEDAS 24–43
    add("24", "ב", "תזונה ים-תיכונית", "האם שמן זית הוא מקור השמן העיקרי?", "single_choice", _opts("כן", "לא"))
    for qid, he in [
        ("25", "כמה מנות ירקות ביום? (מנה = 200 גרם)"),
        ("26", "כמה מנות פרי ביום? (לא כולל מיצים; מנה = 125 גרם)"),
        ("27", "כמה מנות קטניות בשבוע? (מנה = 150 גרם)"),
        ("28", "כמה מנות דגים בשבוע? (מנה = 100–150 גרם)"),
        ("29", "כמה מנות אגוזים ושקדים בשבוע? (מנה = חופן, 30 גרם)"),
        ("30", "כמה מנות דגנים מלאים ביום?"),
        ("31", "כמה מנות מוצרי חלב לא ממותקים ביום?"),
        ("32", "כמה מנות בשר עוף/הודו בשבוע?"),
        ("33", "כמה מנות בשר אדום או מעובד בשבוע?"),
        ("34", "כמה מנות חמאה, מרגרינה או שמנת ביום?"),
        ("35", "כמה כוסות משקאות ממותקים ביום?"),
        ("36", "כמה כוסות משקאות אלכוהוליים בשבוע?"),
        ("37", "כמה פעמים בשבוע מאפים מתוקים?"),
        ("38", "כמה מנות חטיפים מלוחים בשבוע?"),
        ("39", "כמה פעמים בשבוע ממתקים?"),
        ("40", "כמה מנות מאפים מלוחים בשבוע?"),
        ("41", "כמה פעמים בשבוע ארוחות מוכנות / אינסטנט?"),
        ("42", "כמה פעמים בשבוע מטוגן עמוק או ממרחים עשירים בשומן?"),
        ("43", "כמה מנות חומוס/טחינה בשבוע? (מנה = כף אחת)"),
    ]:
        add(qid, "ב", "תזונה ים-תיכונית", he, "number")

    tfeq4 = _opts("בהחלט לא", "ברוב המקרים לא", "ברוב המקרים כן", "בהחלט כן")
    tfeq_sat = _opts("כמעט אף פעם", "לפעמים", "לעיתים קרובות", "כמעט תמיד")
    for qid, he, opts in [
        ("44", "כשאני מתחיל לאכול, קשה לי לעצור לפני שאגמר את כל האוכל שבצלחת.", tfeq4),
        ("45", "אני אוכל בגלל מצב רוח (לחץ, שעמום, עצב) ולא בגלל רעב.", tfeq4),
        ("46", "אני מגביל את עצמי בכמויות אוכל גם כשאני רעב.", tfeq4),
        ("47", "ראיית אוכל טעים גורמת לי לאכול גם ללא רעב.", tfeq4),
        ("48", "בסיומה של כל ארוחה אני מרגיש שבע לחלוטין.", tfeq_sat),
    ]:
        add(qid, "ב", "דפוסי אכילה (TFEQ)", he, "single_choice", opts)

    # חלק ג׳
    add("49", "ג", "פעילות גופנית", "כמה ימים בשבוע פעילות אירובית ≥30 דק׳?", "number")
    add("50", "ג", "פעילות גופנית", "כמה דקות בממוצע נמשכת כל פעילות?", "number")
    add("51", "ג", "פעילות גופנית", "כמה פעמים בשבוע אימוני כוח?", "number")
    add("52", "ג", "פעילות גופנית", "כמה שעות ביום אתה יושב בממוצע?", "number")
    add(
        "53",
        "ג",
        "פעילות גופנית",
        "האם אתה עושה הפסקות תנועה בישיבה ממושכת (>45 דק׳)?",
        "single_choice",
        _opts("כן, כל שעה בערך", "לפעמים", "לעיתים נדירות", "לא"),
    )
    add("54", "ג", "פעילות גופנית", "כמה ימים בשבוע תרגילי גמישות/שיווי משקל?", "number")
    add(
        "55",
        "ג",
        "פעילות גופנית",
        "כיצד היית מדרג את יכולתך הגופנית הכללית?",
        "single_choice",
        _opts("נמוכה מאד", "נמוכה", "בינונית", "גבוהה", "גבוהה מאד"),
    )
    add(
        "56",
        "ג",
        "פעילות גופנית",
        "מכשולים לפעילות גופנית (עד שניים)",
        "multi_choice",
        _opts("חוסר זמן", "עייפות", "כאב/מגבלה גופנית", "חוסר מוטיבציה", "חוסר ידע", "אחר"),
    )

    # חלק ד׳ PSQI
    add("57", "ד", "שינה", "באיזו שעה אתה בדרך כלל הולך לישון בלילה?", "text")
    add("58", "ד", "שינה", "כמה זמן לוקח להירדם לאחר שכיבה למיטה? (דקות)", "number")
    add("59", "ד", "שינה", "באיזו שעה אתה בדרך כלל קם בבוקר?", "text")
    add("60", "ד", "שינה", "כמה שעות שינה בפועל בלילה?", "number")
    add(
        "61",
        "ד",
        "שינה",
        "בעיות הרדמות בחודש האחרון — דרג 0–3 לכל סעיף (א–ו)",
        "composite_sleep61",
    )
    add(
        "62",
        "ד",
        "שינה",
        "באיזו מידה הרגשת עייפות במהלך היום בחודש האחרון?",
        "single_choice",
        _opts("לא כלל", "לעיתים נדירות", "פעם או פעמיים בשבוע", "3+ בשבוע"),
    )
    add(
        "63",
        "ד",
        "שינה",
        "האם אתה משתמש בסמארטפון/טאבלט/מחשב בחדר השינה?",
        "single_choice",
        _opts("לא", "לפעמים", "לעיתים קרובות", "כמעט תמיד"),
    )
    add(
        "64",
        "ד",
        "שינה",
        "האם אובחנת עם הפרעת שינה?",
        "yes_no_detail",
        _opts("לא", "כן"),
    )

    # חלק ה׳
    add(
        "65",
        "ה",
        "עישון",
        "מה מצב העישון שלך?",
        "single_choice",
        _opts("לא מעשן ולא מעשן בעבר", "הפסקתי לעשן", "מעשן כעת"),
    )
    add("65_quit_months", "ה", "עישון", "אם הפסקת — לפני כמה חודשים?", "number")
    add(
        "66",
        "ה",
        "עישון",
        "אם מעשן: כמה סיגריות ביום?",
        "single_choice",
        _opts("10 ומטה", "11–20", "21–30", "31+"),
    )
    add(
        "67",
        "ה",
        "עישון",
        "אם מעשן: כמה זמן לאחר ההתעוררות הסיגריה הראשונה?",
        "single_choice",
        _opts("תוך 5 דקות", "6–30 דקות", "31–60 דקות", "אחרי 60 דקות"),
    )
    add(
        "68",
        "ה",
        "עישון",
        "האם אתה מעשן סיגריות אלקטרוניות?",
        "single_choice",
        _opts("לא", "לפעמים", "באופן קבוע"),
    )
    add(
        "69",
        "ה",
        "עישון",
        "האם אתה חשוף לעשן סיגריות מאחרים?",
        "single_choice",
        _opts("לא", "לעיתים", "יומיומי"),
    )

    add(
        "70",
        "ה",
        "אלכוהול",
        "כמה פעמים בחודש אתה שותה אלכוהול?",
        "single_choice",
        _opts("לא שותה כלל", "פעם בחודש או פחות", "2–4 פעמים בחודש", "2–3 פעמים בשבוע", "4+ פעמים בשבוע"),
    )
    add(
        "71",
        "ה",
        "אלכוהול",
        "בימים שבהם שתית — כמה משקאות בממוצע?",
        "single_choice",
        _opts("1–2", "3–4", "5–6", "7–9", "10+"),
    )
    add(
        "72",
        "ה",
        "אלכוהול",
        "כמה פעמים בחצי השנה האחרונה שתית 6 משקאות או יותר במעמד אחד?",
        "single_choice",
        _opts("לא קרה", "פחות מאחת לחודש", "פעם בחודש", "פעם בשבוע", "כמעט כל יום"),
    )

    add(
        "73",
        "ה",
        "התמכרויות",
        "כמה פעמים בחייך השתמשת בסמים?",
        "yes_no_detail",
        _opts("לא מעולם", "כן"),
    )
    add(
        "74",
        "ה",
        "התמכרויות",
        "אם השתמשת — כמה פעמים בשלושת החודשים האחרונים?",
        "single_choice",
        _opts("לא בכלל", "1–2 פעמים", "חודשי", "שבועי", "יומי/כמעט יומי"),
    )
    add(
        "75",
        "ה",
        "התמכרויות",
        "האם אי פעם חשת דחף חזק לשימוש בסם?",
        "single_choice",
        _opts("לא", "כן"),
    )
    add(
        "76",
        "ה",
        "התמכרויות",
        "כמה שעות ביום מול מסך (לא קשור לעבודה)?",
        "single_choice",
        _opts("פחות מ-2 שעות", "2–4 שעות", "4–6 שעות", "6+ שעות"),
    )

    # PSS subset 77–81 (full PSS-10 in paper; we keep 5 items as in user list)
    pss = _opts(
        "לעולם לא (0)",
        "כמעט אף פעם (1)",
        "לפעמים (2)",
        "לעיתים קרובות (3)",
        "לעיתים מאד קרובות (4)",
    )
    for qid, he in [
        ("77", "בחודש האחרון, כמה פעמים הרגשת שדברים חמקו משליטתך?"),
        ("78", "בחודש האחרון, כמה פעמים הרגשת בטוח ביכולתך להתמודד עם בעיות אישיות?"),
        ("79", "בחודש האחרון, כמה פעמים הרגשת לחץ רב?"),
        ("80", "בחודש האחרון, כמה פעמים הרגשת שאתה שולט בעצבנויות בחיים?"),
        ("81", "בחודש האחרון, כמה פעמים הרגשת שקשיים הצטברו כל כך שלא יכולת להתגבר עליהם?"),
    ]:
        add(qid, "ו", "סטרס (PSS)", he, "single_choice", pss)
    add(
        "82",
        "ו",
        "סטרס",
        "האם אתה מפעיל שיטות לניהול סטרס? (ניתן לסמן יותר מאחד)",
        "multi_choice",
        _opts("לא", "מדיטציה/מיינדפולנס", "פעילות גופנית", "שיחה עם חבר/בן משפחה", "פסיכולוג/עו״ס", "תחביבים", "אחר"),
    )

    phq = _opts("לא כלל (0)", "מספר ימים (1)", "יותר ממחצית הימים (2)", "כמעט כל יום (3)")
    for qid, he in [
        ("83", "בשבועיים האחרונים: עצוב/חסר תקווה?"),
        ("84", "בשבועיים האחרונים: חרדה, עצבנות, מתח?"),
        ("85", "בשבועיים האחרונים: קושי להתרכז?"),
        ("86", "בשבועיים האחרונים: לא הצלחת להירגע ולנוח?"),
    ]:
        add(qid, "ו", "בריאות נפשית (PHQ-4)", he, "single_choice", phq)

    add(
        "87",
        "ז",
        "תמיכה חברתית",
        "האם יש לך אדם קרוב שתוכל לפנות אליו בעת צרה?",
        "single_choice",
        _opts("כן, תמיד", "בדרך כלל", "לפעמים", "לא"),
    )
    add(
        "88",
        "ז",
        "תמיכה חברתית",
        "עד כמה אתה מרגיש מוקף בתמיכה ממשפחה/חברים?",
        "single_choice",
        _opts("בכלל לא", "מעט", "במידה בינונית", "במידה רבה", "תמיד"),
    )
    add(
        "89",
        "ז",
        "תמיכה חברתית",
        "האם אתה שבע רצון מאיכות הקשרים החברתיים?",
        "single_choice",
        _opts("ממש לא", "לא", "בינוני", "כן", "בהחלט כן"),
    )
    add(
        "90",
        "ז",
        "תמיכה חברתית",
        "האם מישהו גרם לך לחץ מוגזם בנושא אכילה ומשקל?",
        "single_choice",
        _opts("לא", "לעיתים", "לעיתים קרובות"),
    )

    for qid, he in [
        ("91", "בשנה האחרונה: האם מישהו בביתך פגע בך פיזית?"),
        ("92", "בשנה האחרונה: שותף או בן משפחה גרם לך לחוש פחד לשלומך?"),
        ("93", "בשנה האחרונה: פגיעה מינית ללא הסכמה?"),
        ("94", "בשנה האחרונה: שליטה בכסף, ניידות או קשרים חברתיים?"),
    ]:
        add(qid, "ז", "אלימות במשפחה", he, "single_choice", _opts("לא", "כן"))

    add(
        "95",
        "ח",
        "ניהול בריאות",
        "בדיקות מניעתיות לפי הגיל?",
        "single_choice",
        _opts("כן, לפי המלצות", "לפעמים", "לא"),
    )
    add(
        "96",
        "ח",
        "ניהול בריאות",
        "האם אתה מתחסן לפי לוח החיסונים?",
        "single_choice",
        _opts("כן", "לא", "חלקית"),
    )
    add(
        "97",
        "ח",
        "ניהול בריאות",
        "חגורת בטיחות וקסדה?",
        "single_choice",
        _opts("תמיד", "בדרך כלל", "לפעמים", "לא"),
    )
    add(
        "98",
        "ח",
        "ניהול בריאות",
        "האם אתה מרוצה מעבודתך / לימודיך / תפקידך?",
        "single_choice",
        _opts("ממש לא", "לא", "בינוני", "כן", "בהחלט"),
    )
    add(
        "99",
        "ח",
        "ניהול בריאות",
        "איזון בין עבודה/לימודים לחיים אישיים?",
        "single_choice",
        _opts("ממש לא", "לא", "בינוני", "כן", "בהחלט"),
    )
    add(
        "100",
        "ח",
        "ניהול בריאות",
        "מה המוטיבציה שלך לשינוי? (ניתן לסמן יותר מאחד)",
        "multi_choice",
        _opts(
            "ירידה במשקל",
            "שיפור בריאות כרונית",
            "הגברת אנרגיה",
            "לחץ רפואי",
            "מראה",
            "לטובת המשפחה",
            "אחר",
        ),
    )
    add(
        "101",
        "ח",
        "ניהול בריאות",
        "באיזה שלב אתה לקראת שינוי אורח חיים?",
        "single_choice",
        _opts(
            "לא חושב על שינוי",
            "שוקל שינוי",
            "מתכנן להתחיל",
            "כבר ניסיתי – לא הצלחתי",
            "בתהליך שינוי פעיל",
        ),
    )

    return m


QUESTIONS: Dict[str, QItem] = _build_questions()

# Primary flow order (composite / follow-ups handled separately in UI later)
PRIMARY_ORDER: List[str] = [str(i) for i in range(1, 102)]

# First-login chat: height/weight stay separate; then these official items (warm intake).
INITIAL_ONBOARDING_QIDS: List[str] = ["2", "3", "4", "5", "6"]

# English paraphrase of catalog intent for LLM prompts (Hebrew labels are never sent in English chat).
TOPIC_INTENT_EN: Dict[str, str] = {
    "2": "date of birth (day, month, and year)",
    "3": "gender",
    "4": "marital or relationship status",
    "5": "education level",
    "6": "current occupation or main role",
}

# Gloss for Hebrew catalog options when prompting in English (patient may still answer freely).
OPTION_MEANINGS_EN: Dict[str, str] = {
    "3": "male / female / other",
    "4": "single / married / divorced / widowed / in a relationship",
    "5": "elementary / high school / post-secondary / academic",
    "6": "employee / self-employed / not working / retired / student",
}

# Safe scripted chat lines when the LLM is unavailable — never Hebrew in EN, never English-only in HE.
SCRIPT_QUESTION_EN: Dict[str, str] = {
    "1": "What's your full name?",
    "2": "When were you born?",
    "3": "How would you describe your gender?",
    "4": "What's your relationship status these days?",
    "5": "What's the highest level of education you've completed?",
    "6": "What best describes your current work situation?",
    # Part A — personal health
    "7": "Have you been diagnosed with any chronic conditions?",
    "7_other": "You mentioned 'other' — could you tell me which condition?",
    "8": "Are you currently taking any medications on a regular basis?",
    "9": "Have you ever been diagnosed with a mental or emotional health condition?",
    "10": "Have you had any past surgeries related to chronic illness or weight?",
    "11": "Do you have any known food allergies?",
    # Part A — family history
    "12": "In your immediate family, has anyone been diagnosed with coronary heart disease at a relatively young age?",
    "13": "Has anyone in your immediate family been diagnosed with type 2 diabetes?",
    "14": "Has anyone in your immediate family been diagnosed with high blood pressure?",
    "15": "Has anyone in your immediate family been diagnosed with obesity?",
    "16": "Has anyone in your immediate family been diagnosed with cancer?",
    "16_detail": "If so, do you remember which type of cancer?",
    "17": "Has anyone in your immediate family struggled with mental health issues?",
    "17_detail": "If so, would you like to share a bit more?",
    # Part B — general nutrition
    "18": "On an average day, how many meals do you eat?",
    "19": "Do you tend to skip breakfast?",
    "20": "How many meals per week do you eat outside the home?",
    "21": "About how many cups of water do you drink in a day?",
    "22": "Do you tend to eat late at night?",
    "23": "How many caffeinated drinks do you have in a day?",
    # Part B — Mediterranean (I-MEDAS)
    "24": "Is olive oil your main cooking oil?",
    "25": "How many servings of vegetables do you eat in a typical day?",
    "26": "How many servings of fruit do you have in a typical day?",
    "27": "How many servings of legumes do you eat in a week?",
    "28": "How many servings of fish do you eat in a week?",
    "29": "How often do you have nuts or almonds in a week?",
    "30": "How many servings of whole grains do you eat in a day?",
    "31": "How many servings of unsweetened dairy do you have in a day?",
    "32": "How many servings of poultry do you eat in a week?",
    "33": "How many servings of red or processed meat do you eat in a week?",
    "34": "How often do you have butter, margarine, or cream?",
    "35": "How many sugary drinks do you have in a day?",
    "36": "About how many alcoholic drinks do you have in a week?",
    "37": "How often do you eat sweet pastries each week?",
    "38": "How often do you have salty snacks in a week?",
    "39": "How often do you eat candy or sweets in a week?",
    "40": "How often do you have savory pastries in a week?",
    "41": "How often do you eat ready-made or instant meals?",
    "42": "How often do you eat deep-fried food or fat-rich spreads?",
    "43": "How often do you have hummus or tahini in a week?",
    # Part B — eating patterns (TFEQ)
    "44": "Once you start eating, is it hard to stop before finishing everything on your plate?",
    "45": "Do you sometimes eat because of mood — stress, boredom, sadness — rather than hunger?",
    "46": "Do you ever restrict how much you eat even when you're hungry?",
    "47": "Does seeing tasty food make you want to eat even when you're not hungry?",
    "48": "At the end of a meal, do you usually feel completely full?",
    # Part C — physical activity
    "49": "How many days a week do you do aerobic activity for at least half an hour?",
    "50": "On average, how long does each activity session last?",
    "51": "How often do you do strength training in a week?",
    "52": "On average, how many hours a day do you spend sitting?",
    "53": "When you've been sitting for a long stretch, do you take movement breaks?",
    "54": "How often do you do flexibility or balance exercises?",
    "55": "How would you rate your overall physical fitness?",
    "56": "What are the main things that get in the way of exercising?",
    # Part D — sleep (PSQI)
    "57": "What time do you usually go to bed?",
    "58": "Once in bed, how long does it usually take you to fall asleep?",
    "59": "What time do you usually wake up?",
    "60": "On a typical night, how many hours do you actually sleep?",
    "61": "Over the past month, how has falling or staying asleep been for you?",
    "62": "How tired have you felt during the day this past month?",
    "63": "Do you tend to use a phone, tablet, or computer in your bedroom?",
    "64": "Have you ever been diagnosed with a sleep disorder?",
    # Part E — smoking
    "65": "What's your smoking status these days?",
    "65_quit_months": "If you've quit smoking, how many months ago did you stop?",
    "66": "If you smoke, about how many cigarettes do you have a day?",
    "67": "If you smoke, how soon after waking up do you have your first cigarette?",
    "68": "Do you use e-cigarettes or vape?",
    "69": "Are you exposed to secondhand smoke from others?",
    # Part E — alcohol
    "70": "How often do you drink alcohol in a month?",
    "71": "On the days you do drink, about how many drinks do you have?",
    "72": "In the past six months, has there been a time you had 6 or more drinks on a single occasion?",
    # Part E — substances
    "73": "Have you ever used recreational drugs?",
    "74": "If you have used drugs, how often in the past three months?",
    "75": "Have you ever felt a strong urge to use a drug?",
    # Part E — screen time
    "76": "About how many hours a day do you spend on screens outside of work?",
    # Part F — stress (PSS)
    "77": "In the past month, how often have you felt that things were out of your control?",
    "78": "In the past month, how often have you felt confident handling personal problems?",
    "79": "In the past month, how often have you felt very stressed?",
    "80": "In the past month, how often have you felt on top of the day-to-day irritations in your life?",
    "81": "In the past month, how often have you felt that difficulties were piling up so much you couldn't overcome them?",
    "82": "Do you use any methods to manage stress?",
    # Part F — mental health (PHQ-4)
    "83": "Over the past two weeks, how often have you felt down or hopeless?",
    "84": "Over the past two weeks, how often have you felt anxious or on edge?",
    "85": "Over the past two weeks, how often have you had trouble concentrating?",
    "86": "Over the past two weeks, how often have you found it hard to relax or rest?",
    # Part G — social support
    "87": "Do you have a close person you can turn to in tough times?",
    "88": "How supported do you feel by family or friends?",
    "89": "Are you satisfied with the quality of your social relationships?",
    "90": "Has anyone put excessive pressure on you about eating or weight?",
    # Part G — domestic safety
    "91": "In the past year, has anyone at home physically hurt you?",
    "92": "In the past year, has a partner or family member made you feel afraid for your safety?",
    "93": "In the past year, have you experienced any sexual contact without your consent?",
    "94": "In the past year, has someone controlled your money, movements, or social ties?",
    # Part H — health management
    "95": "Are you keeping up with age-appropriate preventive screenings?",
    "96": "Are you up to date with your vaccinations?",
    "97": "Do you wear a seatbelt and a helmet when you need to?",
    "98": "Are you satisfied with your work, studies, or main role?",
    "99": "How is the balance between your work or studies and your personal life?",
    "100": "What's motivating you to make a change?",
    "101": "Where would you say you are on your lifestyle change journey?",
}
SCRIPT_QUESTION_HE: Dict[str, str] = {
    "1": "מה השם המלא שלך?",
    "2": "מתי נולדת?",
    "3": "איך נוח לך לתאר את המגדר?",
    "4": "מה המצב המשפחתי שלך כרגע?",
    "5": "מה רמת ההשכלה הגבוהה ביותר שהשלמת?",
    "6": "מה מתאר הכי טוב את המצב התעסוקתי שלך כרגע?",
    "7": "האם אובחנת עם מחלה כרונית כלשהי?",
    "56": "מה הדברים שהכי מקשים עליך לעשות פעילות גופנית?",
    "61": "איך הייתה ההירדמות והשינה שלך בחודש האחרון?",
    "82": "האם אתה משתמש בשיטות כלשהן לניהול סטרס?",
    "100": "מה מניע אותך לעשות שינוי?",
}

# Questions offered in the 21-day drip (exclude initials already collected in onboarding chat)
DAILY_POOL_QIDS: List[str] = [qid for qid in PRIMARY_ORDER if qid not in set(INITIAL_ONBOARDING_QIDS)]

# Sub-IDs not in PRIMARY_ORDER drip by default (filled when parent answered)
SUPPLEMENTAL_QIDS = frozenset({"7_other", "16_detail", "17_detail", "65_quit_months"})


def get_question(qid: str) -> Optional[QItem]:
    return QUESTIONS.get(qid)


def to_public_dict(q: QItem) -> Dict[str, Any]:
    return {
        "question_id": q.id,
        "part": q.part,
        "domain": q.domain,
        "hebrew": q.hebrew,
        "kind": q.kind,
        "options": q.options,
    }
