import { describe, expect, it, vi, afterEach } from "vitest";
import {
  checkForUpdate,
  forceUpdate,
  getAppVersionInfo,
} from "./pwaService";

describe("pwaService", () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;
  const originalCaches = (globalThis as unknown as { caches: unknown }).caches;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "caches", {
      value: originalCaches,
      configurable: true,
      writable: true,
    });
  });

  describe("getAppVersionInfo", () => {
    it("returns version, commitHash, and commitUrl strings", () => {
      const info = getAppVersionInfo();
      expect(typeof info.version).toBe("string");
      expect(typeof info.commitHash).toBe("string");
      expect(typeof info.commitUrl).toBe("string");
      expect(info.commitUrl).toContain("https://github.com/");
    });
  });

  describe("checkForUpdate", () => {
    it("reports unsupported if serviceWorker not in navigator", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        configurable: true,
      });
      const result = await checkForUpdate();
      expect(result.hasUpdate).toBe(false);
      expect(result.message).toContain("not supported");
    });

    it("triggers reg.update() and detects waiting worker", async () => {
      const mockReg = {
        update: vi.fn().mockResolvedValue(undefined),
        waiting: {} as ServiceWorker,
        installing: null,
      } as unknown as ServiceWorkerRegistration;

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            getRegistration: vi.fn().mockResolvedValue(mockReg),
          },
        },
        configurable: true,
      });

      const result = await checkForUpdate(mockReg);
      expect(mockReg.update).toHaveBeenCalled();
      expect(result.hasUpdate).toBe(true);
      expect(result.message).toBe("An update is available!");
    });

    it("reports up to date when no update is waiting or installing", async () => {
      const mockReg = {
        update: vi.fn().mockResolvedValue(undefined),
        waiting: null,
        installing: null,
      } as unknown as ServiceWorkerRegistration;

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            getRegistration: vi.fn().mockResolvedValue(mockReg),
          },
        },
        configurable: true,
      });

      const result = await checkForUpdate(mockReg);
      expect(result.hasUpdate).toBe(false);
      expect(result.message).toBe("Application is up to date.");
    });
  });

  describe("forceUpdate", () => {
    it("unregisters service workers, deletes caches, and reloads window", async () => {
      const unregisterMock = vi.fn().mockResolvedValue(true);
      const deleteCacheMock = vi.fn().mockResolvedValue(true);
      const reloadMock = vi.fn();

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            getRegistrations: vi.fn().mockResolvedValue([
              { unregister: unregisterMock },
            ]),
          },
        },
        configurable: true,
      });

      Object.defineProperty(globalThis, "caches", {
        value: {
          keys: vi.fn().mockResolvedValue(["cache-v1", "cache-v2"]),
          delete: deleteCacheMock,
        },
        configurable: true,
      });

      Object.defineProperty(globalThis, "window", {
        value: {
          location: { reload: reloadMock },
        },
        configurable: true,
      });

      await forceUpdate();

      expect(unregisterMock).toHaveBeenCalledTimes(1);
      expect(deleteCacheMock).toHaveBeenCalledWith("cache-v1");
      expect(deleteCacheMock).toHaveBeenCalledWith("cache-v2");
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });
});
