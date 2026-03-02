import * as React from "react";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { Redirect } from "react-router-dom";
import Header from "./../components/dashHeader";
import { fetchAllUsers, getUser, updateSuperUser } from "./../service/auth";
import Switch from '@mui/material/Switch';

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

  const handleSuperuser = (id: string, value: boolean) => {
    let payload = {
      username: "",
      email: "",
      is_superuser: value,
      password: "",
  }
    updateSuperUser(Number(id), payload);
    window.location.reload()
  }

  if (authFailed) {
    return <Redirect to="/signin?session=expired" />;
  }
  if (authLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }
  if (user && !(user.is_superuser === true || user.is_superuser === 1)) {
    return <Redirect to="/" />;
  }

  return (
    <div>
      <Header user={user} />
      <Paper sx={{ width: "90%", overflow: "hidden", m: "auto", mt: 8 }}>
        <TableContainer sx={{ maxHeight: 500 }}>
          <Table stickyHeader aria-label="sticky table">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    style={{ minWidth: column.minWidth }}
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
              ).map((row: any) => {
                return (
                  <TableRow hover role="checkbox" tabIndex={-1} key={row.id}>
                    {columns.map((column) => {
                      const value = row[column.id];
                      return (
                        <TableCell key={column.id} align={column.align}>
                          {column.format && typeof value === "boolean"
                            ? value? <Switch onChange={e=>{handleSuperuser(row["id"],value)}} defaultChecked />:<Switch onChange={e=>{handleSuperuser(row["id"],value)}}/>
                            : value}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
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
        />
      </Paper>
    </div>
  );
}
