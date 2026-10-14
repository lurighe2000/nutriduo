import { z } from "zod";

export const cloudProfileSchema = z.enum(["luca", "ari"]);
export const hexKeySchema = z.string().regex(/^[a-f0-9]{64}$/);
export const saltSchema = z.string().regex(/^[a-f0-9]{32}$/);
export const CLOUD_CHUNK_BYTES = 65536;
export const CLOUD_MAX_CHUNKS = 1600;
export const CLOUD_MAX_PLAIN_BYTES = 100000000;
export const cloudMetaSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  savedAt: z.string().datetime(),
  parts: z.number().int().min(1).max(CLOUD_MAX_CHUNKS),
  bytes: z
    .number()
    .int()
    .min(16)
    .max(CLOUD_CHUNK_BYTES * CLOUD_MAX_CHUNKS),
  iv: z.string().regex(/^[a-f0-9]{24}$/),
  digest: hexKeySchema,
  contentDigest: hexKeySchema,
  format: z.literal("gzip-aes-gcm-v1"),
});
export type CloudMeta = z.infer<typeof cloudMetaSchema>;
export const cloudHeadSchema = z.object({
  latest: cloudMetaSchema.nullable(),
  previous: cloudMetaSchema.nullable(),
});
