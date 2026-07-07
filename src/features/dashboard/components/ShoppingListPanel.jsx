import AddIcon from "@mui/icons-material/Add";
import { Box, Button, Typography } from "@mui/material";

export default function ShoppingListPanel({ onAddRecipe }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        Shopping List
      </Typography>
      <Typography variant="body2" color="text.secondary">
        This will auto-generate from selected recipes.
      </Typography>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={onAddRecipe}
        sx={{ alignSelf: "flex-start" }}
      >
        Add Recipe
      </Button>
    </Box>
  );
}
