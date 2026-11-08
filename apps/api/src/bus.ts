import type { AutomationTrigger } from "@petra/domain";

type Handler = (event: AutomationTrigger, tenantId: string, payload: Record<string, string | undefined>) => void;
const handlers: Handler[] = [];
export const on = (h: Handler) => { handlers.push(h); };
/** Domain events. Modules emit; automation (and later sync/analytics) listen. */
export const emit = (e: AutomationTrigger, t: string, p: Record<string, string | undefined> = {}) => handlers.forEach((h) => h(e, t, p));
