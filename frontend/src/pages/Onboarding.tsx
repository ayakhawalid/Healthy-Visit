import * as React from "react";
import { Box, Button, Card, CardContent, Container, TextField, Typography } from "@mui/material";
import api from "../service/api";

type ChatMsg = { role: "bot" | "user"; text: string };

type OnboardingStartResponse = { session_id: string; message: string; language?: string };
type OnboardingMessageResponse = { message: string; done: boolean };

const theme = {
  text: "#1F2D3D",
  textMuted: "#868E96",
  bg: "#F8F9FA",
  border: "1px solid #DEE2E6",
  primary: "#1EB7FF",
  logoGreen: "#16a34a",
};

const ONBOARDING_LANG_KEY = "onboarding_language_choice";

export default function Onboarding() {
  const patientIdStr = localStorage.getItem("onboarding_patient_id");
  const patientId = patientIdStr ? Number(patientIdStr) : null;

  // Always require an explicit tap — do not restore ONBOARDING_LANG_KEY (stale "he" skipped the
  // picker and started a Hebrew session while users thought they chose English).
  const [onboardingLang, setOnboardingLang] = React.useState<"he" | "en" | null>(null);
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [input, setInput] = React.useState("");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
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
    if (!onboardingLang) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .post<OnboardingStartResponse>("/onboarding/start", {
        patient_id: patientId,
        language: onboardingLang,
      })
      .then((res) => {
        if (cancelled) return;
        setSessionId(res.data.session_id);
        setMessages([{ role: "bot", text: res.data.message }]);
        const srvLang = res.data.language;
        if (srvLang && onboardingLang && srvLang !== onboardingLang) {
          setError(
            `Language mismatch (server: ${srvLang}, you chose: ${onboardingLang}). Try again or clear site data for this origin.`
          );
        }
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
  }, [patientId, onboardingLang]);

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
        language: onboardingLang ?? undefined,
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
              {onboardingLang === "he" ? "היכרות" : onboardingLang === "en" ? "Onboarding" : "AI onboarding"}
            </Typography>
            <Typography variant="body2" sx={{ color: theme.textMuted }}>
              {onboardingLang === null &&
                "Choose a language — the whole chat will stay in that language only."}
              {onboardingLang === "he" && "שיחה קצרה בעברית בלבד — גובה, משקל וכמה שאלות רקע."}
              {onboardingLang === "en" && "A short chat in English only — height, weight, and a few background questions."}
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

        {patientId != null && onboardingLang === null && (
          <Card sx={{ boxShadow: "0 1px 2px 0 rgba(31, 45, 61, 0.07)", border: theme.border, borderRadius: 1, mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.text, mb: 2 }}>
                בחרו שפה · Choose language
              </Typography>
              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5 }}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    localStorage.setItem("patient_chat_language", "he");
                    localStorage.setItem(ONBOARDING_LANG_KEY, "he");
                    setOnboardingLang("he");
                  }}
                  sx={{ bgcolor: theme.logoGreen, py: 1.5, "&:hover": { bgcolor: theme.logoGreen } }}
                >
                  עברית
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => {
                    localStorage.setItem("patient_chat_language", "en");
                    localStorage.setItem(ONBOARDING_LANG_KEY, "en");
                    setOnboardingLang("en");
                  }}
                  sx={{ borderColor: theme.primary, color: theme.primary, py: 1.5 }}
                >
                  English
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        <Card sx={{ boxShadow: "0 1px 2px 0 rgba(31, 45, 61, 0.07)", border: theme.border, borderRadius: 1 }}>
          <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ bgcolor: "#fff", border: theme.border, borderRadius: 1, p: 2, height: "60vh", overflowY: "auto" }}>
              {onboardingLang === null ? (
                <Typography variant="body2" sx={{ color: theme.textMuted }}>
                  Select עברית or English above to begin.
                </Typography>
              ) : loading ? (
                <Typography variant="body2" sx={{ color: theme.textMuted }}>
                  {onboardingLang === "he" ? "מתחילים את השיחה…" : "Starting your conversation…"}
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
                placeholder={
                  done
                    ? onboardingLang === "he"
                      ? "ההיכרות הסתיימה"
                      : "Onboarding complete"
                    : onboardingLang === "he"
                      ? "כתבו כאן…"
                      : "Type your answer…"
                }
                fullWidth
                size="small"
                disabled={sending || done || loading || !sessionId || onboardingLang === null}
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
                disabled={
                  sending || done || loading || !input.trim() || !sessionId || onboardingLang === null
                }
                sx={{ bgcolor: theme.primary, "&:hover": { bgcolor: theme.primary } }}
              >
                {sending ? "…" : "Send"}
              </Button>
            </Box>

            {!done && !loading && onboardingLang != null && (
              <Typography variant="caption" sx={{ color: theme.textMuted }}>
                {onboardingLang === "he"
                  ? "אפשר לענות בחופשיות — המערכת תתרגם את המשמעות."
                  : "Answer naturally — the AI will interpret your meaning."}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
