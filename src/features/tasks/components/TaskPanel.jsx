import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MenuIcon from "@mui/icons-material/Menu";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { addDays, format } from "date-fns";
import { useMemo, useRef, useState } from "react";
import { dashboardColors } from "../../../app/theme";
import { toDateKey } from "../../dashboard/services/mealService";
import { useHousehold } from "../../household/api/householdContext";
import { useFirebaseAuth } from "../../../shared/api/firebaseAuthContext";
import { useHouseholdTasks } from "../hooks/useHouseholdTasks";

const DATE_VIEWS = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "all", label: "All" },
];

function timestampValue(timestamp) {
  return timestamp?.toMillis?.() || 0;
}

function dueDateLabel(dueDate, todayKey, tomorrowKey) {
  if (dueDate === todayKey) return "Today";
  if (dueDate === tomorrowKey) return "Tomorrow";
  return format(new Date(`${dueDate}T00:00:00`), "MMM d");
}

function taskMatchesView(task, dateView, todayKey, tomorrowKey) {
  if (dateView === "today") return task.dueDate <= todayKey;
  if (dateView === "tomorrow") return task.dueDate === tomorrowKey;
  return true;
}

function TaskRow({ task, todayKey, tomorrowKey, showDueDate, onToggle, onDelete }) {
  const overdue = !task.completed && task.dueDate < todayKey;

  return (
    <Paper
      elevation={0}
      sx={{
        minHeight: 58,
        px: { xs: 1, sm: 1.5 },
        py: 0.75,
        border: "1px solid",
        borderColor: "divider",
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        opacity: task.completed ? 0.64 : 1,
      }}
    >
      <Checkbox
        checked={Boolean(task.completed)}
        onChange={(event) => onToggle(task.id, event.target.checked)}
        inputProps={{ "aria-label": `Mark ${task.title} ${task.completed ? "incomplete" : "complete"}` }}
        sx={{ color: "primary.main" }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 700,
            lineHeight: 1.3,
            textDecoration: task.completed ? "line-through" : "none",
          }}
        >
          {task.title}
        </Typography>
        {(showDueDate || overdue) && (
          <Typography
            variant="caption"
            color={overdue ? "error.main" : "text.secondary"}
            sx={{ fontWeight: overdue ? 750 : 500 }}
          >
            {overdue ? "Overdue · " : ""}
            {dueDateLabel(task.dueDate, todayKey, tomorrowKey)}
          </Typography>
        )}
      </Box>
      <Tooltip title="Delete task">
        <IconButton size="small" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task.id)}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

export function TaskPanelContent({ onOpenMenu, embedded = false, taskStore }) {
  const { members } = useHousehold();
  const { user } = useFirebaseAuth();
  const { tasks, loading, error, addTask, setTaskCompleted, removeTask } = taskStore;
  const [selectedMemberId, setSelectedMemberId] = useState(user.uid);
  const [dateView, setDateView] = useState("today");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const taskInputRef = useRef(null);

  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);
  const tomorrowKey = toDateKey(addDays(today, 1));
  const selectedMember =
    members.find((member) => member.uid === selectedMemberId) ||
    members.find((member) => member.uid === user.uid) ||
    members[0];
  const selectedMemberTasks = useMemo(
    () => tasks.filter((task) => task.assigneeId === selectedMember?.uid),
    [selectedMember?.uid, tasks],
  );
  const visibleTasks = useMemo(
    () =>
      selectedMemberTasks
        .filter((task) => taskMatchesView(task, dateView, todayKey, tomorrowKey))
        .sort(
          (first, second) =>
            first.dueDate.localeCompare(second.dueDate) ||
            timestampValue(first.createdAt) - timestampValue(second.createdAt),
        ),
    [dateView, selectedMemberTasks, todayKey, tomorrowKey],
  );
  const openTasks = visibleTasks.filter((task) => !task.completed);
  const completedTasks = visibleTasks.filter((task) => task.completed);

  const handleAddTask = async (event) => {
    event.preventDefault();
    const taskTitle = title.trim();
    if (!taskTitle || !selectedMember) return;

    setAdding(true);
    try {
      await addTask({
        title: taskTitle,
        assigneeId: selectedMember.uid,
        assigneeName: selectedMember.displayName,
        dueDate: dateView === "tomorrow" ? tomorrowKey : todayKey,
      });
      setTitle("");
    } catch {
      // The shared hook exposes the error directly above the task list.
    } finally {
      setAdding(false);
    }
  };

  const emptyMessage =
    dateView === "today"
      ? "Nothing due today. You're all clear."
      : dateView === "tomorrow"
        ? "Nothing planned for tomorrow."
        : "No open tasks yet.";

  const handleToggleTask = (taskId, completed) => {
    setTaskCompleted(taskId, completed).catch(() => undefined);
  };

  const handleDeleteTask = (taskId) => {
    removeTask(taskId).catch(() => undefined);
  };

  const focusTaskInput = () => {
    taskInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    taskInputRef.current?.focus({ preventScroll: true });
  };

  return (
    <Box sx={{ minHeight: embedded ? 0 : "100vh", bgcolor: "background.default" }}>
      {!embedded && (
        <Box
          component="header"
          sx={{
            minHeight: 76,
            px: { xs: 1.5, sm: 2 },
            display: "flex",
            alignItems: "center",
            gap: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <IconButton aria-label="Open menu" onClick={onOpenMenu}><MenuIcon /></IconButton>
          <Box>
            <Typography variant="h4" sx={{ fontSize: "1.7rem" }}>Tasks</Typography>
            <Typography variant="caption" color="text.secondary">One clear list at a time</Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={focusTaskInput}
            sx={{ ml: "auto", display: { xs: "none", sm: "inline-flex" } }}
          >
            Add task
          </Button>
        </Box>
      )}

      <Box sx={{ width: "100%", maxWidth: 760, mx: "auto", p: { xs: 1.5, sm: 2.5 } }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
          Show tasks for
        </Typography>
        <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", pt: 0.5, pb: 1.5 }}>
          {members.map((member) => {
            const selected = member.uid === selectedMember?.uid;
            return (
              <Chip
                key={member.uid}
                avatar={
                  <Avatar src={member.photoURL} sx={{ bgcolor: `${member.color} !important`, color: "white !important" }}>
                    {member.displayName?.slice(0, 1)}
                  </Avatar>
                }
                label={member.uid === user.uid ? `${member.displayName} (Me)` : member.displayName}
                onClick={() => setSelectedMemberId(member.uid)}
                variant={selected ? "filled" : "outlined"}
                sx={{
                  flexShrink: 0,
                  height: 38,
                  fontWeight: 750,
                  bgcolor: selected ? dashboardColors.tealSoft : "background.paper",
                  borderColor: selected ? "primary.main" : "divider",
                  color: selected ? "primary.main" : "text.primary",
                }}
              />
            );
          })}
        </Box>

        <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", p: { xs: 1.25, sm: 2 } }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 850 }}>
                {selectedMember?.displayName}&apos;s tasks
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {openTasks.length} left
              </Typography>
            </Box>
            <ToggleButtonGroup
              exclusive
              value={dateView}
              onChange={(_, value) => value && setDateView(value)}
              size="small"
              aria-label="Task date"
            >
              {DATE_VIEWS.map((view) => (
                <ToggleButton key={view.value} value={view.value} sx={{ px: { xs: 1.1, sm: 1.75 }, fontWeight: 700 }}>
                  {view.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box component="form" onSubmit={handleAddTask} sx={{ display: "flex", gap: 1, mt: 2 }}>
            <TextField
              inputRef={taskInputRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`Add a task for ${selectedMember?.displayName || "someone"}`}
              size="small"
              fullWidth
              inputProps={{ maxLength: 160 }}
            />
            <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={!title.trim() || adding || !selectedMember}>
              Add
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
            {dateView === "tomorrow" ? "Adding for tomorrow" : "Adding for today"}
          </Typography>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error.message}</Alert>}

          {loading ? (
            <Box sx={{ display: "grid", placeItems: "center", py: 6 }}><CircularProgress size={28} /></Box>
          ) : (
            <>
              <Stack spacing={1} sx={{ mt: 2 }}>
                {openTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    todayKey={todayKey}
                    tomorrowKey={tomorrowKey}
                    showDueDate={dateView === "all"}
                    onToggle={handleToggleTask}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </Stack>

              {!openTasks.length && (
                <Box sx={{ textAlign: "center", py: 5 }}>
                  <CheckCircleOutlineIcon color="primary" sx={{ fontSize: 32 }} />
                  <Typography sx={{ mt: 0.75, fontWeight: 750 }}>{emptyMessage}</Typography>
                </Box>
              )}

              {completedTasks.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Button size="small" color="inherit" onClick={() => setCompletedOpen((open) => !open)}>
                    {completedOpen ? "Hide" : "Show"} completed ({completedTasks.length})
                  </Button>
                  <Collapse in={completedOpen}>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {completedTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          todayKey={todayKey}
                          tomorrowKey={tomorrowKey}
                          showDueDate={dateView === "all"}
                          onToggle={handleToggleTask}
                          onDelete={handleDeleteTask}
                        />
                      ))}
                    </Stack>
                  </Collapse>
                </Box>
              )}
            </>
          )}
        </Paper>
      </Box>

      {!embedded && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={focusTaskInput}
          sx={{
            display: { xs: "inline-flex", sm: "none" },
            position: "fixed",
            right: 18,
            bottom: 18,
            zIndex: 10,
            borderRadius: 8,
            px: 2.2,
            boxShadow: "0 8px 24px rgba(31, 64, 57, 0.24)",
          }}
        >
          Add task
        </Button>
      )}
    </Box>
  );
}

export default function TaskPanel(props) {
  const taskStore = useHouseholdTasks();
  return <TaskPanelContent {...props} taskStore={taskStore} />;
}
