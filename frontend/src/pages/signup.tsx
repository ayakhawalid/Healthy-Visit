import * as React from "react";
import { register } from "../service/auth";
import {
  Button,
  Box,
  TextField,
  Paper,
  Stack,
  Typography,
  InputAdornment,
  IconButton,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { Link } from "react-router-dom";
import logo from "../logo.svg";

const inputSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "#eee",
    borderRadius: 1.5,
    minHeight: 56,
    "& fieldset": { borderColor: "#ddd" },
    "&.Mui-focused fieldset": { borderColor: "#555", borderWidth: "1px" },
    "&:hover fieldset": { borderColor: "#bbb" },
    "&.Mui-focused": { boxShadow: "none" },
  },
  "& .MuiInputBase-input": { color: "#333", py: 1.5, fontSize: "1.1rem" },
  "& .MuiInputBase-input::placeholder": { color: "#666", opacity: 1 },
};

function SignUp() {
  const [user, setUser] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const handleRegistration = () => {
    if (!user.trim() || !email.trim() || !pass) {
      alert("Please fill in username, email and password");
      return;
    }
    register({
      username: user.trim(),
      email: email.trim(),
      is_superuser: false,
      password: pass,
    });
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
            <Typography variant="h4" sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 600, color: "#16a34a", fontSize: "1.75rem" }}>
              Healthy Visit
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, marginTop: "3px" }}>
            <Box sx={{ width: 56, flexShrink: 0 }} />
            <Typography variant="body1" sx={{ fontFamily: '"Poppins", sans-serif', color: "#666", fontSize: "0.95rem" }}>
              An AI-Driven Virtual Visit
            </Typography>
          </Box>
        </Box>
        <Typography variant="h4" gutterBottom sx={{ fontFamily: '"DM Sans", sans-serif', fontWeight: 600, color: "#16a34a", fontSize: "2.75rem", mb: 3, textAlign: "left" }}>
          Create account
        </Typography>
        <Stack component="form" autoComplete="off" spacing={2.5} sx={{ mt: 3 }}>
          <TextField
            fullWidth
            placeholder="Username"
            variant="outlined"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="signup-input"
            sx={inputSx}
            inputProps={{ autoComplete: "off", name: "signup_username" }}
          />
          <TextField
            fullWidth
            type="email"
            placeholder="Email"
            variant="outlined"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="signup-input"
            sx={inputSx}
            inputProps={{ autoComplete: "off", name: "signup_email" }}
          />
          <TextField
            fullWidth
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            variant="outlined"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="signup-input"
            sx={inputSx}
            inputProps={{ autoComplete: "new-password", name: "signup_password" }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((p) => !p)}
                    edge="end"
                    sx={{ color: "#555" }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            fullWidth
            variant="contained"
            onClick={handleRegistration}
            className="home-signin-button"
            sx={{
              bgcolor: "#16a34a",
              borderRadius: 0.75,
              py: 2,
              fontSize: "1.1rem",
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              minHeight: 56,
              "&:hover": { bgcolor: "#15803d" },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            Sign Up
          </Button>
        </Stack>
      </Paper>
      <Typography sx={{ mt: 3, color: "#666", fontSize: "1.1rem", textAlign: "center", width: "100%" }}>
        Already have an account?{" "}
        <Link to="/" style={{ color: "#16a34a", fontWeight: 600, textDecoration: "underline" }}>
          Sign in
        </Link>
      </Typography>
    </>
  );
}

export default SignUp;
