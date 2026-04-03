import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { Redirect, useHistory, useLocation } from "react-router-dom";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { ChartLine } from "@phosphor-icons/react";
import DashboardShell from "../components/DashboardShell";
import ProfileFormContent from "../components/ProfileFormContent";
import { getUser, logout } from "../service/auth";
import api from "../service/api";

const dashboardTheme = {
  primary: "#1EB7FF",
  success: "#1BB934",
  text: "#1F2D3D",
  textMuted: "#868E96",
  bg: "#F8F9FA",
  cardShadow: "0 1px 2px 0 rgba(31, 45, 61, 0.07)",
  border: "1px solid #DEE2E6",
};

const shellTheme = {
  ...dashboardTheme,
  logoGreen: "#16a34a",
  cardShadow: "0 2px 8px rgba(31, 45, 61, 0.1), 0 1px 2px rgba(31, 45, 61, 0.06)",
};

type PatientRow = {
  id: number;
  username: string;
  email: string;
  study_start_date: string | null;
  study_window_start: string;
  study_window_end_exclusive: string;
};

export default function ResearcherDashboard() {
  const [user, setUser] = React.useState<any>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [authFailed, setAuthFailed] = React.useState(false);
  const [patients, setPatients] = React.useState<PatientRow[]>([]);
  const [selectedId, setSelectedId] = React.useState<number | "">("");
  const [metrics, setMetrics] = React.useState<any[]>([]);
  const [scores, setScores] = React.useState<any[]>([]);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [sidebarView, setSidebarView] = React.useState<"research" | "profile">("research");
  const history = useHistory();
  const location = useLocation();

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("view") === "profile") {
      setSidebarView("profile");
    }
  }, [location.search]);

  React.useEffect(() => {
    getUser()
      .then((data: any) => {
        setUser(data);
        setAuthLoading(false);
      })
      .catch(() => {
        setAuthLoading(false);
        setAuthFailed(true);
      });
  }, []);

  React.useEffect(() => {
    if (!user || !(user.is_researcher === true || user.is_researcher === 1)) return;
    api
      .get<PatientRow[]>("/research/patients")
      .then((res) => {
        const list = res.data ?? [];
        setPatients(list);
        if (list.length && selectedId === "") {
          setSelectedId(list[0].id);
        }
      })
      .catch((e) => {
        console.warn(e);
        setLoadError(e?.response?.data?.detail || "Could not load patients.");
      });
    // Intentionally omit selectedId: only re-fetch when user auth changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  React.useEffect(() => {
    if (selectedId === "" || selectedId == null) {
      setMetrics([]);
      setScores([]);
      return;
    }
    setDataLoading(true);
    setLoadError(null);
    Promise.all([
      api.get<any[]>(`/research/patients/${selectedId}/metrics`),
      api.get<any[]>(`/research/patients/${selectedId}/fantastic-scores`),
    ])
      .then(([m, s]) => {
        setMetrics(m.data ?? []);
        setScores(s.data ?? []);
      })
      .catch((e) => {
        setLoadError(e?.response?.data?.detail || "Could not load study data.");
        setMetrics([]);
        setScores([]);
      })
      .finally(() => setDataLoading(false));
  }, [selectedId]);

  const handleSignOut = () => {
    logout();
    window.location.replace("/");
  };

  if (authFailed) {
    return <Redirect to="/signin?session=expired" />;
  }
  if (authLoading) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: dashboardTheme.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress sx={{ color: dashboardTheme.primary }} />
      </Box>
    );
  }
  if (user && !(user.is_researcher === true || user.is_researcher === 1)) {
    return <Redirect to="/" />;
  }

  const selected = patients.find((p) => p.id === selectedId);

  const cardSx = {
    boxShadow: dashboardTheme.cardShadow,
    border: dashboardTheme.border,
    borderRadius: 1,
    overflow: "hidden",
  };

  return (
    <DashboardShell
      user={user}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      onLogout={handleSignOut}
      onProfileClick={() => {
        setSidebarView("profile");
        history.replace("/researcher-dashboard?view=profile");
      }}
      profileSelected={sidebarView === "profile"}
      theme={shellTheme}
      navItems={
        <ListItemButton
          selected={sidebarView === "research"}
          onClick={() => {
            setSidebarView("research");
            history.replace("/researcher-dashboard");
          }}
          sx={!sidebarOpen ? { justifyContent: "center", px: 0 } : {}}
        >
          <ListItemIcon
            sx={{
              minWidth: 40,
              width: 40,
              height: 40,
              justifyContent: "center",
              alignItems: "center",
              "& svg": { width: 22, height: 22, flexShrink: 0 },
            }}
          >
            <ChartLine size={22} />
          </ListItemIcon>
          {sidebarOpen && <ListItemText primary="Study data" />}
        </ListItemButton>
      }
    >
      {sidebarView === "research" && (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "2rem", md: "2.5rem" },
                fontWeight: 300,
                color: dashboardTheme.text,
                mb: 0.5,
              }}
            >
              Researcher dashboard
            </Typography>
            <Typography variant="body2" sx={{ color: dashboardTheme.textMuted }}>
              View enrolled patients’ daily metrics and FANTASTIC scores during the 21-day study window.
            </Typography>
          </Box>
        </Box>

        {loadError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
            {loadError}
          </Alert>
        )}

        <Box sx={{ mb: 2, maxWidth: 420 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="patient-select-label">Patient</InputLabel>
            <Select
              labelId="patient-select-label"
              label="Patient"
              value={selectedId === "" ? "" : selectedId}
              onChange={(e) => setSelectedId(e.target.value as number)}
            >
              {patients.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.username} ({p.email})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {selected && (
          <Typography variant="body2" sx={{ color: dashboardTheme.textMuted, mb: 2 }}>
            Study window: {selected.study_window_start} → {selected.study_window_end_exclusive} (exclusive end)
            {selected.study_start_date ? ` · Recorded start: ${selected.study_start_date}` : ""}
          </Typography>
        )}

        {dataLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress sx={{ color: dashboardTheme.primary }} />
          </Box>
        ) : (
          <>
            <Typography variant="h6" sx={{ mb: 1, color: dashboardTheme.text }}>
              Daily metrics
            </Typography>
            <Card sx={{ ...cardSx, mb: 3 }}>
              <TableContainer sx={{ maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Steps</TableCell>
                      <TableCell align="right">Sleep</TableCell>
                      <TableCell align="right">Score</TableCell>
                      <TableCell align="right">Nutrition</TableCell>
                      <TableCell align="right">Stress</TableCell>
                      <TableCell align="right">Mood</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metrics.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{String(row.date)}</TableCell>
                        <TableCell align="right">{row.steps ?? "—"}</TableCell>
                        <TableCell align="right">{row.sleep ?? "—"}</TableCell>
                        <TableCell align="right">{row.score != null ? Number(row.score).toFixed(1) : "—"}</TableCell>
                        <TableCell align="right">{row.nutrition_score ?? "—"}</TableCell>
                        <TableCell align="right">{row.stress_score ?? "—"}</TableCell>
                        <TableCell align="right">{row.mood_score ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {metrics.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ color: dashboardTheme.textMuted }}>
                          No metrics in this study window yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>

            <Typography variant="h6" sx={{ mb: 1, color: dashboardTheme.text }}>
              FANTASTIC daily scores
            </Typography>
            <Card sx={cardSx}>
              <TableContainer sx={{ maxHeight: 320 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">%</TableCell>
                      <TableCell>Grade</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scores.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{String(row.date)}</TableCell>
                        <TableCell align="right">{row.percentage != null ? Number(row.percentage).toFixed(1) : "—"}</TableCell>
                        <TableCell>{row.grade_label ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {scores.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} sx={{ color: dashboardTheme.textMuted }}>
                          No FANTASTIC scores in this study window yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </>
        )}
      </Container>
      )}
      {sidebarView === "profile" && (
        <ProfileFormContent embedded accentPrimary={dashboardTheme.primary} />
      )}
    </DashboardShell>
  );
}
