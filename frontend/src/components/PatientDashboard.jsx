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
  Smiley,
  Microphone,
  PaperPlaneTilt,
  UsersThree,
  ChatCircle,
  IdentificationCard,
  HeartStraight,
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
  /** Same as right panel — selected sidebar item */
  sidebarSelectedBg: "#f0fdf4",
  sidebarSelectedHoverBg: "#ecfdf5",
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
    bgcolor: theme.sidebarSelectedBg,
    color: theme.text,
    "&:hover": {
      bgcolor: theme.sidebarSelectedHoverBg,
    },
    "&.Mui-focusVisible": {
      bgcolor: theme.sidebarSelectedHoverBg,
    },
    "& .MuiListItemIcon-root": {
      color: theme.text,
    },
  },
};

const ADD_ENTRY_TOPICS = [
  { id: "family-friends", label: "Family & Friends", Icon: UsersThree },
  { id: "activity", label: "Activity", Icon: Sneaker },
  { id: "nutrition", label: "Nutrition", Icon: ForkKnife },
  { id: "tobacco-toxics", label: "Tobacco & Toxics", Icon: Cigarette },
  { id: "alcohol", label: "Alcohol", Icon: Smiley },
  { id: "sleep-stress-safe-sex", label: "Sleep / Stress / Safe Sex", Icon: MoonStars },
  { id: "type", label: "Type (Behavior)", Icon: Brain },
  { id: "insight", label: "Insight", Icon: Smiley },
  { id: "career", label: "Career", Icon: ChartBar },
];

/** Web Speech API language for the mic. */
const SPEECH_RECOGNITION_LANG = "en-US";

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

/** Eight dashboard tiles, one per questionnaire part (א׳–ח׳). */
function buildQuestionnairePartDonuts(row, theme, profilePct) {
  const pick = (k) =>
    typeof row[k] === "number" && !Number.isNaN(row[k]) ? row[k] : null;
  return [
    {
      key: "profile",
      chartId: "qp_profile",
      label: "Profile",
      value: typeof profilePct === "number" && !Number.isNaN(profilePct) ? profilePct : null,
      max: 100,
      Icon: IdentificationCard,
      color: "#64748b",
    },
    {
      key: "nutrition",
      chartId: "qp_nutrition",
      label: "Nutrition",
      value: pick("qp_nutrition"),
      max: 100,
      Icon: ForkKnife,
      color: theme.metric.nutrition,
    },
    {
      key: "physical_activity",
      chartId: "qp_activity",
      label: "Activity",
      value: pick("qp_activity"),
      max: 100,
      Icon: Sneaker,
      color: theme.metric.steps,
    },
    {
      key: "sleep_domain",
      chartId: "qp_sleep",
      label: "Sleep",
      value: pick("qp_sleep"),
      max: 100,
      Icon: MoonStars,
      color: theme.metric.sleep,
    },
    {
      key: "substances",
      chartId: "qp_substances",
      label: "Substances",
      value: pick("qp_substances"),
      max: 100,
      Icon: Cigarette,
      color: theme.snapshotIcon.smoking,
    },
    {
      key: "mind",
      chartId: "qp_mind",
      label: "Stress & mood",
      value: pick("qp_mind"),
      max: 100,
      Icon: Brain,
      color: theme.metric.mood,
    },
    {
      key: "relationships",
      chartId: "qp_relationships",
      label: "Relationships",
      value: pick("qp_relationships"),
      max: 100,
      Icon: HeartStraight,
      color: "#0d9488",
    },
    {
      key: "motivation",
      chartId: "qp_motivation",
      label: "Motivation",
      value: pick("qp_motivation"),
      max: 100,
      Icon: ChartBar,
      color: theme.logoGreen,
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
                    bgcolor: alpha(color, 0.45),
                    border: "none",
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    position: "relative",
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
  const [checkinDateStr, setCheckinDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  /** null = all metrics on weekly chart; otherwise matches WeeklyMetricCircles ids (activity, sleep, …) */
  const [weeklyChartMetricId, setWeeklyChartMetricId] = useState(null);
  /** Official questionnaire (daily drip) */
  const [officialProgress, setOfficialProgress] = useState(null);
  const [officialQuestionQueue, setOfficialQuestionQueue] = useState([]);
  const [officialQuestionIndex, setOfficialQuestionIndex] = useState(0);
  const [officialQInput, setOfficialQInput] = useState("");
  const [officialQLoading, setOfficialQLoading] = useState(false);
  const [officialQError, setOfficialQError] = useState(null);

  /** Stable unique SVG pattern ids (React 17 has no useId) */
  const addEntryWallpaperKey = useMemo(() => `w${Math.random().toString(36).slice(2, 11)}`, []);
  const addEntryPatternBrickA = `chat-wall-a-${addEntryWallpaperKey}`;
  const addEntryPatternBrickB = `chat-wall-b-${addEntryWallpaperKey}`;

  /** First visit to Add entry: default to Family & Friends and show chat (topic rail collapses like a manual pick). */
  useLayoutEffect(() => {
    if (sidebarView !== "add" || selectedTopicId != null) return;
    setSelectedTopicId(ADD_ENTRY_TOPICS[0].id);
    setTopicRailCollapsed(true);
  }, [sidebarView, selectedTopicId]);

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

  const loadOfficialQuestionnaire = useCallback(() => {
    if (patientId == null) return;
    const chatLang =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("patient_chat_language") || "he"
        : "he";
    api
      .get("/official-questionnaire/progress", { params: { patient_id: patientId } })
      .then((r) => setOfficialProgress(r.data))
      .catch(() => setOfficialProgress(null));
    api
      .get("/official-questionnaire/daily", {
        params: { patient_id: patientId, language: chatLang },
      })
      .then((r) => {
        const qs = r.data.questions || [];
        setOfficialQuestionQueue(qs);
        setOfficialQuestionIndex(0);
      })
      .catch(() => {
        setOfficialQuestionQueue([]);
        setOfficialQuestionIndex(0);
      });
  }, [patientId]);

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
    if (sidebarView !== "dashboard" || patientId == null) return;
    loadOfficialQuestionnaire();
  }, [sidebarView, patientId, loadOfficialQuestionnaire]);

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
    return buildQuestionnairePartDonuts(today, theme, profilePct);
  }, [today, profilePct]);

  const selectedTopic = useMemo(
    () => ADD_ENTRY_TOPICS.find((t) => t.id === selectedTopicId) || null,
    [selectedTopicId]
  );

  const speechRecognitionSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (!speechRecognitionSupported) return undefined;
    const SpeechRecognitionImpl =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognitionImpl();
    rec.lang = SPEECH_RECOGNITION_LANG;
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
  }, [speechRecognitionSupported]);

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
        <Typography variant="h6" sx={{ color: theme.textMuted }}>
          Please sign in to view your dashboard.
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
  const donutRowCardSx = { bgcolor: "transparent", boxShadow: "none", mb: 0 };
  /** Stacked: donut on top, label + value in a row underneath (matches weekly metric circle tint) */
  const donutRowCardContentSx = {
    py: 1,
    px: 0.5,
    bgcolor: "transparent",
    "&:last-child": { pb: 1 },
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 0.75,
  };
  const addTopicPalette = [
    theme.metric.nutrition,
    theme.metric.steps,
    theme.metric.sleep,
    theme.snapshotIcon.smoking,
    theme.metric.mood,
    theme.snapshotIcon.stressSocial,
    theme.metric.steps,
    theme.metric.sleep,
    theme.metric.nutrition,
  ];
  const handleTopicSelect = (topicId) => {
    if (recognitionRef.current && (recognitionActiveRef.current || recognitionStartingRef.current)) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn("Speech recognition stop failed", e);
      }
    }
    setSelectedTopicId(topicId);
    setChatMessages([]);
    setChatInput("");
    setLiveTranscript("");
    setAnalyzeError(null);
    setAnalysisResult(null);
    setTopicRailCollapsed(true);
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

  const handleAnalyzeTopic = (e) => {
    e?.preventDefault();
    const text = (chatInput || "").trim();
    if (!text || !selectedTopic) return;
    setAnalyzeError(null);
    setIsAnalyzing(true);
    setAnalysisResult(null);
    const userMessage = { role: "user", text };
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    api
      .post(`/analyze/${selectedTopic.id}`, {
        patient_id: patientId,
        date: formDate,
        text,
      })
      .then((res) => {
        const result = res.data || {};
        setAnalysisResult(result);
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "Structured data extracted. Review the summary and confirm to save.",
          },
        ]);
      })
      .catch((err) => {
        setAnalyzeError(err.response?.data?.detail || err.message || "Failed to analyze message");
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
      .catch((err) => setFormError(err.response?.data?.detail || err.message || "Failed to save entry"))
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
        setOfficialQError(err.response?.data?.detail || err.message || "Failed to save answer");
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
      <Box sx={{ p: 1.5, pb: 1, flexShrink: 0, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: theme.text, mb: 0.25 }}>
              Daily questions
            </Typography>
            {officialProgress != null && (
              <Typography variant="caption" sx={{ color: theme.textMuted, display: "block" }}>
                Progress: {officialProgress.answered_count}/{officialProgress.total_primary}
              </Typography>
            )}
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => {
              setSidebarView("add");
              history.replace("/patient-dashboard");
            }}
            aria-label="Go to add entry page"
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
            <Typography variant="body2" sx={{ color: theme.text, lineHeight: 1.45 }}>
              {officialQuestionQueue[officialQuestionIndex].conversational_prompt ||
                officialQuestionQueue[officialQuestionIndex].hebrew}
            </Typography>
            {officialQuestionQueue[officialQuestionIndex].options?.length ? (
              <Typography variant="caption" sx={{ color: theme.textMuted, display: "block" }}>
                {officialQuestionQueue[officialQuestionIndex].options.join(" · ")}
              </Typography>
            ) : null}
            <TextField
              value={officialQInput}
              onChange={(e) => setOfficialQInput(e.target.value)}
              placeholder="Type your answer"
              size="small"
              fullWidth
              multiline
              minRows={1}
              maxRows={3}
              disabled={officialQLoading}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={officialQLoading || !officialQInput.trim()}
              sx={{ bgcolor: theme.logoGreen, alignSelf: "flex-start", textTransform: "none" }}
            >
              {officialQLoading ? "Sending…" : "Send"}
            </Button>
          </Stack>
        ) : (
          <Typography variant="caption" sx={{ color: theme.textMuted }}>
            No new questions right now — we'll bring a few more in the next days.
          </Typography>
        )}
      </Box>
      <Box sx={{ p: 1.5, pt: 1, pb: 1, flexShrink: 0 }}>
        <DailyCheckinCalendar
          value={checkinDateStr}
          onChange={setCheckinDateStr}
          accentColor={theme.logoGreen}
          backgroundColor={theme.sidebarSelectedBg}
        />
        <Typography variant="caption" sx={{ color: theme.textMuted, mt: 0.5, display: "block" }}>
          Selected: {checkinDateStr}
        </Typography>
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
      navItems={
        <>
          <ListItemButton
            selected={sidebarView === "dashboard"}
            onClick={() => {
              setSidebarView("dashboard");
              history.replace("/patient-dashboard");
            }}
            sx={{ ...sidebarNavSelectedSx, ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}) }}
          >
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <ChartPieSlice size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary="Dashboard" />}
          </ListItemButton>
          <ListItemButton
            selected={sidebarView === "add"}
            onClick={() => {
              setSidebarView("add");
              setFormError(null);
              history.replace("/patient-dashboard");
            }}
            sx={{ ...sidebarNavSelectedSx, ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}) }}
          >
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <PlusCircle size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary="Add daily metrics" />}
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
            {sidebarOpen && <ListItemText primary="Statistics" />}
          </ListItemButton>
          <ListItemButton
            disabled={patientId == null}
            onClick={() => {
              if (patientId == null) return;
              localStorage.setItem("onboarding_patient_id", String(patientId));
              localStorage.removeItem("onboarding_language_choice");
              history.push("/onboarding");
            }}
            sx={{ ...sidebarNavSelectedSx, ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}) }}
          >
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <ChatCircle size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary="Onboarding" />}
          </ListItemButton>
          <ListItemButton disabled sx={{ opacity: 0.7, ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}) }}>
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <DeviceMobile size={22} />
            </ListItemIcon>
            {sidebarOpen && (
              <ListItemText
                primary="Device"
                secondary="Demo – not active. In production, sleep & steps sync from your wearable."
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
          <Typography
            variant="subtitle2"
            sx={{
              display: "block",
              color: theme.text,
              textTransform: "uppercase",
              letterSpacing: 1,
              fontSize: "0.75rem",
              fontWeight: 600,
              mb: 1,
              mt: 0,
            }}
          >
            Today · 8 questionnaire parts (0–100)
          </Typography>
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
                        sx={{
                          width: 104,
                          height: 104,
                          borderRadius: "50%",
                          bgcolor: alpha(m.color, 0.08),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
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
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.text, mb: 0.25, flexShrink: 0 }}>
          Current grade — 8 questionnaire parts (0–100)
        </Typography>
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
            {!selectedTopic ? (
              <Card sx={{ ...cardSx, mt: 2 }}>
                <CardContent>
                  <Typography sx={{ color: theme.textMuted }}>
                    Select a FANTASTIC topic from the right sidebar to start your conversational entry.
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
                          {chatMessages.length === 0 && (
                            <Typography variant="body1" sx={{ color: theme.textMuted, fontSize: "1.05rem", lineHeight: 1.6 }}>
                              Speak or type freely. We will extract structured details for {selectedTopic.label.toLowerCase()}.
                            </Typography>
                          )}
                          {chatMessages.map((m, idx) =>
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
                                  <Typography sx={{ fontSize: "1.05rem", lineHeight: 1.55, color: theme.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                    {m.text}
                                  </Typography>
                                </Box>
                              </Box>
                            ) : (
                              <Box key={`${m.role}-${idx}`} sx={{ display: "flex", justifyContent: "flex-end" }}>
                                <Box
                                  sx={{
                                    maxWidth: "min(88%, 560px)",
                                    px: 2,
                                    py: 1.5,
                                    borderRadius: 2,
                                    bgcolor: ADD_ENTRY_CHAT.userBubble(theme.primary),
                                    border: ADD_ENTRY_CHAT.userBorder(theme.primary),
                                  }}
                                >
                                  <Typography sx={{ fontSize: "1.05rem", lineHeight: 1.55, color: theme.text, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                    {m.text}
                                  </Typography>
                                </Box>
                              </Box>
                            )
                          )}
                          {liveTranscript && (
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
                                <Typography sx={{ fontSize: "1rem", color: theme.textMuted }}>
                                  Listening: {liveTranscript}
                                </Typography>
                              </Box>
                            </Box>
                          )}
                        </Stack>
                        </Box>
                      </Box>

                      {analyzeError && (
                        <Alert severity="error" sx={{ mx: 2, mt: 1, mb: 0, flexShrink: 0 }}>
                          {analyzeError}
                        </Alert>
                      )}

                      <Box
                        component="form"
                        onSubmit={handleAnalyzeTopic}
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
                          disabled={!speechRecognitionSupported}
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
                          title={speechRecognitionSupported ? "Toggle microphone" : "Speech recognition is not supported in this browser"}
                        >
                          <Microphone size={28} weight="duotone" />
                        </IconButton>
                        <TextField
                          fullWidth
                          size="medium"
                          placeholder={`Share your ${selectedTopic.label.toLowerCase()} details...`}
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
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
                          disabled={isAnalyzing || !chatInput.trim()}
                          sx={{ width: 52, height: 52 }}
                        >
                          <PaperPlaneTilt size={28} weight="duotone" />
                        </IconButton>
                      </Box>
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
                {ADD_ENTRY_TOPICS.map((topic) => {
                  const Icon = topic.Icon;
                  const selected = selectedTopicId === topic.id;
                  const accent = addTopicPalette[ADD_ENTRY_TOPICS.indexOf(topic) % addTopicPalette.length];
                  return (
                    <Card
                      key={topic.id}
                      onClick={() => handleTopicSelect(topic.id)}
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
                        <Icon size={topicRailNarrow ? 26 : 24} color={accent} />
                        {!topicRailNarrow && (
                          <Typography sx={{ color: selected ? accent : theme.text, fontWeight: selected ? 700 : 500, fontSize: "1rem", lineHeight: 1.25 }}>
                            {topic.label}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
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