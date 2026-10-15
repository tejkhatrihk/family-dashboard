import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import {
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import IngredientEditor from './IngredientEditor';

const EMPTY_RECIPE = {
  name: '',
  ingredients: [],
  instructions: '',
  prepSteps: [],
  leadHours: '',
};

function createRecipeDraft(recipe) {
  return {
    ...EMPTY_RECIPE,
    ...recipe,
    ingredients: recipe?.ingredients || [],
    prepSteps: recipe?.prepSteps || [],
  };
}

/**
 * Loosely-coupled recipe panel — can be embedded on a page or inside a dialog.
 *
 * Props:
 *   recipe      – Recipe object to display / edit. Pass null/undefined for a new recipe.
 *   onSave      – (recipe) => void   Called with the draft when the user clicks Save.
 *   onCancel    – () => void         Called when cancelling a new-recipe form (no recipe prop).
 *   elevation   – MUI Paper elevation (default 0).
 *   sx          – Additional MUI sx styles for the root Paper.
 */
export default function RecipePanel({
  recipe = null,
  onSave,
  onCancel,
  elevation = 0,
  sx,
}) {
  const isNew = !recipe;
  const [editing, setEditing] = useState(isNew);
  const [draft, setDraft] = useState(() => createRecipeDraft(recipe));
  const hasPrepSteps = draft.prepSteps.some((step) => step.trim());
  const validLeadHours =
    !hasPrepSteps ||
    (draft.leadHours !== '' &&
      Number.isFinite(Number(draft.leadHours)) &&
      Number(draft.leadHours) >= 0);

  const handleSave = () => {
    if (!draft.name.trim() || !validLeadHours) return;
    onSave?.({
      ...draft,
      prepSteps: draft.prepSteps.map((step) => step.trim()).filter(Boolean),
      leadHours: hasPrepSteps ? Number(draft.leadHours) : null,
    });
    if (!isNew) setEditing(false);
  };

  const handleCancel = () => {
    if (isNew) {
      onCancel?.();
    } else {
      setDraft(createRecipeDraft(recipe));
      setEditing(false);
    }
  };

  const required = draft.ingredients.filter((i) => !i.optional);
  const optional = draft.ingredients.filter((i) => i.optional);

  // ── Edit mode ──────────────────────────────────────────────────────
  if (editing) {
    return (
      <Paper elevation={elevation} sx={{ p: 2, ...sx }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label="Recipe Name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            fullWidth
            size="small"
            required
            autoFocus
          />

          <IngredientEditor
            ingredients={draft.ingredients}
            onChange={(ingredients) => setDraft((d) => ({ ...d, ingredients }))}
          />

          <TextField
            label="Instructions"
            value={draft.instructions}
            onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
            fullWidth
            multiline
            minRows={4}
            size="small"
            placeholder="Describe the preparation steps…"
          />

          <Divider />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>
              Prep reminders
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Optional. Enter only timing and steps you know; the app will not guess them.
            </Typography>
          </Box>
          <TextField
            label="Prep lead time (hours)"
            type="number"
            value={draft.leadHours ?? ''}
            onChange={(e) => setDraft((current) => ({ ...current, leadHours: e.target.value }))}
            size="small"
            inputProps={{ min: 0, step: 0.5 }}
            error={!validLeadHours}
            helperText={!validLeadHours ? "Enter the recipe's required lead time." : "Stored once for this recipe."}
          />
          <TextField
            label="Prep steps"
            value={draft.prepSteps.join('\n')}
            onChange={(e) => setDraft((current) => ({ ...current, prepSteps: e.target.value.split('\n') }))}
            fullWidth
            multiline
            minRows={2}
            size="small"
            placeholder={"Soak chickpeas\nDefrost sauce"}
            helperText="Enter one reminder step per line."
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!draft.name.trim() || !validLeadHours}
            >
              {isNew ? 'Save Recipe' : 'Update Recipe'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    );
  }

  // ── Read-only mode ─────────────────────────────────────────────────
  return (
    <Paper elevation={elevation} sx={{ p: 2, ...sx }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 1.5,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {draft.name}
        </Typography>
        <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
          Edit
        </Button>
      </Box>

      {/* Required ingredients */}
      {required.length > 0 && (
        <>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            Ingredients
          </Typography>
          <List dense disablePadding sx={{ mt: 0.5, mb: 1 }}>
            {required.map((ing) => (
              <ListItem key={ing.id} sx={{ py: 0.25, px: 0 }}>
                <ListItemText
                  primary={`• ${ing.name}`}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}

      {/* Optional ingredients */}
      {optional.length > 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
            >
              Optional
            </Typography>
            <Chip label="optional" size="small" variant="outlined" sx={{ height: 16, fontSize: 10 }} />
          </Box>
          <List dense disablePadding sx={{ mb: 1 }}>
            {optional.map((ing) => (
              <ListItem key={ing.id} sx={{ py: 0.25, px: 0 }}>
                <ListItemText
                  primary={`• ${ing.name}`}
                  primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}

      {draft.ingredients.length === 0 && (
        <Typography variant="body2" color="text.disabled" sx={{ mb: 1 }}>
          No ingredients listed.
        </Typography>
      )}

      {/* Instructions */}
      {draft.instructions ? (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            Instructions
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
            {draft.instructions}
          </Typography>
        </>
      ) : null}

      {draft.prepSteps.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            Prep reminders · {draft.leadHours} hours before
          </Typography>
          <List dense disablePadding sx={{ mt: 0.5 }}>
            {draft.prepSteps.map((step) => (
              <ListItem key={step} sx={{ py: 0.25, px: 0 }}>
                <ListItemText primary={`• ${step}`} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Paper>
  );
}
