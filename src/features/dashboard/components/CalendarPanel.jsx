import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import GoogleIcon from "@mui/icons-material/Google";
import LogoutIcon from "@mui/icons-material/Logout";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import SyncIcon from "@mui/icons-material/Sync";
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
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  addMonths,
  endOfMonth,
  format,
  getDay,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { enIN } from "date-fns/locale";
import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useGoogleAuth } from "../../../shared/api/googleAuthContext";
import {
  createGoogleEvent,
  deleteGoogleEvent,
  fetchAllFamilyEvents,
  getFamilyMembers,
  updateGoogleEvent,
} from "../services/googleCalendarService";
import {
  checkReminders,
  getReminder,
  removeReminder,
  setReminder,
} from "../services/reminderService";

// ── date-fns localizer ─────────────────────────────────────────────────
const locales = { "en-IN": enIN };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// ── localStorage for local-only events ─────────────────────────────────
const STORAGE_KEY = "family_calendar_events";

function loadLocalEvents() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return raw.map((e) => ({
      ...e,
      start: new Date(e.start),
      end: new Date(e.end),
      source: "local",
    }));
  } catch {
    return [];
  }
}

function saveLocalEvents(events) {
  const localOnly = events.filter((e) => e.source === "local");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(localOnly));
}

function newEvent(start, end) {
  const members = getFamilyMembers();
  return {
    id: `local_${Date.now()}`,
    title: "",
    start,
    end,
    allDay: false,
    source: "local",
    owner: members[0]?.name || "Family",
    calendarId: members[0]?.calendarId || "primary",
    color: members[0]?.color || "#43a047",
  };
}

// ── Custom toolbar ─────────────────────────────────────────────────────
function CustomToolbar({ label, onNavigate, onView, view }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 1,
        mb: 1,
      }}
    >
      <Box sx={{ display: "flex", gap: 0.5 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onNavigate("TODAY")}
        >
          Today
        </Button>
        <Button size="small" variant="text" onClick={() => onNavigate("PREV")}>
          ‹
        </Button>
        <Button size="small" variant="text" onClick={() => onNavigate("NEXT")}>
          ›
        </Button>
      </Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {[
          { key: Views.MONTH, label: "Month" },
          { key: Views.WEEK, label: "Week" },
          { key: Views.DAY, label: "Day" },
          { key: Views.AGENDA, label: "Agenda" },
        ].map((v) => (
          <Button
            key={v.key}
            size="small"
            variant={view === v.key ? "contained" : "outlined"}
            onClick={() => onView(v.key)}
          >
            {v.label}
          </Button>
        ))}
      </Box>
    </Box>
  );
}

// ── component ──────────────────────────────────────────────────────────
export default function CalendarPanel() {
  const { accessToken, user, isSignedIn, sessionExpired, login, logout } =
    useGoogleAuth();

  const [localEvents, setLocalEvents] = useState(loadLocalEvents);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [currentView, setCurrentView] = useState(Views.WEEK);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Reminder state for the event being edited
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);

  const familyMembers = getFamilyMembers();
  const [visibleMembers, setVisibleMembers] = useState(
    () => new Set(familyMembers.map((m) => m.name)),
  );

  // All events combined, filtered by visible members
  const allEvents = [
    ...localEvents,
    ...googleEvents.filter((e) => visibleMembers.has(e.owner)),
  ];

  // Persist local events
  useEffect(() => {
    saveLocalEvents(localEvents);
  }, [localEvents]);

  // Fetch Google Calendar events when signed in or date changes
  const syncGoogle = useCallback(async () => {
    if (!accessToken) return;
    setSyncing(true);
    try {
      const timeMin = subMonths(startOfMonth(currentDate), 1);
      const timeMax = addMonths(endOfMonth(currentDate), 1);
      const events = await fetchAllFamilyEvents(accessToken, timeMin, timeMax);
      setGoogleEvents(events);
    } catch (err) {
      console.error("Failed to sync Google Calendar:", err);
      if (err.message?.includes("401") || err.message?.includes("403"))
        logout();
    } finally {
      setSyncing(false);
    }
  }, [accessToken, currentDate, logout]);

  useEffect(() => {
    if (isSignedIn) syncGoogle();
  }, [isSignedIn, syncGoogle]);

  // ── Background reminder checker (every 30s) ─────────────────────────
  const allEventsRef = useRef(allEvents);
  allEventsRef.current = allEvents;

  useEffect(() => {
    const interval = setInterval(() => {
      checkReminders(allEventsRef.current);
    }, 30_000);
    // Check immediately on mount
    checkReminders(allEventsRef.current);
    return () => clearInterval(interval);
  }, []);

  // ── Event handlers ───────────────────────────────────────────────────
  const handleSelectSlot = useCallback(({ start, end }) => {
    setEditingEvent(newEvent(start, end));
    setReminderEnabled(false);
    setReminderMinutes(15);
    setDialogOpen(true);
  }, []);

  const handleSelectEvent = useCallback((event) => {
    setEditingEvent({ ...event });
    const existing = getReminder(event.id);
    setReminderEnabled(existing != null);
    setReminderMinutes(existing ?? 15);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingEvent?.title?.trim()) return;

    if (isSignedIn && accessToken) {
      // Save to Google Calendar
      try {
        let savedEventId = editingEvent.id;
        if (editingEvent.source === "google") {
          await updateGoogleEvent(
            accessToken,
            editingEvent.id,
            editingEvent,
            editingEvent.calendarId,
          );
        } else {
          const member = familyMembers.find(
            (m) => m.name === editingEvent.owner,
          );
          const created = await createGoogleEvent(
            accessToken,
            editingEvent,
            member?.calendarId || "primary",
          );
          savedEventId = created.id; // Use the Google-assigned ID
          // Remove from local if it was local
          setLocalEvents((prev) =>
            prev.filter((e) => e.id !== editingEvent.id),
          );
        }

        // Save or remove reminder using the final event ID
        if (reminderEnabled) {
          setReminder(savedEventId, reminderMinutes);
        } else {
          removeReminder(savedEventId);
        }

        await syncGoogle(); // Refresh from Google
      } catch (err) {
        console.error("Failed to save to Google:", err);
        // 401 / 403 means the access token has expired — log out so the
        // sign-in button reappears and the user can re-authenticate.
        if (err.message?.includes("401") || err.message?.includes("403")) {
          logout();
        }
      }
    } else {
      // Save locally
      const exists = localEvents.find((e) => e.id === editingEvent.id);
      if (exists) {
        setLocalEvents((prev) =>
          prev.map((e) => (e.id === editingEvent.id ? editingEvent : e)),
        );
      } else {
        setLocalEvents((prev) => [...prev, editingEvent]);
      }

      // Save or remove reminder
      if (reminderEnabled) {
        setReminder(editingEvent.id, reminderMinutes);
      } else {
        removeReminder(editingEvent.id);
      }
    }

    setDialogOpen(false);
    setEditingEvent(null);
  }, [
    editingEvent,
    localEvents,
    isSignedIn,
    accessToken,
    syncGoogle,
    reminderEnabled,
    reminderMinutes,
  ]);

  const handleDelete = useCallback(async () => {
    if (editingEvent.source === "google" && accessToken) {
      try {
        await deleteGoogleEvent(
          accessToken,
          editingEvent.id,
          editingEvent.calendarId,
        );
        await syncGoogle();
      } catch (err) {
        console.error("Failed to delete from Google:", err);
      }
    } else {
      setLocalEvents((prev) => prev.filter((e) => e.id !== editingEvent.id));
    }
    setDialogOpen(false);
    setEditingEvent(null);
  }, [editingEvent, accessToken, syncGoogle]);

  const handleClose = () => {
    setDialogOpen(false);
    setEditingEvent(null);
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, lineHeight: 1.2 }}
          >
            Calendar
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {allEvents.length} event{allEvents.length !== 1 ? "s" : ""}
            {isSignedIn && " · Google synced"}
          </Typography>
          {isSignedIn && (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
              {familyMembers.map((m) => (
                <Chip
                  key={m.name}
                  label={m.name}
                  size="small"
                  sx={{
                    fontSize: "0.7rem",
                    bgcolor: visibleMembers.has(m.name)
                      ? m.color
                      : "transparent",
                    color: visibleMembers.has(m.name)
                      ? "#fff"
                      : "text.secondary",
                    border: `1px solid ${m.color}`,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setVisibleMembers((prev) => {
                      const next = new Set(prev);
                      next.has(m.name) ? next.delete(m.name) : next.add(m.name);
                      return next;
                    })
                  }
                />
              ))}
            </Box>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {isSignedIn ? (
            <>
              <Tooltip title="Sync now">
                <IconButton
                  size="small"
                  onClick={syncGoogle}
                  disabled={syncing}
                >
                  <SyncIcon
                    fontSize="small"
                    sx={{
                      animation: syncing ? "spin 1s linear infinite" : "none",
                    }}
                  />
                </IconButton>
              </Tooltip>
              <Tooltip title={`Signed in as ${user?.email || "Google"}`}>
                <Avatar
                  src={user?.picture}
                  sx={{ width: 24, height: 24, fontSize: "0.7rem" }}
                >
                  {user?.name?.[0] || "G"}
                </Avatar>
              </Tooltip>
              <Tooltip title="Sign out">
                <IconButton size="small" onClick={logout}>
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <Chip
              icon={<GoogleIcon sx={{ fontSize: 16 }} />}
              label={
                sessionExpired
                  ? "Session expired — sign in again"
                  : "Sign in with Google"
              }
              size="small"
              variant="outlined"
              onClick={login}
              sx={{
                fontSize: "0.7rem",
                ...(sessionExpired && {
                  borderColor: "warning.main",
                  color: "warning.main",
                }),
              }}
            />
          )}
          <Tooltip title="Quick add event">
            <IconButton
              size="small"
              onClick={() => {
                const now = new Date();
                const end = new Date(now);
                end.setHours(end.getHours() + 1);
                setEditingEvent(newEvent(now, end));
                setDialogOpen(true);
              }}
            >
              <AddCircleOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Calendar */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          p: 1,
          "@keyframes spin": {
            from: { transform: "rotate(0deg)" },
            to: { transform: "rotate(360deg)" },
          },
          "& .rbc-calendar": { height: "100%" },
          "& .rbc-header": { fontWeight: 600, fontSize: "0.8rem", py: 0.5 },
          "& .rbc-today": { bgcolor: "action.hover" },
          "& .rbc-event": {
            borderRadius: "4px !important",
            border: "none !important",
            fontSize: "0.75rem",
          },
          "& .rbc-show-more": { color: "primary.main", fontSize: "0.75rem" },
        }}
      >
        <Calendar
          localizer={localizer}
          events={allEvents}
          startAccessor="start"
          endAccessor="end"
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          view={currentView}
          onView={setCurrentView}
          date={currentDate}
          onNavigate={setCurrentDate}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          step={30}
          timeslots={2}
          style={{ height: "100%" }}
          components={{ toolbar: CustomToolbar }}
          eventPropGetter={(event) => {
            const member = familyMembers.find((m) => m.name === event.owner);
            return {
              style: {
                backgroundColor:
                  member?.color ||
                  (event.source === "google" ? "#1a73e8" : "#43a047"),
                borderRadius: 4,
                border: "none",
                fontSize: "0.75rem",
              },
            };
          }}
        />
      </Box>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          {editingEvent?.source === "google"
            ? "Edit Google Event"
            : editingEvent && localEvents.find((e) => e.id === editingEvent.id)
              ? "Edit Event"
              : "New Event"}
          {editingEvent?.source === "google" && (
            <Chip
              label="Google"
              size="small"
              sx={{ ml: 1, fontSize: "0.65rem" }}
              color="primary"
            />
          )}
        </DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
        >
          <TextField
            autoFocus
            label="Event title"
            value={editingEvent?.title || ""}
            onChange={(e) =>
              setEditingEvent((prev) => ({ ...prev, title: e.target.value }))
            }
            fullWidth
            size="small"
            sx={{ mt: 1 }}
          />
          <FormControl fullWidth size="small">
            <InputLabel>Person</InputLabel>
            <Select
              value={editingEvent?.owner || ""}
              label="Person"
              onChange={(e) => {
                const member = familyMembers.find(
                  (m) => m.name === e.target.value,
                );
                setEditingEvent((prev) => ({
                  ...prev,
                  owner: member.name,
                  calendarId: member.calendarId,
                  color: member.color,
                }));
              }}
            >
              {familyMembers.map((m) => (
                <MenuItem key={m.name} value={m.name}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        bgcolor: m.color,
                      }}
                    />
                    {m.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Start"
            type="datetime-local"
            value={
              editingEvent
                ? format(editingEvent.start, "yyyy-MM-dd'T'HH:mm")
                : ""
            }
            onChange={(e) =>
              setEditingEvent((prev) => ({
                ...prev,
                start: new Date(e.target.value),
              }))
            }
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="End"
            type="datetime-local"
            value={
              editingEvent ? format(editingEvent.end, "yyyy-MM-dd'T'HH:mm") : ""
            }
            onChange={(e) =>
              setEditingEvent((prev) => ({
                ...prev,
                end: new Date(e.target.value),
              }))
            }
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          {/* Reminder toggle */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {reminderEnabled ? (
                    <NotificationsActiveIcon
                      sx={{ fontSize: 16, color: "primary.main" }}
                    />
                  ) : (
                    <NotificationsOffIcon
                      sx={{ fontSize: 16, color: "text.disabled" }}
                    />
                  )}
                  <Typography variant="body2">Reminder</Typography>
                </Box>
              }
            />
            {reminderEnabled && (
              <TextField
                label="Minutes before"
                type="number"
                value={reminderMinutes}
                onChange={(e) =>
                  setReminderMinutes(
                    Math.max(1, parseInt(e.target.value, 10) || 15),
                  )
                }
                size="small"
                sx={{ width: 130 }}
                inputProps={{ min: 1 }}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          {editingEvent &&
            (editingEvent.source === "google" ||
              localEvents.find((e) => e.id === editingEvent.id)) && (
              <IconButton
                color="error"
                onClick={handleDelete}
                sx={{ mr: "auto" }}
              >
                <DeleteIcon />
              </IconButton>
            )}
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!editingEvent?.title?.trim()}
          >
            {isSignedIn ? "Save to Google" : "Save Locally"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
