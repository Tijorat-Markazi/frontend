import { useSession } from "./session";

/** Whether the server says this visitor runs the platform. */
export function useIsOversight(): boolean {
  const session = useSession();
  return Boolean(session?.authenticated && !session.restricted && session.role === "admin");
}
