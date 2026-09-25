import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import GoogleIcon from "@mui/icons-material/Google";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import {
  Avatar,
  Box,
  Button,
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
} from "../services/mealService";
import { useHouseholdMenu } from "../hooks/useHouseholdMenu";
import { useHouseholdEvents } from "../hooks/useHouseholdEvents";
import {
  checkReminders,
  getReminder,
  removeReminder,
  setReminder,
} from "../services/reminderService";
import {
  expandRecurringEvents,
  isRecurrenceValid,
  updateRecurrenceForStartChange,
} from "../services/recurrenceService";
import AgendaView from "./AgendaView";
import EventChecklistEditor from "./EventChecklistEditor";
import RecurrenceFields from "./RecurrenceFields";

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
  familyMembers,
  hiddenMembers,
  showFamily,
  onToggleMember,
  onAddEvent,
}) {
  return (
    <Stack spacing={1.5} sx={{ width: 260, flexShrink: 0 }}>
      <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}>
        <Button fullWidth variant="contained" startIcon={<AddIcon />} onClick={onAddEvent} sx={{ minHeight: 48 }}>
          Add event
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
                <Box component="span" aria-hidden>{MEAL_EMOJI[meal.type]}</Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.1 }}>
                    {meal.type}
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
    sessionExpired,
    connectCalendar,
    disconnectCalendar,
  } = useGoogleCalendar();
  const { members: householdMembers } = useHousehold();
  const now = useCurrentTime();
  const { menu } = useHouseholdMenu();
  const {
    events: householdEvents,
    saveEvent: saveHouseholdEvent,
    deleteEvent: deleteHouseholdEvent,
  } = useHouseholdEvents();
  const tomorrowMeals = useMemo(() => {
    const date = addDays(now, 1);
    return { date, meals: getMealsForDate(date, menu) };
  }, [menu, now]);
  const familyMembers = useMemo(
    () => getAvailableFamilyMembers(householdMembers),
    [householdMembers],
  );
  const [googleEvents, setGoogleEvents] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [currentView, setCurrentView] = useState("agenda");
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
        disconnectCalendar();
      }
    } finally {
      setSyncing(false);
    }
  }, [accessToken, currentDate, disconnectCalendar, familyMembers]);

  useEffect(() => {
    if (calendarConnected) syncGoogle();
  }, [calendarConnected, syncGoogle]);

  const allEventsRef = useRef(allEvents);
  allEventsRef.current = allEvents;
  useEffect(() => {
    const interval = window.setInterval(() => checkReminders(allEventsRef.current), 30_000);
    checkReminders(allEventsRef.current);
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
      const existingReminder = getReminder(event.reminderId || eventToEdit.id);
      setReminderEnabled(existingReminder != null);
      setReminderMinutes(existingReminder ?? 15);
      setDialogOpen(true);
    },
    [householdEvents],
  );

  const canSave =
    Boolean(editingEvent?.title?.trim()) &&
    editingEvent?.end > editingEvent?.start &&
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
        if (reminderEnabled) setReminder(reminderId, reminderMinutes);
        else removeReminder(reminderId);
        await syncGoogle();
      } catch (error) {
        console.error("Failed to update Google event:", error);
        if (error.message?.includes("401")) disconnectCalendar();
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
          if (error.message?.includes("401")) disconnectCalendar();
        }
      }

      try {
        await saveHouseholdEvent(sharedEvent);
        if (reminderEnabled) setReminder(sharedEvent.id, reminderMinutes);
        else removeReminder(sharedEvent.id);
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
    disconnectCalendar,
    editingEvent,
    familyMembers,
    reminderEnabled,
    reminderMinutes,
    saveHouseholdEvent,
    syncGoogle,
  ]);

  const handleDelete = useCallback(async () => {
    if (editingEvent.source === "google") {
      if (!accessToken) return;
      try {
        await deleteGoogleEvent(accessToken, editingEvent.id, editingEvent.calendarId);
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
      removeReminder(editingEvent.id);
    }
    setDialogOpen(false);
    setEditingEvent(null);
  }, [editingEvent, accessToken, deleteHouseholdEvent, syncGoogle]);

  const navigateWeek = (direction) => {
    setCurrentDate((previous) => addDays(previous, direction * 7));
  };
  const isExistingEvent =
    editingEvent?.source === "google" ||
    householdEvents.some((event) => event.id === editingEvent?.id);

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
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
              <Tooltip title={calendarConnected ? "Sync calendar now" : "Calendar is stored on this device"}>
                <Typography
                  component={calendarConnected ? "button" : "p"}
                  type={calendarConnected ? "button" : undefined}
                  onClick={calendarConnected ? syncGoogle : undefined}
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5, p: 0, border: 0, bgcolor: "transparent", fontFamily: "inherit", cursor: calendarConnected ? "pointer" : "default" }}
                >
                  {selectedWeekEventCount} event{selectedWeekEventCount === 1 ? "" : "s"}
                  {calendarConnected ? ` · ${syncing ? "Syncing…" : "Google synced"}` : " · Calendar not connected"}
                </Typography>
              </Tooltip>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 0.8, alignItems: "center", overflowX: "auto", pb: 0.25, justifyContent: { xs: "flex-start", sm: "flex-end" } }}>
            {!calendarConnected && (
              <Chip
                icon={<GoogleIcon sx={{ fontSize: 16 }} />}
                label={sessionExpired ? "Reconnect calendar" : "Connect calendar"}
                onClick={connectCalendar}
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
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => openNewEvent()}
              aria-label="Add event"
              sx={{
                justifySelf: "end",
                gridColumn: { xs: 2, md: 3 },
                gridRow: 1,
                display: { xs: "none", sm: "inline-flex" },
                minWidth: { xs: 42, sm: 112 },
                width: { xs: 42, sm: "auto" },
                px: { xs: 1, sm: 2 },
                "& .MuiButton-startIcon": { m: { xs: 0, sm: "0 8px 0 -4px" } },
              }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Add event
              </Box>
            </Button>
          )}
        </Box>
      </Box>

      <Box component="main" sx={{ flex: 1, minHeight: 0 }}>
        {currentView === "agenda" && (
          <Box sx={{ width: "100%", maxWidth: 860, mx: "auto", px: { xs: 1.5, sm: 2 }, py: 2.5 }}>
            <AgendaView events={allEvents} familyMembers={familyMembers} currentDate={currentDate} now={now} onSelectEvent={handleSelectEvent} />
          </Box>
        )}

        {currentView === "week" && (
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

        {currentView === "wall" && (
          <Box sx={{ width: "100%", maxWidth: 900, mx: "auto", px: { xs: 1.5, sm: 2 }, py: 2.5, display: "flex", gap: 2.5, alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <AgendaView events={allEvents} familyMembers={familyMembers} currentDate={currentDate} now={now} onSelectEvent={handleSelectEvent} focusUpcoming />
            </Box>
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <WallSidebar
                tomorrowMeals={tomorrowMeals}
                familyMembers={familyMembers}
                hiddenMembers={hiddenMembers}
                showFamily
                onToggleMember={toggleMember}
                onAddEvent={() => openNewEvent()}
              />
            </Box>
          </Box>
        )}
      </Box>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => openNewEvent()}
        sx={{
          display: {
            xs: "inline-flex",
            sm: currentView === "wall" ? "inline-flex" : "none",
            md: "none",
          },
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 10,
          borderRadius: 8,
          px: 2.2,
          boxShadow: "0 8px 24px rgba(31, 64, 57, 0.24)",
        }}
      >
        Add event
      </Button>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingEvent(null); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography component="span" variant="h6" sx={{ fontWeight: 800 }}>
            {isExistingEvent ? "Edit event" : "Add event"}
          </Typography>
          {editingEvent?.source === "google" && <Chip label="Google" size="small" color="primary" sx={{ ml: 1, height: 22 }} />}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField autoFocus label="Event title" value={editingEvent?.title || ""} onChange={(e) => setEditingEvent((previous) => ({ ...previous, title: e.target.value }))} fullWidth size="small" />
          <FormControl fullWidth size="small">
            <InputLabel>Person</InputLabel>
            <Select
              value={editingEvent?.owner || ""}
              label="Person"
              onChange={(e) => {
                const member = familyMembers.find((candidate) => candidate.name === e.target.value);
                setEditingEvent((previous) => ({ ...previous, owner: member.name, calendarId: member.calendarId, color: member.color }));
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
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <TextField
              label="Start"
              type="datetime-local"
              value={editingEvent ? format(editingEvent.start, "yyyy-MM-dd'T'HH:mm") : ""}
              onChange={(e) => {
                const nextStart = new Date(e.target.value);
                setEditingEvent((previous) => ({ ...previous, start: nextStart, recurrence: updateRecurrenceForStartChange(previous.recurrence, previous.start, nextStart) }));
              }}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End"
              type="datetime-local"
              value={editingEvent ? format(editingEvent.end, "yyyy-MM-dd'T'HH:mm") : ""}
              onChange={(e) => setEditingEvent((previous) => ({ ...previous, end: new Date(e.target.value) }))}
              fullWidth
              size="small"
              error={Boolean(editingEvent && editingEvent.end <= editingEvent.start)}
              helperText={editingEvent && editingEvent.end <= editingEvent.start ? "End must be after start" : ""}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <RecurrenceFields event={editingEvent} onChange={setEditingEvent} />
          <TextField label="Notes (optional)" value={editingEvent?.description || ""} onChange={(e) => setEditingEvent((previous) => ({ ...previous, description: e.target.value }))} multiline minRows={2} fullWidth size="small" />
          <EventChecklistEditor value={editingEvent?.checklist || []} onChange={(checklist) => setEditingEvent((previous) => ({ ...previous, checklist }))} />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <FormControlLabel
              control={<Switch checked={reminderEnabled} onChange={(e) => setReminderEnabled(e.target.checked)} size="small" />}
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                  {reminderEnabled ? <NotificationsActiveIcon sx={{ fontSize: 17, color: "primary.main" }} /> : <NotificationsOffIcon sx={{ fontSize: 17, color: "text.disabled" }} />}
                  <Typography variant="body2">Reminder</Typography>
                </Box>
              }
            />
            {reminderEnabled && (
              <TextField label="Minutes before" type="number" value={reminderMinutes} onChange={(e) => setReminderMinutes(Math.max(1, Number.parseInt(e.target.value, 10) || 15))} size="small" sx={{ width: 145 }} inputProps={{ min: 1 }} />
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
