import type { Client } from "./types";

export type ClientOp = { kind: "upsert"; client: Client } | { kind: "delete"; slug: string };

/**
 * Apply one admin change on top of the latest clients.json (merge by slug), so a save never
 * overwrites someone else's concurrent edits to other clients.
 */
export function applyClientOp(latest: Client[], op: ClientOp): Client[] {
  if (op.kind === "delete") return latest.filter((c) => c.slug !== op.slug);
  const i = latest.findIndex((c) => c.slug === op.client.slug);
  if (i < 0) return [...latest, op.client];
  const next = latest.slice();
  next[i] = op.client;
  return next;
}

/** Pretty-print JSON exactly as the repo stores it (1-space indent, trailing newline). */
export const toRepoJson = (v: unknown) => JSON.stringify(v, null, 1) + "\n";
