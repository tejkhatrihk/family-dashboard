import RecipesPage from "@/features/recipes/pages/RecipesPage";
import MenuPanel from "@/shared/components/MenuPanel";
import { useState } from "react";
import CalendarPanel from "../components/CalendarPanel";
import ShoppingListPanel from "../components/ShoppingListPanel";

import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import MenuIcon from "@mui/icons-material/Menu";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Toolbar,
  Typography,
} from "@mui/material";

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <CalendarTodayIcon fontSize="small" />,
  },
  { id: "recipes", label: "Recipes", icon: <MenuBookIcon fontSize="small" /> },
];

export default function Dashboard() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentView, setCurrentView] = useState("dashboard");

  const navigate = (view) => {
    setCurrentView(view);
    setDrawerOpen(false);
  };

  const viewLabel =
    NAV_ITEMS.find((n) => n.id === currentView)?.label ?? "Family Dashboard";

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
            {viewLabel}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Navigation drawer */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            maxWidth: "85vw",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, px: 2, pt: 2, pb: 1 }}>
          Family Dashboard
        </Typography>

        {/* Nav links */}
        <List disablePadding>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.id}
              selected={currentView === item.id}
              onClick={() => navigate(item.id)}
              sx={{ mx: 1, borderRadius: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>

        {/* Dashboard-only tools */}
        {currentView === "dashboard" && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box
              sx={{
                flex: 1,
                overflow: "auto",
                px: 2,
                pb: 2,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <MenuPanel />
              <Divider />
              <ShoppingListPanel onAddRecipe={() => navigate("recipes")} />
            </Box>
          </>
        )}
      </Drawer>

      {/* Main content */}
      <Box
        sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        {currentView === "dashboard" && (
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
        )}

        {currentView === "recipes" && (
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
            <RecipesPage />
          </Paper>
        )}
      </Box>
    </Box>
  );
}
