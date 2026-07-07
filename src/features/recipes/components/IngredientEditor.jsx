import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

function tempId() {
  return '_' + Math.random().toString(36).slice(2);
}

/**
 * Editable ingredient list.
 *
 * Props:
 *   ingredients  – array of { id, name, optional }
 *   onChange     – (updatedIngredients) => void
 */
export default function IngredientEditor({ ingredients, onChange }) {
  const add = (optional = false) =>
    onChange([...ingredients, { id: tempId(), name: '', optional }]);

  const remove = (id) =>
    onChange(ingredients.filter((i) => i.id !== id));

  const updateName = (id, name) =>
    onChange(ingredients.map((i) => (i.id === id ? { ...i, name } : i)));

  const toggleOptional = (id) =>
    onChange(ingredients.map((i) => (i.id === id ? { ...i, optional: !i.optional } : i)));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
      >
        Ingredients
      </Typography>

      {ingredients.length === 0 && (
        <Typography variant="body2" color="text.disabled">
          No ingredients added yet.
        </Typography>
      )}

      {ingredients.map((ing) => (
        <Box key={ing.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            size="small"
            placeholder={ing.optional ? 'Optional ingredient' : 'Ingredient'}
            value={ing.name}
            onChange={(e) => updateName(ing.id, e.target.value)}
            sx={{ flex: 1 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={ing.optional}
                onChange={() => toggleOptional(ing.id)}
              />
            }
            label={<Typography variant="caption">Optional</Typography>}
            sx={{ mr: 0, whiteSpace: 'nowrap' }}
          />
          <Tooltip title="Remove ingredient">
            <IconButton size="small" onClick={() => remove(ing.id)} aria-label="remove ingredient">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ))}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => add(false)}
          variant="outlined"
        >
          Add Ingredient
        </Button>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => add(true)}
          variant="text"
          color="secondary"
        >
          Add Optional
        </Button>
      </Box>
    </Box>
  );
}
