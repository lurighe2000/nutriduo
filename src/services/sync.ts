export interface SyncAdapter {
  pushChanges(): Promise<{ status: "local-only" }>;
  pullChanges(): Promise<[]>;
  sync(): Promise<{ status: "local-only" }>;
}
export class LocalSyncAdapter implements SyncAdapter {
  async pushChanges() {
    return { status: "local-only" as const };
  }
  async pullChanges(): Promise<[]> {
    return [];
  }
  async sync() {
    return { status: "local-only" as const };
  }
}
// A cloud implementation must authenticate both profiles, enforce RLS and request photo consent.
// No cloud client is instantiated by this application.
