import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import {
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import { useState } from "react";
import RecipesPage from "@/features/recipes/pages/RecipesPage";
import HouseholdPanel from "@/features/household/components/HouseholdPanel";
import { useFirebaseAuth } from "@/shared/api/firebaseAuthContext";
import CalendarPanel from "../components/CalendarPanel";
import ShoppingListPanel from "../components/ShoppingListPanel";

const DRAWER_WIDTH = 420;
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: <CalendarTodayOutlinedIcon fontSize="small" /> },
  { id: "recipes", label: "Recipes", icon: <MenuBookOutlinedIcon fontSize="small" /> },
];

export default function Dashboard() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentView, setCurrentView] = useState("dashboard");
  const { user, logout } = useFirebaseAuth();

  const navigate = (view) => {
    setCurrentView(view);
    setDrawerOpen(false);
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            maxWidth: "92vw",
            boxSizing: "border-box",
            bgcolor: "background.default",
          },
        }}
      >
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <Typography variant="h5" sx={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700 }}>
            Family Dashboard
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Calendar, tasks, meals and recipes in one place
          </Typography>
        </Box>

        <List sx={{ px: 1 }}>
          {NAV_ITEMS.map((item) => (
            <ListItemButton
              key={item.id}
              selected={currentView === item.id}
              onClick={() => navigate(item.id)}
              sx={{ borderRadius: 1, mb: 0.5, "&.Mui-selected": { bgcolor: "#e1f2ef", color: "primary.main" } }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: "inherit" }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 700 }} />
            </ListItemButton>
          ))}
        </List>

        <Divider />
        <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          <HouseholdPanel />
          <ShoppingListPanel onAddRecipe={() => navigate("recipes")} />
        </Box>

        <Divider />
        <Box sx={{ p: 2 }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Avatar src={user?.photoURL} sx={{ width: 34, height: 34 }}>
                {user?.displayName?.slice(0, 1)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{user?.displayName || "Google account"}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>{user?.email}</Typography>
              </Box>
              <IconButton aria-label="Sign out of dashboard" onClick={logout}><LogoutIcon fontSize="small" /></IconButton>
            </Box>
          </Box>
        </Box>
      </Drawer>

      {currentView === "dashboard" && (
        <CalendarPanel onOpenMenu={() => setDrawerOpen(true)} />
      )}

      {currentView === "recipes" && (
        <Box sx={{ minHeight: "100vh" }}>
          <Box sx={{ minHeight: 76, px: 2, display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <IconButton aria-label="Open menu" onClick={() => setDrawerOpen(true)}><MenuIcon /></IconButton>
            <Typography variant="h4" sx={{ fontSize: "1.7rem" }}>Recipes</Typography>
          </Box>
          <Box sx={{ p: { xs: 1.5, sm: 2 } }}><RecipesPage /></Box>
        </Box>
      )}
    </Box>
  );
}
