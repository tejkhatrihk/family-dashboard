import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "../../household/api/householdContext";
import { useFirebaseAuth } from "../../../shared/api/firebaseAuthContext";
import {
  createHouseholdTask,
  deleteHouseholdTask,
  setHouseholdTaskCompleted,
  subscribeToHouseholdTasks,
} from "../services/taskService";

export function useHouseholdTasks() {
  const { householdId } = useHousehold();
  const { user } = useFirebaseAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(Boolean(householdId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!householdId) return undefined;

    return subscribeToHouseholdTasks(
      householdId,
      (nextTasks) => {
        setTasks(nextTasks);
        setLoading(false);
        setError(null);
      },
      (subscriptionError) => {
        console.error("Failed to load household tasks:", subscriptionError);
        setError(subscriptionError);
        setLoading(false);
      },
    );
  }, [householdId]);

  const runMutation = useCallback(async (mutation) => {
    setError(null);
    try {
      return await mutation();
    } catch (mutationError) {
      setError(mutationError);
      throw mutationError;
    }
  }, []);

  const addTask = useCallback(
    (task) =>
      runMutation(() => createHouseholdTask(householdId, task, user.uid)),
    [householdId, runMutation, user.uid],
  );

  const setTaskCompleted = useCallback(
    (taskId, completed) =>
      runMutation(() =>
        setHouseholdTaskCompleted(householdId, taskId, completed),
      ),
    [householdId, runMutation],
  );

  const removeTask = useCallback(
    (taskId) =>
      runMutation(() => deleteHouseholdTask(householdId, taskId)),
    [householdId, runMutation],
  );

  return { tasks, loading, error, addTask, setTaskCompleted, removeTask };
}
