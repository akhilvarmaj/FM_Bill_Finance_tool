import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
import { readJson, verifyOrigin } from "./http";

afterEach(() => vi.unstubAllEnvs());
describe("HTTP security", () => {
  it("rejects missing and cross-site origins", () => {
    vi.stubEnv("APP_URL", "https://billing.example.com");
    expect(() => verifyOrigin(new Request("https://billing.example.com"))).toThrow();
    expect(() => verifyOrigin(new Request("https://billing.example.com", { headers: { origin: "https://attacker.example" } }))).toThrow();
    expect(() => verifyOrigin(new Request("https://billing.example.com", { headers: { origin: "https://billing.example.com" } }))).not.toThrow();
  });
  it("fails closed without an application URL", () => {
    vi.stubEnv("APP_URL", "");
    expect(() => verifyOrigin(new Request("https://billing.example.com"))).toThrow("configuration");
  });
  it("accepts JSON and rejects oversized or malformed payloads", async () => {
    const request = (body: string) => new Request("https://billing.example.com", { method: "POST", headers: { "content-type": "application/json" }, body });
    expect(await readJson(request('{"name":"Parent"}'))).toEqual({ name: "Parent" });
    await expect(readJson(request("invalid"))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(request("x".repeat(9000)))).rejects.toMatchObject({ status: 413 });
  });
});