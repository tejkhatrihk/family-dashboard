import ClearIcon from "@mui/icons-material/Clear";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  FormControlLabel,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHouseholdMenu } from "../../features/dashboard/hooks/useHouseholdMenu";
import { useHousehold } from "../../features/household/api/householdContext";
import { useRecipes } from "../../features/recipes/hooks/useRecipes";
import { createRecipePrepReminders } from "../../features/meals/services/mealPrepReminderService";
import {
  MEAL_EMOJI,
  MEAL_LABELS,
  MEAL_TYPES,
  normalizeMealEntry,
  toDateKey,
} from "../../features/dashboard/services/mealService";

// ── helpers ────────────────────────────────────────────────────────────
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MENU_SAVE_DELAY = 600;

function getMealCellKey(date, meal) {
  return `${toDateKey(date)}_${meal}`;
}

/** Return the Monday of the week that contains `date`. */
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
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

// ── component ──────────────────────────────────────────────────────────
export default function MenuPanel({ defaultView = "today" }) {
  const { menu, setMeal, setChildMeal } = useHouseholdMenu();
  const { household, members, isOwner, setChildrenMealPlansEnabled } =
    useHousehold();
  const { recipes } = useRecipes();
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState(defaultView); // "today" | "week"
  const [draftEntries, setDraftEntries] = useState({});
  const [childrenMealError, setChildrenMealError] = useState(null);
  const draftEntriesRef = useRef(draftEntries);
  const pendingEntriesRef = useRef(new Map());
  const childMembers = useMemo(
    () =>
      members
        .filter((member) => member.isChild)
        .sort((first, second) =>
          String(first.displayName || "").localeCompare(
            String(second.displayName || ""),
          ),
        ),
    [members],
  );
  const showChildMealColumns =
    Boolean(household?.childrenMealPlansEnabled) && childMembers.length > 0;
  const mealColumns = useMemo(
    () => [
      ...MEAL_TYPES.filter((meal) => meal !== "Kaira-Lunch").map((meal) => ({
        key: meal,
        meal,
        label: MEAL_LABELS[meal],
        emoji: MEAL_EMOJI[meal],
      })),
      ...(showChildMealColumns
        ? childMembers.map((child) => ({
            key: `child-${child.uid}`,
            childId: child.uid,
            label: `${child.displayName} lunch`,
            emoji: MEAL_EMOJI["Kaira-Lunch"],
          }))
        : []),
    ],
    [childMembers, showChildMealColumns],
  );

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
    const todayKey = toDateKey(new Date());
    const todayIdx = weekDates.findIndex((d) => toDateKey(d) === todayKey);
    if (todayIdx !== -1) {
      return [{ day: DAY_LABELS[todayIdx], idx: todayIdx }];
    }
    // If today isn't in the current week (user navigated away), show Monday
    return [{ day: DAY_LABELS[0], idx: 0 }];
  }, [view, weekDates]);

  const getEntry = useCallback(
    (dayIdx, meal) => {
      const key = toDateKey(weekDates[dayIdx]);
      return normalizeMealEntry(menu[key]?.[meal]);
    },
    [menu, weekDates],
  );

  const getChildEntry = useCallback(
    (dayIdx, childId) => {
      const key = toDateKey(weekDates[dayIdx]);
      return normalizeMealEntry(menu[key]?.childMeals?.[childId]);
    },
    [menu, weekDates],
  );

  const saveEntry = useCallback(
    (pending) => {
      const save = pending.childId
        ? setChildMeal(pending.date, pending.childId, pending.entry)
        : setMeal(pending.date, pending.meal, pending.entry);
      save.catch(console.error);
    },
    [setChildMeal, setMeal],
  );

  const flushPendingEntry = useCallback(
    (key) => {
      const pending = pendingEntriesRef.current.get(key);
      if (!pending) return;

      clearTimeout(pending.timeout);
      pendingEntriesRef.current.delete(key);
      const nextDrafts = { ...draftEntriesRef.current };
      delete nextDrafts[key];
      draftEntriesRef.current = nextDrafts;
      setDraftEntries(nextDrafts);
      saveEntry(pending);
    },
    [saveEntry],
  );

  const updateEntry = useCallback(
    (dayIdx, meal, patch, childId = null) => {
      const date = weekDates[dayIdx];
      const key = getMealCellKey(date, childId ? `child-${childId}` : meal);
      const currentEntry =
        draftEntriesRef.current[key] ||
        (childId ? getChildEntry(dayIdx, childId) : getEntry(dayIdx, meal));
      const nextEntry = { ...currentEntry, ...patch };
      if (Object.hasOwn(patch, "name")) {
        const matchingRecipe = recipes.find(
          (recipe) =>
            recipe.name.trim().toLowerCase() ===
            nextEntry.name.trim().toLowerCase(),
        );
        nextEntry.recipeId = matchingRecipe?.id || null;
      }

      draftEntriesRef.current = {
        ...draftEntriesRef.current,
        [key]: nextEntry,
      };
      setDraftEntries(draftEntriesRef.current);

      const pending = pendingEntriesRef.current.get(key);
      if (pending) clearTimeout(pending.timeout);
      const timeout = setTimeout(() => flushPendingEntry(key), MENU_SAVE_DELAY);
      pendingEntriesRef.current.set(key, {
        timeout,
        date,
        meal,
        childId,
        entry: nextEntry,
      });
    },
    [flushPendingEntry, getChildEntry, getEntry, recipes, weekDates],
  );

  const clearCell = useCallback(
    (dayIdx, meal, childId = null) =>
      updateEntry(dayIdx, meal, { name: "" }, childId),
    [updateEntry],
  );

  useEffect(
    () => () => {
      pendingEntriesRef.current.forEach((pending) => {
        const { timeout } = pending;
        clearTimeout(timeout);
        saveEntry(pending);
      });
      pendingEntriesRef.current.clear();
    },
    [saveEntry],
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

  const prepReminders = (() => {
    const currentTime = new Date();
    return visibleDays.flatMap(({ idx: dayIdx }) => {
      const dinner = getEntry(dayIdx, "Dinner");
      if (!dinner.name || !dinner.scheduledTime) return [];

      const recipe =
        recipes.find((candidate) => candidate.id === dinner.recipeId) ||
        recipes.find(
          (candidate) =>
            candidate.name.trim().toLowerCase() ===
            dinner.name.trim().toLowerCase(),
        );
      if (
        !recipe?.prepSteps?.length ||
        recipe.leadHours == null ||
        !Number.isFinite(Number(recipe.leadHours))
      ) {
        return [];
      }

      const dateKey = toDateKey(weekDates[dayIdx]);
      const scheduledMeal = new Date(`${dateKey}T${dinner.scheduledTime}:00`);
      if (Number.isNaN(scheduledMeal.getTime()) || scheduledMeal <= currentTime)
        return [];

      return createRecipePrepReminders(
        recipe,
        scheduledMeal.toISOString(),
        currentTime.toISOString(),
      ).map((reminder, index) => ({
        ...reminder,
        id: `${dateKey}_${recipe.id}_${index}`,
      }));
    });
  })();

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

      {childMembers.length > 0 && (
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={Boolean(household?.childrenMealPlansEnabled)}
                disabled={!isOwner}
                onChange={(event) => {
                  setChildrenMealError(null);
                  setChildrenMealPlansEnabled(event.target.checked).catch(
                    setChildrenMealError,
                  );
                }}
              />
            }
            label="Add meal plans for children"
            sx={{
              ml: 0,
              "& .MuiFormControlLabel-label": { fontSize: "0.85rem" },
            }}
          />
          {childrenMealError && (
            <Alert severity="error" sx={{ mt: 0.5 }}>
              Could not update the child meal plan setting:{" "}
              {childrenMealError.message}
            </Alert>
          )}
        </Box>
      )}

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
              {mealColumns.map((column) => (
                <TableCell
                  key={column.key}
                  align="center"
                  sx={{ fontWeight: 700, py: 0.5 }}
                >
                  {column.emoji} {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleDays.map(({ day, idx: dayIdx }) => {
              const dateLabel = formatDate(weekDates[dayIdx]);
              const dateStr = weekDates[dayIdx].toLocaleDateString("en-IN", {
                day: "numeric",
              });
              const isToday =
                toDateKey(weekDates[dayIdx]) === toDateKey(new Date());
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
                  {mealColumns.map((column) => {
                    const { meal, childId } = column;
                    const cellKey = getMealCellKey(
                      weekDates[dayIdx],
                      childId ? `child-${childId}` : meal,
                    );
                    const entry =
                      draftEntries[cellKey] ||
                      (childId
                        ? getChildEntry(dayIdx, childId)
                        : getEntry(dayIdx, meal));
                    const val = entry.name;
                    return (
                      <TableCell key={column.key} sx={{ py: 0.25, px: 0.5 }}>
                        <Box>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <TextField
                              variant="standard"
                              size="small"
                              placeholder="+ add meal"
                              value={val}
                              onChange={(e) =>
                                updateEntry(
                                  dayIdx,
                                  meal,
                                  { name: e.target.value },
                                  childId,
                                )
                              }
                              onBlur={() => flushPendingEntry(cellKey)}
                              InputProps={{
                                disableUnderline: !val,
                                sx: { fontSize: "0.8rem" },
                              }}
                              inputProps={{
                                list: "saved-recipe-names",
                                "aria-label": `${column.label} for ${dateLabel}`,
                              }}
                              fullWidth
                            />
                            {val && (
                              <IconButton
                                size="small"
                                onClick={() => clearCell(dayIdx, meal, childId)}
                                sx={{ ml: -1, opacity: 0.5 }}
                              >
                                <ClearIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                          </Box>
                          {meal === "Dinner" && val && (
                            <TextField
                              type="time"
                              variant="standard"
                              value={entry.scheduledTime}
                              onChange={(event) =>
                                updateEntry(
                                  dayIdx,
                                  meal,
                                  {
                                    scheduledTime: event.target.value,
                                  },
                                  childId,
                                )
                              }
                              onBlur={() => flushPendingEntry(cellKey)}
                              inputProps={{
                                "aria-label": `Dinner time for ${dateLabel}`,
                              }}
                              InputProps={{
                                sx: {
                                  fontSize: "0.72rem",
                                  color: "text.secondary",
                                },
                              }}
                              fullWidth
                              sx={{ mt: 0.25 }}
                            />
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

      <datalist id="saved-recipe-names">
        {recipes.map((recipe) => (
          <option key={recipe.id} value={recipe.name} />
        ))}
      </datalist>

      {prepReminders.length > 0 && (
        <Box
          sx={{
            mt: 1,
            pt: 1.5,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
            Prep reminders
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {prepReminders.map((reminder) => (
              <Alert
                key={reminder.id}
                severity={reminder.status === "too_late" ? "warning" : "info"}
              >
                {reminder.message}
              </Alert>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
