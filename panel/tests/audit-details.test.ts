import { describe, expect, it } from "vitest";
import { formatAuditDetails } from "../src/lib/audit-details";

describe("audit details", () => {
  it("renders parsed MySQL JSON objects as text", () => {
    expect(formatAuditDetails({ by: 1, reason: "test" })).toBe("by: 1 · reason: test");
  });
  it("handles JSON text, plain text and missing values", () => {
    expect(formatAuditDetails('{"tag":"uS"}')).toBe("tag: uS");
    expect(formatAuditDetails("updated rank")).toBe("updated rank");
    expect(formatAuditDetails(null)).toBe("—");
  });
});
