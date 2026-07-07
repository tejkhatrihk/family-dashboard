import AddIcon from "@mui/icons-material/Add";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import {
  Box,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";

/**
 * Sidebar panel that lists saved recipes.
 *
 * Props:
 *   recipes  – Recipe[]        List of recipe objects from useRecipes
 *   onSelect – (recipe) => void  Called when a recipe row is clicked
 *   onAdd    – () => void        Called when the Add button is clicked
 */
export default function RecipeListPanel({ recipes = [], onSelect, onAdd }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Recipes
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={onAdd}>
          Add
        </Button>
      </Box>

      {recipes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No recipes yet. Add one to get started.
        </Typography>
      ) : (
        <List dense disablePadding>
          {recipes.map((recipe, idx) => (
            <Box key={recipe.id}>
              {idx > 0 && <Divider />}
              <ListItemButton
                onClick={() => onSelect(recipe)}
                sx={{ borderRadius: 1, px: 1 }}
              >
                <MenuBookIcon
                  sx={{ fontSize: 16, mr: 1, color: "text.secondary" }}
                />
                <ListItemText primary={recipe.name} />
              </ListItemButton>
            </Box>
          ))}
        </List>
      )}
    </Box>
  );
}
