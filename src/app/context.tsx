import { createContext, useContext } from "react";
import { repository } from "../db";
import type { Profile, Records, TableName } from "../schemas";
export type Data = { [K in TableName]: Records[K][] };
export interface AppContextValue {
  profile: Profile;
  setAppearance: (dark: boolean) => void;
  data: Data;
  repo: ReturnType<typeof repository>;
  date: string;
  setDate: (v: string) => void;
  page: string;
  navigate: (v: string) => void;
  run: (task: () => Promise<unknown>, success?: string) => Promise<boolean>;
  notify: (v: string) => void;
  notice: string;
  lock: () => void;
  addMeal: () => void;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("Perfil bloqueado");
  return value;
}
