import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { today } from "../utils/date";

type Choice = string | number;
interface Snapshot {
  page: string;
  date: string;
  choices: Record<string, Choice>;
  layers: string[];
}
interface Entry {
  session: string;
  index: number;
}
const stateKey = "nutriduoNavigation";

// Browser history contains only opaque session/entry IDs. It never contains a PIN,
// a profile, form contents or the data needed to restore an authenticated session.
export class AppNavigation {
  private session = crypto.randomUUID();
  private index = 0;
  private entries = new Map<number, Snapshot>();
  private listeners = new Set<() => void>();
  private layers = new Map<string, () => void>();
  private snapshot: Snapshot = {
    page: "inicio",
    date: today(),
    choices: {},
    layers: [],
  };
  private started = false;
  private listening = false;
  private retiring = false;
  private pendingPop = false;
  private queued: (() => void)[] = [];
  private exit = () => {};
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(snapshot: Snapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  private write(index: number, replace = false) {
    const state = {
      ...history.state,
      [stateKey]: { session: this.session, index },
    };
    if (replace) history.replaceState(state, "", location.href);
    else history.pushState(state, "", location.href);
  }
  start(exit: () => void) {
    this.listening = true;
    this.exit = exit;
    if (!this.started) {
      this.started = true;
      // Keep a real profile-selection entry behind the first unlocked screen.
      this.write(-1, true);
      this.entries.set(0, this.snapshot);
      this.write(0);
    }
    window.addEventListener("popstate", this.onPop);
    return () => {
      this.listening = false;
      window.removeEventListener("popstate", this.onPop);
    };
  }
  private onPop = (event: PopStateEvent) => {
    this.pendingPop = false;
    const entry: Entry | undefined = event.state?.[stateKey];
    if (!entry || entry.session !== this.session || entry.index < 0) {
      this.listening = false;
      this.exit();
      return;
    }
    const saved = this.entries.get(entry.index);
    if (!saved) {
      this.exit();
      return;
    }
    this.index = entry.index;
    const snapshot = {
      ...saved,
      layers: saved.layers.filter((id) => this.layers.has(id)),
    };
    const closing = this.snapshot.layers
      .filter((id) => !snapshot.layers.includes(id))
      .reverse();
    this.publish(snapshot);
    for (const id of closing) this.layers.get(id)?.();
    const queued = this.queued.splice(0);
    for (const action of queued) action();
  };
  private push(snapshot: Snapshot) {
    for (const index of this.entries.keys())
      if (index > this.index) this.entries.delete(index);
    this.index++;
    this.entries.set(this.index, snapshot);
    this.write(this.index);
    this.publish(snapshot);
  }
  navigate = (page: string) => {
    if (this.pendingPop) {
      this.queued.push(() => this.navigate(page));
      return;
    }
    if (page === this.snapshot.page) return;
    this.push({ ...this.snapshot, page, layers: [] });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  setDate = (date: string) => {
    if (this.pendingPop) {
      this.queued.push(() => this.setDate(date));
      return;
    }
    if (date !== this.snapshot.date) this.push({ ...this.snapshot, date });
  };
  setChoice = (key: string, value: Choice) => {
    if (this.pendingPop) {
      this.queued.push(() => this.setChoice(key, value));
      return;
    }
    if (this.snapshot.choices[key] !== value)
      this.push({
        ...this.snapshot,
        choices: { ...this.snapshot.choices, [key]: value },
      });
  };
  back = () => history.back();
  openLayer = (id: string, onDismiss: () => void) => {
    if (this.pendingPop) {
      this.queued.push(() => this.openLayer(id, onDismiss));
      return;
    }
    this.layers.set(id, onDismiss);
    // StrictMode's second effect setup reuses the already-created entry.
    if (!this.snapshot.layers.includes(id))
      this.push({ ...this.snapshot, layers: [...this.snapshot.layers, id] });
  };
  closeLayer = (id: string) => {
    if (this.snapshot.layers.at(-1) === id) this.back();
  };
  retireLayer = (id: string) => {
    this.layers.delete(id);
    if (!this.snapshot.layers.includes(id) || this.retiring) return;
    this.retiring = true;
    // Closing/saving nested dialogs can unmount several at once. Collapse their
    // entries together so Back never needs extra taps through closed forms.
    queueMicrotask(() => {
      this.retiring = false;
      if (!this.listening) return;
      if (this.snapshot.layers.every((layer) => this.layers.has(layer))) return;
      let target = this.index - 1;
      while (target >= 0) {
        const entry = this.entries.get(target);
        if (entry && entry.layers.every((layer) => this.layers.has(layer)))
          break;
        target--;
      }
      if (target >= 0) {
        this.pendingPop = true;
        history.go(target - this.index);
      }
    });
  };
}

export const NavigationContext = createContext<AppNavigation | null>(null);
export function useAppNavigation(onExit: () => void) {
  const [navigation] = useState(() => new AppNavigation());
  const exit = useRef(onExit);
  exit.current = onExit;
  useEffect(() => navigation.start(() => exit.current()), [navigation]);
  const snapshot = useSyncExternalStore(
    navigation.subscribe,
    navigation.getSnapshot,
  );
  return { navigation, ...snapshot };
}
export function useHistoryChoice<T extends Choice>(key: string, initial: T) {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw new Error("Navegación no disponible.");
  const snapshot = useSyncExternalStore(
    navigation.subscribe,
    navigation.getSnapshot,
  );
  return [
    (snapshot.choices[key] ?? initial) as T,
    (value: T) => navigation.setChoice(key, value),
  ] as const;
}
export function useDialogBack(onClose: () => void) {
  const navigation = useContext(NavigationContext);
  const callback = useRef(onClose);
  callback.current = onClose;
  const [id] = useState(() => crypto.randomUUID());
  useEffect(() => {
    navigation?.openLayer(id, () => callback.current());
    return () => navigation?.retireLayer(id);
  }, [navigation, id]);
  return () => {
    if (navigation) navigation.closeLayer(id);
    else callback.current();
  };
}
