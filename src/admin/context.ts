import { createContext, useContext } from "react";
import type { AudioMap, Client, Demo } from "../shared/types";
import type { GitHub, RepoState } from "./github";
import type { AdminSettings } from "./hooks";
import type { Draft } from "./ops";

export interface AdminApi {
  demo: Demo;
  audio: AudioMap;
  gh: GitHub;
  /** Latest clients/general from the repo (null while loading). */
  state: RepoState | null;
  settings: AdminSettings;
  setSettings: (s: AdminSettings) => void;
  online: boolean;
  saving: boolean;
  /** Resolve a stored logo for display (freshly uploaded logos aren't deployed yet, so use the cached image). */
  logoUrl: (path: string | null | undefined) => string | null;
  saveClient: (draft: Draft, slug?: string) => Promise<Client | null>;
  deleteClient: (slug: string) => Promise<boolean>;
  saveGeneral: (draft: Draft | null) => Promise<boolean>;
  reload: () => void;
  signOut: (notice?: string) => void;
  navigate: (route: string) => void;
}

export const AdminCtx = createContext<AdminApi | null>(null);
export const useAdmin = () => {
  const c = useContext(AdminCtx);
  if (!c) throw new Error("AdminCtx missing");
  return c;
};
