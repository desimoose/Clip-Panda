import { describe, it, expect, vi } from "vitest";

vi.mock("@aws-sdk/client-s3", () => {
  const send = vi.fn().mockResolvedValue({});
  return {
    S3Client: vi.fn().mockImplementation(() => ({ send })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
    GetObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  };
});

import { uploadObject } from "./client.js";

describe("uploadObject", () => {
  it("returns the key it was given", async () => {
    const key = await uploadObject("episodes/abc/source.mp4", Buffer.from("data"), "video/mp4");
    expect(key).toBe("episodes/abc/source.mp4");
  });
});
