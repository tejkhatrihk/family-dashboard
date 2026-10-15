import AddIcon from "@mui/icons-material/Add";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import GoogleIcon from "@mui/icons-material/Google";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import RestaurantMenuOutlinedIcon from "@mui/icons-material/RestaurantMenuOutlined";
import {
  Avatar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isValid,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { enIN } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { dashboardColors, getMemberPalette } from "../../../app/theme";
import { useHousehold } from "../../household/api/householdContext";
import { useGoogleCalendar } from "../../../shared/api/googleCalendarContext";
import {
  createGoogleEvent,
  deleteGoogleEvent,
  fetchAllFamilyEvents,
  updateGoogleEvent,
} from "../services/googleCalendarService";
import {
  getMealsForDate,
  MEAL_EMOJI,
  MEAL_LABELS,
  toDateKey,
} from "../services/mealService";
import { useHouseholdMenu } from "../hooks/useHouseholdMenu";
import { useHouseholdEvents } from "../hooks/useHouseholdEvents";
import { useEventReminders } from "../hooks/useEventReminders";
import { useHouseholdTasks } from "../../tasks/hooks/useHouseholdTasks";
import {
  checkReminders,
} from "../services/reminderService";
import {
  expandRecurringEvents,
  isRecurrenceValid,
  updateRecurrenceForStartChange,
} from "../services/recurrenceService";
import AgendaView from "./AgendaView";
import EventChecklistEditor from "./EventChecklistEditor";
import RecurrenceFields from "./RecurrenceFields";
import QuickAddInput from "./QuickAddInput";
import MenuPanel from "../../../shared/components/MenuPanel";
import { TaskPanelContent } from "../../tasks/components/TaskPanel";
import { applyQuickAddResult } from "../services/quickAddEventMapper";

const locales = { "en-IN": enIN };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const CALENDAR_VIEWS = [
  { value: "agenda", label: "Agenda" },
  { value: "week", label: "Week" },
  { value: "wall", label: "Wall display" },
];

function getAvailableFamilyMembers(householdMembers) {
  return householdMembers.length
    ? householdMembers.map((member) => ({
        id: member.uid,
        name: member.displayName,
        email: member.email,
        calendarId: member.calendarId || member.email || "primary",
        color: member.color || dashboardColors.teal,
      }))
    : [{ name: "Family", calendarId: "primary", color: dashboardColors.teal }];
}

function createNewEvent(start, end, member) {
  return {
    id: `local_${Date.now()}`,
    title: "",
    description: "",
    location: "",
    checklist: [],
    start,
    end,
    allDay: false,
    source: "household",
    owner: member.name,
    calendarId: member.calendarId,
    color: member.color,
  };
}

function formatWeekRange(date) {
  const firstDay = startOfWeek(date, { weekStartsOn: 1 });
  const lastDay = endOfWeek(date, { weekStartsOn: 1 });
  if (firstDay.getMonth() === lastDay.getMonth()) {
    return `${format(firstDay, "MMM d")} – ${format(lastDay, "d")}`;
  }
  return `${format(firstDay, "MMM d")} – ${format(lastDay, "MMM d")}`;
}

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function FamilyPill({ member, familyMembers, active, onClick, compact = false }) {
  const palette = getMemberPalette(familyMembers, member.name);
  return (
    <Chip
      onClick={onClick}
      avatar={
        <Avatar
          sx={{
            bgcolor: `${palette.main} !important`,
            color: "white !important",
            width: compact ? 20 : 22,
            height: compact ? 20 : 22,
            fontSize: "0.68rem !important",
            fontWeight: 800,
          }}
        >
          {member.name.slice(0, 1).toUpperCase()}
        </Avatar>
      }
      label={member.name}
      size="small"
      sx={{
        bgcolor: active ? palette.soft : "transparent",
        color: active ? palette.main : "text.secondary",
        opacity: active ? 1 : 0.55,
        border: "1px solid transparent",
        fontWeight: 650,
        height: compact ? 32 : 34,
        cursor: "pointer",
        "&:hover": { bgcolor: palette.soft },
      }}
    />
  );
}

function WeekCalendarEvent({ event, familyMembers }) {
  const palette = getMemberPalette(familyMembers, event.owner);
  return (
    <Box sx={{ display: "flex", gap: 0.6, alignItems: "center", minWidth: 0 }}>
      <Box
        sx={{
          width: 19,
          height: 19,
          borderRadius: "50%",
          bgcolor: palette.main,
          color: "white",
          display: "grid",
          placeItems: "center",
          fontSize: "0.58rem",
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {(event.owner || "F").slice(0, 1).toUpperCase()}
      </Box>
      <Typography component="span" variant="caption" sx={{ fontWeight: 750 }} noWrap>
        {event.title}
      </Typography>
    </Box>
  );
}

function WallSidebar({
  tomorrowMeals,
  tasks,
  familyMembers,
  hiddenMembers,
  showFamily,
  onToggleMember,
  onToggleTask,
  onOpenTasks,
}) {
  const taskPreview = tasks.slice(0, 3);
  const completedTaskCount = tasks.filter((task) => task.completed).length;

  return (
    <Stack spacing={1.5} sx={{ width: 260, flexShrink: 0 }}>
      <Paper elevation={0} sx={{ p: 1.75, border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>Tasks</Typography>
          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 800 }}>
            {completedTaskCount}/{tasks.length}
          </Typography>
        </Box>

        {taskPreview.length ? (
          <Stack spacing={0}>
            {taskPreview.map((task) => {
              const palette = getMemberPalette(familyMembers, task.owner);
              return (
                <Box
                  key={task.id}
                  sx={{
                    minHeight: 40,
                    display: "flex",
                    alignItems: "center",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    opacity: task.completed ? 0.58 : 1,
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={Boolean(task.completed)}
                    onChange={(event) => onToggleTask(task.id, event.target.checked)}
                    inputProps={{ "aria-label": `Mark ${task.title} ${task.completed ? "incomplete" : "complete"}` }}
                    sx={{ p: 0.5, mr: 0.5 }}
                  />
                  <Avatar
                    sx={{
                      width: 24,
                      height: 24,
                      mr: 0.75,
                      bgcolor: palette.main,
                      fontSize: "0.68rem",
                      fontWeight: 800,
                    }}
                  >
                    {(task.owner || "F").slice(0, 1).toUpperCase()}
                  </Avatar>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ fontWeight: 650, textDecoration: task.completed ? "line-through" : "none" }}
                  >
                    {task.title}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">No tasks due today</Typography>
        )}

        <Button size="small" fullWidth onClick={onOpenTasks} sx={{ mt: 0.75 }}>
          {tasks.length > 3 ? `+${tasks.length - 3} more` : "View all tasks"}
        </Button>
      </Paper>

      <Paper elevation={0} sx={{ p: 1.75, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="body2" sx={{ fontWeight: 800 }}>
          Tomorrow · {format(tomorrowMeals.date, "EEE d")}
        </Typography>
        {tomorrowMeals.meals.length ? (
          <Stack spacing={0.85} sx={{ mt: 1.25 }}>
            {tomorrowMeals.meals.map((meal) => (
              <Box key={meal.type} sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
                <Box component="span" aria-hidden>{meal.emoji || MEAL_EMOJI[meal.type]}</Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.1 }}>
                    {meal.label || MEAL_LABELS[meal.type]}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 650 }}>{meal.value}</Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            No meals planned yet
          </Typography>
        )}
      </Paper>

      {showFamily && (
        <Paper elevation={0} sx={{ p: 1.75, border: "1px solid", borderColor: "divider" }}>
          <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>
            Family
          </Typography>
          <Stack spacing={0.75}>
            {familyMembers.map((member) => (
              <FamilyPill
                key={member.name}
                member={member}
                familyMembers={familyMembers}
                active={!hiddenMembers.has(member.name)}
                onClick={() => onToggleMember(member.name)}
                compact
              />
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

export default function CalendarPanel({ onOpenMenu }) {
  const {
    accessToken,
    calendarConnected,
    canRenewCalendarAccess,
    renewCalendarAccess,
    expireCalendarAccess,
  } = useGoogleCalendar();
  const { household, members: householdMembers } = useHousehold();
  const now = useCurrentTime();
  const { menu } = useHouseholdMenu();
  const {
    reminders: eventReminders,
    setReminder,
    removeReminder,
  } = useEventReminders();
  const {
    events: householdEvents,
    saveEvent: saveHouseholdEvent,
    deleteEvent: deleteHouseholdEvent,
  } = useHouseholdEvents();
  const taskStore = useHouseholdTasks();
  const { tasks: householdTasks, setTaskCompleted } = taskStore;
  const tomorrowMeals = useMemo(() => {
    const date = addDays(now, 1);
    return {
      date,
      meals: getMealsForDate(date, menu, {
        children: householdMembers,
        childMealPlansEnabled: household?.childrenMealPlansEnabled,
      }),
    };
  }, [household?.childrenMealPlansEnabled, householdMembers, menu, now]);
  const familyMembers = useMemo(
    () => getAvailableFamilyMembers(householdMembers),
    [householdMembers],
  );
  const [googleEvents, setGoogleEvents] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [currentView, setCurrentView] = useState("agenda");
  const [dashboardSection, setDashboardSection] = useState("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [hiddenMembers, setHiddenMembers] = useState(() => new Set());

  const expandedLocalEvents = useMemo(() => {
    const earliestRelevantDate = currentDate < now ? subMonths(currentDate, 2) : subMonths(now, 1);
    const latestRelevantDate = currentDate > now ? addMonths(currentDate, 2) : addMonths(now, 2);
    return expandRecurringEvents(
      householdEvents,
      earliestRelevantDate,
      latestRelevantDate,
    );
  }, [householdEvents, currentDate, now]);

  const allEvents = useMemo(
    () => {
      const mirroredGoogleIds = new Set(
        householdEvents
          .map((event) => event.googleEventId)
          .filter(Boolean),
      );
      const externalGoogleEvents = calendarConnected
        ? googleEvents.filter(
            (event) =>
              !mirroredGoogleIds.has(event.id) &&
              !mirroredGoogleIds.has(event.recurrenceParentId),
          )
        : [];
      return [...expandedLocalEvents, ...externalGoogleEvents]
        .filter((event) => !hiddenMembers.has(event.owner))
        .sort((a, b) => a.start - b.start);
    },
    [calendarConnected, expandedLocalEvents, googleEvents, hiddenMembers, householdEvents],
  );

  const selectedWeekEventCount = useMemo(() => {
    const firstDay = startOfWeek(currentDate, { weekStartsOn: 1 });
    const lastDay = endOfWeek(currentDate, { weekStartsOn: 1 });
    return allEvents.filter((event) => event.start >= firstDay && event.start <= lastDay).length;
  }, [allEvents, currentDate]);
  const openTaskCount = householdTasks.filter((task) => !task.completed).length;
  const wallTasks = useMemo(() => {
    const todayKey = toDateKey(now);
    return householdTasks
      .map((task) => ({
        ...task,
        owner:
          familyMembers.find((member) => member.id === task.assigneeId)?.name ||
          task.assigneeName,
      }))
      .filter(
        (task) =>
          !hiddenMembers.has(task.owner) &&
          (task.dueDate === todayKey || (!task.completed && task.dueDate < todayKey)),
      )
      .sort(
        (first, second) =>
          Number(first.completed) - Number(second.completed) ||
          first.dueDate.localeCompare(second.dueDate) ||
          first.title.localeCompare(second.title),
      );
  }, [familyMembers, hiddenMembers, householdTasks, now]);
  const handleToggleTask = useCallback(
    (taskId, completed) => {
      setTaskCompleted(taskId, completed).catch((error) => {
        console.error("Failed to update household task:", error);
      });
    },
    [setTaskCompleted],
  );

  const syncGoogle = useCallback(async () => {
    if (!accessToken) return;
    setSyncing(true);
    try {
      const timeMin = subMonths(startOfMonth(currentDate), 1);
      const timeMax = addMonths(endOfMonth(currentDate), 1);
      setGoogleEvents(
        await fetchAllFamilyEvents(accessToken, timeMin, timeMax, familyMembers),
      );
    } catch (error) {
      console.error("Failed to sync Google Calendar:", error);
      if (error.message?.includes("401") || error.message?.includes("403")) {
        expireCalendarAccess();
      }
    } finally {
      setSyncing(false);
    }
  }, [accessToken, currentDate, expireCalendarAccess, familyMembers]);

  useEffect(() => {
    if (calendarConnected) syncGoogle();
  }, [calendarConnected, syncGoogle]);

  const allEventsRef = useRef(allEvents);
  allEventsRef.current = allEvents;
  const eventRemindersRef = useRef(eventReminders);
  eventRemindersRef.current = eventReminders;
  useEffect(() => {
    const check = () =>
      checkReminders(allEventsRef.current, eventRemindersRef.current);
    const interval = window.setInterval(check, 30_000);
    check();
    return () => window.clearInterval(interval);
  }, []);

  const toggleMember = useCallback((name) => {
    setHiddenMembers((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const openNewEvent = useCallback(
    (start = new Date(), end = null) => {
      const eventEnd = end || new Date(start.getTime() + 60 * 60 * 1000);
      setEditingEvent(createNewEvent(start, eventEnd, familyMembers[0]));
      setReminderEnabled(false);
      setReminderMinutes(15);
      setDialogOpen(true);
    },
    [familyMembers],
  );

  const handleSelectSlot = useCallback(
    ({ start, end }) => openNewEvent(start, end),
    [openNewEvent],
  );

  const handleSelectEvent = useCallback(
    (event) => {
      const eventToEdit = event.recurrenceParentId
        ? householdEvents.find((candidate) => candidate.id === event.recurrenceParentId) || event
        : event;
      setEditingEvent({ ...eventToEdit, checklist: eventToEdit.checklist || [] });
      const existingReminder =
        eventReminders[event.reminderId || eventToEdit.id];
      setReminderEnabled(existingReminder != null);
      setReminderMinutes(existingReminder ?? 15);
      setDialogOpen(true);
    },
    [eventReminders, householdEvents],
  );

  const handleUseQuickAddDraft = useCallback(
    (parsedResult) => {
      setEditingEvent((previous) =>
        applyQuickAddResult(previous, parsedResult, familyMembers),
      );
    },
    [familyMembers],
  );

  const handleUpdateEventChecklist = useCallback(
    async (event, checklist) => {
      const eventToUpdate = event.recurrenceParentId
        ? householdEvents.find((candidate) => candidate.id === event.recurrenceParentId) || event
        : event;
      const updatedEvent = { ...eventToUpdate, checklist };

      if (updatedEvent.source === "google") {
        if (!calendarConnected || !accessToken) return;
        try {
          await updateGoogleEvent(
            accessToken,
            updatedEvent.id,
            updatedEvent,
            updatedEvent.calendarId,
          );
          await syncGoogle();
        } catch (error) {
          console.error("Failed to update the event checklist:", error);
          if (error.message?.includes("401")) expireCalendarAccess();
        }
        return;
      }

      try {
        await saveHouseholdEvent(updatedEvent);
      } catch (error) {
        console.error("Failed to save the event checklist:", error);
        return;
      }

      if (calendarConnected && accessToken && updatedEvent.googleEventId) {
        try {
          await updateGoogleEvent(
            accessToken,
            updatedEvent.googleEventId,
            updatedEvent,
            updatedEvent.googleCalendarId || updatedEvent.calendarId,
          );
          await syncGoogle();
        } catch (error) {
          console.error("Failed to sync the event checklist to Google:", error);
          if (error.message?.includes("401")) expireCalendarAccess();
        }
      }
    },
    [
      accessToken,
      calendarConnected,
      expireCalendarAccess,
      householdEvents,
      saveHouseholdEvent,
      syncGoogle,
    ],
  );

  const hasValidStart = isValid(editingEvent?.start);
  const hasValidEnd = isValid(editingEvent?.end);
  const canSave =
    Boolean(editingEvent?.title?.trim()) &&
    Boolean(editingEvent?.owner) &&
    hasValidStart &&
    hasValidEnd &&
    editingEvent.end > editingEvent.start &&
    isRecurrenceValid(editingEvent);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    const eventToSave = {
      ...editingEvent,
      title: editingEvent.title.trim(),
      checklist: (editingEvent.checklist || []).filter((item) => item.text?.trim()),
    };

    if (eventToSave.source === "google") {
      if (!calendarConnected || !accessToken) return;
      try {
        await updateGoogleEvent(
          accessToken,
          eventToSave.id,
          eventToSave,
          eventToSave.calendarId,
        );
        const reminderId = eventToSave.reminderId || eventToSave.id;
        if (reminderEnabled) {
          await setReminder(reminderId, reminderMinutes);
        } else {
          await removeReminder(reminderId);
        }
        await syncGoogle();
      } catch (error) {
        console.error("Failed to update Google event:", error);
        if (error.message?.includes("401")) expireCalendarAccess();
        return;
      }
    } else {
      let sharedEvent = { ...eventToSave, source: "household" };

      if (calendarConnected && accessToken) {
        try {
          const member = familyMembers.find(
            (candidate) => candidate.name === eventToSave.owner,
          );
          const googleCalendarId =
            sharedEvent.googleCalendarId || member?.calendarId || "primary";

          if (sharedEvent.googleEventId) {
            await updateGoogleEvent(
              accessToken,
              sharedEvent.googleEventId,
              sharedEvent,
              googleCalendarId,
            );
          } else {
            const created = await createGoogleEvent(
              accessToken,
              sharedEvent,
              googleCalendarId,
            );
            sharedEvent = {
              ...sharedEvent,
              googleEventId: created.id,
              googleCalendarId,
            };
          }
        } catch (error) {
          console.error(
            "Google sync failed; the event was still saved to the household:",
            error,
          );
          if (error.message?.includes("401")) expireCalendarAccess();
        }
      }

      try {
        await saveHouseholdEvent(sharedEvent);
        if (reminderEnabled) {
          await setReminder(sharedEvent.id, reminderMinutes);
        } else {
          await removeReminder(sharedEvent.id);
        }
        if (calendarConnected) await syncGoogle();
      } catch (error) {
        console.error("Failed to save household event:", error);
        return;
      }
    }
    setDialogOpen(false);
    setEditingEvent(null);
  }, [
    accessToken,
    calendarConnected,
    canSave,
    expireCalendarAccess,
    editingEvent,
    removeReminder,
    familyMembers,
    reminderEnabled,
    reminderMinutes,
    saveHouseholdEvent,
    setReminder,
    syncGoogle,
  ]);

  const handleDelete = useCallback(async () => {
    if (editingEvent.source === "google") {
      if (!accessToken) return;
      try {
        await deleteGoogleEvent(accessToken, editingEvent.id, editingEvent.calendarId);
        await removeReminder(editingEvent.reminderId || editingEvent.id);
        await syncGoogle();
      } catch (error) {
        console.error("Failed to delete from Google:", error);
        return;
      }
    } else {
      if (editingEvent.googleEventId && accessToken) {
        try {
          await deleteGoogleEvent(
            accessToken,
            editingEvent.googleEventId,
            editingEvent.googleCalendarId || editingEvent.calendarId,
          );
        } catch (error) {
          console.error("Failed to delete the Google Calendar copy:", error);
        }
      }
      await deleteHouseholdEvent(editingEvent.id);
      await removeReminder(editingEvent.reminderId || editingEvent.id);
    }
    setDialogOpen(false);
    setEditingEvent(null);
  }, [editingEvent, accessToken, deleteHouseholdEvent, removeReminder, syncGoogle]);

  const navigateWeek = (direction) => {
    setCurrentDate((previous) => addDays(previous, direction * 7));
  };
  const isExistingEvent =
    editingEvent?.source === "google" ||
    householdEvents.some((event) => event.id === editingEvent?.id);

  return (
    <Box sx={{ minHeight: "100%", pb: { xs: 8, sm: 0 }, bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      <Box component="header" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.8, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: { xs: 1.25, sm: 2 } }}>
          <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <IconButton aria-label="Open menu" onClick={onOpenMenu} sx={{ mr: 0.5 }}>
              <MenuIcon />
            </IconButton>
            <Box>
              <Typography variant="h4" sx={{ fontSize: { xs: "1.55rem", sm: "1.72rem" }, lineHeight: 1.05 }}>
                Dashboard
              </Typography>
              <Tooltip title={calendarConnected ? "Sync calendar now" : "Google Calendar authorization is needed"}>
                <Typography
                  component={calendarConnected ? "button" : "p"}
                  type={calendarConnected ? "button" : undefined}
                  onClick={calendarConnected ? syncGoogle : undefined}
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5, p: 0, border: 0, bgcolor: "transparent", fontFamily: "inherit", cursor: calendarConnected ? "pointer" : "default" }}
                >
                  {selectedWeekEventCount} event{selectedWeekEventCount === 1 ? "" : "s"}
                  {calendarConnected
                    ? ` · ${syncing ? "Syncing…" : "Google synced"}`
                    : " · Google sync needs authorization"}
                </Typography>
              </Tooltip>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 0.8, alignItems: "center", overflowX: "auto", pb: 0.25, justifyContent: { xs: "flex-start", sm: "flex-end" } }}>
            {!calendarConnected && (
              <Chip
                icon={<GoogleIcon sx={{ fontSize: 16 }} />}
                label={
                  canRenewCalendarAccess
                    ? "Renew Calendar access"
                    : "Calendar sync unavailable"
                }
                onClick={
                  canRenewCalendarAccess ? renewCalendarAccess : undefined
                }
                disabled={!canRenewCalendarAccess}
                variant="outlined"
                sx={{ fontWeight: 650, flexShrink: 0 }}
              />
            )}
            {familyMembers.map((member) => (
              <FamilyPill
                key={member.name}
                member={member}
                familyMembers={familyMembers}
                active={!hiddenMembers.has(member.name)}
                onClick={() => toggleMember(member.name)}
              />
            ))}
          </Box>
        </Box>

        <Tabs
          value={dashboardSection}
          onChange={(_, value) => setDashboardSection(value)}
          variant="scrollable"
          scrollButtons={false}
          aria-label="Dashboard sections"
          sx={{
            minHeight: 52,
            px: { xs: 1.5, sm: 3 },
            borderTop: "1px solid",
            borderColor: "divider",
            "& .MuiTab-root": {
              minHeight: 52,
              px: { xs: 1.25, sm: 2 },
              fontSize: "0.9rem",
              fontWeight: 750,
              textTransform: "none",
            },
          }}
        >
          <Tab value="calendar" icon={<CalendarMonthOutlinedIcon fontSize="small" />} iconPosition="start" label="Calendar" />
          <Tab value="meals" icon={<RestaurantMenuOutlinedIcon fontSize="small" />} iconPosition="start" label="Meals" />
          <Tab
            value="tasks"
            icon={<ChecklistOutlinedIcon fontSize="small" />}
            iconPosition="start"
            label={
              <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                Tasks
                {openTaskCount > 0 && (
                  <Chip label={openTaskCount} size="small" sx={{ height: 20, fontSize: "0.68rem", fontWeight: 800 }} />
                )}
              </Box>
            }
          />
        </Tabs>

        {dashboardSection === "calendar" && (
          <Box
            sx={{
              minHeight: 66,
              px: { xs: 1.5, sm: 2 },
              py: 1.25,
              borderTop: "1px solid",
              borderColor: "divider",
              display: "grid",
              gridTemplateColumns: { xs: "1fr auto", md: "1fr auto 1fr" },
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, minWidth: 0, gridColumn: 1, gridRow: 1 }}>
              <Button variant="outlined" size="small" onClick={() => setCurrentDate(new Date())} sx={{ borderColor: "divider", color: "text.primary", bgcolor: "white" }}>
                Today
              </Button>
              <IconButton size="small" aria-label="Previous week" onClick={() => navigateWeek(-1)} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "white" }}>
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" aria-label="Next week" onClick={() => navigateWeek(1)} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "white" }}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
              <Typography variant="body2" sx={{ fontWeight: 800, ml: 0.4, whiteSpace: "nowrap" }}>
                {formatWeekRange(currentDate)}
              </Typography>
            </Box>

            <ToggleButtonGroup
              exclusive
              value={currentView}
              onChange={(_, value) => value && setCurrentView(value)}
              size="small"
              aria-label="Calendar view"
              sx={{
                gridColumn: { xs: "1 / -1", md: 2 },
                gridRow: { xs: 2, md: 1 },
                justifySelf: "center",
                p: 0.45,
                bgcolor: dashboardColors.softSurface,
                borderRadius: 1.25,
                "& .MuiToggleButton-root": { border: 0, borderRadius: "7px !important", px: { xs: 1.5, sm: 2.2 }, py: 0.45, color: "text.secondary", fontWeight: 700 },
                "& .Mui-selected": { bgcolor: "white !important", color: `${dashboardColors.ink} !important`, boxShadow: "0 1px 4px rgba(30, 35, 30, 0.14)" },
              }}
            >
              {CALENDAR_VIEWS.map((view) => (
                <ToggleButton key={view.value} value={view.value}>{view.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>

            {currentView !== "wall" && (
              <Tooltip title="Add event">
                <IconButton
                  onClick={() => openNewEvent()}
                  aria-label="Add event"
                  sx={{
                    justifySelf: "end",
                    gridColumn: { xs: 2, md: 3 },
                    gridRow: 1,
                    display: { xs: "none", sm: "inline-flex" },
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    "&:hover": { bgcolor: "primary.dark" },
                  }}
                >
                  <AddIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>

      <Box component="main" sx={{ flex: 1, minHeight: 0 }}>
        {dashboardSection === "calendar" && currentView === "agenda" && (
          <Box sx={{ width: "100%", maxWidth: 860, mx: "auto", px: { xs: 1.5, sm: 2 }, py: 2.5 }}>
            <AgendaView
              key={currentDate.getTime()}
              events={allEvents}
              reminders={eventReminders}
              familyMembers={familyMembers}
              currentDate={currentDate}
              now={now}
              onSelectEvent={handleSelectEvent}
              onUpdateEventChecklist={handleUpdateEventChecklist}
              onSelectDate={setCurrentDate}
              timeGrouped
            />
          </Box>
        )}

        {dashboardSection === "calendar" && currentView === "week" && (
          <Box
            sx={{
              height: { xs: "calc(100vh - 224px)", md: "calc(100vh - 158px)" },
              minHeight: 520,
              px: { xs: 0.75, sm: 2 },
              py: 1.5,
              "& .rbc-calendar": { fontFamily: "inherit" },
              "& .rbc-time-view": { borderColor: "divider", bgcolor: "white", borderRadius: 1, overflow: "hidden" },
              "& .rbc-header": { py: 1, borderColor: "divider", fontSize: "0.78rem", fontWeight: 750, color: "text.secondary" },
              "& .rbc-header.rbc-today": { color: "primary.main", bgcolor: dashboardColors.tealSoft },
              "& .rbc-time-header-content, & .rbc-timeslot-group, & .rbc-day-slot, & .rbc-time-content > * + * > *": { borderColor: `${dashboardColors.divider} !important` },
              "& .rbc-timeslot-group": { minHeight: 52 },
              "& .rbc-day-slot .rbc-time-slot": { borderTopColor: "#f2efe9" },
              "& .rbc-label": { color: "text.secondary", fontSize: "0.68rem" },
              "& .rbc-today": { bgcolor: "#fafcfb" },
              "& .rbc-current-time-indicator": { bgcolor: "error.main", height: 2, zIndex: 5 },
              "& .rbc-event": { p: 0.6, borderRadius: "5px !important", boxShadow: "none" },
            }}
          >
            <Calendar
              localizer={localizer}
              events={allEvents}
              startAccessor="start"
              endAccessor="end"
              selectable
              toolbar={false}
              view={Views.WEEK}
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              step={30}
              timeslots={2}
              min={new Date(1970, 0, 1, 5, 0)}
              max={new Date(1970, 0, 1, 23, 0)}
              scrollToTime={new Date(1970, 0, 1, 7, 0)}
              components={{ event: (props) => <WeekCalendarEvent {...props} familyMembers={familyMembers} /> }}
              eventPropGetter={(event) => {
                const palette = getMemberPalette(familyMembers, event.owner);
                return { style: { backgroundColor: palette.soft, color: dashboardColors.ink, border: 0, borderLeft: `3px solid ${palette.main}` } };
              }}
            />
          </Box>
        )}

        {dashboardSection === "calendar" && currentView === "wall" && (
          <Box sx={{ width: "100%", maxWidth: 900, mx: "auto", px: { xs: 1.5, sm: 2 }, py: 2.5, display: "flex", gap: 2.5, alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <AgendaView
                events={allEvents}
                reminders={eventReminders}
                familyMembers={familyMembers}
                currentDate={currentDate}
                now={now}
                onSelectEvent={handleSelectEvent}
                onUpdateEventChecklist={handleUpdateEventChecklist}
                focusUpcoming
              />
            </Box>
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <WallSidebar
                tomorrowMeals={tomorrowMeals}
                tasks={wallTasks}
                familyMembers={familyMembers}
                hiddenMembers={hiddenMembers}
                showFamily
                onToggleMember={toggleMember}
                onToggleTask={handleToggleTask}
                onOpenTasks={() => setDashboardSection("tasks")}
              />
            </Box>
          </Box>
        )}

        {dashboardSection === "meals" && (
          <Box sx={{ width: "100%", maxWidth: 1100, mx: "auto", p: { xs: 1.5, sm: 2.5 } }}>
            <MenuPanel defaultView="week" />
          </Box>
        )}

        {dashboardSection === "tasks" && (
          <TaskPanelContent embedded taskStore={taskStore} />
        )}
      </Box>

      <IconButton
        aria-label="Add event"
        onClick={() => openNewEvent()}
        sx={{
          display: {
            xs: dashboardSection === "calendar" ? "inline-flex" : "none",
            sm: dashboardSection === "calendar" && currentView === "wall" ? "inline-flex" : "none",
          },
          position: "fixed",
          right: 18,
          bottom: { xs: 82, sm: 18 },
          zIndex: 10,
          width: 56,
          height: 56,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          boxShadow: "0 8px 24px rgba(31, 64, 57, 0.24)",
          "&:hover": { bgcolor: "primary.dark" },
        }}
      >
        <AddIcon />
      </IconButton>

      <BottomNavigation
        showLabels
        value={
          dashboardSection === "tasks"
            ? "tasks"
            : dashboardSection === "meals"
              ? "more"
              : currentView === "agenda"
                ? "today"
                : "calendar"
        }
        onChange={(_, destination) => {
          if (destination === "today") {
            setDashboardSection("calendar");
            setCurrentView("agenda");
            setCurrentDate(new Date());
          } else if (destination === "calendar") {
            setDashboardSection("calendar");
            setCurrentView("week");
          } else if (destination === "tasks") {
            setDashboardSection("tasks");
          } else {
            onOpenMenu();
          }
        }}
        sx={{
          display: { xs: "flex", sm: "none" },
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 11,
          height: 64,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          "& .MuiBottomNavigationAction-root": { minWidth: 0, py: 0.75 },
          "& .MuiBottomNavigationAction-label": { fontSize: "0.68rem", fontWeight: 700 },
        }}
      >
        <BottomNavigationAction label="Today" value="today" icon={<HomeOutlinedIcon />} />
        <BottomNavigationAction label="Calendar" value="calendar" icon={<CalendarMonthOutlinedIcon />} />
        <BottomNavigationAction label="Tasks" value="tasks" icon={<ChecklistOutlinedIcon />} />
        <BottomNavigationAction label="More" value="more" icon={<MoreHorizIcon />} />
      </BottomNavigation>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingEvent(null); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography component="span" variant="h6" sx={{ fontWeight: 800 }}>
            {isExistingEvent ? "Edit event" : "Add event"}
          </Typography>
          {editingEvent?.source === "google" && <Chip label="Google" size="small" color="primary" sx={{ ml: 1, height: 22 }} />}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          {!isExistingEvent && (
            <QuickAddInput
              key={editingEvent?.id}
              familyMembers={familyMembers}
              now={now}
              onUseDraft={handleUseQuickAddDraft}
            />
          )}
          <TextField autoFocus label="Event title" value={editingEvent?.title || ""} onChange={(e) => setEditingEvent((previous) => ({ ...previous, title: e.target.value }))} fullWidth size="small" />
          <FormControl fullWidth size="small">
            <InputLabel>Person</InputLabel>
            <Select
              value={editingEvent?.owner || ""}
              label="Person"
              onChange={(e) => {
                const member = familyMembers.find((candidate) => candidate.name === e.target.value);
                if (member) {
                  setEditingEvent((previous) => ({ ...previous, owner: member.name, calendarId: member.calendarId, color: member.color }));
                }
              }}
            >
              {familyMembers.map((member) => {
                const palette = getMemberPalette(familyMembers, member.name);
                return (
                  <MenuItem key={member.name} value={member.name}>
                    <Box sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: palette.main, mr: 1 }} />
                    {member.name}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(editingEvent?.allDay)}
                onChange={(e) => {
                  const useAnytime = e.target.checked;
                  setEditingEvent((previous) => {
                    if (useAnytime) {
                      const dateValue = previous.scheduleDate || (isValid(previous.start) ? format(previous.start, "yyyy-MM-dd") : format(now, "yyyy-MM-dd"));
                      const nextStart = new Date(`${dateValue}T00:00:00`);
                      return {
                        ...previous,
                        allDay: true,
                        scheduleDate: dateValue,
                        start: nextStart,
                        end: addDays(nextStart, 1),
                        recurrence: updateRecurrenceForStartChange(previous.recurrence, previous.start, nextStart),
                      };
                    }
                    return {
                      ...previous,
                      allDay: false,
                      scheduleDate: previous.scheduleDate || (isValid(previous.start) ? format(previous.start, "yyyy-MM-dd") : null),
                      start: null,
                      end: null,
                    };
                  });
                }}
                size="small"
              />
            }
            label="Anytime (no fixed time)"
          />
          {editingEvent?.allDay ? (
            <TextField
              label="Date"
              type="date"
              value={editingEvent.scheduleDate || (isValid(editingEvent.start) ? format(editingEvent.start, "yyyy-MM-dd") : "")}
              onChange={(e) => {
                const dateValue = e.target.value;
                setEditingEvent((previous) => {
                  const nextStart = dateValue ? new Date(`${dateValue}T00:00:00`) : null;
                  return {
                    ...previous,
                    scheduleDate: dateValue,
                    start: nextStart,
                    end: nextStart ? addDays(nextStart, 1) : null,
                    recurrence: updateRecurrenceForStartChange(previous.recurrence, previous.start, nextStart),
                  };
                });
              }}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <TextField
                label="Start"
                type="datetime-local"
                value={isValid(editingEvent?.start) ? format(editingEvent.start, "yyyy-MM-dd'T'HH:mm") : ""}
                onChange={(e) => {
                  const nextStart = e.target.value ? new Date(e.target.value) : null;
                  setEditingEvent((previous) => ({ ...previous, scheduleDate: nextStart ? format(nextStart, "yyyy-MM-dd") : previous.scheduleDate, start: nextStart, recurrence: updateRecurrenceForStartChange(previous.recurrence, previous.start, nextStart) }));
                }}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End"
                type="datetime-local"
                value={isValid(editingEvent?.end) ? format(editingEvent.end, "yyyy-MM-dd'T'HH:mm") : ""}
                onChange={(e) => setEditingEvent((previous) => ({ ...previous, end: e.target.value ? new Date(e.target.value) : null }))}
                fullWidth
                size="small"
                error={Boolean(hasValidStart && hasValidEnd && editingEvent.end <= editingEvent.start)}
                helperText={hasValidStart && hasValidEnd && editingEvent.end <= editingEvent.start ? "End must be after start" : ""}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}
          <RecurrenceFields event={editingEvent} onChange={setEditingEvent} />
          <TextField label="Location (optional)" value={editingEvent?.location || ""} onChange={(e) => setEditingEvent((previous) => ({ ...previous, location: e.target.value }))} fullWidth size="small" />
          <TextField label="Notes (optional)" value={editingEvent?.description || ""} onChange={(e) => setEditingEvent((previous) => ({ ...previous, description: e.target.value }))} multiline minRows={2} fullWidth size="small" />
          <EventChecklistEditor value={editingEvent?.checklist || []} onChange={(checklist) => setEditingEvent((previous) => ({ ...previous, checklist }))} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <FormControlLabel
              control={<Switch checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} size="small" />}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                  {reminderEnabled ? <NotificationsActiveIcon sx={{ fontSize: 17, color: "primary.main" }} /> : <NotificationsOffIcon sx={{ fontSize: 17, color: "text.disabled" }} />}
                  <Typography variant="body2">Leave reminder</Typography>
                </Box>
              }
            />
            {reminderEnabled && (
              <TextField label="Leave minutes before" type="number" value={reminderMinutes} onChange={(e) => setReminderMinutes(Math.max(1, Number.parseInt(e.target.value, 10) || 15))} size="small" sx={{ width: 190 }} inputProps={{ min: 1 }} />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          {isExistingEvent && <IconButton color="error" onClick={handleDelete} aria-label="Delete event" sx={{ mr: "auto" }}><DeleteOutlineIcon /></IconButton>}
          <Button onClick={() => { setDialogOpen(false); setEditingEvent(null); }} color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!canSave}>{isExistingEvent ? "Save changes" : "Add event"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
