// Bluetooth heart-rate monitors (standard BLE Heart Rate service, 0x180D).
// Works in Chrome on Android/desktop; Safari on iPhone has no Web Bluetooth.
import { useSyncExternalStore } from "react";

interface Characteristic extends EventTarget {
  value?: DataView;
  startNotifications(): Promise<Characteristic>;
}
interface Server {
  getPrimaryService(name: string): Promise<{
    getCharacteristic(name: string): Promise<Characteristic>;
  }>;
}
interface Device extends EventTarget {
  name?: string;
  gatt?: { connect(): Promise<Server>; connected: boolean; disconnect(): void };
}
interface BluetoothLike {
  requestDevice(options: {
    filters: { services: string[] }[];
  }): Promise<Device>;
}

export type HeartState = {
  status: "off" | "connecting" | "on" | "lost";
  bpm?: number;
  name?: string;
};

/** Parses a Heart Rate Measurement value (flags bit 0: 16-bit value). */
export function parseHeartRate(view: DataView) {
  const flags = view.getUint8(0);
  return flags & 1 ? view.getUint16(1, true) : view.getUint8(1);
}

let state: HeartState = { status: "off" };
let device: Device | undefined;
let retry: number | undefined;
const listeners = new Set<() => void>();
const set = (next: HeartState) => {
  state = next;
  listeners.forEach((l) => l());
};

export const heartRateSupported = () =>
  typeof navigator !== "undefined" && "bluetooth" in navigator;

async function attach(target: Device) {
  const server = await target.gatt!.connect();
  const service = await server.getPrimaryService("heart_rate");
  const characteristic = await service.getCharacteristic(
    "heart_rate_measurement",
  );
  characteristic.addEventListener("characteristicvaluechanged", () => {
    if (!characteristic.value) return;
    const bpm = parseHeartRate(characteristic.value);
    if (bpm > 25 && bpm < 250) set({ status: "on", bpm, name: target.name });
  });
  await characteristic.startNotifications();
  set({ status: "on", name: target.name, bpm: state.bpm });
}

function onDisconnect() {
  if (!device) return;
  set({ status: "lost", name: device.name });
  window.clearTimeout(retry);
  const target = device;
  retry = window.setTimeout(() => {
    if (device === target) void attach(target).catch(onDisconnect);
  }, 3000);
}

/** Must be called from a tap: the browser shows its device picker. */
export async function connectHeartRate() {
  const bluetooth = (navigator as unknown as { bluetooth?: BluetoothLike })
    .bluetooth;
  if (!bluetooth) throw new Error("Este navegador no permite Bluetooth.");
  set({ status: "connecting" });
  try {
    const picked = await bluetooth.requestDevice({
      filters: [{ services: ["heart_rate"] }],
    });
    device?.removeEventListener("gattserverdisconnected", onDisconnect);
    device = picked;
    picked.addEventListener("gattserverdisconnected", onDisconnect);
    await attach(picked);
  } catch (error) {
    set({ status: device ? "lost" : "off", name: device?.name });
    throw error;
  }
}

export function disconnectHeartRate() {
  window.clearTimeout(retry);
  const target = device;
  device = undefined;
  target?.removeEventListener("gattserverdisconnected", onDisconnect);
  if (target?.gatt?.connected) target.gatt.disconnect();
  set({ status: "off" });
}

export function useHeartRate() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}
