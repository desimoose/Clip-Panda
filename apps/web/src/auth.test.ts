import { describe, it, expect } from "vitest";
import { authConfig } from "./auth.js";

describe("authConfig", () => {
  it("configures exactly one Google provider", () => {
    expect(authConfig.providers).toHaveLength(1);
  });

  it("copies the Google profile id onto session.user.id via signIn callback", async () => {
    const session = { user: { id: "", email: "a@b.com" } } as any;
    const result = await authConfig.callbacks!.session!({
      session,
      token: { sub: "google-user-123" },
    } as any);
    expect(result.user!.id).toBe("google-user-123");
  });
});
