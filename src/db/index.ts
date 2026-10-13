import Dexie, { type Table } from "dexie";
import {
  profileSchema,
  tables,
  type Profile,
  type ProfileId,
  type TableName,
  type Records,
} from "../schemas";
export class NutriDatabase extends Dexie {
  profiles!: Table<Profile, string>;
  constructor(name = "nutriduo-v1") {
    super(name);
    this.version(1).stores({
      profiles: "id",
      ...Object.fromEntries(
        Object.keys(tables).map((k) => [k, "id, profileId, [profileId+date]"]),
      ),
    });
  }
}
export const db = new NutriDatabase();
export const table = <K extends TableName>(
  name: K,
): Table<Records[K], string> => db.table(name);
export function meta(profileId: ProfileId) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    profileId,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}
export function repository(profileId: ProfileId) {
  return {
    async list<K extends TableName>(name: K) {
      return table(name).where("profileId").equals(profileId).toArray();
    },
    async save<K extends TableName>(name: K, input: Records[K]) {
      if (input.profileId !== profileId)
        throw new Error("El registro pertenece a otro perfil.");
      const value = tables[name].parse(input) as Records[K];
      await db.transaction("rw", table(name), async () => {
        let previous = await table(name).get(value.id);
        if (previous && previous.profileId !== profileId)
          throw new Error("No se puede modificar otro perfil.");
        if (
          !previous &&
          ["weights", "settings", "activity", "checkins"].includes(name) &&
          "date" in value
        ) {
          previous = await table(name)
            .where("[profileId+date]")
            .equals([profileId, value.date])
            .first();
          if (previous) value.id = previous.id;
        }
        await table(name).put({
          ...value,
          updatedAt: new Date().toISOString(),
          version: (previous?.version ?? 0) + 1,
        });
      });
      return value;
    },
    async remove<K extends TableName>(name: K, id: string) {
      await db.transaction("rw", table(name), async () => {
        const row = await table(name).get(id);
        if (row?.profileId !== profileId)
          throw new Error("No se puede eliminar otro perfil.");
        await table(name).delete(id);
      });
    },
  };
}
export const defaults: Profile[] = [
  profileSchema.parse({
    id: "luca",
    name: "Luca",
    birthDate: "",
    sex: "male",
    height: 0,
    initialWeight: 0,
    activity: 1.375,
    gymDays: 3,
    goal: "gain",
    excluded: ["acelga", "choclo"],
  }),
  profileSchema.parse({
    id: "ari",
    name: "Ari",
    birthDate: "",
    sex: "female",
    height: 0,
    initialWeight: 0,
    activity: 1.2,
    gymDays: 3,
    goal: "loss",
    excluded: ["choclo", "pescado"],
  }),
];
export async function initialize() {
  await db.transaction("rw", db.profiles, async () => {
    for (const p of defaults)
      if (!(await db.profiles.get(p.id))) await db.profiles.add(p);
  });
}
