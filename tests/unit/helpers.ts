import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AudioMap, Client, Demo } from "../../src/shared/types";

export const root = resolve(import.meta.dirname, "../..");
const read = <T>(p: string): T => JSON.parse(readFileSync(resolve(root, p), "utf8"));
export const demo = read<Demo>("data/demo.json");
export const audioMap = read<AudioMap>("data/audio-map.json");
export const clients = read<Client[]>("data/clients.json");
