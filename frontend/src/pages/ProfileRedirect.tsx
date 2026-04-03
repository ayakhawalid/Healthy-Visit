import * as React from "react";
import { Redirect } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { getUser } from "../service/auth";

/** Sends /profile to the correct dashboard with the profile view (sidebar preserved). */
export default function ProfileRedirect() {
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#F8F9FA" }}>
        <CircularProgress sx={{ color: "#1EB7FF" }} />
      </Box>
    );
  }
  if (!user) {
    return <Redirect to="/signin?session=expired" />;
  }
  if (user.is_superuser === true || user.is_superuser === 1) {
    return <Redirect to="/admin-dashboard?view=profile" />;
  }
  if (user.is_researcher === true || user.is_researcher === 1) {
    return <Redirect to="/researcher-dashboard?view=profile" />;
  }
  return <Redirect to="/patient-dashboard?view=profile" />;
}
