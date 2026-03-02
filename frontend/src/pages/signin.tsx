import * as React from "react";
import {
  Button,
  Grid,
  Paper,
  Stack,
  styled,
  TextField,
  Typography,
} from "@mui/material";
import { useLocation } from "react-router-dom";
import { login } from "../service/auth";

const Item = styled(Paper)(({ theme }) => ({
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: "center",
  borderRadius: theme.spacing(0),
  color: theme.palette.text.secondary,
}));

function SignIn() {
    const [user, setUser] = React.useState("");
    const [pass, setPass] = React.useState("");
    const location = useLocation();
    const sessionExpired = new URLSearchParams(location.search).get("session") === "expired";

    React.useEffect(() => {
      if (sessionExpired) {
        alert("Session expired or could not verify login. Please sign in again. (If the backend is not running on port 9999, start it first.)");
      }
    }, [sessionExpired]);

    const handleLogin = () => {
      if (!user.trim() || !pass) {
        alert("Please enter username and password");
        return;
      }
      login(user.trim(), pass);
    }

  return (
    <Grid
      container
      spacing={0}
      direction="column"
      alignItems="center"
      justifyContent="center"
      style={{ minHeight: "100vh", backgroundColor: "#282c34" }}
    >
      <Stack
        spacing={0}
        style={{ backgroundColor: "#ffffff95" }}
        sx={{ p: 2, width: "60vh" }}
      >
        <Item>
          <Typography
            variant="h4"
            gutterBottom
            component="div"
            align="center"
            mt={3}
          >
            Sign In
          </Typography>
        </Item>
        <Item>
          <TextField
            sx={{ width: "90%" }}
            label="Username"
            variant="outlined"
            size="small"
            value={user}
            onChange={e => { setUser(e.target.value) }}
          />
        </Item>
        <Item>
          <TextField
            sx={{ width: "90%" }}
            type="password"
            label="Password"
            variant="outlined"
            size="small"
            value={pass}
            onChange={e => { setPass(e.target.value) }}
          />
        </Item>
        <Item>
          <Button variant="contained" color="secondary" onClick={handleLogin}>
            Login
          </Button>
        </Item>
        <Item></Item>
      </Stack>
    </Grid>
  );
}

export default SignIn;
