import {
  AppBar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  CircularProgress,
} from "@mui/material";
import { createTheme, ThemeProvider } from '@mui/material/styles';
import PersonIcon from '@mui/icons-material/Person';
import MoreIcon from "@mui/icons-material/MoreVert";
import * as React from "react";
import { getUser, logout } from "../service/auth";
import { Redirect } from "react-router-dom";

interface PrimarySearchAppBarProps {
  user?: { username?: string; is_superuser?: boolean } | null;
}

export default function PrimarySearchAppBar(props: PrimarySearchAppBarProps) {
  const { user: userProp } = props;
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [mobileMoreAnchorEl, setMobileMoreAnchorEl] =
    React.useState<null | HTMLElement>(null);

  const isMenuOpen = Boolean(anchorEl);
  const isMobileMenuOpen = Boolean(mobileMoreAnchorEl);

  const [authLoading, setAuthLoading] = React.useState(!userProp);
  const [authState, setAuthState] = React.useState<boolean | number | null>(userProp ? (userProp.is_superuser ?? true) : null);
  const [authFailed, setAuthFailed] = React.useState(false);
  const [User, setUser] = React.useState<any>(userProp ?? {});

  const theme = createTheme({
    palette: {
      success: {
        main: '#fff',
      },
    },
  });

  React.useEffect(() => {
    if (userProp) {
      setUser(userProp);
      setAuthState(userProp.is_superuser ?? true);
      setAuthLoading(false);
      return;
    }
    getUser()
      .then((data: any) => {
        setUser(data);
        setAuthState(data.is_superuser);
        setAuthLoading(false);
      })
      .catch(() => {
        setAuthFailed(true);
        setAuthLoading(false);
      });
  }, [userProp]);

  const signout = () => {
    setAnchorEl(null);
    handleMobileMenuClose();
    logout();
    window.location.replace("/");
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMoreAnchorEl(null);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    handleMobileMenuClose();
  };

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMoreAnchorEl(event.currentTarget);
  };

  const backtohome = () =>{
    setAnchorEl(null);
    handleMobileMenuClose();
    window.location.replace("/");
  }

  const menuId = "primary-search-account-menu";
  const renderMenu = (
    <Menu
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      id={menuId}
      keepMounted
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      open={isMenuOpen}
      onClose={handleMenuClose}
    >
      <MenuItem onClick={backtohome}>Home</MenuItem>
      <MenuItem onClick={signout}>Logout</MenuItem>
    </Menu>
  );

  const mobileMenuId = "primary-search-account-menu-mobile";
  const renderMobileMenu = (
    <Menu
      anchorEl={mobileMoreAnchorEl}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      id={mobileMenuId}
      keepMounted
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      open={isMobileMenuOpen}
      onClose={handleMobileMenuClose}
    >
      <MenuItem onClick={backtohome}>Home</MenuItem>
      <MenuItem onClick={signout}>Logout</MenuItem>
    </Menu>
  );
  if (authFailed) {
    return <Redirect to="/signin?session=expired" />;
  }
  if (authLoading) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" style={{ backgroundColor: "#0A1929" }}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Dashboard
            </Typography>
            <CircularProgress size={24} sx={{ color: "white" }} />
          </Toolbar>
        </AppBar>
      </Box>
    );
  }
  if (authState === false || authState === 0) {
    return <Redirect to="/" />;
  }
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" style={{ backgroundColor: "#0A1929" }}>
        <Toolbar>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ display: { xs: "none", sm: "block" } }}
          >
            Dashboard | Administrator
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: { xs: "none", md: "flex" } }}>
          <ThemeProvider theme={theme}>
            <Button
              variant="outlined"
              aria-controls={menuId}
              color="success"
              onClick={handleProfileMenuOpen}
              startIcon={<PersonIcon/>}
            >
              {User.username}
            </Button>
          </ThemeProvider>
          </Box>
          <Box sx={{ display: { xs: "flex", md: "none" } }}>
            <IconButton
              size="large"
              aria-label="show more"
              aria-controls={mobileMenuId}
              aria-haspopup="true"
              onClick={handleMobileMenuOpen}
              color="inherit"
            >
              <MoreIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      {renderMobileMenu}
      {renderMenu}
    </Box>
  );
}
