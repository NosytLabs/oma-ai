import { Context, Next } from "hono";

function checkAuth(c: Context, roleType: "user" | "team", allowedRoles: string[]) {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const role = roleType === "user" ? user.role : c.get("teamRole");
  if (!role || !allowedRoles.includes(role)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return null;
}

export function requireRole(allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const authError = checkAuth(c, "user", allowedRoles);
    if (authError) return authError;
    await next();
  };
}

export function requireTeamRole(allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const authError = checkAuth(c, "team", allowedRoles);
    if (authError) return authError;
    await next();
  };
}
