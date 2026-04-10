import ClearIcon from "@mui/icons-material/Clear";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import {
  Box,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

// ── helpers ────────────────────────────────────────────────────────────
const MEAL_TYPES = ["Breakfast", "Lunch", "Kaira-Lunch", "Dinner"];
const MEAL_EMOJI = {
  Breakfast: "🍳",
  Lunch: "🍛",
  "Kaira-Lunch": "🥗",
  Dinner: "🍽️",
};
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Return the Monday of the week that contains `date`. */
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format a Date to YYYY-MM-DD for use as a storage key. */
function toKey(date) {
  return date.toISOString().slice(0, 10);
}

/** Format the week range like "Feb 16 – 22, 2026". */
function formatWeekRange(monday) {
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  const start = monday.toLocaleDateString("en-IN", opts);
  const end = sun.toLocaleDateString("en-IN", {
    ...opts,
    year: "numeric",
  });
  return `${start} – ${end}`;
}

/** Format a single date like "Wed, Feb 18, 2026". */
function formatDate(date) {
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STORAGE_KEY = "family_weekly_menu";

function loadMenu() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveMenu(menu) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(menu));
}

// ── component ──────────────────────────────────────────────────────────
export default function MenuPanel() {
  const [menu, setMenu] = useState(loadMenu);
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState("today"); // "today" | "week"

  useEffect(() => {
    saveMenu(menu);
  }, [menu]);

  const monday = useMemo(() => {
    const m = getMonday(new Date());
    m.setDate(m.getDate() + weekOffset * 7);
    return m;
  }, [weekOffset]);

  const weekDates = useMemo(() => {
    return DAY_LABELS.map((_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [monday]);

  // The days to actually render based on view mode
  const visibleDays = useMemo(() => {
    if (view === "week") {
      return DAY_LABELS.map((day, idx) => ({ day, idx }));
    }
    // "today" view — show only today (or the selected day when navigating)
    const todayKey = toKey(new Date());
    const todayIdx = weekDates.findIndex((d) => toKey(d) === todayKey);
    if (todayIdx !== -1) {
      return [{ day: DAY_LABELS[todayIdx], idx: todayIdx }];
    }
    // If today isn't in the current week (user navigated away), show Monday
    return [{ day: DAY_LABELS[0], idx: 0 }];
  }, [view, weekDates]);

  const getValue = useCallback(
    (dayIdx, meal) => {
      const key = toKey(weekDates[dayIdx]);
      return menu[key]?.[meal] || "";
    },
    [menu, weekDates],
  );

  const setValue = useCallback(
    (dayIdx, meal, value) => {
      const key = toKey(weekDates[dayIdx]);
      setMenu((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          [meal]: value,
        },
      }));
    },
    [weekDates],
  );

  const clearCell = useCallback(
    (dayIdx, meal) => setValue(dayIdx, meal, ""),
    [setValue],
  );

  const handleViewChange = (_, newView) => {
    if (newView !== null) {
      setView(newView);
      console.log("Changing view to", newView);
      if (newView === "today") setWeekOffset(0);
    }
  };

  const subtitle =
    view === "week"
      ? formatWeekRange(monday)
      : formatDate(weekDates[visibleDays[0]?.idx ?? 0]);

  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {view === "today" ? "Today's Menu" : "Weekly Menu"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <ToggleButtonGroup
            value={view}
            exclusive
            onChange={handleViewChange}
            size="small"
            sx={{ mr: 1 }}
          >
            <ToggleButton
              value="today"
              sx={{
                px: 1,
                py: 0.25,
                fontSize: "0.7rem",
                borderColor: "red",
              }}
            >
              Today
            </ToggleButton>
            <ToggleButton
              value="week"
              sx={{
                px: 1,
                py: 0.25,
                fontSize: "0.7rem",
                borderColor: "divider",
              }}
            >
              Week
            </ToggleButton>
          </ToggleButtonGroup>
          {view === "week" && (
            <>
              <Tooltip title="Previous week">
                <IconButton
                  size="small"
                  onClick={() => setWeekOffset((w) => w - 1)}
                >
                  <NavigateBeforeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Chip
                label="This week"
                size="small"
                variant={weekOffset === 0 ? "filled" : "outlined"}
                onClick={() => setWeekOffset(0)}
                sx={{ fontSize: "0.7rem" }}
              />
              <Tooltip title="Next week">
                <IconButton
                  size="small"
                  onClick={() => setWeekOffset((w) => w + 1)}
                >
                  <NavigateNextIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>

      {/* Meal grid */}
      <TableContainer sx={{ maxHeight: view === "week" ? 400 : "none" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {view === "week" && (
                <TableCell sx={{ fontWeight: 700, py: 0.5, width: 60 }}>
                  Day
                </TableCell>
              )}
              {MEAL_TYPES.map((meal) => (
                <TableCell
                  key={meal}
                  align="center"
                  sx={{ fontWeight: 700, py: 0.5 }}
                >
                  {MEAL_EMOJI[meal]} {meal}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleDays.map(({ day, idx: dayIdx }) => {
              const dateStr = weekDates[dayIdx].toLocaleDateString("en-IN", {
                day: "numeric",
              });
              const isToday = toKey(weekDates[dayIdx]) === toKey(new Date());
              return (
                <TableRow
                  key={day}
                  sx={{
                    bgcolor:
                      isToday && view === "week" ? "action.hover" : "inherit",
                  }}
                >
                  {view === "week" && (
                    <TableCell
                      sx={{
                        py: 0.5,
                        fontWeight: isToday ? 700 : 400,
                        whiteSpace: "nowrap",
                        color: isToday ? "primary.main" : "inherit",
                      }}
                    >
                      {day} {dateStr}
                    </TableCell>
                  )}
                  {MEAL_TYPES.map((meal) => {
                    const val = getValue(dayIdx, meal);
                    return (
                      <TableCell key={meal} sx={{ py: 0.25, px: 0.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <TextField
                            variant="standard"
                            size="small"
                            placeholder="+ add meal"
                            value={val}
                            onChange={(e) =>
                              setValue(dayIdx, meal, e.target.value)
                            }
                            InputProps={{
                              disableUnderline: !val,
                              sx: { fontSize: "0.8rem" },
                            }}
                            fullWidth
                          />
                          {val && (
                            <IconButton
                              size="small"
                              onClick={() => clearCell(dayIdx, meal)}
                              sx={{ ml: -1, opacity: 0.5 }}
                            >
                              <ClearIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
