import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { format } from "date-fns";
import { useState } from "react";
import { parseQuickAddWithAi } from "../services/quickAddAiService";
import { parseQuickAdd } from "../services/quickAddParser";

const FIELD_LABELS = {
  title: "event title",
  familyMember: "family member",
  date: "date",
  startTime: "start time",
  endTime: "end time",
};

function PreviewValue({ label, value, missing = false }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 750, color: missing ? "warning.dark" : "text.primary" }}>
        {value || "Needs your input"}
      </Typography>
    </Box>
  );
}

function describeRecurrence(recurrence) {
  if (!recurrence) return "Does not repeat";
  const frequencyLabels = {
    daily: "Every day",
    weekly: "Every week",
    monthly: "Every month",
    yearly: "Every year",
  };
  const interval = recurrence.interval > 1
    ? `Every ${recurrence.interval} weeks`
    : frequencyLabels[recurrence.frequency] || recurrence.frequency;
  const days = recurrence.weekdays?.length ? ` · ${recurrence.weekdays.join(", ")}` : "";
  const ending = recurrence.endType === "until" ? ` · until ${recurrence.until}` : "";
  return `${interval}${days}${ending}`;
}

export default function QuickAddInput({ familyMembers, now, onUseDraft }) {
  const [sentence, setSentence] = useState("");
  const [result, setResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const handleParse = () => {
    if (!sentence.trim()) return;
    const parsedResult = parseQuickAdd(sentence, { members: familyMembers, now });
    setResult(parsedResult);
    setAiError("");
    onUseDraft(parsedResult);
  };

  const handleAiParse = async () => {
    if (!result || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    try {
      const aiResult = await parseQuickAddWithAi(sentence, {
        members: familyMembers,
        now,
        deterministicResult: result,
      });
      setResult(aiResult);
      onUseDraft(aiResult);
    } catch (error) {
      setAiError(
        error?.message || "AI Quick Add is unavailable. Complete the event manually.",
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{ p: 1.5, border: "1px solid", borderColor: "divider", bgcolor: "#f8fbfa" }}
    >
      <Stack spacing={1.25}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <AutoAwesomeIcon color="primary" sx={{ fontSize: 19 }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 800 }}>Quick Add</Typography>
            <Typography variant="caption" color="text.secondary">
              Try “Kaira swimming every Monday at 7 PM to 8 PM”
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <TextField
            value={sentence}
            onChange={(event) => {
              setSentence(event.target.value);
              setResult(null);
              setAiError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleParse();
              }
            }}
            placeholder="Describe the event"
            size="small"
            fullWidth
            inputProps={{ "aria-label": "Describe an event to Quick Add" }}
          />
          <Button variant="outlined" onClick={handleParse} disabled={!sentence.trim()} sx={{ flexShrink: 0 }}>
            Parse
          </Button>
        </Box>

        {result && (
          <Stack spacing={1.25}>
            {(result.missingFields.length > 0 || result.ambiguities.length > 0) && (
              <Alert severity="warning" sx={{ py: 0.25 }}>
                {result.missingFields.length > 0 && (
                  <Typography variant="body2">
                    Missing: {result.missingFields.map((field) => FIELD_LABELS[field] || field).join(", ")}.
                  </Typography>
                )}
                {result.ambiguities.map((ambiguity) => (
                  <Typography variant="body2" key={`${ambiguity.field}-${ambiguity.message}`}>
                    {ambiguity.message}
                  </Typography>
                ))}
              </Alert>
            )}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" },
                gap: 1.25,
              }}
            >
              <PreviewValue label="Event" value={result.draft.title} missing={!result.draft.title} />
              <PreviewValue label="Person" value={result.draft.owner} missing={!result.draft.owner} />
              <PreviewValue label="Date" value={result.parsed.date} missing={!result.parsed.date} />
              <PreviewValue
                label="Starts"
                value={result.draft.allDay
                  ? "Anytime"
                  : result.draft.start
                    ? format(result.draft.start, "h:mm a")
                    : result.parsed.startTime}
                missing={!result.draft.start}
              />
              <PreviewValue
                label="Ends"
                value={result.draft.allDay
                  ? "No fixed time"
                  : result.draft.end
                    ? format(result.draft.end, "h:mm a")
                    : result.parsed.endTime}
                missing={!result.draft.end}
              />
              <PreviewValue label="Repeat" value={describeRecurrence(result.draft.recurrence)} />
            </Box>

            {(result.draft.location || result.draft.description) && (
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {result.draft.location && <Chip size="small" label={`Location: ${result.draft.location}`} />}
                {result.draft.description && <Chip size="small" label={`Notes: ${result.draft.description}`} />}
              </Stack>
            )}

            {result.warnings.map((warning) => (
              <Alert severity="info" key={warning} sx={{ py: 0.25 }}>{warning}</Alert>
            ))}

            {result.needsAi && (
              <Box>
                <Button
                  variant="outlined"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={handleAiParse}
                  disabled={aiLoading}
                >
                  {aiLoading ? "Understanding…" : "Try AI for missing details"}
                </Button>
              </Box>
            )}

            {aiError && <Alert severity="error" sx={{ py: 0.25 }}>{aiError}</Alert>}

            <Alert severity="success" sx={{ py: 0.25 }}>
              {result.source === "ai" ? "AI suggestions" : "Recognized details"} were filled into the event form below.
            </Alert>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
