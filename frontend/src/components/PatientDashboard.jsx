import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  Grid,
  Button,
  Container,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  IconButton,
  Alert,
  Stack,
} from "@mui/material";
import {
  ChartPieSlice,
  ChartBar,
  PlusCircle,
  PencilSimple,
  DeviceMobile,
  Trash,
  Sneaker,
  MoonStars,
  ForkKnife,
  Cigarette,
  Brain,
  Microphone,
  PaperPlaneTilt,
  ChatCircle,
  IdentificationCard,
  HeartStraight,
  Translate,
} from "@phosphor-icons/react";
import DailyCheckinCalendar from "./DailyCheckinCalendar";
import { useHistory, useLocation } from "react-router-dom";
import { getUser, logout } from "../service/auth";
import api from "../service/api";
import DashboardShell from "./DashboardShell";
import ProfileFormContent from "./ProfileFormContent";
import { keyframes } from "@emotion/react";
import { alpha } from "@mui/material/styles";
import siteLogo from "../logo.svg";

const logoWiggle = keyframes`
  0%, 100% {
    transform: rotate(-3deg);
  }
  50% {
    transform: rotate(3deg);
  }
`;

// Dashboard theme + metric colors (from palette: steps=red, sleep=blue, nutrition=green, mood=orange)
const theme = {
  primary: "#1EB7FF",
  success: "#1BB934",
  text: "#1F2D3D",
  textMuted: "#868E96",
  bg: "#FFFFFF",
  cardShadow: "0 2px 8px rgba(31, 45, 61, 0.1), 0 1px 2px rgba(31, 45, 61, 0.06)",
  border: "1px solid #DEE2E6",
  logoGreen: "#16a34a",
  /** Recording / mic-on (same red as steps donut) */
  danger: "#ED1C24",
  metric: {
    steps: "#ED1C24",     // Airframe red
    sleep: "#444D7E",    // blue from palette
    nutrition: "#16a34a", // logo green
    mood: "#F1BB55",     // orange from palette
  },
  /** Snapshot grid cards — icons align with donuts where possible */
  snapshotIcon: {
    smoking: "#C2410C",
    stressSocial: "#6366F1",
  },
  /** Used by the right panel calendar — keep mint green to match the panel. */
  sidebarSelectedBg: "#f0fdf4",
  sidebarSelectedHoverBg: "#ecfdf5",
  /** Left rail selected item — neutral gray so the active page doesn't read
   *  as a green accent on the white sidebar. */
  leftNavSelectedBg: "#E2E6EA",
  leftNavSelectedHoverBg: "#D6DBE0",
};

/** Add-entry chat: distinct message fills (same palette as original Chip bubbles). */
const ADD_ENTRY_CHAT = {
  /** Tiled logo wallpaper (grey via CSS filter on overlay); opacity of the layer */
  panelTileOpacity: 0.12,
  /** Repeat grid period (px) — spacing between tile centers; larger than the logo for gaps */
  panelTileSizePx: 88,
  /** Drawn logo size inside each grid cell (px); smaller than panelTileSizePx */
  panelLogoSizePx: 30,
  /** User (right): primary sky-blue tint */
  userBubble: (primary) => alpha(primary, 0.15),
  userBorder: (primary) => `1px solid ${alpha(primary, 0.35)}`,
  /** Assistant (left + logo): soft indigo/lavender */
  assistantBubble: "#eef2ff",
  assistantBorder: "1px solid rgba(99, 102, 241, 0.22)",
  /** Live speech-transcript preview */
  liveBg: "#fff8e1",
  liveBorder: "1px solid rgba(234, 179, 8, 0.35)",
};

const ADD_ENTRY_TILE_PX = ADD_ENTRY_CHAT.panelTileSizePx;
const ADD_ENTRY_LOGO_IN_TILE_PX = ADD_ENTRY_CHAT.panelLogoSizePx;
const ADD_ENTRY_TILE_LOGO_OFFSET = (ADD_ENTRY_TILE_PX - ADD_ENTRY_LOGO_IN_TILE_PX) / 2;
const ADD_ENTRY_TILE_HALF = ADD_ENTRY_TILE_PX / 2;

const sidebarNavSelectedSx = {
  "&.Mui-selected": {
    bgcolor: theme.leftNavSelectedBg,
    color: theme.text,
    "&:hover": {
      bgcolor: theme.leftNavSelectedHoverBg,
    },
    "&.Mui-focusVisible": {
      bgcolor: theme.leftNavSelectedHoverBg,
    },
    "& .MuiListItemIcon-root": {
      color: theme.text,
    },
  },
};

/**
 * Topics in the Add daily metrics rail.
 *
 * These mirror the 8 questionnaire-part donuts on the dashboard (label, icon
 * and color come from `buildQuestionnairePartDonuts` so the two views feel
 * identical). `analyzeTopic` is the backend `/analyze/{topic}` slug used when
 * the patient submits free-text — `null` means the topic does not have a
 * conversational analyzer (Profile is filled via the onboarding flow).
 */
const ADD_ENTRY_TOPICS = [
  { id: "profile", labelKey: "topic_profile", Icon: IdentificationCard, color: "#64748b", analyzeTopic: null },
  { id: "nutrition", labelKey: "topic_nutrition", Icon: ForkKnife, color: theme.metric.nutrition, analyzeTopic: "nutrition" },
  { id: "activity", labelKey: "topic_activity", Icon: Sneaker, color: theme.metric.steps, analyzeTopic: "activity" },
  { id: "sleep", labelKey: "topic_sleep", Icon: MoonStars, color: theme.metric.sleep, analyzeTopic: "sleep" },
  { id: "substances", labelKey: "topic_substances", Icon: Cigarette, color: theme.snapshotIcon.smoking, analyzeTopic: "tobacco-toxics" },
  { id: "mind", labelKey: "topic_mind", Icon: Brain, color: theme.metric.mood, analyzeTopic: "mental-health" },
  { id: "relationships", labelKey: "topic_relationships", Icon: HeartStraight, color: "#0d9488", analyzeTopic: "family-friends" },
  { id: "motivation", labelKey: "topic_motivation", Icon: ChartBar, color: theme.logoGreen, analyzeTopic: "insight" },
];

/** Web Speech API language tag per UI language. */
const SPEECH_RECOGNITION_LANGS = { en: "en-US", he: "he-IL" };

/**
 * UI strings keyed by language. Topic labels and headings are duplicated here
 * so the dashboard, the right-side panel, the calendar and the sidebar all
 * speak the same language. Functions accept the runtime arg (e.g. topic name).
 */
const I18N = {
  en: {
    dashboard_nav: "Dashboard",
    add_nav: "Add daily metrics",
    statistics_nav: "Statistics",
    onboarding_nav: "Onboarding",
    device_nav: "Device",
    device_secondary: "Demo – not active. In production, sleep & steps sync from your wearable.",
    my_profile: "My profile",
    logout: "Logout",
    open_sidebar: "Open sidebar",
    close_sidebar: "Close sidebar",
    today_heading: "Today · 8 questionnaire parts (0–100)",
    grade_heading: "Current grade — 8 questionnaire parts (0–100)",
    daily_questions: "Daily questions",
    progress_label: "Progress",
    no_new_questions: "No new questions right now — we'll bring a few more in the next days.",
    type_your_answer: "Type your answer",
    sending: "Sending…",
    send: "Send",
    selected_label: "Selected",
    today_button: "Today",
    language_label: "Language",
    chat_empty_default: (topic) => `Speak or type freely. We will extract structured details for ${topic}.`,
    chat_empty_questionnaire: "Loading today's question...",
    chat_input_questionnaire: "Type your answer...",
    chat_input_default: (topic) => `Share your ${topic} details...`,
    listening_label: "Listening",
    profile_via_onboarding: "Profile is filled via the onboarding flow — open Onboarding from the sidebar.",
    questionnaire_done: "Thanks — that's all the questions for today. We'll bring a few more in the next days.",
    daily_batch_complete: "You have finished today’s daily questions. That’s all for now — we will offer a fresh batch another day.",
    daily_skipped_today:
      "No problem — we will not ask again today. Tomorrow you will see other questions; anything you left unanswered can come back after a few days.",
    not_today_button: "Not today",
    not_today_next_question: "Skipping — here's the next question.",
    select_topic: "Select a topic from the right sidebar to start your conversational entry.",
    viewing_topic_history: (topic) => `Your previous answers about ${topic}`,
    no_session_answers: (topic) => `No previous answers about ${topic} yet.`,
    back_to_current_question: "Back to current question",
    back_label: "Back",
    answer_text_unavailable: "Original wording wasn't saved",
    saved_as_label: "Saved as",
    structured_extracted: "Structured data extracted. Review the summary and confirm to save.",
    aria_logo_questionnaire: "Answer today's question on the Add daily metrics page",
    aria_mic_supported: "Toggle microphone",
    aria_mic_unsupported: "Speech recognition is not supported in this browser",
    failed_save_answer: "Failed to save answer",
    failed_save_entry: "Failed to save entry",
    failed_analyze: "Failed to analyze message",
    sign_in_prompt: "Please sign in to view your dashboard.",
    topic_profile: "Profile",
    topic_nutrition: "Nutrition",
    topic_activity: "Activity",
    topic_sleep: "Sleep",
    topic_substances: "Substances",
    topic_mind: "Stress & mood",
    topic_relationships: "Relationships",
    topic_motivation: "Motivation",
    weekdays_short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months_short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
  he: {
    dashboard_nav: "לוח בקרה",
    add_nav: "הוספת מדדים יומיים",
    statistics_nav: "סטטיסטיקה",
    onboarding_nav: "תהליך קליטה",
    device_nav: "מכשיר",
    device_secondary: "הדגמה – לא פעיל. בגרסה החיה נתוני שינה וצעדים מסתנכרנים מהמכשיר הלביש שלך.",
    my_profile: "הפרופיל שלי",
    logout: "יציאה",
    open_sidebar: "פתח סרגל צד",
    close_sidebar: "סגור סרגל צד",
    today_heading: "היום · 8 חלקי השאלון (0–100)",
    grade_heading: "ציון נוכחי — 8 חלקי השאלון (0–100)",
    daily_questions: "שאלות יומיות",
    progress_label: "התקדמות",
    no_new_questions: "אין שאלות חדשות כרגע — נביא עוד שאלות בימים הקרובים.",
    type_your_answer: "כתוב/י את התשובה",
    sending: "שולח…",
    send: "שלח",
    selected_label: "נבחר",
    today_button: "היום",
    language_label: "שפה",
    chat_empty_default: (topic) => `אפשר לדבר או להקליד בחופשיות. נחלץ פרטים מובנים עבור ${topic}.`,
    chat_empty_questionnaire: "טוען את שאלת היום...",
    chat_input_questionnaire: "כתוב/י את התשובה שלך...",
    chat_input_default: (topic) => `שתף/י את הפרטים על ${topic}...`,
    listening_label: "מקשיב",
    profile_via_onboarding: "הפרופיל ממולא דרך מסך הקליטה — פתח/י אותו מסרגל הצד.",
    questionnaire_done: "תודה — אלו כל השאלות להיום. נביא עוד בימים הקרובים.",
    daily_batch_complete: "סיימת את שאלות היום. זה הכול לעת עתה — מחר נציע אצווה חדשה.",
    daily_skipped_today:
      "בסדר — לא נשאל שוב היום. מחר יופיעו שאלות אחרות; שאלות שלא נענו יכולות לחזור אחרי כמה ימים.",
    not_today_button: "לא היום",
    not_today_next_question: "מדלגים — השאלה הבאה:",
    select_topic: "בחר/י נושא מסרגל הצד כדי להתחיל בשיחה.",
    viewing_topic_history: (topic) => `התשובות הקודמות שלך בנושא ${topic}`,
    no_session_answers: (topic) => `אין עדיין תשובות שמורות בנושא ${topic}.`,
    back_to_current_question: "חזרה לשאלה הנוכחית",
    back_label: "חזרה",
    answer_text_unavailable: "הניסוח המקורי לא נשמר",
    saved_as_label: "נשמר כ-",
    structured_extracted: "המידע נחלץ. סקור/י את הסיכום ואשר/י לשמור.",
    aria_logo_questionnaire: "ענה על שאלת היום בעמוד הוספת מדדים",
    aria_mic_supported: "הפעל/כבה מיקרופון",
    aria_mic_unsupported: "זיהוי דיבור אינו נתמך בדפדפן זה",
    failed_save_answer: "שמירת התשובה נכשלה",
    failed_save_entry: "שמירת הרשומה נכשלה",
    failed_analyze: "ניתוח ההודעה נכשל",
    sign_in_prompt: "התחבר/י כדי לצפות בלוח הבקרה.",
    topic_profile: "פרופיל",
    topic_nutrition: "תזונה",
    topic_activity: "פעילות",
    topic_sleep: "שינה",
    topic_substances: "חומרים פעילים",
    topic_mind: "מצב רוח ולחץ",
    topic_relationships: "מערכות יחסים",
    topic_motivation: "מוטיבציה",
    weekdays_short: ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"],
    months_short: ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"],
  },
};

function makeT(lang) {
  const dict = I18N[lang] || I18N.en;
  return (key, ...args) => {
    const v = dict[key] ?? I18N.en[key] ?? key;
    return typeof v === "function" ? v(...args) : v;
  };
}

function normalizeLanguage(v) {
  return v === "en" ? "en" : "he";
}

/**
 * Generic LLM fallbacks that the backend returns when it has no scripted line
 * for a question. They tell the patient nothing about *what* to answer, so we
 * detect them on the client and prefer the catalog question text instead.
 */
const GENERIC_QUESTION_FALLBACKS = [
  "Could you share a quick answer in your own words? Anything close is fine.",
  "אפשר לענות במשפט או שניים בניסוח חופשי? כל ניסוח שמספר את המידע מספיק.",
];

/**
 * Pick the most meaningful question text for display in the active UI language.
 *
 * 1. Prefer the backend's `conversational_prompt` — it is generated in the
 *    language the dashboard requested and usually carries warm phrasing.
 * 2. If that prompt is one of the generic placeholders (the LLM had nothing
 *    scripted for the question id), fall back to the catalog `hebrew` field —
 *    but only when the UI is actually Hebrew, otherwise an English speaker
 *    would suddenly see a Hebrew question.
 * 3. As a last resort, return whatever non-empty value we have.
 */
function pickQuestionPrompt(q, language = "he") {
  if (!q) return "";
  const conv = (q.conversational_prompt || "").trim();
  const hebrew = (q.hebrew || "").trim();
  if (conv && !GENERIC_QUESTION_FALLBACKS.includes(conv)) return conv;
  if (language === "he" && hebrew) return hebrew;
  return conv || hebrew || "";
}

/**
 * Map a question's catalog `part` (Hebrew א–ח) to the matching topic id in
 * `ADD_ENTRY_TOPICS`. Used to highlight the right-rail subject that owns the
 * question currently shown in the daily-metrics chat.
 */
const QUESTION_PART_TO_TOPIC_ID = {
  "א": "profile",
  "ב": "nutrition",
  "ג": "activity",
  "ד": "sleep",
  "ה": "substances",
  "ו": "mind",
  "ז": "relationships",
  "ח": "motivation",
};

function questionTopicId(q) {
  if (!q) return null;
  const part = (q.part || "").trim();
  return QUESTION_PART_TO_TOPIC_ID[part] || null;
}

/** Human-readable Today donut stat line. Lifestyle domains use 0–100. */
function formatTodayMetricValue(key, value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  switch (key) {
    case "steps":
      return `${Math.round(value).toLocaleString()} steps`;
    case "sleep": {
      const rounded = Math.round(value * 10) / 10;
      const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, "");
      return `${text} hour${rounded === 1 ? "" : "s"}`;
    }
    case "nutrition":
    case "physical_activity":
    case "sleep_domain":
    case "stress":
    case "mental_health":
    case "social_support":
    case "controlled_eating":
    case "substance":
    case "profile":
    case "substances":
    case "mind":
    case "relationships":
    case "motivation":
      return `${Math.round(value)}/100`;
    case "smoking":
      if (value === 0) return "0 cigarettes";
      if (value === 1) return "1 cigarette";
      return `${value % 1 === 0 ? value : value.toFixed(1)} cigarettes`;
    case "mood": {
      const s = value % 1 === 0 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
      return `${s}/10`;
    }
    default:
      return String(value);
  }
}

/**
 * Collapse the 10 raw questionnaire radar scores into the 8 parts of the
 * official health-behaviours questionnaire (חלקים א׳–ח׳).
 * Part א׳ (Profile) is handled separately because it is completion %, not a score.
 */
function computeQuestionnairePartScores(row) {
  const get = (k) => {
    const v = row[`lr_${k}`];
    return typeof v === "number" && !Number.isNaN(v) ? v : null;
  };
  const avg = (...keys) => {
    const vals = keys.map(get).filter((v) => v !== null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  return {
    qp_nutrition: avg("nutrition", "controlled_eating"),
    qp_activity: get("physical_activity"),
    qp_sleep: get("sleep"),
    qp_substances: avg("smoke_free", "alcohol_free"),
    qp_mind: avg("stress", "mental_health"),
    qp_relationships: get("social_support"),
    qp_motivation: get("motivation"),
  };
}

function mergeLifestyleRadarIntoRow(row) {
  if (!row || !row.lifestyle_radar_json) return row;
  try {
    const arr =
      typeof row.lifestyle_radar_json === "string" ? JSON.parse(row.lifestyle_radar_json) : row.lifestyle_radar_json;
    if (!Array.isArray(arr)) return row;
    const extra = {};
    arr.forEach((d) => {
      if (d && d.key && typeof d.score === "number" && !Number.isNaN(d.score)) {
        extra[`lr_${d.key}`] = d.score;
      }
    });
    const withRaw = { ...row, ...extra };
    return { ...withRaw, ...computeQuestionnairePartScores(withRaw) };
  } catch (e) {
    return row;
  }
}

/** Eight dashboard tiles, one per questionnaire part (א׳–ח׳). Labels come from `t()`
 *  so they switch with the active UI language. */
function buildQuestionnairePartDonuts(row, theme, profilePct, t) {
  const pick = (k) =>
    typeof row[k] === "number" && !Number.isNaN(row[k]) ? row[k] : null;
  return [
    {
      key: "profile",
      chartId: "qp_profile",
      label: t("topic_profile"),
      value: typeof profilePct === "number" && !Number.isNaN(profilePct) ? profilePct : null,
      max: 100,
      Icon: IdentificationCard,
      color: "#64748b",
    },
    {
      key: "nutrition",
      chartId: "qp_nutrition",
      label: t("topic_nutrition"),
      value: pick("qp_nutrition"),
      max: 100,
      Icon: ForkKnife,
      color: theme.metric.nutrition,
    },
    {
      key: "physical_activity",
      chartId: "qp_activity",
      label: t("topic_activity"),
      value: pick("qp_activity"),
      max: 100,
      Icon: Sneaker,
      color: theme.metric.steps,
    },
    {
      key: "sleep_domain",
      chartId: "qp_sleep",
      label: t("topic_sleep"),
      value: pick("qp_sleep"),
      max: 100,
      Icon: MoonStars,
      color: theme.metric.sleep,
    },
    {
      key: "substances",
      chartId: "qp_substances",
      label: t("topic_substances"),
      value: pick("qp_substances"),
      max: 100,
      Icon: Cigarette,
      color: theme.metric.steps,
    },
    {
      key: "mind",
      chartId: "qp_mind",
      label: t("topic_mind"),
      value: pick("qp_mind"),
      max: 100,
      Icon: Brain,
      color: theme.metric.mood,
    },
    {
      key: "relationships",
      chartId: "qp_relationships",
      label: t("topic_relationships"),
      value: pick("qp_relationships"),
      max: 100,
      Icon: HeartStraight,
      color: theme.metric.nutrition,
    },
    {
      key: "motivation",
      chartId: "qp_motivation",
      label: t("topic_motivation"),
      value: pick("qp_motivation"),
      max: 100,
      Icon: ChartBar,
      color: theme.metric.mood,
    },
  ];
}

// Donut chart: value vs max (0–1). Optional centerLabel or centerIcon in the middle.
function DonutChart({ value, max, color, size = 64, strokeWidth = 8, centerLabel, centerIcon, trackColor = "#E9ECEF" }) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = max > 0 && typeof value === "number" ? Math.min(1, Math.max(0, value / max)) : 0;
  const filled = ratio * circumference;
  const gap = circumference - filled;
  const fontSize = Math.max(10, Math.min(size * 0.28, 14));
  const svg = (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${filled} ${gap}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {centerIcon == null && centerLabel != null && centerLabel !== "" && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize, fill: "#1F2D3D", fontWeight: 600, fontFamily: "Roboto, sans-serif" }}
        >
          {String(centerLabel)}
        </text>
      )}
    </svg>
  );
  if (centerIcon != null) {
    return (
      <Box sx={{ position: "relative", width: size, height: size, display: "inline-block" }}>
        {svg}
        <Box
          sx={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {centerIcon}
        </Box>
      </Box>
    );
  }
  return svg;
}

/**
 * Vertical bar chart for the 8 questionnaire parts.
 * X-axis = part name (categorical). Y-axis = score 0–100 (grade concluded so far).
 * Built with flex/CSS so it grows naturally with the container height.
 */
function QuestionnairePartsBarChart({ parts, theme }) {
  const yMax = 100;
  const yTicks = [100, 75, 50, 25, 0];
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "row" }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            py: 1,
            pr: 1,
            flexShrink: 0,
            minWidth: 28,
          }}
        >
          {yTicks.map((t) => (
            <Typography
              key={t}
              variant="caption"
              sx={{ color: theme.textMuted, fontSize: "0.7rem", lineHeight: 1, textAlign: "right" }}
            >
              {t}
            </Typography>
          ))}
        </Box>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            position: "relative",
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            gap: { xs: 0.5, sm: 1 },
            px: 0.5,
            pt: 1,
            pb: 0,
            borderBottom: `1px solid ${alpha(theme.text, 0.35)}`,
          }}
        >
          {yTicks.map((t) => (
            <Box
              key={`grid-${t}`}
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `calc(8px + (100% - 8px) * ${1 - t / yMax})`,
                borderTop: `1px dashed ${alpha(theme.text, 0.1)}`,
                pointerEvents: "none",
              }}
            />
          ))}
          {parts.map((p) => {
            const hasValue = typeof p.value === "number" && !Number.isNaN(p.value);
            const v = hasValue ? Math.max(0, Math.min(yMax, p.value)) : 0;
            const color = p.color || theme.logoGreen;
            return (
              <Box
                key={p.key}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  position: "relative",
                }}
                title={hasValue ? `${p.label}: ${Math.round(p.value)}/100` : `${p.label}: —`}
              >
                <Box
                  sx={{
                    width: { xs: "70%", sm: "60%", md: "45%" },
                    maxWidth: 34,
                    height: `${(v / yMax) * 100}%`,
                    minHeight: hasValue ? 2 : 0,
                    background: hasValue
                      ? `linear-gradient(180deg, ${color} 0%, ${alpha(color, 0.82)} 100%)`
                      : alpha(color, 0.18),
                    border: "none",
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    position: "relative",
                    boxShadow: hasValue
                      ? `0 4px 10px -4px ${alpha(color, 0.55)}, inset 0 1px 0 ${alpha("#ffffff", 0.25)}`
                      : "none",
                    transition: "height 320ms ease",
                  }}
                >
                  {hasValue ? (
                    <Typography
                      variant="caption"
                      sx={{
                        position: "absolute",
                        top: -18,
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        color: theme.text,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {Math.round(p.value)}
                    </Typography>
                  ) : (
                    <Typography
                      variant="caption"
                      sx={{
                        position: "absolute",
                        bottom: 2,
                        fontSize: "0.7rem",
                        color: theme.textMuted,
                      }}
                    >
                      —
                    </Typography>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          pl: "28px",
          pr: 0.5,
          pt: 0.75,
          gap: { xs: 0.5, sm: 1 },
          flexShrink: 0,
        }}
      >
        {parts.map((p) => (
          <Box
            key={`lbl-${p.key}`}
            sx={{
              flex: 1,
              minWidth: 0,
              textAlign: "center",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: theme.textMuted,
                fontWeight: 600,
                fontSize: "0.7rem",
                lineHeight: 1.15,
                display: "block",
                wordBreak: "break-word",
              }}
            >
              {p.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function normalizeRow(row) {
  return {
    ...row,
    jsDate: row.date ? new Date(row.date) : null,
  };
}

function average(rows, field) {
  const values = rows
    .map((r) => (typeof r[field] === "number" ? r[field] : null))
    .filter((v) => v !== null);
  if (!values.length) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

function emptyTodayRow(patientId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return normalizeRow({
    id: -1,
    patient_id: patientId,
    date: todayStr,
    steps: null,
    sleep: null,
    sleep_quality: null,
    active_minutes: null,
    nutrition_score: null,
    alcohol_units: null,
    stress_score: null,
    social_support_score: null,
    cigarettes_per_day: null,
    is_smoking: null,
    mood_score: null,
    work_satisfaction: null,
    score: null,
  });
}

/**
 * Demo radar rows so the 10-line chart is never empty while the patient has no data yet.
 * Each field is a smooth-ish 0-100 curve with a small per-day jitter.
 */
function buildDemoRadarRows(patientId) {
  const keys = [
    "nutrition",
    "physical_activity",
    "sleep",
    "stress",
    "mental_health",
    "social_support",
    "controlled_eating",
    "smoke_free",
    "alcohol_free",
    "motivation",
  ];
  const baseByKey = {
    nutrition: 62,
    physical_activity: 55,
    sleep: 70,
    stress: 48,
    mental_health: 66,
    social_support: 72,
    controlled_eating: 58,
    smoke_free: 80,
    alcohol_free: 74,
    motivation: 68,
  };
  const ampByKey = {
    nutrition: 14,
    physical_activity: 18,
    sleep: 10,
    stress: 16,
    mental_health: 12,
    social_support: 8,
    controlled_eating: 14,
    smoke_free: 10,
    alcohol_free: 12,
    motivation: 16,
  };
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const rows = [];
  const today = new Date();
  for (let i = 20; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const radar = keys.map((k, ki) => {
      const phase = ki * 0.7;
      const osc = Math.sin((20 - i) / 3 + phase) * ampByKey[k];
      const jitter = ((ki * 131 + (20 - i) * 37) % 9) - 4;
      return { key: k, score: clamp(baseByKey[k] + osc + jitter) };
    });
    const scoreToSteps = (s) => Math.round(3000 + (s / 100) * 8000);
    const activityScore = radar.find((r) => r.key === "physical_activity").score;
    const sleepScore = radar.find((r) => r.key === "sleep").score;
    const nutritionScore = radar.find((r) => r.key === "nutrition").score;
    const stressScore = radar.find((r) => r.key === "stress").score;
    const moodBase = radar.find((r) => r.key === "mental_health").score;
    rows.push(
      normalizeRow({
        id: -(100 + i),
        patient_id: patientId,
        date: dateStr,
        steps: scoreToSteps(activityScore),
        sleep: Math.round((4 + (sleepScore / 100) * 5) * 10) / 10,
        sleep_quality: Math.round(sleepScore / 10),
        active_minutes: Math.round((activityScore / 100) * 60),
        nutrition_score: nutritionScore,
        alcohol_units: Math.max(0, Math.round((100 - radar.find((r) => r.key === "alcohol_free").score) / 15)),
        stress_score: Math.round(stressScore / 10),
        social_support_score: Math.round(radar.find((r) => r.key === "social_support").score / 10),
        cigarettes_per_day: Math.max(0, Math.round((100 - radar.find((r) => r.key === "smoke_free").score) / 12)),
        is_smoking: false,
        mood_score: Math.round(moodBase / 10),
        work_satisfaction: Math.round(radar.find((r) => r.key === "motivation").score / 10),
        score: null,
        lifestyle_radar_json: JSON.stringify(radar),
        __demo: true,
      })
    );
  }
  return rows;
}

export default function PatientDashboard() {
  const history = useHistory();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarView, setSidebarView] = useState("dashboard"); // 'dashboard' | 'add' | 'manage' | 'statistics' | 'profile'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [topicRailCollapsed, setTopicRailCollapsed] = useState(false);
  /** While collapsed, hovering the rail temporarily expands it (no arrow button). */
  const [topicRailHover, setTopicRailHover] = useState(false);
  const topicRailNarrow = topicRailCollapsed && !topicRailHover;
  const recognitionRef = useRef(null);
  const recognitionActiveRef = useRef(false);
  const recognitionStartingRef = useRef(false);
  /** Tracks the last daily-question id while in questionnaire mode (for leaving topic-history when the question advances). */
  const lastActiveQuestionnaireQidRef = useRef(null);
  const [checkinDateStr, setCheckinDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  /** null = all metrics on weekly chart; otherwise matches WeeklyMetricCircles ids (activity, sleep, …) */
  const [weeklyChartMetricId, setWeeklyChartMetricId] = useState(null);
  /** Official questionnaire (daily drip) */
  const [officialProgress, setOfficialProgress] = useState(null);
  const [officialQuestionQueue, setOfficialQuestionQueue] = useState([]);
  const [officialQuestionIndex, setOfficialQuestionIndex] = useState(0);
  /** From `/official-questionnaire/daily` — patient chose "not today" for this calendar day. */
  const [officialSessionSkippedToday, setOfficialSessionSkippedToday] = useState(false);
  /** Today's capped batch (e.g. 5) is fully answered — backend returns no further questions today. */
  const [officialDailyBatchComplete, setOfficialDailyBatchComplete] = useState(false);
  const [declineDailySubmitting, setDeclineDailySubmitting] = useState(false);
  const [officialQInput, setOfficialQInput] = useState("");
  const [officialQLoading, setOfficialQLoading] = useState(false);
  const [officialQError, setOfficialQError] = useState(null);
  /** When true, the Add daily metrics chat is driven by the official questionnaire
   *  (assistant asks the next question; patient answers via text/mic; answer is
   *  posted to /official-questionnaire/answer instead of /analyze/{topic}). */
  const [addQuestionnaireMode, setAddQuestionnaireMode] = useState(false);
  /** While in questionnaire mode, this is the question the patient is currently answering. */
  const [addQuestionnaireActive, setAddQuestionnaireActive] = useState(null);
  /** In-session log of every (question, answer) pair the patient submitted from
   *  the daily-metrics chat. Used so the right-rail topics can replay what was
   *  already answered for that subject. */
  const [questionnaireTranscript, setQuestionnaireTranscript] = useState([]);
  /** Every question the patient has already answered across previous days, as
   *  returned by `/official-questionnaire/history`. Refreshed when entering
   *  questionnaire mode or toggling language so the saved scripted prompts
   *  arrive in the active language. */
  const [historicalAnswers, setHistoricalAnswers] = useState([]);
  /** When set, the chat area is replaying the session transcript filtered to
   *  this topic id. Null means we're showing the live conversation. */
  const [viewingTopicId, setViewingTopicId] = useState(null);
  /** UI language ("he" | "en"). Persisted in localStorage so the backend
   *  questionnaire fetch + the speech recognizer pick the same language as the UI. */
  const [language, setLanguage] = useState(() => {
    if (typeof localStorage === "undefined") return "he";
    return normalizeLanguage(localStorage.getItem("patient_chat_language"));
  });
  const t = useMemo(() => makeT(language), [language]);
  const isRtl = language === "he";

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem("patient_chat_language", language);
  }, [language]);

  /** Stable unique SVG pattern ids (React 17 has no useId) */
  const addEntryWallpaperKey = useMemo(() => `w${Math.random().toString(36).slice(2, 11)}`, []);
  const addEntryPatternBrickA = `chat-wall-a-${addEntryWallpaperKey}`;
  const addEntryPatternBrickB = `chat-wall-b-${addEntryWallpaperKey}`;

  /** First visit to Add entry: default to Family & Friends and show chat (topic rail collapses like a manual pick).
   *  Skip when the chat is being driven by the official questionnaire — there is no topic to pick. */
  useLayoutEffect(() => {
    if (sidebarView !== "add" || selectedTopicId != null || addQuestionnaireMode) return;
    setSelectedTopicId(ADD_ENTRY_TOPICS[0].id);
    setTopicRailCollapsed(true);
  }, [sidebarView, selectedTopicId, addQuestionnaireMode]);

  // 1) Fetch current user
  useEffect(() => {
    getUser()
      .then((u) => {
        if (u.is_superuser === true || u.is_superuser === 1) {
          window.location.replace("/admin-dashboard");
          return;
        }
        if (u.is_researcher === true || u.is_researcher === 1) {
          window.location.replace("/researcher-dashboard");
          return;
        }
        setUser(u);
      })
      .catch((err) => {
        console.warn("Failed to get user", err);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("view") === "profile") {
      setSidebarView("profile");
    }
  }, [location.search]);

  const patientId = user?.id;

  const loadQuestionnaireHistory = useCallback(() => {
    if (patientId == null) return;
    api
      .get("/official-questionnaire/history", {
        params: { patient_id: patientId, language },
      })
      .then((r) => setHistoricalAnswers(r.data?.answers || []))
      .catch(() => setHistoricalAnswers([]));
  }, [patientId, language]);

  const loadOfficialQuestionnaire = useCallback(() => {
    if (patientId == null) return;
    api
      .get("/official-questionnaire/progress", { params: { patient_id: patientId } })
      .then((r) => setOfficialProgress(r.data))
      .catch(() => setOfficialProgress(null));
    api
      .get("/official-questionnaire/daily", {
        params: { patient_id: patientId, language },
      })
      .then((r) => {
        const qs = r.data.questions || [];
        setOfficialQuestionQueue(qs);
        setOfficialQuestionIndex(0);
        setOfficialSessionSkippedToday(!!r.data.session_closed_today);
        setOfficialDailyBatchComplete(!!r.data.daily_batch_complete);
      })
      .catch(() => {
        setOfficialQuestionQueue([]);
        setOfficialQuestionIndex(0);
        setOfficialSessionSkippedToday(false);
        setOfficialDailyBatchComplete(false);
      });
  }, [patientId, language]);

  /** "Not today" = skip this question; backend removes today's prompt row and may offer another up to the daily cap. */
  const handleNotTodaySkipQuestion = useCallback(() => {
    if (patientId == null) return;
    const q = addQuestionnaireActive;
    const qid = q?.question_id != null ? String(q.question_id) : "";
    if (!qid) return;
    setDeclineDailySubmitting(true);
    setAnalyzeError(null);
    api
      .post("/official-questionnaire/skip-question", { patient_id: patientId, question_id: qid })
      .then(() =>
        api.get("/official-questionnaire/daily", {
          params: { patient_id: patientId, language },
        })
      )
      .then((r) => {
        const qs = r.data.questions || [];
        setOfficialQuestionQueue(qs);
        setOfficialQuestionIndex(0);
        setOfficialSessionSkippedToday(!!r.data.session_closed_today);
        setOfficialDailyBatchComplete(!!r.data.daily_batch_complete);
        setViewingTopicId(null);
        const next = qs[0] || null;
        setAddQuestionnaireActive(next);
        if (next) {
          const nextPrompt = pickQuestionPrompt(next, language);
          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: `${t("not_today_next_question")}\n\n${nextPrompt}`,
            },
          ]);
        } else {
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", text: t("daily_batch_complete") },
          ]);
        }
        api
          .get("/official-questionnaire/progress", { params: { patient_id: patientId } })
          .then((pr) => setOfficialProgress(pr.data))
          .catch(() => {});
      })
      .catch((err) => {
        setAnalyzeError(err.response?.data?.detail || err.message || t("failed_save_answer"));
      })
      .finally(() => setDeclineDailySubmitting(false));
  }, [patientId, addQuestionnaireActive?.question_id, language, t]);

  const refetchMetrics = useCallback(() => {
    if (patientId == null) return;
    api
      .get("/metrics", { params: { patient_id: patientId } })
      .then((res) => {
        let rows = (res.data || []).map(normalizeRow);
        rows.sort((a, b) => {
          if (!a.jsDate || !b.jsDate) return 0;
          return a.jsDate.getTime() - b.jsDate.getTime();
        });
        setMetrics(rows);
      })
      .catch((err) => {
        console.warn("Failed to fetch metrics", err);
        setMetrics([]);
      });
  }, [patientId]);

  // 2) Ensure today’s metric row exists (partial onboarding / sync), then load metrics
  useEffect(() => {
    if (!authChecked) return;
    if (patientId == null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .post("/onboarding/sync-dashboard", { patient_id: patientId })
      .catch((err) => console.warn("sync-dashboard failed", err))
      .then(() =>
        api.get("/metrics", { params: { patient_id: patientId } })
      )
      .then((res) => {
        let rows = (res.data || []).map(normalizeRow);
        rows.sort((a, b) => {
          if (!a.jsDate || !b.jsDate) return 0;
          return a.jsDate.getTime() - b.jsDate.getTime();
        });
        setMetrics(rows);
      })
      .catch((err) => {
        console.warn("Failed to fetch metrics", err);
        setMetrics([]);
      })
      .finally(() => {
        setLoading(false);
        loadOfficialQuestionnaire();
      });
  }, [authChecked, patientId, loadOfficialQuestionnaire]);

  useEffect(() => {
    if (patientId == null) return;
    // Refetch when entering any view OR when the UI language changes — the
    // backend returns prompts in the requested language, so we always need a
    // fresh queue after a toggle.
    loadOfficialQuestionnaire();
  }, [sidebarView, patientId, loadOfficialQuestionnaire]);

  // Pull the patient's full answer history whenever they enter the
  // questionnaire chat, open a topic for review (e.g. profile from outside
  // questionnaire mode), or change languages — that way the right-rail topic
  // replay can include answers from previous days and the scripted prompts
  // arrive in the active language.
  useEffect(() => {
    if (!addQuestionnaireMode && !viewingTopicId) return;
    loadQuestionnaireHistory();
  }, [addQuestionnaireMode, viewingTopicId, loadQuestionnaireHistory]);

  // When the daily API returns no queue because the patient skipped today or
  // finished the capped batch, show the matching assistant line in the chat.
  useEffect(() => {
    if (!addQuestionnaireMode) return;
    if (officialQuestionQueue.length > 0) return;
    if (!officialSessionSkippedToday && !officialDailyBatchComplete) return;
    setAddQuestionnaireActive(null);
    const text = officialSessionSkippedToday ? t("daily_skipped_today") : t("daily_batch_complete");
    setChatMessages((prev) => {
      // Do not replace a multi-turn transcript (e.g. after answering the last
      // question — the submit handler already appended the wrap-up line).
      if (prev.length > 1) return prev;
      if (prev.length === 1 && prev[0].role === "assistant" && prev[0].text === text) return prev;
      if (prev.length === 1 && prev[0].role === "user") return prev;
      return [{ role: "assistant", text }];
    });
  }, [
    addQuestionnaireMode,
    officialQuestionQueue.length,
    officialSessionSkippedToday,
    officialDailyBatchComplete,
    t,
  ]);

  // While the patient is mid-conversation in the daily-metrics chat, swap the
  // currently displayed question text to the newly chosen language.
  useEffect(() => {
    if (!addQuestionnaireMode) return;
    const q = officialQuestionQueue[officialQuestionIndex];
    if (!q) return;
    const newPrompt = pickQuestionPrompt(q, language);
    setAddQuestionnaireActive(q);
    setChatMessages((prev) => {
      if (!prev.length) return [{ role: "assistant", text: newPrompt }];
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === "assistant") {
          if (next[i].text === newPrompt) return prev;
          next[i] = { ...next[i], text: newPrompt };
          return next;
        }
      }
      return prev;
    });
  }, [language, addQuestionnaireMode, officialQuestionQueue, officialQuestionIndex]);

  // When the daily question advances to a new question_id, leave topic-history
  // review so the new assistant prompt is visible. We intentionally do NOT
  // compare viewingTopicId to the live question's subject — the patient may
  // click another topic to read past answers while the current question is
  // still from a different part; clearing on that mismatch made clicks feel
  // broken (state was reset in the same tick as the click).
  useEffect(() => {
    if (!addQuestionnaireMode) {
      lastActiveQuestionnaireQidRef.current = null;
      return;
    }
    const q = addQuestionnaireActive;
    const qid = q?.question_id != null ? String(q.question_id) : null;
    if (viewingTopicId == null) {
      if (qid) lastActiveQuestionnaireQidRef.current = qid;
      return;
    }
    if (!qid) return;
    if (
      lastActiveQuestionnaireQidRef.current != null &&
      lastActiveQuestionnaireQidRef.current !== qid
    ) {
      setViewingTopicId(null);
    }
    lastActiveQuestionnaireQidRef.current = qid;
  }, [addQuestionnaireMode, addQuestionnaireActive, viewingTopicId]);

  const metricsWithRadar = useMemo(
    () => metrics.map((row) => mergeLifestyleRadarIntoRow(normalizeRow(row))),
    [metrics]
  );

  /** Intake/profile completion %, derived from the official questionnaire progress. */
  const profilePct = useMemo(() => {
    if (
      officialProgress &&
      typeof officialProgress.total_primary === "number" &&
      officialProgress.total_primary > 0 &&
      typeof officialProgress.answered_count === "number"
    ) {
      return Math.max(0, Math.min(100, (officialProgress.answered_count / officialProgress.total_primary) * 100));
    }
    return null;
  }, [officialProgress]);

  const { today, week1, week2, week3, last21 } = useMemo(() => {
    if (patientId == null) {
      return { today: null, week1: [], week2: [], week3: [], last21: [] };
    }
    const PART_FIELDS = [
      "qp_nutrition",
      "qp_activity",
      "qp_sleep",
      "qp_substances",
      "qp_mind",
      "qp_relationships",
      "qp_motivation",
    ];
    const hasAnyRadar = metricsWithRadar.some((row) =>
      PART_FIELDS.some((f) => typeof row[f] === "number" && !Number.isNaN(row[f]))
    );
    // The Profile line is completion %, not a per-day behaviour, so it stays
    // constant across the window.
    const demoProfilePct = typeof profilePct === "number" ? profilePct : 55;
    const attachProfile = (rows, pct) =>
      rows.map((r) => ({ ...r, qp_profile: typeof pct === "number" ? pct : null }));
    if (!hasAnyRadar) {
      const demoRows = buildDemoRadarRows(patientId).map((r) => mergeLifestyleRadarIntoRow(r));
      const withProfile = attachProfile(demoRows, demoProfilePct);
      const todayRow = withProfile[withProfile.length - 1] || null;
      return {
        today: todayRow,
        week1: withProfile.slice(0, 7),
        week2: withProfile.slice(7, 14),
        week3: withProfile.slice(14, 21),
        last21: withProfile,
      };
    }
    const last21m = attachProfile(metricsWithRadar.slice(-21), profilePct);
    const todayRow = last21m[last21m.length - 1] || null;
    const week1m = last21m.slice(0, 7);
    const week2m = last21m.slice(7, 14);
    const week3m = last21m.slice(14, 21);
    return { today: todayRow, week1: week1m, week2: week2m, week3: week3m, last21: last21m };
  }, [metricsWithRadar, patientId, profilePct]);

  /** Eight tiles, one per questionnaire part (חלקים א׳–ח׳). */
  const todayDonutMetrics = useMemo(() => {
    if (!today) return [];
    return buildQuestionnairePartDonuts(today, theme, profilePct, t);
  }, [today, profilePct, t]);

  const selectedTopic = useMemo(
    () => ADD_ENTRY_TOPICS.find((t) => t.id === selectedTopicId) || null,
    [selectedTopicId]
  );

  /** Topic the patient is reviewing inside the questionnaire chat (set when
   *  they click a topic from the right rail mid-conversation). */
  const viewingTopic = useMemo(
    () => ADD_ENTRY_TOPICS.find((tp) => tp.id === viewingTopicId) || null,
    [viewingTopicId]
  );

  /** Derived chat bubbles: live conversation by default, or a replay of every
   *  question/answer pair the patient has stored for the chosen topic — both
   *  past days (`historicalAnswers` from the backend) and any answers given
   *  in this session (`questionnaireTranscript`). Session answers win over
   *  the matching historical row so freshly-typed text shows up immediately.
   *
   *  Each user bubble also carries `savedAs` — the parser's conclusion for
   *  that reply — so the patient can audit whether the LLM mapped their
   *  words to the right option/number. */
  const displayedMessages = useMemo(() => {
    if (!viewingTopicId) return chatMessages;
    const sessionByQid = new Map();
    questionnaireTranscript.forEach((entry) => {
      if (questionTopicId(entry.q) !== viewingTopicId) return;
      sessionByQid.set(String(entry.q.question_id), entry);
    });
    const merged = [];
    historicalAnswers.forEach((h) => {
      if (questionTopicId(h) !== viewingTopicId) return;
      const qid = String(h.question_id);
      if (sessionByQid.has(qid)) return;
      merged.push({
        q: h,
        answerText: h.raw_answer || "",
        savedAs: h.saved_as || "",
        answeredAt: h.answered_at || null,
      });
    });
    sessionByQid.forEach((entry) => {
      merged.push({
        q: entry.q,
        answerText: entry.answerText,
        // Session answers haven't been re-fetched from history yet, so we
        // don't have `saved_as` until the next history refresh fires.
        savedAs: entry.savedAs || "",
        answeredAt: null,
      });
    });
    merged.sort((a, b) => {
      if (a.answeredAt && b.answeredAt) return a.answeredAt.localeCompare(b.answeredAt);
      if (a.answeredAt && !b.answeredAt) return -1;
      if (!a.answeredAt && b.answeredAt) return 1;
      return 0;
    });
    const out = [];
    merged.forEach((entry) => {
      out.push({ role: "assistant", text: pickQuestionPrompt(entry.q, language) });
      if (entry.answerText) {
        out.push({ role: "user", text: entry.answerText, savedAs: entry.savedAs });
      } else {
        out.push({
          role: "user",
          text: t("answer_text_unavailable"),
          placeholder: true,
          savedAs: entry.savedAs,
        });
      }
    });
    return out;
  }, [viewingTopicId, chatMessages, questionnaireTranscript, historicalAnswers, language, t]);

  const speechRecognitionSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (!speechRecognitionSupported) return undefined;
    const SpeechRecognitionImpl =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognitionImpl();
    rec.lang = SPEECH_RECOGNITION_LANGS[language] || SPEECH_RECOGNITION_LANGS.en;
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) {
          setChatInput((prev) => `${prev}${prev ? " " : ""}${chunk.trim()}`.trim());
          setLiveTranscript("");
        } else {
          interim += chunk;
        }
      }
      if (interim.trim()) setLiveTranscript(interim.trim());
    };
    rec.onstart = () => {
      recognitionStartingRef.current = false;
      recognitionActiveRef.current = true;
      setIsListening(true);
    };
    rec.onend = () => {
      recognitionStartingRef.current = false;
      recognitionActiveRef.current = false;
      setIsListening(false);
    };
    rec.onerror = () => {
      recognitionStartingRef.current = false;
      recognitionActiveRef.current = false;
      setIsListening(false);
    };
    recognitionRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch (e) {
        console.warn("Speech recognition stop failed", e);
      }
      recognitionStartingRef.current = false;
      recognitionActiveRef.current = false;
    };
  }, [speechRecognitionSupported, language]);

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: theme.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress sx={{ color: theme.textMuted }} />
      </Box>
    );
  }

  if (!today) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: theme.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
        }}
      >
        <Typography variant="h6" sx={{ color: theme.textMuted }} dir={isRtl ? "rtl" : "ltr"}>
          {t("sign_in_prompt")}
        </Typography>
      </Box>
    );
  }

  const weekSummary = (rows) => ({
    steps: average(rows, "steps"),
    sleep: average(rows, "sleep"),
    nutrition_score: average(rows, "nutrition_score"),
    alcohol_units: average(rows, "alcohol_units"),
    stress_score: average(rows, "stress_score"),
    mood_score: average(rows, "mood_score"),
  });

  const w1 = weekSummary(week1);
  const w2 = weekSummary(week2);
  const w3 = weekSummary(week3);

  const formatNumber = (n) =>
    typeof n === "number" ? n.toFixed(1).replace(/\.0$/, "") : "—";

  const handleSignOut = () => {
    logout();
    window.location.replace("/");
  };

  const cardSx = {
    boxShadow: theme.cardShadow,
    borderRadius: 3,
    mb: 2,
  };
  const cardTitleSx = { fontWeight: 600, color: theme.text, mb: 1.5 };
  /** Today row — six donut stats (icons match WeeklyMetricCircles): no card chrome, smaller label/value */
  const donutRowCardSx = { bgcolor: "transparent", boxShadow: "none", mb: 0, overflow: "visible" };
  /** Stacked: donut on top, label + value in a row underneath (matches weekly metric circle tint) */
  const donutRowCardContentSx = {
    py: 1,
    px: 0.5,
    bgcolor: "transparent",
    overflow: "visible",
    "&:last-child": { pb: 1 },
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 0.75,
  };
  const handleTopicSelect = (topic) => {
    if (recognitionRef.current && (recognitionActiveRef.current || recognitionStartingRef.current)) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Speech recognition stop failed", e);
      }
    }
    // In daily-metrics questionnaire mode, clicking a topic does NOT abandon
    // the live conversation — it just shows the patient what they've already
    // answered for that topic, with a "back to current question" affordance
    // to resume. Profile is no exception: its onboarding answers are stored
    // in the same questionnaire table, so we replay them inline instead of
    // navigating off the page.
    if (addQuestionnaireMode) {
      setViewingTopicId(topic.id);
      setChatInput("");
      setLiveTranscript("");
      setAnalyzeError(null);
      return;
    }
    // Outside questionnaire mode, profile is read-only — it has no free-chat
    // analyzer endpoint, so clicking it shows the saved onboarding Q+A pairs
    // via the same review UI.
    if (topic && topic.id === "profile") {
      setViewingTopicId(topic.id);
      setChatInput("");
      setLiveTranscript("");
      setAnalyzeError(null);
      setTopicRailCollapsed(true);
      return;
    }
    setSelectedTopicId(topic.id);
    setChatMessages([]);
    setChatInput("");
    setLiveTranscript("");
    setAnalyzeError(null);
    setAnalysisResult(null);
    setTopicRailCollapsed(true);
    setAddQuestionnaireMode(false);
    setAddQuestionnaireActive(null);
    setViewingTopicId(null);
  };

  /** Leave transcript-review mode and return to the live current question. */
  const handleBackToCurrentQuestion = () => {
    setViewingTopicId(null);
    setChatInput("");
    setLiveTranscript("");
    setAnalyzeError(null);
  };

  const handleMicToggle = () => {
    if (!recognitionRef.current) return;
    if (recognitionActiveRef.current || recognitionStartingRef.current || isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Speech recognition stop failed", e);
      }
      return;
    }
    setLiveTranscript("");
    recognitionStartingRef.current = true;
    try {
      recognitionRef.current.start();
    } catch (e) {
      recognitionStartingRef.current = false;
      console.warn("Speech recognition start failed", e);
    }
  };

  /**
   * Submit an answer to the official questionnaire from the Add daily metrics chat.
   * Adds the user's answer + the next question (or a friendly "all done" line) to
   * the in-chat transcript, and refreshes progress + metrics in the background.
   */
  const handleAddEntryQuestionnaireSubmit = (e) => {
    e?.preventDefault();
    const text = (chatInput || "").trim();
    const q = addQuestionnaireActive;
    if (!text || !q || patientId == null) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    const userMessage = { role: "user", text };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setLiveTranscript("");
    api
      .post("/official-questionnaire/answer", {
        patient_id: patientId,
        question_id: q.question_id,
        user_message: text,
      })
      .then(() => {
        setQuestionnaireTranscript((prev) => [...prev, { q, answerText: text }]);
        loadQuestionnaireHistory();
        const remaining = officialQuestionQueue.slice(officialQuestionIndex + 1);
        const nextQ = remaining[0] || null;
        if (nextQ) {
          const nextPrompt = pickQuestionPrompt(nextQ, language);
          setOfficialQuestionIndex((i) => i + 1);
          setAddQuestionnaireActive(nextQ);
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", text: nextPrompt },
          ]);
        } else {
          setAddQuestionnaireActive(null);
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", text: t("questionnaire_done") },
          ]);
          setOfficialQuestionIndex(0);
          loadOfficialQuestionnaire();
        }
        refetchMetrics();
        api
          .get("/official-questionnaire/progress", { params: { patient_id: patientId } })
          .then((r) => setOfficialProgress(r.data))
          .catch(() => {});
      })
      .catch((err) => {
        setAnalyzeError(err.response?.data?.detail || err.message || t("failed_save_answer"));
      })
      .finally(() => setIsAnalyzing(false));
  };

  const handleAnalyzeTopic = (e) => {
    e?.preventDefault();
    const text = (chatInput || "").trim();
    if (!text || !selectedTopic) return;
    if (!selectedTopic.analyzeTopic) {
      setAnalyzeError(t("profile_via_onboarding"));
      return;
    }
    setAnalyzeError(null);
    setIsAnalyzing(true);
    setAnalysisResult(null);
    const userMessage = { role: "user", text };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    api
      .post(`/analyze/${selectedTopic.analyzeTopic}`, {
        patient_id: patientId,
        date: formDate,
        text,
      })
      .then((res) => {
        const result = res.data || {};
        setAnalysisResult(result);
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: t("structured_extracted") },
        ]);
      })
      .catch((err) => {
        setAnalyzeError(err.response?.data?.detail || err.message || t("failed_analyze"));
      })
      .finally(() => setIsAnalyzing(false));
  };

  const handleConfirmSaveFromAnalysis = () => {
    if (!analysisResult) return;
    setFormError(null);
    setConfirmSaving(true);
    const metricPayload = analysisResult.metric_payload || {};
    const payload = {
      patient_id: patientId,
      date: formDate,
      ...metricPayload,
      raw_data: JSON.stringify({
        topic: selectedTopic?.id,
        structured_data: analysisResult.structured_data || {},
        chat_messages: chatMessages,
      }),
    };
    api
      .post("/metrics", payload)
      .then(() => {
        refetchMetrics();
        setSidebarView("dashboard");
      })
      .catch((err) => setFormError(err.response?.data?.detail || err.message || t("failed_save_entry")))
      .finally(() => setConfirmSaving(false));
  };

  const handleUpdateMetric = (id, updates) => {
    api
      .patch(`/metrics/${id}`, updates)
      .then(() => {
        refetchMetrics();
        setEditingId(null);
      })
      .catch((err) => console.warn(err));
  };

  const handleDeleteMetric = (id) => {
    if (!window.confirm("Delete this entry?")) return;
    api
      .delete(`/metrics/${id}`)
      .then(() => refetchMetrics())
      .catch((err) => console.warn(err));
  };

  const handleOfficialQuestionnaireSubmit = (e) => {
    e?.preventDefault();
    const q = officialQuestionQueue[officialQuestionIndex];
    const text = (officialQInput || "").trim();
    if (!patientId || !q || !text) return;
    setOfficialQError(null);
    setOfficialQLoading(true);
    api
      .post("/official-questionnaire/answer", {
        patient_id: patientId,
        question_id: q.question_id,
        user_message: text,
      })
      .then(() => {
        setOfficialQInput("");
        if (officialQuestionIndex + 1 < officialQuestionQueue.length) {
          setOfficialQuestionIndex((i) => i + 1);
        } else {
          setOfficialQuestionIndex(0);
          loadOfficialQuestionnaire();
        }
        refetchMetrics();
        api
          .get("/official-questionnaire/progress", { params: { patient_id: patientId } })
          .then((r) => setOfficialProgress(r.data))
          .catch(() => {});
      })
      .catch((err) => {
        setOfficialQError(err.response?.data?.detail || err.message || t("failed_save_answer"));
      })
      .finally(() => setOfficialQLoading(false));
  };

  const rightSidePanel = (
    <Box
      sx={{
        width: { xs: "100%", lg: 400 },
        maxWidth: { xs: "100%", lg: 400 },
        flexShrink: 0,
        borderLeft: "none",
        borderTop: "none",
        bgcolor: "#f0fdf4",
        display: "flex",
        flexDirection: "column",
        minHeight: { xs: "auto", lg: 0 },
        height: { lg: "100%" },
        maxHeight: { lg: "100%" },
        overflowY: { xs: "visible", lg: "auto" },
        overflowX: "hidden",
        boxShadow: { lg: "-12px 0 18px -14px rgba(31,45,61,0.35)" },
      }}
    >
      <Box sx={{ p: 1.5, pb: 1, flexShrink: 0, borderBottom: "1px solid rgba(0,0,0,0.06)" }} dir={isRtl ? "rtl" : "ltr"}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: theme.text, mb: 0.25 }}>
              {t("daily_questions")}
            </Typography>
            {officialProgress != null && (
              <Typography variant="caption" sx={{ color: theme.textMuted, display: "block" }}>
                {t("progress_label")}: {officialProgress.answered_count}/{officialProgress.total_primary}
              </Typography>
            )}
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => {
              const currentQ = officialQuestionQueue[officialQuestionIndex] || null;
              const promptText = pickQuestionPrompt(currentQ, language);
              setAddQuestionnaireMode(true);
              setAddQuestionnaireActive(currentQ);
              setSelectedTopicId(null);
              setTopicRailCollapsed(true);
              setAnalyzeError(null);
              setAnalysisResult(null);
              setOfficialQError(null);
              setChatInput("");
              setLiveTranscript("");
              setQuestionnaireTranscript([]);
              setViewingTopicId(null);
              setChatMessages(
                promptText
                  ? [{ role: "assistant", text: promptText }]
                  : [{ role: "assistant", text: t("no_new_questions") }]
              );
              setSidebarView("add");
              history.replace("/patient-dashboard");
            }}
            aria-label={t("aria_logo_questionnaire")}
            sx={{
              flexShrink: 0,
              width: 72,
              height: 72,
              border: "none",
              p: 0,
              bgcolor: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              "&:hover": { bgcolor: alpha(theme.logoGreen, 0.1) },
              "&:focus-visible": { outline: `2px solid ${theme.logoGreen}`, outlineOffset: 2 },
            }}
          >
            <Box
              component="img"
              src={siteLogo}
              alt="Healthy Visit logo"
              sx={{
                width: 64,
                height: 64,
                objectFit: "contain",
                display: "block",
                transformOrigin: "center center",
                animation: `${logoWiggle} 2.4s ease-in-out infinite`,
                "@media (prefers-reduced-motion: reduce)": { animation: "none" },
              }}
            />
          </Box>
        </Box>
        {officialQError && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => setOfficialQError(null)}>
            {officialQError}
          </Alert>
        )}
        {officialQuestionQueue.length > 0 && officialQuestionQueue[officialQuestionIndex] ? (
          <Stack component="form" onSubmit={handleOfficialQuestionnaireSubmit} spacing={1}>
            <Typography
              variant="body2"
              sx={{
                color: theme.text,
                lineHeight: 1.45,
                textAlign: isRtl ? "right" : "left",
              }}
              dir={isRtl ? "rtl" : "ltr"}
            >
              {pickQuestionPrompt(officialQuestionQueue[officialQuestionIndex], language)}
            </Typography>
            <TextField
              value={officialQInput}
              onChange={(e) => setOfficialQInput(e.target.value)}
              placeholder={t("type_your_answer")}
              size="small"
              fullWidth
              multiline
              minRows={1}
              maxRows={3}
              disabled={officialQLoading}
              inputProps={{ dir: isRtl ? "rtl" : "ltr" }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={officialQLoading || !officialQInput.trim()}
              sx={{ bgcolor: theme.logoGreen, alignSelf: "flex-start", textTransform: "none" }}
            >
              {officialQLoading ? t("sending") : t("send")}
            </Button>
          </Stack>
        ) : (
          <Typography variant="caption" sx={{ color: theme.textMuted }} dir={isRtl ? "rtl" : "ltr"}>
            {t("no_new_questions")}
          </Typography>
        )}
      </Box>
      <Box sx={{ p: 1.5, pt: 1, pb: 1, flexShrink: 0 }} dir={isRtl ? "rtl" : "ltr"}>
        <DailyCheckinCalendar
          value={checkinDateStr}
          onChange={setCheckinDateStr}
          accentColor={theme.logoGreen}
          backgroundColor={theme.sidebarSelectedBg}
          language={language}
        />
        <Typography variant="caption" sx={{ color: theme.textMuted, mt: 0.5, display: "block" }}>
          {t("selected_label")}: {checkinDateStr}
        </Typography>
        <Box
          sx={{
            mt: 1.25,
            display: "flex",
            justifyContent: isRtl ? "flex-start" : "flex-end",
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => setLanguage(language === "he" ? "en" : "he")}
            aria-label={t("language_label")}
            title={language === "he" ? "Switch to English" : "החלף לעברית"}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              border: `1px solid ${alpha(theme.logoGreen, 0.4)}`,
              borderRadius: 999,
              bgcolor: "#fff",
              cursor: "pointer",
              px: 1.25,
              py: 0.5,
              fontFamily: "Roboto, sans-serif",
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: 0.4,
              color: theme.logoGreen,
              boxShadow: "0 1px 2px rgba(31,45,61,0.08)",
              transition: "background-color 0.18s ease, color 0.18s ease, transform 0.18s ease",
              "&:hover": {
                bgcolor: alpha(theme.logoGreen, 0.1),
                transform: "translateY(-1px)",
              },
              "&:focus-visible": {
                outline: `2px solid ${theme.logoGreen}`,
                outlineOffset: 2,
              },
            }}
          >
            <Translate size={16} weight="bold" />
            <Box component="span" sx={{ lineHeight: 1 }}>
              {language === "he" ? "עב" : "EN"}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <DashboardShell
      user={user}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      onLogout={handleSignOut}
      onProfileClick={() => {
        setSidebarView("profile");
        history.replace("/patient-dashboard?view=profile");
      }}
      profileSelected={sidebarView === "profile"}
      theme={theme}
      labels={{
        myProfile: t("my_profile"),
        logout: t("logout"),
        openSidebar: t("open_sidebar"),
        closeSidebar: t("close_sidebar"),
      }}
      navItems={
        <>
          <ListItemButton
            selected={sidebarView === "dashboard"}
            onClick={() => {
              setSidebarView("dashboard");
              setAddQuestionnaireMode(false);
              setAddQuestionnaireActive(null);
              setViewingTopicId(null);
              history.replace("/patient-dashboard");
            }}
            sx={{ ...sidebarNavSelectedSx, ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}) }}
          >
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <ChartPieSlice size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary={t("dashboard_nav")} />}
          </ListItemButton>
          <ListItemButton
            selected={sidebarView === "add"}
            onClick={() => {
              const currentQ = officialQuestionQueue[officialQuestionIndex] || null;
              const promptText = pickQuestionPrompt(currentQ, language);
              setAddQuestionnaireMode(true);
              setAddQuestionnaireActive(currentQ);
              setSelectedTopicId(null);
              setTopicRailCollapsed(true);
              setAnalyzeError(null);
              setAnalysisResult(null);
              setOfficialQError(null);
              setChatInput("");
              setLiveTranscript("");
              setFormError(null);
              setQuestionnaireTranscript([]);
              setViewingTopicId(null);
              setChatMessages(
                promptText
                  ? [{ role: "assistant", text: promptText }]
                  : [{ role: "assistant", text: t("no_new_questions") }]
              );
              setSidebarView("add");
              history.replace("/patient-dashboard");
            }}
            sx={{ ...sidebarNavSelectedSx, ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}) }}
          >
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <PlusCircle size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary={t("add_nav")} />}
          </ListItemButton>
          <ListItemButton
            selected={sidebarView === "statistics"}
            onClick={() => {
              setSidebarView("statistics");
              history.replace("/patient-dashboard");
            }}
            sx={{ ...sidebarNavSelectedSx, ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}) }}
          >
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <ChartBar size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary={t("statistics_nav")} />}
          </ListItemButton>
          <ListItemButton disabled sx={{ opacity: 0.7, ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}) }}>
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <DeviceMobile size={22} />
            </ListItemIcon>
            {sidebarOpen && (
              <ListItemText
                primary={t("device_nav")}
                secondary={t("device_secondary")}
                primaryTypographyProps={{ fontSize: "0.95rem" }}
                secondaryTypographyProps={{ fontSize: "0.7rem" }}
              />
            )}
          </ListItemButton>
        </>
      }
    >
        {sidebarView === "dashboard" && (
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          width: "100%",
          alignItems: "stretch",
          flex: 1,
          minHeight: 0,
          bgcolor: theme.bg,
          /* lg: lock row to viewport so only the main column scrolls; right panel stays fixed full-height */
          height: { xs: "auto", lg: "100vh" },
          maxHeight: { xs: "none", lg: "100vh" },
          overflow: { xs: "visible", lg: "hidden" },
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflowY: { xs: "auto", lg: "hidden" },
            overflowX: "hidden",
            height: { lg: "100%" },
            display: "flex",
            flexDirection: "column",
          }}
        >
      <Container maxWidth="lg" sx={{ flexShrink: 0, pt: 1.5, pb: 0, px: { xs: 2, sm: 3 } }}>
        {/* Quick stats row with donut charts */}
        <Box sx={{ mb: 1.5 }}>
          <Grid container spacing={1.25}>
            {todayDonutMetrics.map((m) => {
              const Icon = m.Icon;
              const displayValue = formatTodayMetricValue(m.key, m.value);
              const weeklyId = m.chartId;
              const isWeeklySelected = weeklyId != null && weeklyChartMetricId === weeklyId;
              return (
                <Grid item xs={6} sm={4} md={3} key={m.key}>
                  <Card
                    elevation={0}
                    sx={{
                      ...donutRowCardSx,
                      cursor: "pointer",
                      "&:focus-visible": { outline: `2px solid ${m.color}`, outlineOffset: 2 },
                      "&:hover .donut-pop, &:focus-visible .donut-pop": {
                        boxShadow:
                          "0 0 0 1px rgba(31,45,61,0.1), 0 0 12px 1px rgba(31,45,61,0.16), 0 0 22px 3px rgba(31,45,61,0.08)",
                      },
                    }}
                    onClick={() => {
                      if (weeklyId == null) {
                        setWeeklyChartMetricId(null);
                        return;
                      }
                      setWeeklyChartMetricId((prev) => (prev === weeklyId ? null : weeklyId));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (weeklyId == null) {
                          setWeeklyChartMetricId(null);
                          return;
                        }
                        setWeeklyChartMetricId((prev) => (prev === weeklyId ? null : weeklyId));
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isWeeklySelected}
                    aria-label={`${m.label}. Tap to show this metric over three weeks in the chart below.`}
                  >
                    <CardContent sx={donutRowCardContentSx}>
                      <Box
                        className="donut-pop"
                        sx={{
                          width: 98,
                          height: 98,
                          borderRadius: "50%",
                          bgcolor: alpha(m.color, 0.08),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow:
                            "0 0 0 1px rgba(31,45,61,0.06), 0 0 10px 0px rgba(31,45,61,0.12), 0 0 18px 2px rgba(31,45,61,0.06)",
                          transition: "box-shadow 0.2s ease",
                        }}
                      >
                        <DonutChart
                          value={m.value}
                          max={m.max}
                          color={m.color}
                          size={98}
                          strokeWidth={12}
                          trackColor={alpha(m.color, 0.08)}
                          centerIcon={<Icon size={34} weight="duotone" color={m.color} />}
                        />
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 0.15,
                          textAlign: "center",
                          width: "100%",
                        }}
                      >
                        <Typography
                          component="div"
                          sx={{
                            color: m.color,
                            fontSize: "0.8rem",
                            lineHeight: 1.2,
                            fontWeight: 600,
                          }}
                        >
                          {m.label}
                        </Typography>
                        <Typography
                          component="div"
                          sx={{
                            color: "#4A4A4A",
                            fontSize: "0.95rem",
                            lineHeight: 1.25,
                            fontWeight: 600,
                          }}
                        >
                          {displayValue}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Container>

      <Box
        sx={{
          flex: 1,
          minHeight: { xs: 280, lg: 0 },
          display: "flex",
          flexDirection: "column",
          px: { xs: 2, sm: 3 },
          pb: 1.5,
          maxWidth: "lg",
          width: "100%",
          mx: "auto",
          boxSizing: "border-box",
        }}
      >
        <QuestionnairePartsBarChart parts={todayDonutMetrics} theme={theme} />
      </Box>
        </Box>

        {rightSidePanel}
      </Box>
        )}

        {sidebarView === "add" && (
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", lg: "row" },
              width: "100%",
              alignItems: "stretch",
              flex: 1,
              bgcolor: theme.bg,
              /* Fill viewport so flex children (chat vs composer) get a real height budget */
              minHeight: { xs: "100vh", lg: 0 },
              height: { lg: "100vh" },
              maxHeight: { lg: "100vh" },
              overflow: { xs: "visible", lg: "hidden" },
            }}
          >
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                overflowY: { xs: "auto", lg: "hidden" },
                overflowX: "hidden",
                height: { lg: "100%" },
                display: "flex",
                flexDirection: "column",
                alignSelf: "stretch",
              }}
            >
          <Container
            maxWidth={false}
            sx={{
              width: "100%",
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              height: { lg: "100%" },
              /* No top padding so chat/green panel aligns with top of main area */
              pt: 0,
              pb: 2,
              px: { xs: 2, sm: 2.5 },
            }}
          >
            {formError && (
              <Alert severity="error" onClose={() => setFormError(null)} sx={{ mb: 2, mt: 0 }}>{formError}</Alert>
            )}
            {!selectedTopic && !addQuestionnaireMode ? (
              <Card sx={{ ...cardSx, mt: 2 }}>
                <CardContent>
                  <Typography sx={{ color: theme.textMuted }} dir={isRtl ? "rtl" : "ltr"}>
                    {t("select_topic")}
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Grid
                container
                spacing={0}
                sx={{
                  flex: 1,
                  minHeight: 0,
                  mt: 0,
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  /* Full-bleed chat column: undo Container horizontal padding for this block */
                  mx: { xs: -2, sm: -2.5 },
                  width: { xs: "calc(100% + 32px)", sm: "calc(100% + 40px)" },
                  maxWidth: { xs: "calc(100% + 32px)", sm: "calc(100% + 40px)" },
                }}
              >
                <Grid item xs={12} sx={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column", height: "100%" }}>
                  <Card
                    sx={{
                      width: "100%",
                      flex: 1,
                      minHeight: 0,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "none",
                      borderRadius: 0,
                      bgcolor: "transparent",
                    }}
                  >
                    <CardContent
                      sx={{
                        width: "100%",
                        height: "100%",
                        flex: 1,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        py: 0,
                        px: 0,
                        "&:last-child": { pb: 0 },
                      }}
                    >
                      {/* White chat panel above composer; mic row stays on theme.bg */}
                      <Box
                        sx={{
                          position: "relative",
                          flex: "1 1 0",
                          /* lg: flex chain; xs: fill viewport above mic when parent height is content-sized */
                          minHeight: { xs: "calc(100dvh - 200px)", lg: 0 },
                          width: "100%",
                          display: "flex",
                          flexDirection: "column",
                          alignSelf: "stretch",
                          bgcolor: theme.bg,
                          overflow: "hidden",
                        }}
                      >
                        {/* Tiled logos: grey (desaturated) on white */}
                        <Box
                          aria-hidden
                          sx={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 0,
                            pointerEvents: "none",
                            opacity: ADD_ENTRY_CHAT.panelTileOpacity,
                            filter: "grayscale(1)",
                          }}
                        >
                          <svg width="100%" height="100%" style={{ display: "block" }}>
                            <defs>
                              <pattern
                                id={addEntryPatternBrickA}
                                width={ADD_ENTRY_TILE_PX}
                                height={ADD_ENTRY_TILE_PX}
                                patternUnits="userSpaceOnUse"
                              >
                                <image
                                  href={siteLogo}
                                  x={ADD_ENTRY_TILE_LOGO_OFFSET}
                                  y={ADD_ENTRY_TILE_LOGO_OFFSET}
                                  width={ADD_ENTRY_LOGO_IN_TILE_PX}
                                  height={ADD_ENTRY_LOGO_IN_TILE_PX}
                                  preserveAspectRatio="xMidYMid meet"
                                />
                              </pattern>
                              <pattern
                                id={addEntryPatternBrickB}
                                width={ADD_ENTRY_TILE_PX}
                                height={ADD_ENTRY_TILE_PX}
                                patternUnits="userSpaceOnUse"
                                patternTransform={`translate(${ADD_ENTRY_TILE_HALF}, ${ADD_ENTRY_TILE_HALF})`}
                              >
                                <image
                                  href={siteLogo}
                                  x={ADD_ENTRY_TILE_LOGO_OFFSET}
                                  y={ADD_ENTRY_TILE_LOGO_OFFSET}
                                  width={ADD_ENTRY_LOGO_IN_TILE_PX}
                                  height={ADD_ENTRY_LOGO_IN_TILE_PX}
                                  preserveAspectRatio="xMidYMid meet"
                                />
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill={`url(#${addEntryPatternBrickA})`} />
                            <rect width="100%" height="100%" fill={`url(#${addEntryPatternBrickB})`} />
                          </svg>
                        </Box>
                        <Box
                          sx={{
                            position: "relative",
                            zIndex: 1,
                            flex: "1 1 auto",
                            minHeight: 0,
                            overflowY: "auto",
                            p: { xs: 2, sm: 2.5 },
                          }}
                        >
                        <Stack spacing={2}>
                          {viewingTopicId && viewingTopic && (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 1.5,
                                flexWrap: "wrap",
                                px: 0.5,
                                py: 0.5,
                              }}
                            >
                              <Typography
                                sx={{ color: theme.text, fontWeight: 600, fontSize: "0.98rem", textAlign: isRtl ? "right" : "left" }}
                                dir={isRtl ? "rtl" : "ltr"}
                              >
                                {t("viewing_topic_history", t(viewingTopic.labelKey))}
                              </Typography>
                              <Box
                                component="button"
                                type="button"
                                onClick={handleBackToCurrentQuestion}
                                sx={{
                                  border: "none",
                                  bgcolor: viewingTopic.color,
                                  color: "#fff",
                                  px: 1.75,
                                  py: 0.75,
                                  borderRadius: 2,
                                  cursor: "pointer",
                                  fontSize: "0.92rem",
                                  fontWeight: 600,
                                  "&:hover": { bgcolor: alpha(viewingTopic.color, 0.85) },
                                }}
                              >
                                {addQuestionnaireMode ? t("back_to_current_question") : t("back_label")}
                              </Box>
                            </Box>
                          )}
                          {displayedMessages.length === 0 && (
                            <Typography
                              variant="body1"
                              sx={{ color: theme.textMuted, fontSize: "1.05rem", lineHeight: 1.6, textAlign: isRtl ? "right" : "left" }}
                              dir={isRtl ? "rtl" : "ltr"}
                            >
                              {viewingTopicId && viewingTopic
                                ? t("no_session_answers", t(viewingTopic.labelKey).toLowerCase())
                                : addQuestionnaireMode
                                ? t("chat_empty_questionnaire")
                                : t("chat_empty_default", selectedTopic ? t(selectedTopic.labelKey).toLowerCase() : t("topic_nutrition").toLowerCase())}
                            </Typography>
                          )}
                          {displayedMessages.map((m, idx) =>
                            m.role === "assistant" ? (
                              <Box
                                key={`${m.role}-${idx}`}
                                sx={{
                                  display: "flex",
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 1.5,
                                  justifyContent: "flex-start",
                                }}
                              >
                                <Box
                                  sx={{
                                    width: 40,
                                    height: 40,
                                    flexShrink: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Box
                                    component="img"
                                    src={siteLogo}
                                    alt=""
                                    sx={{ width: 40, height: 40, objectFit: "contain", display: "block" }}
                                  />
                                </Box>
                                <Box
                                  sx={{
                                    maxWidth: "min(92%, 640px)",
                                    px: 2,
                                    py: 1.5,
                                    borderRadius: 2,
                                    bgcolor: ADD_ENTRY_CHAT.assistantBubble,
                                    border: ADD_ENTRY_CHAT.assistantBorder,
                                    boxShadow: "0 1px 3px rgba(31,45,61,0.06)",
                                  }}
                                >
                                  <Typography
                                    sx={{ fontSize: "1.05rem", lineHeight: 1.55, color: theme.text, whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: isRtl ? "right" : "left" }}
                                    dir={isRtl ? "rtl" : "ltr"}
                                  >
                                    {m.text}
                                  </Typography>
                                </Box>
                              </Box>
                            ) : (
                              <Box key={`${m.role}-${idx}`} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.4 }}>
                                <Box
                                  sx={{
                                    maxWidth: "min(88%, 560px)",
                                    px: 2,
                                    py: 1.5,
                                    borderRadius: 2,
                                    bgcolor: m.placeholder ? "transparent" : ADD_ENTRY_CHAT.userBubble(theme.primary),
                                    border: m.placeholder ? `1px dashed ${alpha(theme.text, 0.2)}` : ADD_ENTRY_CHAT.userBorder(theme.primary),
                                  }}
                                >
                                  <Typography
                                    sx={{
                                      fontSize: m.placeholder ? "0.92rem" : "1.05rem",
                                      lineHeight: 1.55,
                                      color: m.placeholder ? theme.textMuted : theme.text,
                                      fontStyle: m.placeholder ? "italic" : "normal",
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                      textAlign: isRtl ? "right" : "left",
                                    }}
                                    dir={isRtl ? "rtl" : "ltr"}
                                  >
                                    {m.text}
                                  </Typography>
                                </Box>
                                {m.savedAs && (
                                  <Typography
                                    sx={{
                                      fontSize: "0.78rem",
                                      lineHeight: 1.3,
                                      color: theme.textMuted,
                                      fontStyle: "italic",
                                      px: 1,
                                      maxWidth: "min(88%, 560px)",
                                      textAlign: isRtl ? "right" : "left",
                                    }}
                                    dir={isRtl ? "rtl" : "ltr"}
                                  >
                                    {t("saved_as_label")}: {m.savedAs}
                                  </Typography>
                                )}
                              </Box>
                            )
                          )}
                          {!viewingTopicId && liveTranscript && (
                            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                              <Box
                                sx={{
                                  maxWidth: "min(88%, 560px)",
                                  px: 2,
                                  py: 1.25,
                                  borderRadius: 2,
                                  bgcolor: ADD_ENTRY_CHAT.liveBg,
                                  border: ADD_ENTRY_CHAT.liveBorder,
                                }}
                              >
                                <Typography
                                  sx={{ fontSize: "1rem", color: theme.textMuted, textAlign: isRtl ? "right" : "left" }}
                                  dir={isRtl ? "rtl" : "ltr"}
                                >
                                  {t("listening_label")}: {liveTranscript}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        </Stack>
                        </Box>
                      </Box>

                      {analyzeError && !viewingTopicId && (
                        <Alert severity="error" sx={{ mx: 2, mt: 1, mb: 0, flexShrink: 0 }}>
                          {analyzeError}
                        </Alert>
                      )}

                      {!viewingTopicId &&
                        addQuestionnaireMode &&
                        officialQuestionQueue.length > 0 &&
                        !officialSessionSkippedToday &&
                        addQuestionnaireActive?.question_id != null && (
                          <Box
                            sx={{
                              flexShrink: 0,
                              px: { xs: 2, sm: 2.5 },
                              pt: 1,
                              display: "flex",
                              justifyContent: isRtl ? "flex-start" : "flex-end",
                            }}
                          >
                            <Button
                              type="button"
                              variant="text"
                              size="small"
                              disabled={declineDailySubmitting || isAnalyzing}
                              onClick={handleNotTodaySkipQuestion}
                              sx={{ color: theme.textMuted, textTransform: "none", fontWeight: 600 }}
                            >
                              {declineDailySubmitting ? t("sending") : t("not_today_button")}
                            </Button>
                          </Box>
                        )}

                      {!viewingTopicId && (
                      <Box
                        component="form"
                        onSubmit={addQuestionnaireMode ? handleAddEntryQuestionnaireSubmit : handleAnalyzeTopic}
                        sx={{
                          flexShrink: 0,
                          pt: 2,
                          pb: 2,
                          px: { xs: 2, sm: 2.5 },
                          bgcolor: theme.bg,
                          display: "flex",
                          gap: 1.5,
                          alignItems: "center",
                        }}
                      >
                        <IconButton
                          size="large"
                          onClick={handleMicToggle}
                          disabled={
                            !speechRecognitionSupported ||
                            (addQuestionnaireMode &&
                              (!addQuestionnaireActive || officialSessionSkippedToday || officialDailyBatchComplete))
                          }
                          sx={{
                            width: 52,
                            height: 52,
                            bgcolor: isListening ? alpha(theme.danger, 0.18) : "#f8fafc",
                            border: "1px solid",
                            borderColor: isListening ? alpha(theme.danger, 0.55) : "#e2e8f0",
                            color: isListening ? theme.danger : "rgba(31, 45, 61, 0.65)",
                            "&:hover": {
                              bgcolor: isListening ? alpha(theme.danger, 0.26) : "#f1f5f9",
                            },
                          }}
                          title={speechRecognitionSupported ? t("aria_mic_supported") : t("aria_mic_unsupported")}
                        >
                          <Microphone size={28} weight="duotone" />
                        </IconButton>
                        <TextField
                          fullWidth
                          size="medium"
                          disabled={
                            addQuestionnaireMode &&
                            (!addQuestionnaireActive ||
                              officialSessionSkippedToday ||
                              officialDailyBatchComplete)
                          }
                          placeholder={
                            addQuestionnaireMode
                              ? t("chat_input_questionnaire")
                              : t("chat_input_default", selectedTopic ? t(selectedTopic.labelKey).toLowerCase() : t("topic_nutrition").toLowerCase())
                          }
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          inputProps={{ dir: isRtl ? "rtl" : "ltr" }}
                          sx={{
                            "& .MuiOutlinedInput-root": {
                              borderRadius: 2.5,
                              bgcolor: "#fff",
                              minHeight: 52,
                              fontSize: "1.05rem",
                              py: 0.5,
                            },
                            "& .MuiOutlinedInput-input": {
                              py: 1.25,
                            },
                          }}
                        />
                        <IconButton
                          type="submit"
                          size="large"
                          disabled={
                            isAnalyzing ||
                            !chatInput.trim() ||
                            (addQuestionnaireMode &&
                              (!addQuestionnaireActive ||
                                officialSessionSkippedToday ||
                                officialDailyBatchComplete))
                          }
                          sx={{ width: 52, height: 52 }}
                        >
                          <PaperPlaneTilt size={28} weight="duotone" />
                        </IconButton>
                      </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Container>
            </Box>
            <Box
              onMouseEnter={() => setTopicRailHover(true)}
              onMouseLeave={() => setTopicRailHover(false)}
              sx={{
                width: { xs: "100%", lg: topicRailNarrow ? 76 : 280 },
                minWidth: { xs: "100%", lg: topicRailNarrow ? 76 : 280 },
                maxWidth: { xs: "100%", lg: topicRailNarrow ? 76 : 280 },
                borderLeft: { lg: theme.border },
                borderTop: { xs: theme.border, lg: "none" },
                bgcolor: "transparent",
                p: 0,
                minHeight: { xs: "auto", lg: 0 },
                height: { lg: "100%" },
                maxHeight: { lg: "100%" },
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
                transition: {
                  xs: "none",
                  lg: "width 0.38s ease-in-out, min-width 0.38s ease-in-out, max-width 0.38s ease-in-out",
                },
                boxShadow: { lg: "inset -8px 0 14px -10px rgba(31,45,61,0.28)" },
                position: "relative",
                zIndex: 1,
              }}
            >
              <Stack spacing={0} sx={{ width: "100%", minHeight: { lg: "100%" }, flex: { lg: 1 } }}>
                {(() => {
                  const activeQuestionTopicId = addQuestionnaireMode
                    ? questionTopicId(addQuestionnaireActive)
                    : null;
                  // While reviewing a topic mid-questionnaire, highlight the
                  // topic the patient picked; otherwise highlight the topic
                  // that owns the current live question (or the manually
                  // selected topic in free-chat mode).
                  const highlightTopicId = viewingTopicId
                    ?? (addQuestionnaireMode ? activeQuestionTopicId : selectedTopicId);
                  return ADD_ENTRY_TOPICS.map((topic) => {
                  const Icon = topic.Icon;
                  const selected = highlightTopicId === topic.id;
                  const accent = topic.color;
                  return (
                    <Card
                      key={topic.id}
                      onClick={() => handleTopicSelect(topic)}
                      sx={{
                        width: "100%",
                        flex: { lg: 1 },
                        cursor: "pointer",
                        borderRadius: 0,
                        border: "1px solid transparent",
                        boxShadow: "none",
                        bgcolor: selected ? alpha(accent, 0.34) : alpha(accent, 0.08),
                        "&:hover": {
                          bgcolor: selected ? alpha(accent, 0.4) : alpha(accent, 0.16),
                        },
                      }}
                    >
                      <CardContent
                        sx={{
                          py: topicRailNarrow ? 1.2 : 1.5,
                          "&:last-child": { pb: topicRailNarrow ? 1.2 : 1.5 },
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: topicRailNarrow ? "center" : "flex-start",
                          gap: topicRailNarrow ? 0 : 1,
                        }}
                      >
                        <Icon size={topicRailNarrow ? 26 : 24} color={accent} weight="duotone" />
                        {!topicRailNarrow && (
                          <Typography
                            sx={{ color: selected ? accent : theme.text, fontWeight: selected ? 700 : 500, fontSize: "1rem", lineHeight: 1.25, textAlign: isRtl ? "right" : "left" }}
                            dir={isRtl ? "rtl" : "ltr"}
                          >
                            {t(topic.labelKey)}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  );
                });
                })()}
              </Stack>
            </Box>
            {rightSidePanel}
          </Box>
        )}

        {sidebarView === "statistics" && (
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <Typography variant="h5" sx={{ mb: 1, color: theme.text }}>Statistics</Typography>
            <Typography variant="body2" sx={{ color: theme.textMuted, mb: 3 }}>
              Precise daily metrics and three-week breakdown with graphs.
            </Typography>

            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.text, mb: 1.5 }}>Precise daily info (last 21 days)</Typography>
            <Box sx={{ overflowX: "auto", mb: 4 }}>
              <Box
                component="table"
                sx={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.8rem",
                  "& th, & td": { borderBottom: theme.border, py: 1, px: 1.5, textAlign: "left" },
                  "& th": { color: theme.textMuted, fontWeight: 600 },
                  "& td": { color: theme.text },
                }}
              >
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Steps</th>
                    <th>Sleep</th>
                    <th>Sleep Q.</th>
                    <th>Active m.</th>
                    <th>Nutrition</th>
                    <th>Alcohol</th>
                    <th>Stress</th>
                    <th>Social</th>
                    <th>Cig.</th>
                    <th>Mood</th>
                    <th>Work</th>
                  </tr>
                </thead>
                <tbody>
                  {[...last21].reverse().map((row) => (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td>{row.steps ?? "—"}</td>
                      <td>{row.sleep != null ? row.sleep + " h" : "—"}</td>
                      <td>{row.sleep_quality ?? "—"}</td>
                      <td>{row.active_minutes ?? "—"}</td>
                      <td>{row.nutrition_score ?? "—"}</td>
                      <td>{row.alcohol_units ?? "—"}</td>
                      <td>{row.stress_score ?? "—"}</td>
                      <td>{row.social_support_score ?? "—"}</td>
                      <td>{row.cigarettes_per_day ?? "—"}</td>
                      <td>{row.mood_score ?? "—"}</td>
                      <td>{row.work_satisfaction ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>

            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.text, mb: 2 }}>Three weeks — graphs and 7 days per week</Typography>
            <Grid container spacing={3}>
              {[
                { label: "Week 1", data: w1, days: week1 },
                { label: "Week 2", data: w2, days: week2 },
                { label: "Week 3", data: w3, days: week3 },
              ].map(({ label, data, days }) => (
                <Grid item xs={12} md={4} key={label}>
                  <Card sx={cardSx}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={cardTitleSx}>{label}</Typography>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, flexWrap: "wrap", mb: 2 }}>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                          <DonutChart value={data.steps} max={10000} color={theme.metric.steps} size={56} strokeWidth={6} centerLabel={formatNumber(data.steps)} />
                          <Typography variant="caption" sx={{ color: theme.textMuted }}>Steps</Typography>
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                          <DonutChart value={data.sleep} max={8} color={theme.metric.sleep} size={56} strokeWidth={6} centerLabel={formatNumber(data.sleep)} />
                          <Typography variant="caption" sx={{ color: theme.textMuted }}>Sleep</Typography>
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                          <DonutChart value={data.nutrition_score} max={100} color={theme.metric.nutrition} size={56} strokeWidth={6} centerLabel={formatNumber(data.nutrition_score)} />
                          <Typography variant="caption" sx={{ color: theme.textMuted }}>Nutrition</Typography>
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                          <DonutChart value={data.mood_score} max={10} color={theme.metric.mood} size={56} strokeWidth={6} centerLabel={formatNumber(data.mood_score)} />
                          <Typography variant="caption" sx={{ color: theme.textMuted }}>Mood</Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ color: theme.textMuted, display: "block", mb: 1 }}>7 days</Typography>
                      <Stack spacing={0.5}>
                        {days.map((day, i) => (
                          <Box key={day.id || i} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.5, borderBottom: "1px solid", borderColor: "divider" }}>
                            <Typography variant="body2" sx={{ color: theme.text }}>{day.date}</Typography>
                            <Typography variant="body2" sx={{ color: theme.textMuted }}>
                              S: {day.steps ?? "—"} · Sl: {day.sleep ?? "—"} h · N: {day.nutrition_score ?? "—"} · M: {day.mood_score ?? "—"}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        )}

        {sidebarView === "manage" && (
          <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, color: theme.text }}>Manage entries (edit / delete)</Typography>
            <Typography variant="body2" sx={{ color: theme.textMuted, mb: 2 }}>
              Entries from the last 21 days. Edit inline or delete.
            </Typography>
            {metrics.length === 0 ? (
              <Typography sx={{ color: theme.textMuted }}>No entries yet. Add one from the sidebar.</Typography>
            ) : (
              <Stack spacing={1}>
                {[...metrics].reverse().slice(0, 21).map((row) => (
                  <Card key={row.id} sx={cardSx}>
                    <CardContent sx={{ py: 1.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: theme.text }}>
                          {row.date} — Steps: {row.steps ?? "—"} · Sleep: {row.sleep ?? "—"} h · Mood: {row.mood_score ?? "—"}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <IconButton size="small" onClick={() => setEditingId(editingId === row.id ? null : row.id)} sx={{ color: theme.primary }} title="Edit">
                            <PencilSimple size={18} />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteMetric(row.id)} sx={{ color: "#c62828" }} title="Delete">
                            <Trash size={18} />
                          </IconButton>
                        </Box>
                      </Box>
                      {editingId === row.id && (
                        <Box
                          component="form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const fd = e.target;
                            const intFields = ["steps", "sleep", "sleep_quality", "active_minutes"];
                            const num = (name) => {
                              const v = fd[name]?.value;
                              if (v === "" || v == null) return undefined;
                              const n = intFields.includes(name) ? parseInt(v, 10) : parseFloat(v);
                              return Number.isNaN(n) ? undefined : n;
                            };
                            const updates = {};
                            if (fd.date?.value) updates.date = fd.date.value;
                            ["steps", "sleep", "sleep_quality", "active_minutes", "nutrition_score", "alcohol_units", "stress_score", "social_support_score", "cigarettes_per_day", "mood_score", "work_satisfaction", "score"].forEach((name) => {
                              const val = num(name);
                              if (val !== undefined) updates[name] = val;
                            });
                            if (fd.is_smoking) updates.is_smoking = fd.is_smoking.checked;
                            handleUpdateMetric(row.id, updates);
                          }}
                          sx={{ mt: 2 }}
                        >
                          <Grid container spacing={2}>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="date" label="Date" type="date" defaultValue={row.date} size="small" fullWidth InputLabelProps={{ shrink: true }} />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="steps" label="Steps" type="number" defaultValue={row.steps} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="sleep" label="Sleep (h)" type="number" defaultValue={row.sleep} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="sleep_quality" label="Sleep quality" type="number" defaultValue={row.sleep_quality} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="active_minutes" label="Active min" type="number" defaultValue={row.active_minutes} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="nutrition_score" label="Nutrition" type="number" defaultValue={row.nutrition_score} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="alcohol_units" label="Alcohol units" type="number" defaultValue={row.alcohol_units} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="stress_score" label="Stress" type="number" defaultValue={row.stress_score} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="social_support_score" label="Social support" type="number" defaultValue={row.social_support_score} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="cigarettes_per_day" label="Cigarettes/day" type="number" defaultValue={row.cigarettes_per_day} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="mood_score" label="Mood" type="number" defaultValue={row.mood_score} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="work_satisfaction" label="Work satisfaction" type="number" defaultValue={row.work_satisfaction} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={6} sm={4} md={3}>
                              <TextField name="score" label="Overall score" type="number" defaultValue={row.score} size="small" fullWidth />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Box sx={{ display: "flex", alignItems: "center", height: "100%", minHeight: 40 }}>
                                <input type="checkbox" name="is_smoking" id={`is_smoking_${row.id}`} defaultChecked={row.is_smoking === true} style={{ marginRight: 8 }} />
                                <label htmlFor={`is_smoking_${row.id}`} style={{ fontSize: 14, color: theme.textMuted }}>Smoking</label>
                              </Box>
                            </Grid>
                          </Grid>
                          <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                            <Button type="submit" size="small" variant="contained" sx={{ bgcolor: theme.primary }}>Save</Button>
                            <Button type="button" size="small" onClick={() => setEditingId(null)}>Cancel</Button>
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Container>
        )}
        {sidebarView === "profile" && (
          <ProfileFormContent embedded accentPrimary={theme.logoGreen} />
        )}
    </DashboardShell>
  );
}