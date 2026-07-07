import AddIcon from "@mui/icons-material/Add";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import RecipeDialog from "../components/RecipeDialog";
import { useRecipes } from "../hooks/useRecipes";

export default function RecipesPage() {
  const { recipes, save, loading } = useRecipes();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeRecipe, setActiveRecipe] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, search]);

  const openNew = () => {
    setActiveRecipe(null);
    setDialogOpen(true);
  };

  const openRecipe = (recipe) => {
    setActiveRecipe(recipe);
    setDialogOpen(true);
  };

  const handleSave = (draft) => {
    save(draft);
    setDialogOpen(false);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Search + Add bar */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          gap: 2,
          alignItems: "center",
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <TextField
          size="small"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          Add Recipe
        </Button>
      </Box>

      {/* Recipe list */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography sx={{ p: 3 }} color="text.secondary">
            {search
              ? "No recipes match your search."
              : "No recipes yet. Add one to get started."}
          </Typography>
        ) : (
          <List disablePadding>
            {filtered.map((recipe, idx) => (
              <Box key={recipe.id}>
                {idx > 0 && <Divider />}
                <ListItemButton
                  onClick={() => openRecipe(recipe)}
                  sx={{ py: 1.5, px: 2 }}
                >
                  <MenuBookIcon sx={{ mr: 2, color: "text.secondary", flexShrink: 0 }} />
                  <ListItemText
                    primary={recipe.name}
                    secondary={
                      recipe.ingredients?.length
                        ? `${recipe.ingredients.length} ingredient${recipe.ingredients.length !== 1 ? "s" : ""}`
                        : null
                    }
                  />
                </ListItemButton>
              </Box>
            ))}
          </List>
        )}
      </Box>

      <RecipeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        recipe={activeRecipe}
        onSave={handleSave}
      />
    </Box>
  );
}
