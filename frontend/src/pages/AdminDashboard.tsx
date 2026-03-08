import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { Redirect } from "react-router-dom";
import { fetchAllUsers, getUser, logout, updateSuperUser } from "../service/auth";
import Switch from "@mui/material/Switch";

const dashboardTheme = {
  primary: "#1EB7FF",
  success: "#1BB934",
  text: "#1F2D3D",
  textMuted: "#868E96",
  bg: "#F8F9FA",
  cardShadow: "0 1px 2px 0 rgba(31, 45, 61, 0.07)",
  border: "1px solid #DEE2E6",
};

interface Column {
  id: "id" | "username" | "email" | "is_superuser";
  label: string;
  minWidth?: number;
  align?: "right";
  format?: (value: boolean) => string;
}

const columns: readonly Column[] = [
  { id: "id", label: "id", minWidth: 50 },
  { id: "username", label: "Username", minWidth: 150 },
  { id: "email", label: "E-mail", minWidth: 100 },
  {
    id: "is_superuser",
    label: "Is superuser",
    minWidth: 170,
    format: (value: boolean) => (value ? "true" : "false"),
  },
];

export default function StickyHeadTable() {
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [Users, setUsers] = React.useState<any[]>([]);
  const [user, setUser] = React.useState<any>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [authFailed, setAuthFailed] = React.useState(false);

  React.useEffect(() => {
    getUser()
      .then((data: any) => {
        setUser(data);
        setAuthLoading(false);
      })
      .catch(() => {
        setAuthLoading(false);
        setAuthFailed(true);
      });
  }, []);

  React.useEffect(() => {
    if (!user || (user.is_superuser !== true && user.is_superuser !== 1)) return;
    fetchAllUsers()
      .then((data: any) => setUsers(data))
      .catch((error) => console.warn(error.message));
  }, [user]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const handleSuperuser = (id: number, newValue: boolean) => {
    const payload = {
      username: "",
      email: "",
      is_superuser: newValue,
      password: "",
    };
    updateSuperUser(id, payload);
    window.location.reload();
  };

  const handleSignOut = () => {
    logout();
    window.location.replace("/");
  };

  if (authFailed) {
    return <Redirect to="/signin?session=expired" />;
  }
  if (authLoading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: dashboardTheme.bg,
          position: "relative",
        }}
      >
        <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
          <Button
            variant="outlined"
            onClick={() => {
              logout();
              window.location.replace("/");
            }}
            sx={{
              borderColor: dashboardTheme.primary,
              color: dashboardTheme.primary,
              "&:hover": {
                borderColor: dashboardTheme.primary,
                bgcolor: "rgba(30, 183, 255, 0.08)",
              },
            }}
          >
            Sign out
          </Button>
        </Box>
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress sx={{ color: dashboardTheme.primary }} />
        </Box>
      </Box>
    );
  }
  if (user && !(user.is_superuser === true || user.is_superuser === 1)) {
    return <Redirect to="/" />;
  }

  const cardSx = {
    boxShadow: dashboardTheme.cardShadow,
    border: dashboardTheme.border,
    borderRadius: 1,
    overflow: "hidden",
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: dashboardTheme.bg }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
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
          <Box>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "2rem", md: "2.5rem" },
                fontWeight: 300,
                color: dashboardTheme.text,
                mb: 0.5,
              }}
            >
              User Management
            </Typography>
            <Typography variant="body2" sx={{ color: dashboardTheme.textMuted }}>
              Manage users and administrator access.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={handleSignOut}
            sx={{
              borderColor: dashboardTheme.primary,
              color: dashboardTheme.primary,
              "&:hover": {
                borderColor: dashboardTheme.primary,
                bgcolor: "rgba(30, 183, 255, 0.08)",
              },
            }}
          >
            Sign out
          </Button>
        </Box>

        <Card sx={cardSx}>
          <TableContainer sx={{ maxHeight: 500 }}>
            <Table stickyHeader aria-label="sticky table">
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.align}
                      style={{ minWidth: column.minWidth }}
                      sx={{
                        bgcolor: dashboardTheme.bg,
                        color: dashboardTheme.text,
                        fontWeight: 600,
                        borderBottom: `1px solid ${dashboardTheme.border}`,
                      }}
                    >
                      {column.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Users.slice(
                  page * rowsPerPage,
                  page * rowsPerPage + rowsPerPage
                ).map((row: any) => (
                  <TableRow hover role="checkbox" tabIndex={-1} key={row.id}>
                    {columns.map((column) => {
                      const value = row[column.id];
                      return (
                        <TableCell
                          key={column.id}
                          align={column.align}
                          sx={{ color: dashboardTheme.text }}
                        >
                          {column.format && typeof value === "boolean" ? (
                            <Switch
                              checked={!!value}
                              onChange={(_, checked) =>
                                handleSuperuser(row.id, checked)
                              }
                              sx={{
                                "& .MuiSwitch-switchBase.Mui-checked": {
                                  color: dashboardTheme.success,
                                },
                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                                  {
                                    backgroundColor: dashboardTheme.success,
                                  },
                              }}
                            />
                          ) : (
                            value
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[10, 25, 100]}
            component="div"
            count={Users.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{
              borderTop: `1px solid ${dashboardTheme.border}`,
              color: dashboardTheme.textMuted,
            }}
          />
        </Card>
      </Container>
    </Box>
  );
}
