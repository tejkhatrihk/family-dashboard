import {
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
  subMinutes,
} from "date-fns";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { dashboardColors, getMemberPalette } from "../../../app/theme";
import { toDateKey } from "../services/mealService";

const INITIAL_PAST_DAYS = 14;
const INITIAL_FUTURE_DAYS = 20;
const AGENDA_PAGE_DAYS = 14;

function getEventEmoji(title = "") {
  const normalizedTitle = title.toLowerCase();
  if (/dinner|lunch|breakfast|meal|food/.test(normalizedTitle)) return "🍽️";
  if (/school|class|homework|study/.test(normalizedTitle)) return "🏫";
  if (/gym|dance|sport|swim|football|soccer/.test(normalizedTitle)) return "🤸";
  if (/doctor|dentist|medical|appointment/.test(normalizedTitle)) return "🩺";
  return "📅";
}

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

function EventCard({
  event,
  familyMembers,
  now,
  reminders,
  onSelect,
  onUpdateChecklist,
}) {
  const happeningNow = now >= event.start && now < event.end;
  const hasEnded = event.end < now;
  const [checklistOpen, setChecklistOpen] = useState(false);
  const checklist = (event.checklist || []).filter((item) => item.text?.trim());
  const completedCount = checklist.filter((item) => item.completed).length;
  const remainingCount = checklist.length - completedCount;
  const progress = checklist.length ? (completedCount / checklist.length) * 100 : 0;
  const reminderMinutes =
    reminders[event.reminderId || event.recurrenceParentId || event.id];
  const leaveBy = reminderMinutes ? subMinutes(event.start, reminderMinutes) : null;

  const updateChecklistItem = (itemIndex, completed) => {
    const updatedChecklist = (event.checklist || []).map((item, index) =>
      index === itemIndex ? { ...item, completed } : item,
    );
    onUpdateChecklist(event, updatedChecklist);
  };

  const markReady = () => {
    const updatedChecklist = (event.checklist || []).map((item) =>
      item.text?.trim() ? { ...item, completed: true } : item,
    );
    onUpdateChecklist(event, updatedChecklist);
  };

  return (
    <Paper
      component="article"
      onClick={() => onSelect(event)}
      elevation={0}
      sx={{
        width: "100%",
        minHeight: 62,
        p: { xs: 1.25, sm: 1.5 },
        border: "1px solid",
        borderWidth: happeningNow ? 2 : 1,
        borderColor: happeningNow ? "error.main" : "divider",
        bgcolor: "background.paper",
        display: "grid",
        gridTemplateColumns: { xs: "54px 42px minmax(0, 1fr)", sm: "70px 48px minmax(0, 1fr)" },
        alignItems: "center",
        gap: { xs: 0.75, sm: 1.25 },
        textAlign: "left",
        opacity: hasEnded && !happeningNow ? 0.62 : 1,
        transition: "border-color 120ms ease, box-shadow 120ms ease",
        "&:hover": { borderColor: happeningNow ? "error.main" : "primary.main", boxShadow: "0 3px 14px rgba(40, 48, 42, 0.06)" },
        "&:focus-visible": { outline: `3px solid ${dashboardColors.tealSoft}`, outlineOffset: 2 },
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, color: "text.secondary", whiteSpace: "nowrap" }}
      >
        {event.allDay ? "All day" : format(event.start, "h:mm a")}
      </Typography>

      <Box
        aria-hidden
        sx={{
          width: { xs: 42, sm: 48 },
          height: { xs: 42, sm: 48 },
          borderRadius: 1.25,
          bgcolor: dashboardColors.blueSoft,
          display: "grid",
          placeItems: "center",
          fontSize: "1.25rem",
        }}
      >
        {getEventEmoji(event.title)}
      </Box>

      <Box sx={{ minWidth: 0, display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body1" sx={{ fontWeight: 750, lineHeight: 1.25 }} noWrap>
            {event.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {event.allDay
              ? `All day · ${event.owner}`
              : `${format(event.start, "h:mm a")} – ${format(event.end, "h:mm a")} · ${event.owner}`}
          </Typography>
        </Box>
        <Stack spacing={0.75} alignItems="flex-end" sx={{ flexShrink: 0 }}>
          {checklist.length > 0 && (
            <Button
              size="small"
              aria-expanded={checklistOpen}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                setChecklistOpen((open) => !open);
              }}
              sx={{
                minWidth: 0,
                px: 1.15,
                py: 0.2,
                borderRadius: 10,
                bgcolor: remainingCount ? "#f5efdf" : dashboardColors.tealSoft,
                color: remainingCount ? dashboardColors.amber : "primary.main",
                fontSize: "0.72rem",
                fontWeight: 800,
                textTransform: "none",
                "&:hover": { bgcolor: remainingCount ? "#f5efdf" : dashboardColors.tealSoft },
              }}
            >
              {remainingCount ? `${remainingCount} to do` : "Ready"}
            </Button>
          )}
          {checklist.length === 0 && (
            <MemberBadge members={familyMembers} owner={event.owner} size={26} />
          )}
        </Stack>
      </Box>

      <Collapse
        in={checklistOpen}
        unmountOnExit
        sx={{ gridColumn: "1 / -1" }}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <Box sx={{ pt: 1.5, mt: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
          {leaveBy && (
            <Button
              fullWidth
              onClick={() => onSelect(event)}
              sx={{
                justifyContent: "flex-start",
                mb: 1.25,
                bgcolor: dashboardColors.tealSoft,
                color: "primary.main",
                textTransform: "none",
                fontWeight: 800,
              }}
            >
              🚗 Leave by {format(leaveBy, "h:mm a")} ({reminderMinutes} min) — edit
            </Button>
          )}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Get ready</Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {completedCount}/{checklist.length}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 7, borderRadius: 8, mb: 1, bgcolor: "action.hover" }}
          />
          <Stack spacing={0.15}>
            {(event.checklist || []).map((item, itemIndex) =>
              item.text?.trim() ? (
                <Stack key={`${item.text}-${itemIndex}`} direction="row" alignItems="center" spacing={0.5}>
                  <Checkbox
                    size="small"
                    checked={Boolean(item.completed)}
                    onChange={(changeEvent) => updateChecklistItem(itemIndex, changeEvent.target.checked)}
                    inputProps={{ "aria-label": `Mark ${item.text} ${item.completed ? "incomplete" : "complete"}` }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      textDecoration: item.completed ? "line-through" : "none",
                      color: item.completed ? "text.secondary" : "text.primary",
                    }}
                  >
                    {item.text}
                  </Typography>
                </Stack>
              ) : null,
            )}
          </Stack>
          {remainingCount > 0 && (
            <Button
              fullWidth
              variant="contained"
              onClick={markReady}
              sx={{ mt: 1, minHeight: 42, textTransform: "none", fontWeight: 800 }}
            >
              Mark as ready
            </Button>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

function DayTasks({ tasks, familyMembers, onToggle }) {
  if (!tasks.length) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        bgcolor: dashboardColors.tealSoft,
        overflow: "hidden",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", px: 1.5, pt: 1, pb: 0.25, fontWeight: 800 }}
      >
        TASKS
      </Typography>
      {tasks.map((task) => (
        <Box
          key={task.id}
          sx={{
            minHeight: 46,
            px: 0.75,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            borderTop: "1px solid",
            borderColor: "rgba(42, 157, 143, 0.16)",
            opacity: task.completed ? 0.58 : 1,
          }}
        >
          <Checkbox
            size="small"
            checked={Boolean(task.completed)}
            onChange={(event) => onToggle(task.id, event.target.checked)}
            inputProps={{ "aria-label": `Mark ${task.title} ${task.completed ? "incomplete" : "complete"}` }}
          />
          <MemberBadge members={familyMembers} owner={task.owner} size={24} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                textDecoration: task.completed ? "line-through" : "none",
              }}
            >
              {task.title}
            </Typography>
            {task.isOverdue && (
              <Typography variant="caption" color="error.main" sx={{ fontWeight: 750 }}>
                Overdue
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

function DayGroup({
  date,
  events,
  tasks,
  familyMembers,
  now,
  reminders,
  onSelect,
  onToggleTask,
  onUpdateEventChecklist,
}) {
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
        <DayTasks tasks={tasks} familyMembers={familyMembers} onToggle={onToggleTask} />
        {events.length ? (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              familyMembers={familyMembers}
              now={now}
              reminders={reminders}
              onSelect={onSelect}
              onUpdateChecklist={onUpdateEventChecklist}
            />
          ))
        ) : (
          <Paper
            elevation={0}
            sx={{
              px: 1.75,
              py: 1.5,
              bgcolor: dashboardColors.softSurface,
              border: "1px dashed",
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No events scheduled
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}

function TimeGroupedAgenda({
  events,
  familyMembers,
  currentDate,
  now,
  reminders,
  onSelectEvent,
  onUpdateEventChecklist,
  onSelectDate,
}) {
  const viewingToday = isSameDay(currentDate, now);
  const dayEvents = events
    .filter((event) => isSameDay(event.start, currentDate))
    .filter((event) => !viewingToday || event.end >= now)
    .sort((first, second) => first.start - second.start);
  const happeningNow = viewingToday
    ? dayEvents.filter((event) => now >= event.start && now < event.end)
    : [];
  const upcoming = dayEvents.filter((event) => !happeningNow.includes(event));
  const nextEvents = upcoming.slice(0, 1);
  const laterEvents = upcoming.slice(1);
  const tomorrow = addDays(currentDate, 1);
  const tomorrowEvents = events
    .filter((event) => isSameDay(event.start, tomorrow))
    .sort((first, second) => first.start - second.start);
  const sections = [
    { label: "NOW", events: happeningNow },
    { label: "NEXT", events: nextEvents },
    { label: "LATER", events: laterEvents },
  ].filter((section) => section.events.length > 0);

  return (
    <Stack spacing={2.4}>
      {sections.map((section) => (
        <Box component="section" key={section.label}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.8, ml: 0.5, fontWeight: 850, letterSpacing: "0.05em" }}
          >
            {section.label}
          </Typography>
          <Stack spacing={1}>
            {section.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                familyMembers={familyMembers}
                now={now}
                reminders={reminders}
                onSelect={onSelectEvent}
                onUpdateChecklist={onUpdateEventChecklist}
              />
            ))}
          </Stack>
        </Box>
      ))}

      {!dayEvents.length && (
        <Paper
          elevation={0}
          sx={{ p: 2.5, border: "1px dashed", borderColor: "divider", textAlign: "center", bgcolor: dashboardColors.softSurface }}
        >
          <Typography sx={{ fontWeight: 750 }}>No events scheduled</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            A little breathing room.
          </Typography>
        </Paper>
      )}

      <Paper
        component="button"
        type="button"
        onClick={() => onSelectDate(tomorrow)}
        elevation={0}
        sx={{
          width: "100%",
          px: 1.75,
          py: 1.35,
          border: "1px dashed",
          borderColor: "divider",
          bgcolor: dashboardColors.softSurface,
          color: "text.secondary",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          textAlign: "left",
          font: "inherit",
          cursor: "pointer",
        }}
      >
        <Box component="span" sx={{ minWidth: 0 }}>
          <Box component="strong" sx={{ color: "text.primary" }}>
            Tomorrow · {format(tomorrow, "EEE d")}
          </Box>
          {tomorrowEvents.length > 0
            ? ` — ${tomorrowEvents.slice(0, 2).map((event) => `${event.title} ${format(event.start, "h:mm a")}`).join(", ")}`
            : " — Nothing scheduled yet"}
        </Box>
        <Box component="span" aria-hidden>›</Box>
      </Paper>
    </Stack>
  );
}

function useEndlessAgenda(anchorDate, onRangeChange) {
  const [pastDayCount, setPastDayCount] = useState(INITIAL_PAST_DAYS);
  const [futureDayCount, setFutureDayCount] = useState(INITIAL_FUTURE_DAYS);
  const scrollRootRef = useRef(null);
  const anchorRef = useRef(null);
  const loadPastRef = useRef(null);
  const loadFutureRef = useRef(null);
  const initializedRef = useRef(false);
  const pendingPrependRef = useRef(null);
  const rangeStart = useMemo(
    () => addDays(startOfDay(anchorDate), -pastDayCount),
    [anchorDate, pastDayCount],
  );
  const rangeEnd = useMemo(
    () => addDays(startOfDay(anchorDate), futureDayCount),
    [anchorDate, futureDayCount],
  );

  useLayoutEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;

    if (pendingPrependRef.current) {
      const { scrollHeight, scrollTop } = pendingPrependRef.current;
      scrollRoot.scrollTop = scrollTop + scrollRoot.scrollHeight - scrollHeight;
      pendingPrependRef.current = null;
      return;
    }

    if (!initializedRef.current && anchorRef.current) {
      scrollRoot.scrollTop = anchorRef.current.offsetTop;
      initializedRef.current = true;
    }
  }, [pastDayCount]);

  useEffect(() => {
    onRangeChange?.({ start: rangeStart, end: rangeEnd });
  }, [onRangeChange, rangeEnd, rangeStart]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    const loadPastElement = loadPastRef.current;
    const loadFutureElement = loadFutureRef.current;
    if (
      !scrollRoot ||
      !loadPastElement ||
      !loadFutureElement ||
      typeof IntersectionObserver === "undefined"
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !initializedRef.current) return;

        if (entry.target === loadPastElement) {
          pendingPrependRef.current = {
            scrollHeight: scrollRoot.scrollHeight,
            scrollTop: scrollRoot.scrollTop,
          };
          setPastDayCount((currentCount) => currentCount + AGENDA_PAGE_DAYS);
        } else {
          setFutureDayCount((currentCount) => currentCount + AGENDA_PAGE_DAYS);
        }
      },
      { root: scrollRoot, rootMargin: "500px 0px" },
    );

    observer.observe(loadPastElement);
    observer.observe(loadFutureElement);
    return () => observer.disconnect();
  }, []);

  return {
    anchorRef,
    loadFutureRef,
    loadPastRef,
    rangeEnd,
    rangeStart,
    scrollRootRef,
  };
}

export default function AgendaView({
  events,
  tasks = [],
  reminders = {},
  familyMembers,
  currentDate,
  now,
  onSelectEvent,
  onToggleTask = () => {},
  onUpdateEventChecklist = () => {},
  onSelectDate = () => {},
  focusUpcoming = false,
  endless = false,
  timeGrouped = false,
  onRangeChange,
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const {
    anchorRef,
    loadFutureRef,
    loadPastRef,
    rangeStart: endlessRangeStart,
    rangeEnd: endlessRangeEnd,
    scrollRootRef,
  } = useEndlessAgenda(currentDate, endless ? onRangeChange : undefined);
  const rangeStart = endless ? endlessRangeStart : weekStart;
  const rangeEnd = endless ? endlessRangeEnd : weekEnd;

  if (timeGrouped) {
    return (
      <TimeGroupedAgenda
        events={events}
        familyMembers={familyMembers}
        currentDate={currentDate}
        now={now}
        reminders={reminders}
        onSelectEvent={onSelectEvent}
        onUpdateEventChecklist={onUpdateEventChecklist}
        onSelectDate={onSelectDate}
      />
    );
  }

  const rangeEndWithTime = endOfDay(rangeEnd);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const viewingCurrentWeek = isSameDay(
    weekStart,
    startOfWeek(now, { weekStartsOn: 1 }),
  );

  const visibleEvents = events
    .filter((event) => event.start >= rangeStart && event.start <= rangeEndWithTime)
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

  const todayKey = toDateKey(now);
  const groupedTasks = tasks.reduce((groups, task) => {
    const isOverdue = !task.completed && task.dueDate < todayKey;
    const dateKey = isOverdue ? todayKey : task.dueDate;
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push({ ...task, isOverdue });
    return groups;
  }, new Map());
  groupedTasks.forEach((dayTasks) =>
    dayTasks.sort(
      (first, second) =>
        Number(first.completed) - Number(second.completed) ||
        first.title.localeCompare(second.title),
    ),
  );

  const tomorrowKey = toDateKey(tomorrow);
  const tomorrowHasItems =
    visibleEvents.some((event) => isSameDay(event.start, tomorrow)) ||
    groupedTasks.has(tomorrowKey);
  const visibleDays = endless
    ? eachDayOfInterval({ start: startOfDay(rangeStart), end: rangeEnd })
    : eachDayOfInterval({ start: startOfDay(rangeStart), end: rangeEnd }).filter(
        (date) => {
          const dateKey = toDateKey(date);
          const hasItems = groupedEvents.has(dateKey) || groupedTasks.has(dateKey);
          const isUpcoming =
            !focusUpcoming || !viewingCurrentWeek || dateKey >= todayKey;
          return hasItems && isUpcoming;
        },
      );

  return (
    <Stack
      ref={scrollRootRef}
      spacing={3.25}
      sx={
        endless
          ? {
              height: {
                xs: "calc(100dvh - 238px)",
                md: "calc(100dvh - 188px)",
              },
              minHeight: 360,
              overflowY: "auto",
              position: "relative",
              pr: { xs: 0.5, sm: 1 },
              scrollbarGutter: "stable",
            }
          : undefined
      }
    >
      {endless && <Box ref={loadPastRef} aria-hidden sx={{ height: 1, flexShrink: 0 }} />}

      {visibleDays.map((date) => {
        const dateKey = toDateKey(date);
        return (
          <Box
            key={dateKey}
            ref={endless && isSameDay(date, currentDate) ? anchorRef : undefined}
            sx={{ flexShrink: 0 }}
          >
            <DayGroup
              date={date}
              events={groupedEvents.get(dateKey) || []}
              tasks={groupedTasks.get(dateKey) || []}
              familyMembers={familyMembers}
              now={now}
              reminders={reminders}
              onSelect={onSelectEvent}
              onToggleTask={onToggleTask}
              onUpdateEventChecklist={onUpdateEventChecklist}
            />
          </Box>
        );
      })}

      {!endless && !visibleDays.length && (
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

      {!endless && !focusUpcoming && isSameDay(currentDate, now) && !tomorrowHasItems && (
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

      {endless && <Box ref={loadFutureRef} aria-hidden sx={{ height: 1, flexShrink: 0 }} />}
    </Stack>
  );
}
