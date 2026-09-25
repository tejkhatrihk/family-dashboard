const REMINDER_STORAGE_KEY = "family_event_reminders";
const FIRED_STORAGE_KEY = "family_reminders_fired";

// ── Persistence ────────────────────────────────────────────────────────
export function loadReminders() {
  try {
    return JSON.parse(localStorage.getItem(REMINDER_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveReminders(reminders) {
  localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
}

export function getReminder(eventId) {
  const all = loadReminders();
  return all[eventId] ?? null;
}

export function setReminder(eventId, minutesBefore) {
  const all = loadReminders();
  all[eventId] = minutesBefore;
  saveReminders(all);
}

export function removeReminder(eventId) {
  const all = loadReminders();
  delete all[eventId];
  saveReminders(all);
}

// ── Fired tracking (so we don't repeat) ────────────────────────────────
function getFired() {
  try {
    return JSON.parse(localStorage.getItem(FIRED_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function markFired(key) {
  const fired = getFired();
  fired[key] = Date.now();
  // Clean entries older than 24 hours
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const k of Object.keys(fired)) {
    if (fired[k] < cutoff) delete fired[k];
  }
  localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(fired));
}

function hasFired(key) {
  return !!getFired()[key];
}

// ── Chime via Web Audio API ────────────────────────────────────────────
function playChime() {
  return new Promise((resolve) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + i * 0.15 + 0.4,
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.4);
      });
      setTimeout(resolve, 800);
    } catch {
      resolve();
    }
  });
}

// ── Speech ─────────────────────────────────────────────────────────────
function speak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }
    // Wait for voices to load if needed
    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(
        (v) =>
          /female|zira|susan|hazel|linda|samantha|karen|moira|tessa|fiona/i.test(
            v.name,
          ) ||
          (/google.*us/i.test(v.name) && /female/i.test(v.name)),
      );
      const utterance = new SpeechSynthesisUtterance(text);
      if (femaleVoice) utterance.voice = femaleVoice;
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      utterance.volume = 1;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      trySpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = trySpeak;
    }
  });
}

// ── Check and fire reminders ───────────────────────────────────────────
export async function checkReminders(events) {
  const reminders = loadReminders();
  const now = Date.now();
  const reminderKeys = Object.keys(reminders);

  if (reminderKeys.length > 0) {
    console.debug(
      `[Reminders] Checking ${events.length} events, ${reminderKeys.length} reminders set`,
    );
  }

  for (const event of events) {
    const reminderId = event.reminderId || event.recurrenceParentId || event.id;
    const minutesBefore = reminders[reminderId];
    if (minutesBefore == null) continue;

    const eventStart = new Date(event.start).getTime();
    const triggerTime = eventStart - minutesBefore * 60 * 1000;
    const firedKey = `${event.id}_${eventStart}_${minutesBefore}`;
    const minsUntilTrigger = Math.round((triggerTime - now) / 60000);

    console.debug(
      `[Reminders] "${event.title}" (${event.owner}) — triggers in ${minsUntilTrigger} min, fired: ${hasFired(firedKey)}`,
    );

    // Fire if we're within the reminder window (trigger time to event start)
    // and haven't already fired
    if (now >= triggerTime && now < eventStart && !hasFired(firedKey)) {
      markFired(firedKey);

      const minsLeft = Math.round((eventStart - now) / 60000);
      const ownerText = event.owner ? `${event.owner} has` : "You have";
      const timeText =
        minsLeft <= 1 ? "in about 1 minute" : `in ${minsLeft} minutes`;
      const message = `${ownerText} ${event.title} ${timeText}`;

      console.log(`[Reminders] 🔔 Firing: ${message}`);
      await playChime();
      await speak(message);
    }
  }
}
