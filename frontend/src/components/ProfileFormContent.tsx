import * as React from "react";
import {
  Button,
  Card,
  Container,
  TextField,
  Typography,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material";
import { Link, Redirect } from "react-router-dom";
import { getUser, updateMyProfile } from "../service/auth";
import {
  EMAIL_RULES,
  PASSWORD_RULES,
  USERNAME_RULES,
  validateEmail,
  validatePassword,
  validateUsername,
} from "../utils/validation";

const defaultTheme = {
  primary: "#16a34a",
  text: "#1F2D3D",
  textMuted: "#868E96",
  border: "1px solid #DEE2E6",
};

export function dashboardPathForUser(u: any): string {
  if (u.is_superuser === true || u.is_superuser === 1) return "/admin-dashboard";
  if (u.is_researcher === true || u.is_researcher === 1) return "/researcher-dashboard";
  return "/patient-dashboard";
}

type ProfileFormContentProps = {
  /** Primary accent (buttons, title) — e.g. patient dashboard blue */
  accentPrimary?: string;
  /** Hide standalone “Back to dashboard” */
  embedded?: boolean;
  /** Optional title override */
  title?: string;
};

export default function ProfileFormContent({
  accentPrimary = defaultTheme.primary,
  embedded = false,
  title = "My profile",
}: ProfileFormContentProps) {
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [authFailed, setAuthFailed] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    getUser()
      .then((u: any) => {
        setUser(u);
        setUsername(u.username || "");
        setEmail(u.email || "");
        setLoading(false);
      })
      .catch(() => {
        setAuthFailed(true);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    const uErr = validateUsername(username);
    if (uErr) {
      setError(uErr);
      return;
    }
    const eErr = validateEmail(email);
    if (eErr) {
      setError(eErr);
      return;
    }
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setError("Enter your current password to change your password.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("New password and confirmation do not match.");
        return;
      }
      const pErr = validatePassword(newPassword);
      if (pErr) {
        setError(pErr);
        return;
      }
    }

    setSaving(true);
    try {
      const payload: any = {
        username: username.trim(),
        email: email.trim().toLowerCase(),
      };
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }
      await updateMyProfile(payload);
      setSuccess("Profile updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      const fresh = await getUser();
      setUser(fresh);
      setUsername(fresh.username || "");
      setEmail(fresh.email || "");
    } catch (e: any) {
      setError(e?.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (authFailed) {
    return <Redirect to="/signin?session=expired" />;
  }
  const containerSx = {
    py: embedded ? 2 : 4,
    ml: 0,
    mr: "auto",
    textAlign: "left" as const,
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={containerSx}>
        <Stack alignItems="flex-start" py={4}>
          <CircularProgress sx={{ color: accentPrimary }} />
        </Stack>
      </Container>
    );
  }

  const backHref = user ? dashboardPathForUser(user) : "/";

  return (
    <Container maxWidth="sm" sx={containerSx}>
      <Typography variant="h4" sx={{ fontWeight: 600, color: accentPrimary, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: defaultTheme.textMuted, mb: 3 }}>
        Update your username, email, or password. The same rules apply as when you signed up.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Card sx={{ p: 3, border: defaultTheme.border }}>
        <Stack spacing={2.5}>
          <TextField
            label="Username"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={saving}
            helperText={USERNAME_RULES}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={saving}
            helperText={EMAIL_RULES}
          />
          <Typography variant="subtitle2" sx={{ pt: 1, color: defaultTheme.text }}>
            Change password (optional)
          </Typography>
          <TextField
            label="Current password"
            type="password"
            fullWidth
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={saving}
            autoComplete="current-password"
          />
          <TextField
            label="New password"
            type="password"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={saving}
            helperText={PASSWORD_RULES}
            autoComplete="new-password"
          />
          <TextField
            label="Confirm new password"
            type="password"
            fullWidth
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={saving}
            autoComplete="new-password"
          />
          <Stack direction="row" spacing={2} sx={{ pt: 1 }} flexWrap="wrap">
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              sx={{ bgcolor: accentPrimary, "&:hover": { bgcolor: accentPrimary, filter: "brightness(0.92)" } }}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {!embedded && (
              <Button component={Link} to={backHref} disabled={saving}>
                Back to dashboard
              </Button>
            )}
          </Stack>
        </Stack>
      </Card>
    </Container>
  );
}
