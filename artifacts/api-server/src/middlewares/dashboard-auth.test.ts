import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { IncomingMessage } from "node:http";
import {
  assertProductionAuthConfigured,
  isDashboardAuthorized,
  parseCookieHeader,
} from "./dashboard-auth";

const originalEnv = { ...process.env };

function makeRequest(headers: Record<string, string>): IncomingMessage {
  return { headers } as IncomingMessage;
}

function basic(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

beforeEach(() => {
  process.env.DASHBOARD_PASSWORD = "s3cret";
  process.env.DASHBOARD_USER = "admin";
  process.env.SESSION_SECRET = "test-secret";
  delete process.env.NODE_ENV;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("dashboard auth", () => {
  it("rejects requests without credentials", () => {
    expect(isDashboardAuthorized(makeRequest({}))).toBe(false);
  });

  it("accepts valid Basic auth", () => {
    expect(isDashboardAuthorized(makeRequest({ authorization: basic("admin", "s3cret") }))).toBe(true);
  });

  it("rejects a wrong password or user", () => {
    expect(isDashboardAuthorized(makeRequest({ authorization: basic("admin", "nope") }))).toBe(false);
    expect(isDashboardAuthorized(makeRequest({ authorization: basic("guest", "s3cret") }))).toBe(false);
  });

  it("is open in development when no password is configured", () => {
    delete process.env.DASHBOARD_PASSWORD;
    expect(isDashboardAuthorized(makeRequest({}))).toBe(true);
  });

  it("refuses to start in production without a password", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DASHBOARD_PASSWORD;
    expect(() => assertProductionAuthConfigured()).toThrow(/DASHBOARD_PASSWORD/);
  });

  it("also refuses when NODE_ENV is unset", () => {
    delete process.env.NODE_ENV;
    delete process.env.DASHBOARD_PASSWORD;
    expect(() => assertProductionAuthConfigured()).toThrow(/DASHBOARD_PASSWORD/);
  });

  it("allows an explicit development environment without a password", () => {
    process.env.NODE_ENV = "development";
    delete process.env.DASHBOARD_PASSWORD;
    expect(() => assertProductionAuthConfigured()).not.toThrow();
  });
});

describe("parseCookieHeader", () => {
  it("parses and decodes cookies", () => {
    expect(parseCookieHeader("a=1; b=hello%20world")).toEqual({ a: "1", b: "hello world" });
  });

  it("returns an empty object for a missing header", () => {
    expect(parseCookieHeader(undefined)).toEqual({});
  });
});
