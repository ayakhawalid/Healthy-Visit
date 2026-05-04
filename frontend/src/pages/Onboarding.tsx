import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import api from "../service/api";

type ChatMsg = { role: "bot" | "user"; text: string };

type OnboardingStartResponse = { session_id: string; message: string; language?: string };
type OnboardingMessageResponse = { message: string; done: boolean };

/** Align with marketing / auth (App.css body, signup, index). */
const site = {
  primary: "#16a34a",
  primaryDark: "#15803d",
  text: "#1f2937",
  textMuted: "#6b7280",
  pageBg: "#f6f5f7",
  cardBg: "#ffffff",
  border: "1px solid #e5e7eb",
  inputBg: "#f3f4f6",
};

const ONBOARDING_LANG_KEY = "onboarding_language_choice";

const textFieldChatSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: site.inputBg,
    borderRadius: 1.5,
    "& fieldset": { borderColor: "#e5e7eb" },
    "&:hover fieldset": { borderColor: "#d1d5db" },
    "&.Mui-focused fieldset": { borderColor: site.primary, borderWidth: "1px" },
  },
  "& .MuiInputBase-input": { color: site.text },
} as const;

export default function Onboarding() {
  const patientIdStr = localStorage.getItem("onboarding_patient_id");
  const patientId = patientIdStr ? Number(patientIdStr) : null;

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
    <Box sx={{ minHeight: "100vh", bgcolor: site.pageBg }}>
      <Container maxWidth="md" sx={{ py: { xs: 3, sm: 4 }, px: { xs: 2, sm: 3 } }}>
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
            <Box sx={{ minWidth: 0, flex: "1 1 240px" }}>
              <Typography
                component="h1"
                sx={{
                  fontFamily: "Roboto, sans-serif",
                  fontSize: { xs: "1.75rem", sm: "2.125rem" },
                  fontWeight: 600,
                  color: site.primary,
                  mb: 0.75,
                  lineHeight: 1.2,
                }}
              >
                {onboardingLang === "he"
                  ? "היכרות"
                  : onboardingLang === "en"
                    ? "Onboarding"
                    : "Get started"}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: site.textMuted, fontSize: "0.95rem", maxWidth: 520, lineHeight: 1.5 }}
              >
                {onboardingLang === null &&
                  "Choose a language — the whole chat will stay in that language only."}
                {onboardingLang === "he" && "שיחה קצרה בעברית בלבד — גובה, משקל וכמה שאלות רקע."}
                {onboardingLang === "en" &&
                  "A short chat in English only — height, weight, and a few background questions."}
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
                borderColor: site.primary,
                color: site.primary,
                fontWeight: 600,
                textTransform: "none",
                borderRadius: 1.5,
                px: 2,
                flexShrink: 0,
                "&:hover": {
                  borderColor: site.primaryDark,
                  bgcolor: alpha(site.primary, 0.08),
                },
              }}
            >
              Continue to sign in
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {patientId != null && onboardingLang === null && (
            <Card
              elevation={0}
              sx={{
                mb: 2.5,
                bgcolor: site.cardBg,
                border: site.border,
                borderRadius: 2,
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, color: site.text, mb: 2, fontFamily: "Roboto, sans-serif" }}
                >
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
                    sx={{
                      bgcolor: site.primary,
                      py: 1.5,
                      textTransform: "none",
                      fontWeight: 600,
                      borderRadius: 1.5,
                      "&:hover": { bgcolor: site.primaryDark },
                    }}
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
                    sx={{
                      borderColor: site.primary,
                      color: site.primary,
                      py: 1.5,
                      textTransform: "none",
                      fontWeight: 600,
                      borderRadius: 1.5,
                      "&:hover": {
                        borderColor: site.primaryDark,
                        bgcolor: alpha(site.primary, 0.06),
                      },
                    }}
                  >
                    English
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          <Card
            elevation={0}
            sx={{
              bgcolor: site.cardBg,
              border: site.border,
              borderRadius: 2,
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.25,
                bgcolor: alpha(site.primary, 0.08),
                borderBottom: site.border,
              }}
            >
              <Typography variant="body2" sx={{ color: site.text, fontWeight: 600, fontSize: "0.8rem" }}>
                Conversation
              </Typography>
            </Box>
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2, p: { xs: 2, sm: 2.5 } }}>
              <Box
                sx={{
                  bgcolor: site.pageBg,
                  border: site.border,
                  borderRadius: 2,
                  p: 2,
                  height: { xs: "50vh", sm: "56vh" },
                  maxHeight: 520,
                  overflowY: "auto",
                }}
              >
                {onboardingLang === null ? (
                  <Typography variant="body2" sx={{ color: site.textMuted }}>
                    Select עברית or English above to begin.
                  </Typography>
                ) : loading ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: site.textMuted }}>
                    <CircularProgress size={22} sx={{ color: site.primary }} />
                    <Typography variant="body2">
                      {onboardingLang === "he" ? "מתחילים את השיחה…" : "Starting your conversation…"}
                    </Typography>
                  </Box>
                ) : (
                  messages.map((m, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: "flex",
                        justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                        mb: 1.25,
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: "88%",
                          px: 1.75,
                          py: 1.25,
                          borderRadius: 2,
                          bgcolor: m.role === "user" ? site.primary : site.cardBg,
                          color: m.role === "user" ? "#fff" : site.text,
                          border: m.role === "user" ? "none" : site.border,
                          whiteSpace: "pre-wrap",
                          fontSize: "0.9375rem",
                          lineHeight: 1.5,
                          boxShadow: m.role === "user" ? "0 1px 2px rgba(22, 163, 74, 0.25)" : "none",
                        }}
                      >
                        {m.text}
                      </Box>
                    </Box>
                  ))
                )}
              </Box>

              <Box sx={{ display: "flex", gap: 1.25, alignItems: "stretch", flexDirection: { xs: "column", sm: "row" } }}>
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
                  size="medium"
                  disabled={sending || done || loading || !sessionId || onboardingLang === null}
                  sx={textFieldChatSx}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  onClick={handleSend}
                  disabled={sending || done || loading || !input.trim() || !sessionId || onboardingLang === null}
                  sx={{
                    bgcolor: site.primary,
                    minWidth: { xs: "100%", sm: 100 },
                    py: 1.25,
                    fontWeight: 700,
                    textTransform: "none",
                    borderRadius: 1.5,
                    letterSpacing: 0.5,
                    "&:hover": { bgcolor: site.primaryDark },
                    "&:disabled": { bgcolor: alpha(site.primary, 0.4) },
                  }}
                >
                  {sending ? "…" : "Send"}
                </Button>
              </Box>

              {!done && !loading && onboardingLang != null && (
                <Typography variant="caption" sx={{ color: site.textMuted, display: "block" }}>
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
