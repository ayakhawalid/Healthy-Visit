import logo from "./../logo.svg";
import Button from "@mui/material/Button";
import { logout, getUser, login } from "../service/auth";
import * as React from "react";
import { Typography, Box, TextField, Paper, Stack, InputAdornment, IconButton } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { Link } from "react-router-dom";

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

function Index() {
  const [Auth, setAuth] = React.useState(false);
  const [User, setUser] = React.useState<{ username?: string; is_superuser?: boolean }>({});
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  React.useEffect(() => {
    getUser()
      .then((data) => {
        setUser(data);
        setAuth(true);
      })
      .catch((error) => {
        console.warn(error.message);
      });
  }, []);

  const handleLogout = () => {
    logout();
    setAuth(false);
  };

  const handleLogin = () => {
    if (!username.trim() || !password) {
      alert("Please enter username and password");
      return;
    }
    login(username.trim(), password);
  };

  return (
    <div className="App" style={{ width: "100%", maxWidth: 480 }}>
      {Auth ? (
          <Typography variant="h6" color="textSecondary">
            You're all set.
          </Typography>
        ) : (
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
                Welcome back!
              </Typography>
              <Stack spacing={2.5} sx={{ mt: 3 }}>
                <TextField
                  fullWidth
                  placeholder="Username"
                  variant="outlined"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="signup-input"
                  sx={inputSx}
                />
                <TextField
                  fullWidth
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  variant="outlined"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="signup-input"
                  sx={inputSx}
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
                  onClick={handleLogin}
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
                  Sign In
                </Button>
              </Stack>
            </Paper>
            <Typography sx={{ mt: 3, color: "#666", fontSize: "1.1rem" }}>
              Don't have an account?{" "}
              <Link to="/signup" style={{ color: "#16a34a", fontWeight: 600, textDecoration: "underline" }}>
                Sign up
              </Link>
            </Typography>
          </>
        )}
    </div>
  );
}

export default Index;
