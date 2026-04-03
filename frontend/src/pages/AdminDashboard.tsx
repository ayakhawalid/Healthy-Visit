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
import { Redirect, useHistory, useLocation } from "react-router-dom";
import {
  fetchAllUsers,
  getUser,
  logout,
  registerResearcher,
  updateResearcher,
  updateSuperUser,
  updateUserAdmin,
  deleteUser,
} from "../service/auth";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import IconButton from "@mui/material/IconButton";
import {
  validateSignupFields,
  validateUsername,
  validateEmail,
  validatePassword,
  USERNAME_RULES,
  EMAIL_RULES,
  PASSWORD_RULES,
} from "../utils/validation";
import Switch from "@mui/material/Switch";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { Users as UsersIcon } from "@phosphor-icons/react";
import DashboardShell from "../components/DashboardShell";
import ProfileFormContent from "../components/ProfileFormContent";

const dashboardTheme = {
  primary: "#1EB7FF",
  success: "#1BB934",
  text: "#1F2D3D",
  textMuted: "#868E96",
  bg: "#F8F9FA",
  cardShadow: "0 1px 2px 0 rgba(31, 45, 61, 0.07)",
  border: "1px solid #DEE2E6",
};

const shellTheme = {
  ...dashboardTheme,
  logoGreen: "#16a34a",
  cardShadow: "0 2px 8px rgba(31, 45, 61, 0.1), 0 1px 2px rgba(31, 45, 61, 0.06)",
};

interface Column {
  id: "id" | "username" | "email" | "is_superuser" | "is_researcher";
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
    label: "Admin",
    minWidth: 120,
    format: (value: boolean) => (value ? "true" : "false"),
  },
  {
    id: "is_researcher",
    label: "Researcher",
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
  const [researcherOpen, setResearcherOpen] = React.useState(false);
  const [newRUsername, setNewRUsername] = React.useState("");
  const [newREmail, setNewREmail] = React.useState("");
  const [newRPassword, setNewRPassword] = React.useState("");
  const [researcherError, setResearcherError] = React.useState<string | null>(null);
  const [researcherSaving, setResearcherSaving] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editRow, setEditRow] = React.useState<any>(null);
  const [editUsername, setEditUsername] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editPassword, setEditPassword] = React.useState("");
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editSaving, setEditSaving] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteRow, setDeleteRow] = React.useState<any>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [sidebarView, setSidebarView] = React.useState<"users" | "profile">("users");
  const history = useHistory();
  const location = useLocation();

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("view") === "profile") {
      setSidebarView("profile");
    }
  }, [location.search]);

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
      is_researcher: false,
      password: "",
    };
    updateSuperUser(id, payload);
    window.location.reload();
  };

  const handleResearcherToggle = (id: number, newValue: boolean) => {
    updateResearcher(id, { is_researcher: newValue });
    window.location.reload();
  };

  const handleCreateResearcher = async () => {
    if (!newRUsername.trim() || !newREmail.trim() || !newRPassword) {
      setResearcherError("Username, email, and password are required.");
      return;
    }
    const v = validateSignupFields(newRUsername, newREmail, newRPassword);
    if (v) {
      setResearcherError(v);
      return;
    }
    setResearcherError(null);
    setResearcherSaving(true);
    try {
      await registerResearcher({
        username: newRUsername.trim(),
        email: newREmail.trim(),
        password: newRPassword,
      });
      setResearcherOpen(false);
      setNewRUsername("");
      setNewREmail("");
      setNewRPassword("");
      window.location.reload();
    } catch (e: any) {
      setResearcherError(e?.message || "Could not create researcher.");
    } finally {
      setResearcherSaving(false);
    }
  };

  const handleSignOut = () => {
    logout();
    window.location.replace("/");
  };

  const openEdit = (row: any) => {
    setEditRow(row);
    setEditUsername(row.username || "");
    setEditEmail(row.email || "");
    setEditPassword("");
    setEditError(null);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editRow) return;
    setEditError(null);
    const uErr = validateUsername(editUsername);
    if (uErr) {
      setEditError(uErr);
      return;
    }
    const eErr = validateEmail(editEmail);
    if (eErr) {
      setEditError(eErr);
      return;
    }
    if (editPassword.trim()) {
      const pErr = validatePassword(editPassword);
      if (pErr) {
        setEditError(pErr);
        return;
      }
    }
    setEditSaving(true);
    try {
      const payload: { username: string; email: string; password?: string } = {
        username: editUsername.trim(),
        email: editEmail.trim().toLowerCase(),
      };
      if (editPassword.trim()) {
        payload.password = editPassword;
      }
      await updateUserAdmin(editRow.id, payload);
      setEditOpen(false);
      window.location.reload();
    } catch (e: any) {
      setEditError(e?.message || "Could not update user.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteRow) return;
    setDeleteError(null);
    setDeleteSaving(true);
    try {
      await deleteUser(deleteRow.id);
      setDeleteOpen(false);
      window.location.reload();
    } catch (e: any) {
      setDeleteError(e?.message || "Could not delete user.");
    } finally {
      setDeleteSaving(false);
    }
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress sx={{ color: dashboardTheme.primary }} />
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
    <DashboardShell
      user={user}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      onLogout={handleSignOut}
      onProfileClick={() => {
        setSidebarView("profile");
        history.replace("/admin-dashboard?view=profile");
      }}
      profileSelected={sidebarView === "profile"}
      theme={shellTheme}
      navItems={
        <ListItemButton
          selected={sidebarView === "users"}
          onClick={() => {
            setSidebarView("users");
            history.replace("/admin-dashboard");
          }}
          sx={!sidebarOpen ? { justifyContent: "center", px: 0 } : {}}
        >
          <ListItemIcon
            sx={{
              minWidth: 40,
              width: 40,
              height: 40,
              justifyContent: "center",
              alignItems: "center",
              "& svg": { width: 22, height: 22, flexShrink: 0 },
            }}
          >
            <UsersIcon size={22} />
          </ListItemIcon>
          {sidebarOpen && <ListItemText primary="User management" />}
        </ListItemButton>
      }
    >
      {sidebarView === "users" && (
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
              Manage patients, administrators, and researchers (nurses, nutritionists, doctors, specialists).
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={() => {
              setResearcherError(null);
              setResearcherOpen(true);
            }}
            sx={{
              bgcolor: dashboardTheme.primary,
              "&:hover": { bgcolor: "#1899d9" },
            }}
          >
            Add researcher
          </Button>
        </Box>

        <Dialog open={editOpen} onClose={() => !editSaving && setEditOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Edit user</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {editError && (
                <Alert severity="error" onClose={() => setEditError(null)}>
                  {editError}
                </Alert>
              )}
              <TextField
                label="Username"
                fullWidth
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                disabled={editSaving}
                helperText={USERNAME_RULES}
              />
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                disabled={editSaving}
                helperText={EMAIL_RULES}
              />
              <TextField
                label="New password (optional)"
                type="password"
                fullWidth
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                disabled={editSaving}
                helperText={editPassword ? PASSWORD_RULES : "Leave blank to keep the current password."}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={deleteOpen} onClose={() => !deleteSaving && setDeleteOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Delete user</DialogTitle>
          <DialogContent>
            {deleteError && (
              <Alert severity="error" sx={{ mb: 1 }} onClose={() => setDeleteError(null)}>
                {deleteError}
              </Alert>
            )}
            <Typography variant="body2">
              Delete{" "}
              <strong>{deleteRow?.username}</strong> ({deleteRow?.email})? This cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteOpen(false)} disabled={deleteSaving}>
              Cancel
            </Button>
            <Button color="error" variant="contained" onClick={handleConfirmDelete} disabled={deleteSaving}>
              {deleteSaving ? "Deleting…" : "Delete"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={researcherOpen} onClose={() => !researcherSaving && setResearcherOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Add researcher account</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {researcherError && (
                <Alert severity="error" onClose={() => setResearcherError(null)}>
                  {researcherError}
                </Alert>
              )}
              <TextField
                label="Username"
                fullWidth
                value={newRUsername}
                onChange={(e) => setNewRUsername(e.target.value)}
                disabled={researcherSaving}
                helperText={USERNAME_RULES}
              />
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={newREmail}
                onChange={(e) => setNewREmail(e.target.value)}
                disabled={researcherSaving}
                helperText={EMAIL_RULES}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                value={newRPassword}
                onChange={(e) => setNewRPassword(e.target.value)}
                disabled={researcherSaving}
                helperText={PASSWORD_RULES}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResearcherOpen(false)} disabled={researcherSaving}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleCreateResearcher} disabled={researcherSaving}>
              {researcherSaving ? "Creating…" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>

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
                  <TableCell
                    align="right"
                    sx={{
                      bgcolor: dashboardTheme.bg,
                      color: dashboardTheme.text,
                      fontWeight: 600,
                      borderBottom: `1px solid ${dashboardTheme.border}`,
                      minWidth: 100,
                    }}
                  >
                    Actions
                  </TableCell>
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
                          {column.id === "is_superuser" && column.format && typeof value === "boolean" ? (
                            <Switch
                              checked={!!value}
                              onChange={(_, checked) =>
                                handleSuperuser(row.id, checked)
                              }
                              disabled={!!row.is_researcher}
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
                          ) : column.id === "is_researcher" && column.format && typeof value === "boolean" ? (
                            <Switch
                              checked={!!value}
                              onChange={(_, checked) =>
                                handleResearcherToggle(row.id, checked)
                              }
                              disabled={!!row.is_superuser}
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
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <IconButton
                        size="small"
                        aria-label="Edit user"
                        onClick={() => openEdit(row)}
                        sx={{ color: dashboardTheme.primary }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Delete user"
                        disabled={row.id === user?.id}
                        onClick={() => {
                          setDeleteRow(row);
                          setDeleteError(null);
                          setDeleteOpen(true);
                        }}
                        sx={{ color: dashboardTheme.textMuted }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
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
      )}
      {sidebarView === "profile" && (
        <ProfileFormContent embedded accentPrimary={dashboardTheme.primary} />
      )}
    </DashboardShell>
  );
}
