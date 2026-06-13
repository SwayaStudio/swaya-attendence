import { describe, it, expect } from "vitest";
import { mintNativeToken, verifyNativeToken } from "@/lib/native-token";

describe("native token", () => {
  it("round-trips a valid token", () => {
    const t = mintNativeToken("emp1", "co1");
    const p = verifyNativeToken(t);
    expect(p?.employeeId).toBe("emp1");
    expect(p?.companyId).toBe("co1");
  });

  it("rejects a tampered payload", () => {
    const t = mintNativeToken("emp1", "co1");
    const [body, sig] = t.split(".");
    // flip the body but keep the old signature
    const forged = Buffer.from(JSON.stringify({ employeeId: "admin", companyId: "co1", exp: Date.now() + 1e9 })).toString("base64url");
    expect(verifyNativeToken(`${forged}.${sig}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const t = mintNativeToken("emp1", "co1");
    const [body] = t.split(".");
    expect(verifyNativeToken(`${body}.deadbeef`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const t = mintNativeToken("emp1", "co1", -1000); // already expired
    expect(verifyNativeToken(t)).toBeNull();
  });

  it("rejects malformed / empty input", () => {
    expect(verifyNativeToken("")).toBeNull();
    expect(verifyNativeToken(null)).toBeNull();
    expect(verifyNativeToken("no-dot-here")).toBeNull();
  });
});
