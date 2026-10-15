import RepeatIcon from "@mui/icons-material/Repeat";
import {
  Box,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { format } from "date-fns";
import {
  createRecurrenceFromPreset,
  getRecurrencePreset,
  getRecurrenceValidationMessage,
  RECURRENCE_PRESETS,
  WEEKDAYS,
} from "../services/recurrenceService";

export default function RecurrenceFields({ event, onChange }) {
  const recurrence = event?.recurrence;
  const preset = getRecurrencePreset(recurrence);
  const validationMessage = getRecurrenceValidationMessage(event);
  const hasWeekdayError = validationMessage.startsWith("Choose the start date");
  const hasEndDateError =
    recurrence?.endType === "until" &&
    Boolean(validationMessage) &&
    !hasWeekdayError;

  const updateRecurrence = (changes) => {
    onChange({ ...event, recurrence: { ...recurrence, ...changes } });
  };

  const handleWeekdayChange = (_, selectedDays) => {
    if (selectedDays.length > 0) {
      updateRecurrence({ weekdays: selectedDays });
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <FormControl fullWidth size="small">
        <InputLabel>Repeat</InputLabel>
        <Select
          value={preset}
          label="Repeat"
          disabled={!event?.start}
          onChange={(e) =>
            onChange({
              ...event,
              recurrence: createRecurrenceFromPreset(e.target.value, event.start),
            })
          }
        >
          {RECURRENCE_PRESETS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {recurrence && (
        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <RepeatIcon color="primary" sx={{ fontSize: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Repeat schedule
            </Typography>
          </Box>

          {recurrence.frequency === "weekly" && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Repeats on (choose more than one for multiple times a week)
              </Typography>
              <ToggleButtonGroup
                value={recurrence.weekdays || []}
                onChange={handleWeekdayChange}
                size="small"
                sx={{ display: "flex", mt: 0.75 }}
              >
                {WEEKDAYS.map((weekday) => (
                  <ToggleButton
                    key={weekday.value}
                    value={weekday.value}
                    aria-label={weekday.longLabel}
                    sx={{ flex: 1, minWidth: 0, px: 0.5 }}
                  >
                    {weekday.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {hasWeekdayError && (
                <FormHelperText error>{validationMessage}</FormHelperText>
              )}
            </Box>
          )}

          <FormControl fullWidth size="small">
            <InputLabel>Ends</InputLabel>
            <Select
              value={recurrence.endType}
              label="Ends"
              onChange={(e) => updateRecurrence({ endType: e.target.value })}
            >
              <MenuItem value="never">Never</MenuItem>
              <MenuItem value="until">On a date</MenuItem>
              <MenuItem value="count">After a number of times</MenuItem>
            </Select>
          </FormControl>

          {recurrence.endType === "until" && (
            <TextField
              label="End date"
              type="date"
              value={recurrence.until || ""}
              onChange={(e) => updateRecurrence({ until: e.target.value })}
              inputProps={{ min: event.start ? format(event.start, "yyyy-MM-dd") : undefined }}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              error={hasEndDateError}
              helperText={hasEndDateError ? validationMessage : ""}
            />
          )}

          {recurrence.endType === "count" && (
            <TextField
              label="Number of occurrences"
              type="number"
              value={recurrence.count}
              onChange={(e) =>
                updateRecurrence({
                  count: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                })
              }
              inputProps={{ min: 1, max: 999 }}
              fullWidth
              size="small"
            />
          )}
        </Box>
      )}
    </Box>
  );
}
