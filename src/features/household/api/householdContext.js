import { createContext, useContext } from "react";

export const HouseholdContext = createContext(null);

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error("useHousehold must be used inside HouseholdProvider");
  }
  return context;
}

