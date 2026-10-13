import { defaults } from "./db";
// Artificial, test-only measurements. Not imported by the application.
export const testProfiles = defaults.map((p, i) => ({
  ...p,
  birthDate: i ? "2004-01-15" : "2000-06-15",
  height: i ? 165 : 169,
  initialWeight: i ? 69 : 60,
}));
