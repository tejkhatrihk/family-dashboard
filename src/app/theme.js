import { createTheme } from "@mui/material/styles";

export const dashboardColors = {
  background: "#fbfaf7",
  paper: "#ffffff",
  ink: "#15211d",
  muted: "#6f6b59",
  divider: "#e7e2d9",
  softSurface: "#f3f1eb",
  teal: "#2a9d8f",
  tealSoft: "#e1f2ef",
  coral: "#ed4b36",
  coralSoft: "#fbe7e2",
  blue: "#3f63df",
  blueSoft: "#e7ecfc",
  amber: "#8a7132",
};

export const memberPalette = [
  { main: dashboardColors.teal, soft: dashboardColors.tealSoft },
  { main: dashboardColors.coral, soft: dashboardColors.coralSoft },
  { main: dashboardColors.blue, soft: dashboardColors.blueSoft },
  { main: dashboardColors.amber, soft: "#f5efdf" },
];

export function getMemberPalette(members, owner) {
  const index = Math.max(
    0,
    members.findIndex((member) => member.name === owner),
  );
  return memberPalette[index % memberPalette.length];
}

export const dashboardTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: dashboardColors.teal, contrastText: "#ffffff" },
    error: { main: dashboardColors.coral },
    background: {
      default: dashboardColors.background,
      paper: dashboardColors.paper,
    },
    text: { primary: dashboardColors.ink, secondary: dashboardColors.muted },
    divider: dashboardColors.divider,
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    button: { textTransform: "none", fontWeight: 700 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 36 } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backgroundImage: "none", border: `1px solid ${dashboardColors.divider}` },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: { borderColor: dashboardColors.divider },
      },
    },
  },
});
