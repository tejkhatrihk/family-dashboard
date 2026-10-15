import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { firestore } from "../../../shared/api/firebaseClient";

const LEGACY_REMINDERS_KEY = "family_event_reminders";
const LEGACY_FIRED_KEY = "family_reminders_fired";

function remindersCollection(userId) {
  return collection(firestore, "users", userId, "eventReminders");
}

export function subscribeToEventReminders(userId, onValue, onError) {
  return onSnapshot(
    remindersCollection(userId),
    (snapshot) => {
      onValue(
        Object.fromEntries(
          snapshot.docs.map((reminder) => [
            reminder.id,
            reminder.data().minutesBefore,
          ]),
        ),
      );
    },
    onError,
  );
}

export function saveEventReminder(userId, eventId, minutesBefore) {
  return setDoc(doc(remindersCollection(userId), eventId), {
    minutesBefore,
  });
}

export function deleteEventReminder(userId, eventId) {
  return deleteDoc(doc(remindersCollection(userId), eventId));
}

export async function migrateLocalEventReminders(userId, existingReminders) {
  const rawReminders = localStorage.getItem(LEGACY_REMINDERS_KEY);
  const localReminders = rawReminders ? JSON.parse(rawReminders) : {};
  if (
    !localReminders ||
    typeof localReminders !== "object" ||
    Array.isArray(localReminders)
  ) {
    throw new TypeError("Legacy event reminders must be an object.");
  }

  const missingReminders = Object.entries(localReminders).filter(
    ([eventId, minutesBefore]) =>
      !Object.hasOwn(existingReminders, eventId) &&
      Number.isFinite(minutesBefore) &&
      minutesBefore > 0,
  );
  await Promise.all(
    missingReminders.map(([eventId, minutesBefore]) =>
      saveEventReminder(userId, eventId, minutesBefore),
    ),
  );

  localStorage.removeItem(LEGACY_REMINDERS_KEY);
  localStorage.removeItem(LEGACY_FIRED_KEY);
}
