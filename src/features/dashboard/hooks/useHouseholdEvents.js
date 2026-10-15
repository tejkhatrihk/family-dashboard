import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { firestore } from "../../../shared/api/firebaseClient";
import { useHousehold } from "../../household/api/householdContext";

const LEGACY_STORAGE_KEY = "family_calendar_events";

function readLegacyEvents() {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function eventFromSnapshot(snapshot) {
  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    start: data.start?.toDate ? data.start.toDate() : new Date(data.start),
    end: data.end?.toDate ? data.end.toDate() : new Date(data.end),
    checklist: data.checklist || [],
    source: "household",
  };
}

function eventDocument(event) {
  return {
    title: event.title,
    description: event.description || "",
    location: event.location || "",
    checklist: event.checklist || [],
    start: event.start,
    end: event.end,
    allDay: Boolean(event.allDay),
    owner: event.owner || "Family",
    calendarId: event.calendarId || "primary",
    color: event.color || "#2a9d8f",
    recurrence: event.recurrence || null,
    googleEventId: event.googleEventId || null,
    googleCalendarId: event.googleCalendarId || null,
    updatedAt: serverTimestamp(),
  };
}

export function useHouseholdEvents() {
  const { householdId } = useHousehold();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const migrationAttempted = useRef(false);

  useEffect(() => {
    if (!householdId) return undefined;
    const eventsCollection = collection(
      firestore,
      "households",
      householdId,
      "events",
    );
    return onSnapshot(
      eventsCollection,
      (snapshot) => {
        const sharedEvents = snapshot.docs.map(eventFromSnapshot);
        setEvents(sharedEvents);
        setLoading(false);

        if (!sharedEvents.length && !migrationAttempted.current) {
          migrationAttempted.current = true;
          Promise.all(
            readLegacyEvents().map((legacyEvent) => {
              const eventRef = doc(eventsCollection, legacyEvent.id);
              return setDoc(
                eventRef,
                eventDocument({
                  ...legacyEvent,
                  start: new Date(legacyEvent.start),
                  end: new Date(legacyEvent.end),
                }),
              );
            }),
          ).catch(console.error);
        }
      },
      (error) => {
        console.error("Failed to load household events:", error);
        setLoading(false);
      },
    );
  }, [householdId]);

  const saveEvent = useCallback(
    async (event) => {
      const eventRef = doc(
        firestore,
        "households",
        householdId,
        "events",
        event.id,
      );
      const sharedEvent = { ...event, source: "household" };
      setEvents((previous) => {
        const exists = previous.some((candidate) => candidate.id === event.id);
        return exists
          ? previous.map((candidate) =>
              candidate.id === event.id ? sharedEvent : candidate,
            )
          : [...previous, sharedEvent];
      });
      await setDoc(eventRef, eventDocument(sharedEvent), { merge: true });
      return sharedEvent;
    },
    [householdId],
  );

  const deleteEvent = useCallback(
    async (eventId) => {
      setEvents((previous) =>
        previous.filter((event) => event.id !== eventId),
      );
      await deleteDoc(
        doc(firestore, "households", householdId, "events", eventId),
      );
    },
    [householdId],
  );

  return { events, loading, saveEvent, deleteEvent };
}
