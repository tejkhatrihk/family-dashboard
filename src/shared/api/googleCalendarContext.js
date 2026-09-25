import { createContext, useContext } from "react";

export const GoogleCalendarContext = createContext(null);

export function useGoogleCalendar() {
  const context = useContext(GoogleCalendarContext);
  if (!context) {
    throw new Error("useGoogleCalendar must be used inside GoogleCalendarProvider");
  }
  return context;
}
