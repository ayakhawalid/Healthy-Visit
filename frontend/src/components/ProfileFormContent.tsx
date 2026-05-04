import * as React from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { User } from "@phosphor-icons/react";
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
      <Container maxWidth="lg" sx={containerSx}>
        <Stack alignItems="flex-start" py={4}>
          <CircularProgress sx={{ color: accentPrimary }} />
        </Stack>
      </Container>
    );
  }

  const backHref = user ? dashboardPathForUser(user) : "/";

  const headingColor = embedded ? "#0f172a" : defaultTheme.text;
  const mutedColor = embedded ? "#64748b" : defaultTheme.textMuted;

  const profileHeader = (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      alignItems={{ xs: "flex-start", sm: "center" }}
      sx={{ mb: embedded ? 2 : 1, width: "100%" }}
    >
      <Avatar
        sx={{
          width: 52,
          height: 52,
          bgcolor: accentPrimary,
          color: "#fff",
          flexShrink: 0,
          "& svg": { color: "inherit" },
        }}
      >
        <User size={28} weight="duotone" />
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="h5"
          component="h1"
          sx={{
            fontWeight: 600,
            fontFamily: "Roboto, sans-serif",
            color: headingColor,
            lineHeight: 1.25,
            mb: 0.5,
          }}
        >
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: mutedColor, maxWidth: 560 }}>
          Update how you sign in. The same rules apply as when you created your account.
        </Typography>
      </Box>
    </Stack>
  );

  const cardShellSx = {
    border: embedded ? `1px solid ${alpha(accentPrimary, 0.14)}` : defaultTheme.border,
    borderRadius: 2,
    boxShadow: embedded ? "none" : "0 1px 2px rgba(15, 23, 42, 0.06)",
    bgcolor: embedded ? alpha(accentPrimary, 0.03) : "#fff",
    overflow: "hidden",
  } as const;

  const accountGridSx = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
    gap: 2.5,
    alignItems: "flex-start",
    width: "100%",
  } as const;

  const passwordGridSx = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
    gap: 2.5,
    alignItems: "flex-start",
    width: "100%",
  } as const;

  const sectionTitleSx = {
    fontWeight: 600,
    fontSize: "1.05rem",
    color: headingColor,
    letterSpacing: "-0.01em",
  } as const;

  const sectionLeadSx = {
    color: mutedColor,
    fontSize: "0.875rem",
    lineHeight: 1.5,
    mt: 0.5,
    mb: 2.5,
    maxWidth: 640,
  } as const;

  const formBody = (
    <Stack spacing={2.5} sx={{ width: "100%", maxWidth: embedded ? 720 : 900 }}>
      <Card elevation={0} sx={cardShellSx}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" component="h2" sx={sectionTitleSx}>
            Account
          </Typography>
          <Typography variant="body2" sx={sectionLeadSx}>
            Your username and email are used to sign in and reach you about your care.
          </Typography>
          <Box sx={accountGridSx}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={saving}
              helperText={USERNAME_RULES}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
              helperText={EMAIL_RULES}
            />
          </Box>
        </CardContent>
      </Card>

      <Card elevation={0} sx={cardShellSx}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" component="h2" sx={sectionTitleSx}>
            Password
          </Typography>
          <Typography variant="body2" sx={sectionLeadSx}>
            Leave password fields blank to keep your current password. To change it, enter your current password
            first.
          </Typography>
          <Box sx={passwordGridSx}>
            <Box sx={{ gridColumn: { xs: "auto", md: "1 / -1" } }}>
              <TextField
                fullWidth
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={saving}
                autoComplete="current-password"
              />
            </Box>
            <TextField
              fullWidth
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={saving}
              helperText={PASSWORD_RULES}
              autoComplete="new-password"
            />
            <TextField
              fullWidth
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
              autoComplete="new-password"
            />
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              mt: 3,
              pt: 3,
              borderTop: `1px solid ${alpha(embedded ? accentPrimary : "#000", embedded ? 0.12 : 0.08)}`,
              alignItems: { xs: "stretch", sm: "center" },
            }}
            flexWrap="wrap"
          >
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              sx={{
                bgcolor: accentPrimary,
                px: 3,
                py: 1,
                "&:hover": { bgcolor: accentPrimary, filter: "brightness(0.92)" },
              }}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {!embedded && (
              <Button component={Link} to={backHref} disabled={saving} sx={{ alignSelf: { sm: "center" } }}>
                Back to dashboard
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );

  return (
    embedded ? (
      <Stack
        spacing={2.5}
        sx={{
          width: "100%",
          p: { xs: 2, sm: 3 },
          "& .MuiInputLabel-root, & .MuiFormHelperText-root": { color: "#000" },
          "& .MuiOutlinedInput-root fieldset": { borderColor: alpha(accentPrimary, 0.22) },
          "& .MuiOutlinedInput-root:hover fieldset": { borderColor: alpha(accentPrimary, 0.34) },
          "& .MuiOutlinedInput-root.Mui-focused fieldset": { borderColor: accentPrimary },
          "& .MuiInputBase-input": { color: "#000" },
        }}
      >
        {profileHeader}
        {error && (
          <Alert severity="error" sx={{ mb: 0 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 0 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
        {formBody}
      </Stack>
    ) : (
      <Container maxWidth="md" sx={containerSx}>
        <Stack spacing={2.5} sx={{ width: "100%" }}>
          {profileHeader}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}
          {formBody}
        </Stack>
      </Container>
    )
  );
}
