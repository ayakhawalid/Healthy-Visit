import React, { useEffect, useMemo, useState } from "react";
import { Box, Card, CardContent, Typography, Grid, Button } from "@mui/material";
import { getUser, logout } from "../service/auth";
import api from "../service/api";

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

  // 2) Fetch metrics for this patient when user is known
  useEffect(() => {
    if (!user) return;
    const patientId = user.id != null ? user.id : 1;
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="h6">Loading dashboard…</Typography>
      </Box>
    );
  }

  if (!today) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
        }}
      >
        <Typography variant="h6">
          No tracking data available yet. Once we collect some data, your dashboard
          will appear here.
        </Typography>
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
  const w2 = weekSummary(week2);
  const w3 = weekSummary(week3);

  const formatNumber = (n) =>
    typeof n === "number" ? n.toFixed(1).replace(/\.0$/, "") : "—";

  const handleSignOut = () => {
    logout();
    window.location.replace("/");
  };

  return (
    <Box sx={{ p: 4, display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="outlined" onClick={handleSignOut}>
          Sign out
        </Button>
      </Box>
      <Box sx={{ display: "flex", gap: 3 }}>
      {/* Left: daily tiles */}
      <Box sx={{ flex: 2 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Today&apos;s snapshot ({today.date})
        </Typography>
        <Grid container spacing={2}>
          {/* Activity */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Activity</Typography>
                <Typography variant="body2">
                  Steps: {today.steps ?? "—"}
                </Typography>
                <Typography variant="body2">
                  Active minutes: {today.active_minutes ?? "—"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Sleep */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Sleep</Typography>
                <Typography variant="body2">
                  Hours: {today.sleep ?? "—"}
                </Typography>
                <Typography variant="body2">
                  Quality: {today.sleep_quality ?? "—"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Nutrition & Alcohol */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Nutrition & Alcohol</Typography>
                <Typography variant="body2">
                  Nutrition score: {today.nutrition_score ?? "—"}
                </Typography>
                <Typography variant="body2">
                  Alcohol units: {today.alcohol_units ?? "—"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Smoking */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Smoking</Typography>
                <Typography variant="body2">
                  Cigarettes/day: {today.cigarettes_per_day ?? "—"}
                </Typography>
                <Typography variant="body2">
                  Smoking status:{" "}
                  {today.is_smoking === true
                    ? "Smoker"
                    : today.is_smoking === false
                    ? "Non-smoker"
                    : "—"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Stress & Social */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Stress & Social</Typography>
                <Typography variant="body2">
                  Stress score: {today.stress_score ?? "—"}
                </Typography>
                <Typography variant="body2">
                  Social support: {today.social_support_score ?? "—"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Mood & Work */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Mood & Work</Typography>
                <Typography variant="body2">
                  Mood: {today.mood_score ?? "—"}
                </Typography>
                <Typography variant="body2">
                  Work satisfaction: {today.work_satisfaction ?? "—"}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Right: weekly + 3-week summary */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="h6">Weekly summaries (last 3 weeks)</Typography>

        <Card>
          <CardContent>
            <Typography variant="subtitle1">Week 1</Typography>
            <Typography variant="body2">
              Steps: {formatNumber(w1.steps)}
            </Typography>
            <Typography variant="body2">
              Sleep: {formatNumber(w1.sleep)} h
            </Typography>
            <Typography variant="body2">
              Nutrition: {formatNumber(w1.nutrition_score)}
            </Typography>
            <Typography variant="body2">
              Alcohol: {formatNumber(w1.alcohol_units)}
            </Typography>
            <Typography variant="body2">
              Stress: {formatNumber(w1.stress_score)}
            </Typography>
            <Typography variant="body2">
              Mood: {formatNumber(w1.mood_score)}
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle1">Week 2</Typography>
            <Typography variant="body2">
              Steps: {formatNumber(w2.steps)}
            </Typography>
            <Typography variant="body2">
              Sleep: {formatNumber(w2.sleep)} h
            </Typography>
            <Typography variant="body2">
              Nutrition: {formatNumber(w2.nutrition_score)}
            </Typography>
            <Typography variant="body2">
              Alcohol: {formatNumber(w2.alcohol_units)}
            </Typography>
            <Typography variant="body2">
              Stress: {formatNumber(w2.stress_score)}
            </Typography>
            <Typography variant="body2">
              Mood: {formatNumber(w2.mood_score)}
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle1">Week 3</Typography>
            <Typography variant="body2">
              Steps: {formatNumber(w3.steps)}
            </Typography>
            <Typography variant="body2">
              Sleep: {formatNumber(w3.sleep)} h
            </Typography>
            <Typography variant="body2">
              Nutrition: {formatNumber(w3.nutrition_score)}
            </Typography>
            <Typography variant="body2">
              Alcohol: {formatNumber(w3.alcohol_units)}
            </Typography>
            <Typography variant="body2">
              Stress: {formatNumber(w3.stress_score)}
            </Typography>
            <Typography variant="body2">
              Mood: {formatNumber(w3.mood_score)}
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle1">3-week summary</Typography>
            <Typography variant="body2">
              Steps: {formatNumber(overall.steps)}
            </Typography>
            <Typography variant="body2">
              Sleep: {formatNumber(overall.sleep)} h
            </Typography>
            <Typography variant="body2">
              Sleep quality: {formatNumber(overall.sleep_quality)}
            </Typography>
            <Typography variant="body2">
              Nutrition: {formatNumber(overall.nutrition_score)}
            </Typography>
            <Typography variant="body2">
              Alcohol: {formatNumber(overall.alcohol_units)}
            </Typography>
            <Typography variant="body2">
              Stress: {formatNumber(overall.stress_score)}
            </Typography>
            <Typography variant="body2">
              Social support: {formatNumber(overall.social_support_score)}
            </Typography>
            <Typography variant="body2">
              Mood: {formatNumber(overall.mood_score)}
            </Typography>
            <Typography variant="body2">
              Work satisfaction: {formatNumber(overall.work_satisfaction)}
            </Typography>
          </CardContent>
        </Card>
      </Box>
      </Box>
    </Box>
  );
}