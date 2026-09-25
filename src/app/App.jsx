import Dashboard from "../features/dashboard/pages/Dashboard";
import HouseholdGate from "../features/household/components/HouseholdGate";

function App() {
  return (
    <HouseholdGate>
      <Dashboard />
    </HouseholdGate>
  );
}

export default App;
