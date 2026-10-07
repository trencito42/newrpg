import { describe, expect, it } from "vitest";
import {
  canViewChatLogs,
  canViewPrivateChatLogs,
  isPrivateChatChannel,
  CHAT_LOG_CHANNEL_TYPES,
} from "@/lib/staff-chat-logs";

describe("staff chat logs permissions", () => {
  it("allows helpers and admins to view chat logs", () => {
    expect(canViewChatLogs({ adminLevel: 0, helperLevel: 1 } as never)).toBe(true);
    expect(canViewChatLogs({ adminLevel: 2, helperLevel: 0 } as never)).toBe(true);
    expect(canViewChatLogs(null)).toBe(false);
    expect(canViewChatLogs({ adminLevel: 0, helperLevel: 0 } as never)).toBe(false);
  });

  it("restricts private channels to admins", () => {
    expect(canViewPrivateChatLogs({ adminLevel: 1, helperLevel: 0 } as never)).toBe(true);
    expect(canViewPrivateChatLogs({ adminLevel: 0, helperLevel: 2 } as never)).toBe(false);
  });

  it("marks PM and whisper as private", () => {
    expect(isPrivateChatChannel("pm")).toBe(true);
    expect(isPrivateChatChannel("whisper")).toBe(true);
    expect(isPrivateChatChannel("say")).toBe(false);
  });

  it("uses only real channel types", () => {
    expect(CHAT_LOG_CHANNEL_TYPES).toContain("f");
    expect(CHAT_LOG_CHANNEL_TYPES).toContain("newbie_qa");
    expect(CHAT_LOG_CHANNEL_TYPES.length).toBeGreaterThan(20);
  });
});
