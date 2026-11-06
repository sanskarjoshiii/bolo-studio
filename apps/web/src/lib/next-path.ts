/** Only same-site paths, never an absolute URL (open-redirect guard). */
export const safeNext = (next?: string) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
