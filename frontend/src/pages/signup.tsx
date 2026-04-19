import * as React from "react";
import { register } from "../service/auth";
import {
  Box,
  Button,
  TextField,
  Paper,
  Stack,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { Link } from "react-router-dom";
import logo from "../logo.svg";
import { validateSignupFields } from "../utils/validation";

/** Compact inputs for the form only — logo block above is unchanged. */
const formInputSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "#eee",
    borderRadius: 1.25,
    minHeight: 44,
    "& fieldset": { borderColor: "#ddd" },
    "&.Mui-focused fieldset": { borderColor: "#555", borderWidth: "1px" },
    "&:hover fieldset": { borderColor: "#bbb" },
    "&.Mui-focused": { boxShadow: "none" },
  },
  "& .MuiInputBase-input": { color: "#333", py: 1, fontSize: "0.95rem" },
  "& .MuiInputBase-input::placeholder": { color: "#666", opacity: 1 },
};

function SignUp() {
  const [user, setUser] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [confirmPass, setConfirmPass] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleRegistration = async () => {
    if (!user.trim() || !email.trim() || !pass || !confirmPass) {
      setSubmitError("Please fill in all fields.");
      return;
    }
    if (pass !== confirmPass) {
      setSubmitError("Passwords do not match.");
      return;
    }
    const validationError = validateSignupFields(user, email, pass);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const data: any = await register({
        username: user.trim(),
        email: email.trim(),
        is_superuser: false,
        password: pass,
      });
      if (data?.id != null) {
        localStorage.setItem("onboarding_patient_id", String(data.id));
      }
      localStorage.removeItem("onboarding_language_choice");
      window.location.replace("/onboarding");
    } catch (err: any) {
      setSubmitError(err?.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          width: "100%",
          maxWidth: 480,
          borderRadius: 2,
          bgcolor: "transparent",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <img src={logo} alt="logo" style={{ height: 56 }} />
            <Typography variant="h4" sx={{ fontFamily: "Roboto, sans-serif", fontWeight: 600, color: "#16a34a", fontSize: "1.75rem" }}>
              Healthy Visit
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, marginTop: "3px" }}>
            <Box sx={{ width: 56, flexShrink: 0 }} />
            <Typography variant="body1" sx={{ fontFamily: "Roboto, sans-serif", color: "#666", fontSize: "0.95rem" }}>
              An AI-Driven Virtual Visit
            </Typography>
          </Box>
        </Box>
        <Typography
          variant="h5"
          component="h2"
          sx={{
            fontFamily: "Roboto, sans-serif",
            fontWeight: 600,
            color: "#16a34a",
            fontSize: { xs: "1.35rem", sm: "1.5rem" },
            lineHeight: 1.25,
            mb: 1.5,
            mt: 0,
            textAlign: "left",
          }}
        >
          Create account
        </Typography>
        {submitError && (
          <Alert
            severity="error"
            onClose={() => setSubmitError(null)}
            sx={{
              width: "100%",
              mb: 1,
              py: 0.75,
              alignItems: "flex-start",
              "& .MuiAlert-message": {
                fontSize: "0.8rem",
                lineHeight: 1.35,
              },
            }}
          >
            {submitError}
          </Alert>
        )}
        <Stack component="form" autoComplete="off" spacing={1.35} sx={{ mt: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Username"
            variant="outlined"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="signup-input"
            sx={formInputSx}
            inputProps={{ autoComplete: "off", name: "signup_username" }}
            helperText={false}
          />
          <TextField
            fullWidth
            size="small"
            type="email"
            placeholder="Email"
            variant="outlined"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="signup-input"
            sx={formInputSx}
            inputProps={{ autoComplete: "off", name: "signup_email" }}
            helperText={false}
          />
          <TextField
            fullWidth
            size="small"
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            variant="outlined"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="signup-input"
            sx={formInputSx}
            inputProps={{ autoComplete: "new-password", name: "signup_password" }}
            helperText={false}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((p) => !p)}
                    edge="end"
                    sx={{ color: "#555" }}
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            size="small"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm password"
            variant="outlined"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            className="signup-input"
            sx={formInputSx}
            inputProps={{ autoComplete: "new-password", name: "signup_confirm_password" }}
            helperText={false}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    edge="end"
                    sx={{ color: "#555" }}
                  >
                    {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            fullWidth
            variant="contained"
            onClick={handleRegistration}
            disabled={submitting}
            sx={{
              bgcolor: "#16a34a",
              borderRadius: 1.25,
              boxSizing: "border-box",
              minHeight: 44,
              height: 44,
              maxHeight: 44,
              py: 0,
              px: 2,
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: 0.65,
              textTransform: "uppercase",
              mt: 0.25,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              "&:hover": { bgcolor: "#15803d" },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            {submitting ? "Creating…" : "Sign Up"}
          </Button>
        </Stack>
      </Paper>
      <Typography sx={{ mt: 2, color: "#666", fontSize: "0.95rem", textAlign: "center", width: "100%" }}>
        Already have an account?{" "}
        <Link to="/" style={{ color: "#16a34a", fontWeight: 600, textDecoration: "underline" }}>
          Sign in
        </Link>
      </Typography>
    </>
  );
}

export default SignUp;
