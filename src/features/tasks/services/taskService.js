import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { firestore } from "../../../shared/api/firebaseClient";

function taskFromSnapshot(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

function tasksCollection(householdId) {
  return collection(firestore, "households", householdId, "tasks");
}

export function subscribeToHouseholdTasks(householdId, onValue, onError) {
  return onSnapshot(
    tasksCollection(householdId),
    (snapshot) => onValue(snapshot.docs.map(taskFromSnapshot)),
    onError,
  );
}

export async function createHouseholdTask(householdId, task, createdBy) {
  return addDoc(tasksCollection(householdId), {
    title: task.title.trim(),
    assigneeId: task.assigneeId,
    assigneeName: task.assigneeName,
    dueDate: task.dueDate,
    completed: false,
    completedAt: null,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function setHouseholdTaskCompleted(householdId, taskId, completed) {
  return updateDoc(doc(tasksCollection(householdId), taskId), {
    completed,
    completedAt: completed ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export function deleteHouseholdTask(householdId, taskId) {
  return deleteDoc(doc(tasksCollection(householdId), taskId));
}
