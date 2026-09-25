import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import {
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import { dashboardColors, getMemberPalette } from "../../../app/theme";
import { toDateKey } from "../services/mealService";

function MemberBadge({ members, owner, size = 30 }) {
  const palette = getMemberPalette(members, owner);
  return (
    <Box
      aria-label={owner}
      title={owner}
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: palette.main,
        color: "white",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        fontSize: size <= 24 ? "0.68rem" : "0.76rem",
        fontWeight: 800,
      }}
    >
      {(owner || "F").slice(0, 1).toUpperCase()}
    </Box>
  );
}

function getChecklistSummary(checklist = []) {
  const namedItems = checklist.filter((item) => item.text?.trim());
  if (!namedItems.length) return null;
  const remaining = namedItems.filter((item) => !item.completed);
  if (!remaining.length) return "Checklist complete";
  return remaining.map((item) => item.text.trim()).join(", ");
}

function EventCard({ event, familyMembers, now, onSelect }) {
  const happeningNow = now >= event.start && now < event.end;
  const hasEnded = event.end < now;
  const checklistSummary = getChecklistSummary(event.checklist);

  return (
    <Paper
      component="button"
      type="button"
      onClick={() => onSelect(event)}
      elevation={0}
      sx={{
        appearance: "none",
        width: "100%",
        minHeight: 62,
        p: { xs: 1.25, sm: 1.5 },
        border: "1px solid",
        borderWidth: happeningNow ? 2 : 1,
        borderColor: happeningNow ? "error.main" : "divider",
        bgcolor: "background.paper",
        display: "grid",
        gridTemplateColumns: { xs: "64px 30px minmax(0, 1fr)", sm: "78px 32px minmax(0, 1fr)" },
        alignItems: "start",
        gap: { xs: 0.75, sm: 1.25 },
        textAlign: "left",
        cursor: "pointer",
        opacity: hasEnded && !happeningNow ? 0.62 : 1,
        transition: "border-color 120ms ease, box-shadow 120ms ease",
        "&:hover": { borderColor: happeningNow ? "error.main" : "primary.main", boxShadow: "0 3px 14px rgba(40, 48, 42, 0.06)" },
        "&:focus-visible": { outline: `3px solid ${dashboardColors.tealSoft}`, outlineOffset: 2 },
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, color: "text.secondary", pt: 0.25, whiteSpace: "nowrap" }}
      >
        {event.allDay ? "All day" : format(event.start, "h:mm a")}
      </Typography>

      <MemberBadge members={familyMembers} owner={event.owner} />

      <Box sx={{ minWidth: 0, display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body1" sx={{ fontWeight: 750, lineHeight: 1.25 }} noWrap>
            {event.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {event.allDay
              ? event.owner
              : `${format(event.start, "h:mm")} – ${format(event.end, "h:mm a")}`}
            {checklistSummary && (
              <Box component="span" sx={{ display: { xs: "block", sm: "inline" } }}>
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}> · </Box>
                <CheckCircleOutlineIcon sx={{ fontSize: 14, verticalAlign: "-2px", mr: 0.4 }} />
                {checklistSummary}
              </Box>
            )}
          </Typography>
        </Box>
        {happeningNow && (
          <Chip
            label="Happening now"
            size="small"
            sx={{
              bgcolor: dashboardColors.coralSoft,
              color: dashboardColors.coral,
              height: 22,
              fontSize: "0.68rem",
              fontWeight: 800,
              flexShrink: 0,
            }}
          />
        )}
      </Box>
    </Paper>
  );
}

function DayGroup({ date, events, familyMembers, now, onSelect }) {
  const today = isSameDay(date, now);
  return (
    <Box component="section">
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 800 }}>
          {today ? "Today" : format(date, "EEEE")}
        </Typography>
        {today && (
          <Chip
            label="TODAY"
            size="small"
            sx={{ height: 19, bgcolor: "error.main", color: "white", fontSize: "0.62rem", fontWeight: 800 }}
          />
        )}
        <Typography variant="body2" color="text.secondary">
          {format(date, "MMM d")}
        </Typography>
      </Box>
      <Stack spacing={1}>
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            familyMembers={familyMembers}
            now={now}
            onSelect={onSelect}
          />
        ))}
      </Stack>
    </Box>
  );
}

export default function AgendaView({
  events,
  familyMembers,
  currentDate,
  now,
  onSelectEvent,
  focusUpcoming = false,
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const viewingCurrentWeek = isSameDay(
    weekStart,
    startOfWeek(now, { weekStartsOn: 1 }),
  );

  const visibleEvents = events
    .filter((event) => event.start >= weekStart && event.start <= weekEnd)
    .filter(
      (event) => !focusUpcoming || !viewingCurrentWeek || event.end >= now,
    )
    .sort((a, b) => a.start - b.start);

  const groupedEvents = visibleEvents.reduce((groups, event) => {
    const key = toDateKey(event.start);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
    return groups;
  }, new Map());

  const tomorrowHasEvents = visibleEvents.some((event) => isSameDay(event.start, tomorrow));

  return (
    <Stack spacing={3.25}>
      {[...groupedEvents.entries()].map(([dateKey, dayEvents]) => (
        <DayGroup
          key={dateKey}
          date={dayEvents[0].start}
          events={dayEvents}
          familyMembers={familyMembers}
          now={now}
          onSelect={onSelectEvent}
        />
      ))}

      {!visibleEvents.length && (
        <Paper
          elevation={0}
          sx={{ border: "1px dashed", borderColor: "divider", p: 3, textAlign: "center", bgcolor: dashboardColors.softSurface }}
        >
          <Typography sx={{ fontWeight: 750 }}>Nothing scheduled this week</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            A little breathing room.
          </Typography>
        </Paper>
      )}

      {!focusUpcoming && isSameDay(currentDate, now) && !tomorrowHasEvents && (
        <Paper
          elevation={0}
          sx={{
            px: 1.75,
            py: 1.25,
            bgcolor: dashboardColors.softSurface,
            border: "1px dashed",
            borderColor: "divider",
            display: "flex",
            gap: 1.25,
            alignItems: "center",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            Tomorrow · {format(tomorrow, "EEE d")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Nothing scheduled yet
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}
