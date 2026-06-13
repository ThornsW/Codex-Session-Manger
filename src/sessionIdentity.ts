import type { CodexSession } from "./types";

export function getSessionInstanceKey(session: Pick<CodexSession, "id" | "sessionFilePaths">): string {
  return JSON.stringify([session.id, session.sessionFilePaths]);
}
