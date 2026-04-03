import * as React from "react";
import { Box, Button, Card, CardContent, Container, TextField, Typography } from "@mui/material";
import api from "../service/api";

type ChatMsg = { role: "bot" | "user"; text: string };

type OnboardingStartResponse = { session_id: string; message: string };
type OnboardingMessageResponse = { message: string; done: boolean };

const theme = {
  text: "#1F2D3D",
  textMuted: "#868E96",
  bg: "#F8F9FA",
  border: "1px solid #DEE2E6",
  primary: "#1EB7FF",
  logoGreen: "#16a34a",
};

export default function Onboarding() {
  const patientIdStr = localStorage.getItem("onboarding_patient_id");
  const patientId = patientIdStr ? Number(patientIdStr) : null;

  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [input, setInput] = React.useState("");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const appendBot = (text: string) => {
    setMessages((prev) => [...prev, { role: "bot", text }]);
  };

  React.useEffect(() => {
    if (!patientId) {
      setError("Missing patient id. Please sign up again.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .post<OnboardingStartResponse>("/onboarding/start", { patient_id: patientId })
      .then((res) => {
        if (cancelled) return;
        setSessionId(res.data.session_id);
        appendBot(res.data.message);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || err.message || "Could not start onboarding.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !sessionId || sending || done) return;
    setSending(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    try {
      const res = await api.post<OnboardingMessageResponse>("/onboarding/message", {
        session_id: sessionId,
        user_message: text,
      });
      appendBot(res.data.message);
      if (res.data.done) {
        setDone(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: theme.bg }}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 3 }}>
          <Box>
            <Typography component="h1" sx={{ fontSize: { xs: "2rem", md: "2.5rem" }, fontWeight: 300, color: theme.text, mb: 0.5 }}>
              AI onboarding
            </Typography>
            <Typography variant="body2" sx={{ color: theme.textMuted }}>
              A short, natural conversation — height, weight, and a few lifestyle questions.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={async () => {
              if (patientId != null) {
                try {
                  await api.post("/onboarding/persist-session", {
                    patient_id: patientId,
                    session_id: sessionId ?? undefined,
                  });
                } catch {
                  /* still allow sign-in */
                }
              }
              window.location.replace("/");
            }}
            sx={{
              borderColor: theme.logoGreen,
              color: theme.logoGreen,
              "&:hover": { borderColor: theme.logoGreen, bgcolor: "rgba(22, 163, 74, 0.08)" },
            }}
          >
            Continue to sign in
          </Button>
        </Box>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Card sx={{ boxShadow: "0 1px 2px 0 rgba(31, 45, 61, 0.07)", border: theme.border, borderRadius: 1 }}>
          <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ bgcolor: "#fff", border: theme.border, borderRadius: 1, p: 2, height: "60vh", overflowY: "auto" }}>
              {loading ? (
                <Typography variant="body2" sx={{ color: theme.textMuted }}>
                  Starting your conversation…
                </Typography>
              ) : (
                messages.map((m, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: "flex",
                      justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                      mb: 1,
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: "85%",
                        px: 1.5,
                        py: 1,
                        borderRadius: 2,
                        bgcolor: m.role === "user" ? theme.primary : "#fff",
                        color: m.role === "user" ? "#fff" : theme.text,
                        border: m.role === "user" ? "none" : theme.border,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {m.text}
                    </Box>
                  </Box>
                ))
              )}
            </Box>

            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={done ? "Onboarding complete" : "Type your answer…"}
                fullWidth
                size="small"
                disabled={sending || done || loading || !sessionId}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleSend}
                disabled={sending || done || loading || !input.trim() || !sessionId}
                sx={{ bgcolor: theme.primary, "&:hover": { bgcolor: theme.primary } }}
              >
                {sending ? "…" : "Send"}
              </Button>
            </Box>

            {!done && !loading && (
              <Typography variant="caption" sx={{ color: theme.textMuted }}>
                Answer naturally (e.g. “170 cm and 72 kg”, “ok”, “rough week”). The AI will interpret your meaning.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
