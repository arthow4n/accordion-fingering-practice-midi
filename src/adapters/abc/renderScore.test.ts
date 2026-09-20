import { describe, expect, it } from "vitest";
import { renderScoreHighlight } from "./renderScore";

describe("renderScoreHighlight", () => {
  it("does not throw if container has no svg", () => {
    const div = {
      querySelector: () => null,
    } as unknown as HTMLElement;
    expect(() => renderScoreHighlight(div)).not.toThrow();
  });

  it("adds translucent warm amber column behind marked elements", () => {
    let insertedChild: unknown = null;
    const markElement = {
      getAttribute: (attr: string) => (attr === "highlight" ? null : "mark"),
      setAttribute: () => {},
      getBBox: () => ({ x: 50, y: 30, width: 10, height: 10 }),
    };

    const createdAttrs = new Map<string, string>();
    const fakeRect = {
      setAttribute: (k: string, v: string) => createdAttrs.set(k, v),
    };

    const origCreate = globalThis.document?.createElementNS;
    globalThis.document = {
      ...globalThis.document,
      createElementNS: (_ns: string, tag: string) => {
        if (tag === "rect") return fakeRect as unknown as Element;
        return {} as Element;
      },
    } as unknown as Document;

    const fakeSvg = {
      querySelector: () => null,
      querySelectorAll: (sel: string) => (sel === ".mark" ? [markElement] : []),
      insertBefore: (child: unknown) => {
        insertedChild = child;
      },
      firstChild: null,
    };

    const container = {
      querySelector: (sel: string) => (sel === "svg" ? fakeSvg : null),
    } as unknown as HTMLElement;

    try {
      renderScoreHighlight(container);
      expect(insertedChild).toBe(fakeRect);
      expect(createdAttrs.get("class")).toBe("note-column-highlight");
      expect(createdAttrs.get("fill")).toBe("rgba(245, 158, 11, 0.22)");
      expect(createdAttrs.get("rx")).toBe("6");
    } finally {
      if (origCreate) {
        globalThis.document.createElementNS = origCreate;
      }
    }
  });
});
