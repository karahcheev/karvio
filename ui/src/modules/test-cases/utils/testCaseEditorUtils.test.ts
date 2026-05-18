import { describe, expect, it } from "vitest";
import { stripInternalAttachmentImageSources } from "./testCaseEditorUtils";

describe("stripInternalAttachmentImageSources", () => {
  it("removes internal /attachments source from markdown images", () => {
    const source = "Open app\n![Screenshot.png](/attachments/485b5dfbd54e4414)\nDone";

    const normalized = stripInternalAttachmentImageSources(source);

    expect(normalized).toBe("Open app\n![Screenshot.png]\nDone");
  });

  it("keeps external image urls unchanged", () => {
    const source = "![Diagram](https://example.com/diagram.png)";

    const normalized = stripInternalAttachmentImageSources(source);

    expect(normalized).toBe(source);
  });
});
