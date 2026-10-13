import {
  lazy,
  Suspense,
  useEffect,
  useState,
  Component,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Leaf,
  House,
  Utensils,
  Dumbbell,
  ChartNoAxesCombined,
  Ellipsis,
  Plus,
  LogOut,
  WifiOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { db, initialize, repository } from "../db";
import {
  tables,
  type Profile,
  type ProfileId,
  type TableName,
} from "../schemas";
import { AppContext, type Data } from "./context";
import { niceDate, today, shiftDate } from "../utils/date";
import Gate from "../features/auth/Gate";
import Dashboard from "../features/dashboard/Dashboard";
import MealEditor from "../features/meals/MealEditor";
import { Button } from "../components/ui";
import ThemeToggle from "../components/ThemeToggle";
import { NavigationContext, useAppNavigation } from "./navigation";
const Meals = lazy(() => import("../features/meals/Meals"));
const Progress = lazy(() => import("../features/progress/Progress"));
const Workouts = lazy(() => import("../features/workouts/Workouts"));
const More = lazy(() => import("../features/settings/More"));
const navigation = [
  { id: "inicio", label: "Inicio", icon: House },
  { id: "comidas", label: "Comidas", icon: Utensils },
  { id: "entreno", label: "Entreno", icon: Dumbbell },
  { id: "progreso", label: "Progreso", icon: ChartNoAxesCombined },
  { id: "mas", label: "Más", icon: Ellipsis },
];
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="empty">
        <h1>No pudimos abrir esta vista.</h1>
        <p>Tus registros siguen guardados en este dispositivo.</p>
        <Button onClick={() => location.reload()}>Volver a intentar</Button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [dark, setDark] = useState(
    () => localStorage.getItem("nutriduo-appearance") === "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    localStorage.setItem("nutriduo-appearance", dark ? "dark" : "light");
  }, [dark]);
  const [active, setActive] = useState<ProfileId | null>(null),
    [initError, setInitError] = useState("");
  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  useEffect(() => {
    void initialize().catch(() =>
      setInitError(
        "No pudimos acceder al almacenamiento. Revisá si tu navegador permite guardar datos.",
      ),
    );
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const hide = () => {
      clearTimeout(timer);
      if (document.hidden)
        timer = setTimeout(() => setActive(null), 5 * 60 * 1000);
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  const p = profiles?.find((x) => x.id === active);
  if (initError)
    return (
      <div className="empty" role="alert">
        {initError}
      </div>
    );
  if (!profiles?.length)
    return <div className="loading">Preparando tu espacio…</div>;
  return (
    <ErrorBoundary>
      {p ? (
        <Shell
          key={p.id}
          profile={p}
          lock={() => setActive(null)}
          dark={dark}
          setDark={setDark}
        />
      ) : (
        <div className={dark ? "appearance-frame dark" : "appearance-frame"}>
          <div className="welcome-theme">
            <ThemeToggle dark={dark} onChange={setDark} />
          </div>
          <Gate
            profiles={profiles}
            onUnlock={(id) => {
              setActive(id);
              const selected = profiles.find((p) => p.id === id);
              if (selected?.onboarded) setDark(selected.dark);
            }}
          />
        </div>
      )}
    </ErrorBoundary>
  );
}
function Shell({
  profile,
  lock,
  dark,
  setDark,
}: {
  profile: Profile;
  lock: () => void;
  dark: boolean;
  setDark: (v: boolean) => void;
}) {
  useEffect(() => setDark(profile.dark), [profile.dark, setDark]);
  const { navigation: appNavigation, date, page } = useAppNavigation(lock);
  const { setDate, navigate } = appNavigation;
  const [mealOpen, setMealOpen] = useState(false),
    [notice, setNotice] = useState(""),
    [offline, setOffline] = useState(!navigator.onLine);
  const repo = repository(profile.id);
  const data = useLiveQuery(
    async () =>
      Object.fromEntries(
        await Promise.all(
          (Object.keys(tables) as TableName[]).map(async (name) => [
            name,
            await repository(profile.id).list(name),
          ]),
        ),
      ) as Data,
    [profile.id],
  );
  useEffect(() => {
    const on = () => setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5500);
    return () => clearTimeout(t);
  }, [notice]);
  async function run(task: () => Promise<unknown>, success?: string) {
    try {
      await task();
      if (success) setNotice(success);
      return true;
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "No se pudo guardar. Revisá el espacio disponible e intentá otra vez.",
      );
      return false;
    }
  }
  useEffect(() => {
    const doc = document as Document & {
      modelContext?: {
        registerTool: (
          t: unknown,
          o: { signal: AbortSignal },
        ) => Promise<void> | void;
      };
    };
    if (!doc.modelContext) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      doc.modelContext.registerTool(
        {
          name: "nutriduo_start_meal",
          description:
            "Abre el formulario de comida del perfil desbloqueado. No guarda datos.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: unknown) => {
            if (
              typeof input !== "object" ||
              input === null ||
              Object.keys(input).length
            )
              throw new Error("Se espera un objeto vacío.");
            setMealOpen(true);
            return { opened: true, profile: profile.name };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [profile.name]);
  if (!data) return <div className="loading">Abriendo tus registros…</div>;
  return (
    <NavigationContext.Provider value={appNavigation}>
      <AppContext.Provider
        value={{
          profile,
          data,
          repo,
          date,
          setDate,
          page,
          navigate,
          run,
          notify: setNotice,
          lock,
          addMeal: () => setMealOpen(true),
          notice,
        }}
      >
        <div className={`app-shell theme-${profile.id} ${dark ? "dark" : ""}`}>
          <aside className="sidebar">
            <div className="brand">
              <span className="brand-icon">
                <Leaf size={22} />
              </span>
              nutri<span>duo</span>
            </div>
            <div className="sidebar-label">MI ESPACIO</div>
            <nav>
              {navigation.map((n) => (
                <button
                  key={n.id}
                  className={page === n.id ? "active" : ""}
                  onClick={() => navigate(n.id)}
                >
                  <n.icon size={20} />
                  <span>{n.label}</span>
                  {page === n.id && <span className="nav-mark" />}
                </button>
              ))}
            </nav>
            <div className="sidebar-note">
              <Leaf size={22} />
              <strong>Datos locales</strong>
              <p>
                Guardá un backup para llevar tus registros a otro dispositivo.
              </p>
            </div>
            <button className="profile-switch" onClick={lock}>
              <span className="avatar">{profile.name[0]}</span>
              <span>
                <strong>{profile.name}</strong>
                <small>Cambiar perfil</small>
              </span>
              <LogOut size={18} />
            </button>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <div className="topbar-left">
                <button
                  type="button"
                  className="back-button"
                  aria-label="Volver"
                  onClick={appNavigation.back}
                >
                  <ChevronLeft size={21} />
                  <span>Volver</span>
                </button>
                <div className="breadcrumb">
                  Mi espacio <span>/</span>{" "}
                  {navigation.find((n) => n.id === page)?.label}
                </div>
              </div>
              <div className="topbar-right">
                <ThemeToggle
                  dark={dark}
                  onChange={(value) =>
                    void run(async () => {
                      await db.profiles.update(profile.id, { dark: value });
                      setDark(value);
                    })
                  }
                />
                <span className="local-badge">
                  {offline ? (
                    <WifiOff size={14} />
                  ) : (
                    <span className="local-dot" />
                  )}
                  {offline ? "Modo offline" : "Guardado en este dispositivo"}
                </span>
                <button
                  className="mini-avatar"
                  aria-label="Cambiar perfil"
                  onClick={lock}
                >
                  {profile.name[0]}
                </button>
              </div>
            </header>
            <main className="main-content">
              <div className="date-control">
                <button
                  aria-label="Día anterior"
                  onClick={() => setDate(shiftDate(date, -1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <label>
                  <span>
                    {date === today() ? "Hoy · " : ""}
                    {niceDate(date)}
                  </span>
                  <input
                    aria-label="Fecha de los registros"
                    type="date"
                    value={date}
                    max={today()}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                  />
                </label>
                <button
                  aria-label="Día siguiente"
                  disabled={date >= today()}
                  onClick={() => setDate(shiftDate(date, 1))}
                >
                  <ChevronRight size={16} />
                </button>
                {date !== today() && (
                  <button onClick={() => setDate(today())}>Hoy</button>
                )}
              </div>
              <Suspense fallback={<div className="loading">Abriendo…</div>}>
                {page === "inicio" ? (
                  <Dashboard />
                ) : page === "comidas" ? (
                  <Meals />
                ) : page === "entreno" ? (
                  <Workouts />
                ) : page === "progreso" ? (
                  <Progress />
                ) : (
                  <More />
                )}
              </Suspense>
              <footer className="app-footer">
                Guardado en este dispositivo <span>NutriDuo · 1.1</span>
              </footer>
            </main>
          </div>
          <nav className="bottom-nav">
            {navigation.map((n) => (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={21} />
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
          <button
            className="mobile-add"
            aria-label="Registrar comida"
            onClick={() => setMealOpen(true)}
          >
            <Plus size={24} />
          </button>
          {notice && (
            <div className="toast" role="status" onClick={() => setNotice("")}>
              {notice}
            </div>
          )}
          {mealOpen && <MealEditor onClose={() => setMealOpen(false)} />}
        </div>
      </AppContext.Provider>
    </NavigationContext.Provider>
  );
}
