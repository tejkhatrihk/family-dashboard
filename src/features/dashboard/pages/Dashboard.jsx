import MenuPanel from "@/shared/components/MenuPanel";
import { useState } from "react";
import CalendarPanel from "../components/CalendarPanel";
import ShoppingListPanel from "../components/ShoppingListPanel";

import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Paper,
  Toolbar,
  Typography,
} from "@mui/material";

const DRAWER_WIDTH = 360;

export default function Dashboard() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#fafafa",
      }}
    >
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={() => setDrawerOpen((prev) => !prev)}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Family Dashboard
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar drawer */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            maxWidth: "85vw",
            p: 2,
            gap: 2,
            boxSizing: "border-box",
          },
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Family Dashboard
        </Typography>

        <MenuPanel />
        <ShoppingListPanel />
      </Drawer>

      {/* Main content — full-screen calendar */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            m: 2,
          }}
        >
          <CalendarPanel />
        </Paper>
      </Box>
    </Box>
  );
}
