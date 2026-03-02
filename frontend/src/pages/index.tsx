import logo from "./../logo.svg";
import Button from "@mui/material/Button";
import { logout, getUser, login } from "../service/auth";
import * as React from "react";
import { Typography, Box, TextField, Paper, Stack } from "@mui/material";
import { Link } from "react-router-dom";

function Index() {
  const [Auth, setAuth] = React.useState(false);
  const [User, setUser] = React.useState<{ username?: string; is_superuser?: boolean }>({});
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

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
    <div className="App">
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: { xs: "column", md: "row" },
        }}
      >
        {/* Left half: green with white logo */}
        <Box
          sx={{
            flex: 1,
            bgcolor: "#16a34a",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 4,
          }}
        >
          <img
            src={logo}
            className="App-logo"
            alt="logo"
            style={{ filter: "brightness(0) invert(1)" }}
          />
          {Auth && (
            <Typography variant="h5" sx={{ mt: 2, color: "rgba(255,255,255,0.95)" }}>
              Welcome back, {User.username}!
            </Typography>
          )}
        </Box>

        {/* Right half: white with sign-in section */}
        <Box
          sx={{
            flex: 1,
            bgcolor: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 4,
            px: 2,
          }}
        >
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
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 2, mb: 3 }}>
                  <img src={logo} alt="logo" style={{ height: 56 }} />
                  <Typography variant="h4" sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 600, color: "#16a34a", fontSize: "1.75rem" }}>
                    Healthy Visit
                  </Typography>
                </Box>
                <Typography variant="h4" gutterBottom sx={{ fontFamily: '"DM Sans", sans-serif', fontWeight: 600, color: "#16a34a", fontSize: "2.5rem", mb: 3, textAlign: "left" }}>
                  Welcome back!
                </Typography>
                <Stack spacing={2.5} sx={{ mt: 3 }}>
                  <TextField
                    fullWidth
                    placeholder="Username"
                    variant="outlined"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="home-signin-input"
                    sx={{
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
                    }}
                  />
                  <TextField
                    fullWidth
                    type="password"
                    placeholder="Password"
                    variant="outlined"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="home-signin-input"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        bgcolor: "#eee",
                        borderRadius: 1.5,
                        minHeight: 56,
                        "& fieldset": { borderColor: "#ddd" },
                        "&.Mui-focused fieldset": { borderColor: "#555", borderWidth: "1px" },
                        "&.Mui-focused": { boxShadow: "none" },
                        "&:hover fieldset": { borderColor: "#bbb" },
                      },
                      "& .MuiInputBase-input": { color: "#333", py: 1.5, fontSize: "1.1rem" },
                      "& .MuiInputBase-input::placeholder": { color: "#666", opacity: 1 },
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
        </Box>
      </Box>
    </div>
  );
}

export default Index;
