import CloseIcon from "@mui/icons-material/Close";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import RecipePanel from "./RecipePanel";

/**
 * Dialog wrapper around RecipePanel.
 *
 * Props:
 *   open    – boolean controlling visibility
 *   onClose – () => void
 *   recipe  – Recipe object to view/edit, or null/undefined for a new recipe
 *   onSave  – (recipe) => void  Called with the saved draft (parent handles persistence)
 */
export default function RecipeDialog({ open, onClose, recipe = null, onSave }) {
  const title = recipe?.name ? recipe.name : "New Recipe";

  const handleSave = (draft) => {
    onSave?.(draft);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pr: 1,
          pb: 0,
        }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <RecipePanel
          recipe={recipe}
          onSave={handleSave}
          onCancel={onClose}
          elevation={0}
        />
      </DialogContent>
    </Dialog>
  );
}
