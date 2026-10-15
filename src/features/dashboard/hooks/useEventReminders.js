import { useCallback, useEffect, useRef, useState } from "react";
import { useFirebaseAuth } from "../../../shared/api/firebaseAuthContext";
import {
  deleteEventReminder,
  migrateLocalEventReminders,
  saveEventReminder,
  subscribeToEventReminders,
} from "../services/eventReminderService";

export function useEventReminders() {
  const { user } = useFirebaseAuth();
  const userId = user?.uid;
  const [state, setState] = useState(() => ({
    userId,
    reminders: {},
    loading: Boolean(userId),
  }));
  const migrationAttempted = useRef(false);
  const currentState =
    state.userId === userId
      ? state
      : { userId, reminders: {}, loading: Boolean(userId) };

  useEffect(() => {
    if (!userId) {
      migrationAttempted.current = false;
      return undefined;
    }

    migrationAttempted.current = false;
    return subscribeToEventReminders(
      userId,
      (nextReminders) => {
        setState({
          userId,
          reminders: nextReminders,
          loading: false,
        });
        if (!migrationAttempted.current) {
          migrationAttempted.current = true;
          migrateLocalEventReminders(userId, nextReminders).catch((error) => {
            console.error("Failed to migrate local event reminders:", error);
          });
        }
      },
      (error) => {
        console.error("Failed to load event reminders:", error);
        setState({ userId, reminders: {}, loading: false });
      },
    );
  }, [userId]);

  const setReminder = useCallback(
    (eventId, minutesBefore) => {
      if (!userId) return Promise.reject(new Error("Sign in to save reminders."));
      return saveEventReminder(userId, eventId, minutesBefore);
    },
    [userId],
  );

  const removeReminder = useCallback(
    (eventId) => {
      if (!userId) return Promise.reject(new Error("Sign in to remove reminders."));
      return deleteEventReminder(userId, eventId);
    },
    [userId],
  );

  return {
    reminders: currentState.reminders,
    loading: currentState.loading,
    setReminder,
    removeReminder,
  };
}
