import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";

function createChecklistItem() {
  return {
    id: `check_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text: "",
    completed: false,
  };
}

export default function EventChecklistEditor({ value = [], onChange }) {
  const updateItem = (id, changes) => {
    onChange(
      value.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  };

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 1.5,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        Checklist <Typography component="span" color="text.secondary">(optional)</Typography>
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Add anything that needs to be brought or done.
      </Typography>

      {value.map((item) => (
        <Box key={item.id} sx={{ display: "flex", alignItems: "center", mt: 1 }}>
          <Checkbox
            size="small"
            checked={Boolean(item.completed)}
            onChange={(e) => updateItem(item.id, { completed: e.target.checked })}
            inputProps={{ "aria-label": `Mark ${item.text || "item"} complete` }}
          />
          <TextField
            value={item.text}
            onChange={(e) => updateItem(item.id, { text: e.target.value })}
            placeholder="e.g. water bottle"
            variant="standard"
            fullWidth
            autoFocus={!item.text}
            inputProps={{ "aria-label": "Checklist item" }}
          />
          <IconButton
            size="small"
            aria-label="Remove checklist item"
            onClick={() => onChange(value.filter((candidate) => candidate.id !== item.id))}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}

      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={() => onChange([...value, createChecklistItem()])}
        sx={{ mt: value.length ? 1 : 1.5 }}
      >
        Add checklist item
      </Button>
    </Box>
  );
}
