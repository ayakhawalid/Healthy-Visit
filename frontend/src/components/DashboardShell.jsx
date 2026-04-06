import React from "react";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { CaretLeft, CaretRight, SignOut, User } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import logo from "../logo.svg";

export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

/** Matches PatientDashboard sidebar chrome (logo, avatar, collapse, profile + logout). */
export default function DashboardShell({
  user,
  sidebarOpen,
  setSidebarOpen,
  onLogout,
  onProfileClick,
  profileSelected = false,
  profileHref = "/profile",
  theme,
  navItems,
  children,
}) {
  const sidebarWidth = sidebarOpen ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: theme.bg, width: "100%" }}>
      <Box sx={{ width: sidebarWidth, flexShrink: 0, transition: "width 0.25s ease" }} />
      <Box
        sx={{
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 1100,
          width: sidebarWidth,
          height: "100vh",
          bgcolor: "#fff",
          display: "flex",
          flexDirection: "column",
          boxShadow: theme.cardShadow,
          overflow: "hidden",
          transition: "width 0.25s ease",
        }}
      >
        <Box
          sx={{
            p: sidebarOpen ? 1.5 : 1,
            flexShrink: 0,
            display: "flex",
            flexDirection: sidebarOpen ? "column" : "row",
            alignItems: sidebarOpen ? "stretch" : "center",
            justifyContent: sidebarOpen ? "flex-start" : "center",
            gap: 1,
            minHeight: 56,
          }}
        >
          {sidebarOpen && (
            <>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <img src={logo} alt="" style={{ height: 36, width: 36, flexShrink: 0 }} />
                <Typography
                  sx={{
                    flex: 1,
                    fontFamily: "Roboto, sans-serif",
                    fontWeight: 600,
                    color: "#16a34a",
                    fontSize: "1.4rem",
                    lineHeight: 1.2,
                  }}
                >
                  Healthy Visit
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setSidebarOpen(false)}
                  sx={{ flexShrink: 0, color: theme.textMuted }}
                  aria-label="Close sidebar"
                >
                  <CaretLeft size={20} />
                </IconButton>
              </Box>
              <Divider sx={{ flexShrink: 0, my: 1, mx: -1.5 }} />
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: theme.logoGreen,
                    color: "#fff",
                    "& svg": { color: "inherit" },
                  }}
                >
                  <User size={20} weight="duotone" />
                </Avatar>
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.text,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user?.username ?? ""}
                </Typography>
              </Box>
              <Divider sx={{ flexShrink: 0, mt: 1, mx: -1.5 }} />
            </>
          )}
          {!sidebarOpen && (
            <IconButton
              size="medium"
              onClick={() => setSidebarOpen(true)}
              sx={{ color: theme.textMuted }}
              aria-label="Open sidebar"
            >
              <CaretRight size={24} />
            </IconButton>
          )}
        </Box>
        <List sx={{ py: 1, flex: 1, overflow: "auto" }}>{navItems}</List>
        <Divider sx={{ flexShrink: 0 }} />
        <List sx={{ flexShrink: 0, py: 1 }}>
          {onProfileClick ? (
            <ListItemButton
              selected={profileSelected}
              onClick={onProfileClick}
              sx={{
                ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}),
                ...(theme.sidebarSelectedBg
                  ? {
                      "&.Mui-selected": {
                        bgcolor: theme.sidebarSelectedBg,
                        color: theme.text,
                        "&:hover": { bgcolor: theme.sidebarSelectedHoverBg ?? theme.sidebarSelectedBg },
                        "&.Mui-focusVisible": {
                          bgcolor: theme.sidebarSelectedHoverBg ?? theme.sidebarSelectedBg,
                        },
                        "& .MuiListItemIcon-root": { color: theme.text },
                      },
                    }
                  : {}),
              }}
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
                <User size={22} />
              </ListItemIcon>
              {sidebarOpen && <ListItemText primary="My profile" />}
            </ListItemButton>
          ) : (
            <ListItemButton
              component={Link}
              to={profileHref}
              selected={profileSelected}
              sx={{
                ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}),
                ...(theme.sidebarSelectedBg
                  ? {
                      "&.Mui-selected": {
                        bgcolor: theme.sidebarSelectedBg,
                        color: theme.text,
                        "&:hover": { bgcolor: theme.sidebarSelectedHoverBg ?? theme.sidebarSelectedBg },
                        "&.Mui-focusVisible": {
                          bgcolor: theme.sidebarSelectedHoverBg ?? theme.sidebarSelectedBg,
                        },
                        "& .MuiListItemIcon-root": { color: theme.text },
                      },
                    }
                  : {}),
              }}
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
                <User size={22} />
              </ListItemIcon>
              {sidebarOpen && <ListItemText primary="My profile" />}
            </ListItemButton>
          )}
          <ListItemButton
            onClick={onLogout}
            sx={{ color: theme.logoGreen, ...(!sidebarOpen ? { justifyContent: "center", px: 0 } : {}) }}
          >
            <ListItemIcon
              sx={{
                minWidth: 40,
                width: 40,
                height: 40,
                justifyContent: "center",
                alignItems: "center",
                color: "inherit",
                "& svg": { width: 22, height: 22, flexShrink: 0 },
              }}
            >
              <SignOut size={22} />
            </ListItemIcon>
            {sidebarOpen && <ListItemText primary="Logout" />}
          </ListItemButton>
        </List>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, minHeight: "100vh", overflow: "auto" }}>{children}</Box>
    </Box>
  );
}
