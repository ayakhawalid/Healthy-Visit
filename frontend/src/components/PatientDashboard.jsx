import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Container,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  TextField,
  IconButton,
  Alert,
  Stack,
} from "@mui/material";
import { ChartPieSlice, ChartBar, PlusCircle, PencilSimple, DeviceMobile, SignOut, Trash, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { getUser, logout } from "../service/auth";
import api from "../service/api";
import logo from "../logo.svg";

const SIDEBAR_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 72;

// Dashboard theme + metric colors (from palette: steps=red, sleep=blue, nutrition=green, mood=orange)
const theme = {
  primary: "#1EB7FF",
  success: "#1BB934",
  text: "#1F2D3D",
  textMuted: "#868E96",
  bg: "#F8F9FA",
  cardShadow: "0 1px 2px 0 rgba(31, 45, 61, 0.07)",
  border: "1px solid #DEE2E6",
  logoGreen: "#16a34a",
  metric: {
    steps: "#ED1C24",     // Airframe red
    sleep: "#444D7E",    // blue from palette
    nutrition: "#16a34a", // logo green
    mood: "#F1BB55",     // orange from palette
  },
};

// Donut chart: value vs max (0–1), or multi-segment for breakdown. Optional centerLabel shows text inside.
function DonutChart({ value, max, color, size = 64, strokeWidth = 8, centerLabel }) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = max > 0 && typeof value === "number" ? Math.min(1, Math.max(0, value / max)) : 0;
  const filled = ratio * circumference;
  const gap = circumference - filled;
  const fontSize = Math.max(10, Math.min(size * 0.28, 14));
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#E9ECEF"
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
      {centerLabel != null && centerLabel !== "" && (
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
}

// Multi-segment donut for breakdown (e.g. week 1 / week 2 / week 3)
function DonutChartSegments({ segments, size = 80, strokeWidth = 10 }) {
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const parts = total > 0
    ? segments.map((seg) => {
        const v = seg.value || 0;
        const ratio = v / total;
        const dash = ratio * circumference;
        const el = (
          <circle
            key={seg.label || seg.color}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += dash;
        return el;
      })
    : [
        <circle
          key="empty"
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#E9ECEF"
          strokeWidth={strokeWidth}
          transform={`rotate(-90 ${cx} ${cy})`}
        />,
      ];
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E9ECEF" strokeWidth={strokeWidth} transform={`rotate(-90 ${cx} ${cy})`} />
      {parts}
    </svg>
  );
}

// Dummy data when backend has no metrics yet (last 7 days for demo)
function getDummyMetrics(patientId) {
  const base = new Date();
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = new Date(base);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return {
      id: 9000 + i,
      patient_id: patientId,
      date: dateStr,
      steps: 6000 + i * 400,
      sleep: 6 + (i % 3),
      sleep_quality: 6 + (i % 4),
      active_minutes: 20 + i * 5,
      nutrition_score: 65 + i * 3,
      alcohol_units: i % 3,
      stress_score: 5 + (i % 3),
      social_support_score: 6 + (i % 3),
      cigarettes_per_day: 0,
      is_smoking: false,
      mood_score: 6 + (i % 4),
      work_satisfaction: 6 + (i % 3),
    };
  });
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

export default function PatientDashboard() {
  const [user, setUser] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarView, setSidebarView] = useState("dashboard"); // 'dashboard' | 'add' | 'manage'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formValues, setFormValues] = useState({ steps: "", sleep: "", sleep_quality: "", active_minutes: "", nutrition_score: "", stress_score: "", mood_score: "" });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // 1) Fetch current user
  useEffect(() => {
    getUser()
      .then((u) => {
        setUser(u);
      })
      .catch((err) => {
        console.warn("Failed to get user", err);
        setLoading(false);
      });
  }, []);

  const patientId = user?.id != null ? user.id : 1;

  const refetchMetrics = () => {
    if (!user) return;
    api
      .get("/metrics", { params: { patient_id: patientId } })
      .then((res) => {
        let rows = (res.data || []).map(normalizeRow);
        if (rows.length === 0) {
          rows = getDummyMetrics(patientId).map(normalizeRow);
        }
        rows.sort((a, b) => {
          if (!a.jsDate || !b.jsDate) return 0;
          return a.jsDate.getTime() - b.jsDate.getTime();
        });
        setMetrics(rows);
      })
      .catch((err) => {
        console.warn("Failed to fetch metrics", err);
        setMetrics(getDummyMetrics(patientId).map(normalizeRow));
      });
  };

  // 2) Fetch metrics for this patient when user is known
  useEffect(() => {
    if (!user) return;
    api
      .get("/metrics", { params: { patient_id: patientId } })
      .then((res) => {
        let rows = (res.data || []).map(normalizeRow);
        if (rows.length === 0) {
          rows = getDummyMetrics(patientId).map(normalizeRow);
        }
        rows.sort((a, b) => {
          if (!a.jsDate || !b.jsDate) return 0;
          return a.jsDate.getTime() - b.jsDate.getTime();
        });
        setMetrics(rows);
      })
      .catch((err) => {
        console.warn("Failed to fetch metrics", err);
        setMetrics(getDummyMetrics(patientId).map(normalizeRow));
      })
      .finally(() => setLoading(false));
  }, [user]);

  const { today, week1, week2, week3, last21 } = useMemo(() => {
    if (!metrics.length) {
      return { today: null, week1: [], week2: [], week3: [], last21: [] };
    }
    const last21 = metrics.slice(-21);
    const today = last21[last21.length - 1] || null;
    const week1 = last21.slice(0, 7);
    const week2 = last21.slice(7, 14);
    const week3 = last21.slice(14, 21);
    return { today, week1, week2, week3, last21 };
  }, [metrics]);

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: theme.bg,
          position: "relative",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 10,
          }}
        >
          <Button
            variant="outlined"
            onClick={() => {
              logout();
              window.location.replace("/");
            }}
            sx={{
              borderColor: theme.logoGreen,
              color: theme.logoGreen,
              "&:hover": { borderColor: theme.logoGreen, bgcolor: "rgba(22, 163, 74, 0.08)" },
            }}
          >
            Sign out
          </Button>
        </Box>
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="h6" sx={{ color: theme.textMuted }}>
            Loading dashboard…
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!today) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: theme.bg,
          position: "relative",
        }}
      >
        <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
          <Button
            variant="outlined"
            onClick={() => {
              logout();
              window.location.replace("/");
            }}
            sx={{
              borderColor: theme.logoGreen,
              color: theme.logoGreen,
              "&:hover": { borderColor: theme.logoGreen, bgcolor: "rgba(22, 163, 74, 0.08)" },
            }}
          >
            Sign out
          </Button>
        </Box>
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ color: theme.textMuted }}>
            No tracking data available yet. Once we collect some data, your dashboard
            will appear here.
          </Typography>
        </Box>
      </Box>
    );
  }

  const overall = {
    steps: average(last21, "steps"),
    sleep: average(last21, "sleep"),
    sleep_quality: average(last21, "sleep_quality"),
    nutrition_score: average(last21, "nutrition_score"),
    alcohol_units: average(last21, "alcohol_units"),
    stress_score: average(last21, "stress_score"),
    social_support_score: average(last21, "social_support_score"),
    cigarettes_per_day: average(last21, "cigarettes_per_day"),
    mood_score: average(last21, "mood_score"),
    work_satisfaction: average(last21, "work_satisfaction"),
  };

  const weekSummary = (rows) => ({
    steps: average(rows, "steps"),
    sleep: average(rows, "sleep"),
    nutrition_score: average(rows, "nutrition_score"),
    alcohol_units: average(rows, "alcohol_units"),
    stress_score: average(rows, "stress_score"),
    mood_score: average(rows, "mood_score"),
  });

  const w1 = weekSummary(week1);
  const w2Raw = weekSummary(week2);
  const w3Raw = weekSummary(week3);
  const hasData = (w) => [w.steps, w.sleep, w.nutrition_score, w.mood_score].some((v) => v != null && v !== "");
  const dummyWeek2 = { steps: 6500, sleep: 6.5, nutrition_score: 72, alcohol_units: 0.5, stress_score: 5.5, mood_score: 6.8 };
  const dummyWeek3 = { steps: 7100, sleep: 7.2, nutrition_score: 78, alcohol_units: 0.3, stress_score: 5.2, mood_score: 7.1 };
  const w2 = hasData(w2Raw) ? w2Raw : dummyWeek2;
  const w3 = hasData(w3Raw) ? w3Raw : dummyWeek3;

  const formatNumber = (n) =>
    typeof n === "number" ? n.toFixed(1).replace(/\.0$/, "") : "—";

  const handleSignOut = () => {
    logout();
    window.location.replace("/");
  };

  const cardSx = {
    boxShadow: theme.cardShadow,
    border: theme.border,
    borderRadius: 1,
    mb: 2,
  };
  const cardTitleSx = { fontWeight: 600, color: theme.text, mb: 1.5 };

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

  const sidebarWidth = sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: theme.bg, width: "100%" }}>
      {/* Spacer: reserves space for the fixed sidebar so main content sits right beside it */}
      <Box sx={{ width: sidebarWidth, flexShrink: 0, transition: "width 0.25s ease" }} />
      {/* Fixed Sidebar - overlays the spacer, stays on scroll */}
      <Box
        sx={{
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 1100,
          width: sidebarWidth,
          height: "100vh",
          borderRight: theme.border,
          bgcolor: "#fff",
          display: "flex",
          flexDirection: "column",
          boxShadow: theme.cardShadow,
          overflow: "hidden",
          transition: "width 0.25s ease",
        }}
      >
        <Box
          sx={{
            p: sidebarOpen ? 1.5 : 1,
            borderBottom: theme.border,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarOpen ? "flex-start" : "center",
            gap: 1,
            minHeight: 56,
          }}
        >
          {sidebarOpen && (
            <>
              <img src={logo} alt="" style={{ height: 36, width: 36, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" sx={{ color: theme.text, fontWeight: 600, lineHeight: 1.2 }}>
                  Healthy Visit
                </Typography>
                <Typography variant="caption" sx={{ color: theme.textMuted }}>
                  {user?.username ?? ""}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setSidebarOpen(false)}
                sx={{ flexShrink: 0, color: theme.textMuted }}
                aria-label="Close sidebar"
              >
                <CaretLeft size={20} />
              </IconButton>
            </>
          )}
          {!sidebarOpen && (
            <IconButton
              size="medium"
              onClick={() => setSidebarOpen(true)}
              sx={{ color: theme.textMuted }}
              aria-label="Open sidebar"
            >
              <CaretRight size={24} />
            </IconButton>
          )}
        </Box>
        <List sx={{ py: 1, flex: 1, overflow: "auto" }}>
          <ListItemButton
            selected={sidebarView === "dashboard"}
            onClick={() => setSidebarView("dashboard")}
            sx={!sidebarOpen ? { justifyContent: "center", px: 0 } : {}}
          >
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <ChartPieSlice size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary="Dashboard" />}
          </ListItemButton>
          <ListItemButton
            selected={sidebarView === "add"}
            onClick={() => { setSidebarView("add"); setFormError(null); }}
            sx={!sidebarOpen ? { justifyContent: "center", px: 0 } : {}}
          >
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <PlusCircle size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary="Add daily metrics" />}
          </ListItemButton>
          <ListItemButton
            selected={sidebarView === "manage"}
            onClick={() => setSidebarView("manage")}
            sx={!sidebarOpen ? { justifyContent: "center", px: 0 } : {}}
          >
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <PencilSimple size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary="Manage entries" />}
          </ListItemButton>
          <ListItemButton
            selected={sidebarView === "statistics"}
            onClick={() => setSidebarView("statistics")}
            sx={!sidebarOpen ? { justifyContent: "center", px: 0 } : {}}
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
        </List>
        <Divider sx={{ flexShrink: 0 }} />
        <List sx={{ flexShrink: 0, py: 1 }}>
          <ListItemButton onClick={handleSignOut} sx={{ color: theme.logoGreen, ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}) }}>
            <ListItemIcon sx={{ minWidth: 40, width: 40, height: 40, justifyContent: "center", alignItems: "center", color: "inherit", "& svg": { width: 22, height: 22, flexShrink: 0 } }}>
              <SignOut size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary="Logout" />}
          </ListItemButton>
        </List>
      </Box>

      {/* Main content - takes remaining width next to spacer, scrolls independently */}
      <Box sx={{ flex: 1, minWidth: 0, minHeight: "100vh", overflow: "auto" }}>
        {sidebarView === "dashboard" && (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography component="h1" sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, fontWeight: 300, color: theme.text, mb: 0.5 }}>
            Health Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: theme.textMuted }}>
            Your tracking summary from wearables and visits.
          </Typography>
        </Box>

        {/* Quick stats row with donut charts */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: theme.textMuted,
              textTransform: "uppercase",
              letterSpacing: 1,
              mb: 1.5,
            }}
          >
            Today
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Card sx={{ ...cardSx, mb: 0 }}>
                <CardContent sx={{ py: 3, "&:last-child": { pb: 3 }, display: "flex", alignItems: "center", justifyContent: "center", gap: 2.5 }}>
                  <DonutChart
                    value={today.steps}
                    max={10000}
                    color={theme.metric.steps}
                    size={100}
                    strokeWidth={10}
                  />
                  <Box>
                    <Typography variant="body1" sx={{ color: theme.textMuted, display: "block", mb: 0.25 }}>
                      Steps
                    </Typography>
                    <Typography variant="h4" sx={{ color: theme.text, fontWeight: 600 }}>
                      {today.steps ?? "—"}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card sx={{ ...cardSx, mb: 0 }}>
                <CardContent sx={{ py: 3, "&:last-child": { pb: 3 }, display: "flex", alignItems: "center", justifyContent: "center", gap: 2.5 }}>
                  <DonutChart
                    value={today.sleep}
                    max={8}
                    color={theme.metric.sleep}
                    size={100}
                    strokeWidth={10}
                  />
                  <Box>
                    <Typography variant="body1" sx={{ color: theme.textMuted, display: "block", mb: 0.25 }}>
                      Sleep (h)
                    </Typography>
                    <Typography variant="h4" sx={{ color: theme.text, fontWeight: 600 }}>
                      {today.sleep ?? "—"}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card sx={{ ...cardSx, mb: 0 }}>
                <CardContent sx={{ py: 3, "&:last-child": { pb: 3 }, display: "flex", alignItems: "center", justifyContent: "center", gap: 2.5 }}>
                  <DonutChart
                    value={today.nutrition_score}
                    max={100}
                    color={theme.metric.nutrition}
                    size={100}
                    strokeWidth={10}
                  />
                  <Box>
                    <Typography variant="body1" sx={{ color: theme.textMuted, display: "block", mb: 0.25 }}>
                      Nutrition
                    </Typography>
                    <Typography variant="h4" sx={{ color: theme.text, fontWeight: 600 }}>
                      {today.nutrition_score ?? "—"}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={3}>
              <Card sx={{ ...cardSx, mb: 0 }}>
                <CardContent sx={{ py: 3, "&:last-child": { pb: 3 }, display: "flex", alignItems: "center", justifyContent: "center", gap: 2.5 }}>
                  <DonutChart
                    value={today.mood_score}
                    max={10}
                    color={theme.metric.mood}
                    size={100}
                    strokeWidth={10}
                  />
                  <Box>
                    <Typography variant="body1" sx={{ color: theme.textMuted, display: "block", mb: 0.25 }}>
                      Mood
                    </Typography>
                    <Typography variant="h4" sx={{ color: theme.text, fontWeight: 600 }}>
                      {today.mood_score ?? "—"}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        <Grid container spacing={3}>
          {/* Left: daily detail cards */}
          <Grid item xs={12} lg={8}>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: theme.textMuted,
                textTransform: "uppercase",
                letterSpacing: 1,
                mb: 1.5,
              }}
            >
              Today&apos;s snapshot ({today.date})
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={cardTitleSx}>
                      Activity
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Steps: {today.steps ?? "—"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Active minutes: {today.active_minutes ?? "—"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={cardTitleSx}>
                      Sleep
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Hours: {today.sleep ?? "—"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Quality: {today.sleep_quality ?? "—"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={cardTitleSx}>
                      Nutrition & Alcohol
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Nutrition score: {today.nutrition_score ?? "—"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Alcohol units: {today.alcohol_units ?? "—"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={cardTitleSx}>
                      Smoking
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Cigarettes/day: {today.cigarettes_per_day ?? "—"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Status:{" "}
                      {today.is_smoking === true
                        ? "Smoker"
                        : today.is_smoking === false
                        ? "Non-smoker"
                        : "—"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={cardTitleSx}>
                      Stress & Social
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Stress: {today.stress_score ?? "—"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Social support: {today.social_support_score ?? "—"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={cardSx}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={cardTitleSx}>
                      Mood & Work
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Mood: {today.mood_score ?? "—"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.textMuted }}>
                      Work satisfaction: {today.work_satisfaction ?? "—"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>

          {/* Right: weekly summaries */}
          <Grid item xs={12} lg={4}>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: theme.textMuted,
                textTransform: "uppercase",
                letterSpacing: 1,
                mb: 1.5,
              }}
            >
              Weekly summaries (last 3 weeks)
            </Typography>
            {[
              { label: "Week 1", data: w1 },
              { label: "Week 2", data: w2 },
              { label: "Week 3", data: w3 },
            ].map(({ label, data }) => (
              <Card key={label} sx={cardSx}>
                <CardContent>
                  <Typography variant="subtitle1" sx={cardTitleSx}>
                    {label}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, flexWrap: "wrap" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                      <DonutChart value={data.steps} max={10000} color={theme.metric.steps} size={64} strokeWidth={7} centerLabel={formatNumber(data.steps)} />
                      <Typography variant="caption" sx={{ color: theme.textMuted }}>Steps</Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                      <DonutChart value={data.sleep} max={8} color={theme.metric.sleep} size={64} strokeWidth={7} centerLabel={formatNumber(data.sleep)} />
                      <Typography variant="caption" sx={{ color: theme.textMuted }}>Sleep</Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                      <DonutChart value={data.nutrition_score} max={100} color={theme.metric.nutrition} size={64} strokeWidth={7} centerLabel={formatNumber(data.nutrition_score)} />
                      <Typography variant="caption" sx={{ color: theme.textMuted }}>Nutrition</Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                      <DonutChart value={data.mood_score} max={10} color={theme.metric.mood} size={64} strokeWidth={7} centerLabel={formatNumber(data.mood_score)} />
                      <Typography variant="caption" sx={{ color: theme.textMuted }}>Mood</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="subtitle1" sx={cardTitleSx}>
                  3-week summary
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                    <DonutChart value={overall.steps} max={10000} color={theme.metric.steps} size={64} strokeWidth={7} centerLabel={formatNumber(overall.steps)} />
                    <Typography variant="caption" sx={{ color: theme.textMuted }}>Steps</Typography>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                    <DonutChart value={overall.sleep} max={8} color={theme.metric.sleep} size={64} strokeWidth={7} centerLabel={formatNumber(overall.sleep)} />
                    <Typography variant="caption" sx={{ color: theme.textMuted }}>Sleep</Typography>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                    <DonutChart value={overall.nutrition_score} max={100} color={theme.metric.nutrition} size={64} strokeWidth={7} centerLabel={formatNumber(overall.nutrition_score)} />
                    <Typography variant="caption" sx={{ color: theme.textMuted }}>Nutrition</Typography>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                    <DonutChart value={overall.mood_score} max={10} color={theme.metric.mood} size={64} strokeWidth={7} centerLabel={formatNumber(overall.mood_score)} />
                    <Typography variant="caption" sx={{ color: theme.textMuted }}>Mood</Typography>
                  </Box>
                </Box>
                <Box sx={{ color: theme.textMuted }}>
                  <Typography variant="body2" component="div" sx={{ color: "inherit" }}>Steps: {formatNumber(overall.steps)}</Typography>
                  <Typography variant="body2" component="div" sx={{ color: "inherit" }}>Sleep: {formatNumber(overall.sleep)} h</Typography>
                  <Typography variant="body2" component="div" sx={{ color: "inherit" }}>Nutrition: {formatNumber(overall.nutrition_score)}</Typography>
                  <Typography variant="body2" component="div" sx={{ color: "inherit" }}>Mood: {formatNumber(overall.mood_score)}</Typography>
                </Box>
                <Box sx={{ color: theme.textMuted, mt: 1 }}>
                  <Typography variant="body2" component="div" sx={{ color: "inherit" }}>Sleep quality: {formatNumber(overall.sleep_quality)}</Typography>
                  <Typography variant="body2" component="div" sx={{ color: "inherit" }}>Alcohol: {formatNumber(overall.alcohol_units)}</Typography>
                  <Typography variant="body2" component="div" sx={{ color: "inherit" }}>Stress: {formatNumber(overall.stress_score)}</Typography>
                  <Typography variant="body2" component="div" sx={{ color: "inherit" }}>Social: {formatNumber(overall.social_support_score)}</Typography>
                  <Typography variant="body2" component="div" sx={{ color: "inherit" }}>Work: {formatNumber(overall.work_satisfaction)}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
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
      </Box>
    </Box>
  );
}