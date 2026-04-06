import React, { useEffect, useMemo, useState } from "react";
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
  Divider,
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
} from "@phosphor-icons/react";
import DailyCheckinCalendar from "./DailyCheckinCalendar";
import WeeklyMetricCircles from "./WeeklyMetricCircles";
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

/** Demo values for the six “Today” donut rings when `today` has no value for that field */
const DEMO_DONUT_TODAY = {
  steps: 6840,
  sleep: 6.5,
  nutrition: 78,
  cigarettes_per_day: 1,
  stress_score: 4,
  mood: 7,
};

/** Human-readable Today donut stat line. Nutrition `78/100`; stress and mood `7/10`. */
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
      return `${Math.round(value)}/100`;
    case "smoking":
      if (value === 0) return "0 cigarettes";
      if (value === 1) return "1 cigarette";
      return `${value % 1 === 0 ? value : value.toFixed(1)} cigarettes`;
    case "stress":
    case "mood": {
      const s = value % 1 === 0 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
      return `${s}/10`;
    }
    default:
      return String(value);
  }
}

/** Today donut `key` → WeeklyMetricCircles metric id (`steps` → `activity`). */
function todayKeyToWeeklyMetricId(key) {
  if (key === "steps") return "activity";
  return key;
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
  const [formValues, setFormValues] = useState({ steps: "", sleep: "", sleep_quality: "", active_minutes: "", nutrition_score: "", stress_score: "", mood_score: "" });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [checkinDateStr, setCheckinDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  /** null = all metrics on weekly chart; otherwise matches WeeklyMetricCircles ids (activity, sleep, …) */
  const [weeklyChartMetricId, setWeeklyChartMetricId] = useState(null);

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

  const refetchMetrics = () => {
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
  };

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
      .finally(() => setLoading(false));
  }, [authChecked, patientId]);

  const { today, week1, week2, week3, last21 } = useMemo(() => {
    if (patientId == null) {
      return { today: null, week1: [], week2: [], week3: [], last21: [] };
    }
    if (!metrics.length) {
      const placeholder = emptyTodayRow(patientId);
      return {
        today: placeholder,
        week1: [],
        week2: [],
        week3: [],
        last21: [placeholder],
      };
    }
    const last21 = metrics.slice(-21);
    const today = last21[last21.length - 1] || null;
    const week1 = last21.slice(0, 7);
    const week2 = last21.slice(7, 14);
    const week3 = last21.slice(14, 21);
    return { today, week1, week2, week3, last21 };
  }, [metrics, patientId]);

  /** Same six metrics + icons as WeeklyMetricCircles — values from `today` row or demo fallbacks */
  const todayDonutMetrics = useMemo(() => {
    if (!today) return [];
    const d = DEMO_DONUT_TODAY;
    const pick = (field, demoVal) =>
      typeof today[field] === "number" && !Number.isNaN(today[field]) ? today[field] : demoVal;
    return [
      {
        key: "steps",
        label: "Activity",
        value: pick("steps", d.steps),
        max: 10000,
        Icon: Sneaker,
        color: theme.metric.steps,
      },
      {
        key: "sleep",
        label: "Sleep",
        value: pick("sleep", d.sleep),
        max: 8,
        Icon: MoonStars,
        color: theme.metric.sleep,
      },
      {
        key: "nutrition",
        label: "Nutrition",
        value: pick("nutrition_score", d.nutrition),
        max: 100,
        Icon: ForkKnife,
        color: theme.metric.nutrition,
      },
      {
        key: "smoking",
        label: "Smoking",
        value: pick("cigarettes_per_day", d.cigarettes_per_day),
        max: 20,
        Icon: Cigarette,
        color: theme.snapshotIcon.smoking,
      },
      {
        key: "stress",
        label: "Stress",
        value: pick("stress_score", d.stress_score),
        max: 10,
        Icon: Brain,
        color: theme.snapshotIcon.stressSocial,
      },
      {
        key: "mood",
        label: "Mood",
        value: pick("mood_score", d.mood),
        max: 10,
        Icon: Smiley,
        color: theme.metric.mood,
      },
    ];
  }, [today]);

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
    py: 2,
    px: 0.5,
    bgcolor: "transparent",
    "&:last-child": { pb: 2 },
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 1.25,
  };
  const handleAddMetric = (e) => {
    e?.preventDefault();
    setFormError(null);
    setFormSubmitting(true);
    const payload = {
      patient_id: patientId,
      date: formDate,
      steps: formValues.steps ? parseInt(formValues.steps, 10) : null,
      sleep: formValues.sleep ? parseInt(formValues.sleep, 10) : null,
      sleep_quality: formValues.sleep_quality ? parseInt(formValues.sleep_quality, 10) : null,
      active_minutes: formValues.active_minutes ? parseInt(formValues.active_minutes, 10) : null,
      nutrition_score: formValues.nutrition_score ? parseFloat(formValues.nutrition_score) : null,
      stress_score: formValues.stress_score ? parseFloat(formValues.stress_score) : null,
      mood_score: formValues.mood_score ? parseFloat(formValues.mood_score) : null,
    };
    api
      .post("/metrics", payload)
      .then(() => {
        refetchMetrics();
        setFormValues({ steps: "", sleep: "", sleep_quality: "", active_minutes: "", nutrition_score: "", stress_score: "", mood_score: "" });
        setSidebarView("dashboard");
      })
      .catch((err) => setFormError(err.response?.data?.detail || err.message || "Failed to add entry"))
      .finally(() => setFormSubmitting(false));
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
            selected={sidebarView === "manage"}
            onClick={() => {
              setSidebarView("manage");
              history.replace("/patient-dashboard");
            }}
            sx={{ ...sidebarNavSelectedSx, ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}) }}
          >
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <PencilSimple size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary="Manage entries" />}
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
      <Container maxWidth="lg" sx={{ flexShrink: 0, pt: 2, pb: 0, px: { xs: 2, sm: 3 } }}>
        {/* Quick stats row with donut charts */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle2"
            sx={{
              display: "block",
              color: theme.text,
              textTransform: "uppercase",
              letterSpacing: 1,
              fontSize: "0.75rem",
              fontWeight: 600,
              mb: 1.5,
              mt: 0,
            }}
          >
            Today
          </Typography>
          <Grid container spacing={2}>
            {todayDonutMetrics.map((m) => {
              const Icon = m.Icon;
              const displayValue = formatTodayMetricValue(m.key, m.value);
              const weeklyId = todayKeyToWeeklyMetricId(m.key);
              const isWeeklySelected = weeklyChartMetricId === weeklyId;
              return (
                <Grid item xs={6} sm={4} md={2} key={m.key}>
                  <Card
                    elevation={0}
                    sx={{
                      ...donutRowCardSx,
                      cursor: "pointer",
                      "&:focus-visible": { outline: `2px solid ${m.color}`, outlineOffset: 2 },
                    }}
                    onClick={() =>
                      setWeeklyChartMetricId((prev) => (prev === weeklyId ? null : weeklyId))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
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
                          width: 100,
                          height: 100,
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
                          size={96}
                          strokeWidth={14}
                          trackColor={alpha(m.color, 0.08)}
                          centerIcon={<Icon size={30} weight="duotone" color={m.color} />}
                        />
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 0.35,
                          textAlign: "center",
                          width: "100%",
                        }}
                      >
                        <Typography
                          component="div"
                          sx={{
                            color: m.color,
                            fontSize: "0.875rem",
                            lineHeight: 1.3,
                            fontWeight: 600,
                          }}
                        >
                          {m.label}
                        </Typography>
                        <Typography
                          component="div"
                          sx={{
                            color: "#4A4A4A",
                            fontSize: "1.1rem",
                            lineHeight: 1.35,
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
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          px: { xs: 2, sm: 3 },
          pb: 2,
          maxWidth: "lg",
          width: "100%",
          mx: "auto",
          boxSizing: "border-box",
        }}
      >
        <WeeklyMetricCircles
          weeklyRows={last21.slice(-7)}
          last21Rows={last21}
          theme={theme}
          selectedMetricId={weeklyChartMetricId}
          selectedCalendarDate={checkinDateStr}
          onShowAllMetrics={() => setWeeklyChartMetricId(null)}
        />
      </Box>
        </Box>

        <Box
          sx={{
            width: { xs: "100%", lg: 400 },
            maxWidth: { xs: "100%", lg: 400 },
            flexShrink: 0,
            borderLeft: { lg: theme.border },
            borderTop: { xs: theme.border, lg: "none" },
            bgcolor: "#f0fdf4",
            display: "flex",
            flexDirection: "column",
            minHeight: { xs: "min(70vh, 640px)", lg: 0 },
            height: { lg: "100%" },
            maxHeight: { lg: "100%" },
            overflow: "hidden",
            boxShadow: { lg: theme.cardShadow },
          }}
        >
          <Box sx={{ p: 2, pb: 1.5, flexShrink: 0 }}>
            <DailyCheckinCalendar
              value={checkinDateStr}
              onChange={setCheckinDateStr}
              accentColor={theme.logoGreen}
              backgroundColor={theme.sidebarSelectedBg}
            />
            <Typography variant="caption" sx={{ color: theme.textMuted, mt: 1, display: "block" }}>
              Selected: {checkinDateStr}
            </Typography>
          </Box>
          <Divider />
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              bgcolor: "#ecfdf5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: { xs: 1.5, sm: 2 },
            }}
          >
            <Box
              component="img"
              src={siteLogo}
              alt=""
              sx={{
                width: "100%",
                height: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: "block",
                transformOrigin: "center center",
                animation: `${logoWiggle} 2.4s ease-in-out infinite`,
                "@media (prefers-reduced-motion: reduce)": {
                  animation: "none",
                },
              }}
            />
          </Box>
        </Box>
      </Box>
        )}

        {sidebarView === "add" && (
          <Container maxWidth="sm" sx={{ py: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, color: theme.text }}>Add daily metrics</Typography>
            {formError && (
              <Alert severity="error" onClose={() => setFormError(null)} sx={{ mb: 2 }}>{formError}</Alert>
            )}
            <Card sx={cardSx}>
              <CardContent component="form" onSubmit={handleAddMetric}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Steps" type="number" value={formValues.steps} onChange={(e) => setFormValues((v) => ({ ...v, steps: e.target.value }))} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Sleep (hours)" type="number" value={formValues.sleep} onChange={(e) => setFormValues((v) => ({ ...v, sleep: e.target.value }))} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Sleep quality (1–10)" type="number" value={formValues.sleep_quality} onChange={(e) => setFormValues((v) => ({ ...v, sleep_quality: e.target.value }))} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Active minutes" type="number" value={formValues.active_minutes} onChange={(e) => setFormValues((v) => ({ ...v, active_minutes: e.target.value }))} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Nutrition score" type="number" value={formValues.nutrition_score} onChange={(e) => setFormValues((v) => ({ ...v, nutrition_score: e.target.value }))} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Stress score" type="number" value={formValues.stress_score} onChange={(e) => setFormValues((v) => ({ ...v, stress_score: e.target.value }))} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Mood score" type="number" value={formValues.mood_score} onChange={(e) => setFormValues((v) => ({ ...v, mood_score: e.target.value }))} />
                  </Grid>
                  <Grid item xs={12}>
                    <Button type="submit" variant="contained" disabled={formSubmitting} sx={{ bgcolor: theme.primary, "&:hover": { bgcolor: theme.primary } }}>
                      {formSubmitting ? "Saving…" : "Save entry"}
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Container>
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
          <ProfileFormContent embedded accentPrimary={theme.primary} />
        )}
    </DashboardShell>
  );
}