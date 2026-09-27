import { describe, expect, it, vi, afterEach } from "vitest";
import {
  applyUpdate,
  checkForUpdate,
  forceUpdate,
  getAppVersionInfo,
  waitForWorkerInstallation,
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

  describe("waitForWorkerInstallation", () => {
    it("resolves true immediately if state is installed", async () => {
      const worker = { state: "installed" } as unknown as ServiceWorker;
      const result = await waitForWorkerInstallation(worker);
      expect(result).toBe(true);
    });

    it("resolves false immediately if state is redundant", async () => {
      const worker = { state: "redundant" } as unknown as ServiceWorker;
      const result = await waitForWorkerInstallation(worker);
      expect(result).toBe(false);
    });

    it("listens to statechange and resolves when worker becomes installed", async () => {
      let listener: (() => void) | undefined;
      const worker = {
        state: "installing",
        addEventListener: vi.fn((event: string, cb: () => void) => {
          if (event === "statechange") listener = cb;
        }),
        removeEventListener: vi.fn(),
      } as unknown as ServiceWorker;

      const promise = waitForWorkerInstallation(worker);
      (worker as { state: string }).state = "installed";
      listener?.();

      const result = await promise;
      expect(result).toBe(true);
      expect(worker.removeEventListener).toHaveBeenCalled();
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

    it("reports no active registration if none found", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            getRegistration: vi.fn().mockResolvedValue(undefined),
            getRegistrations: vi.fn().mockResolvedValue([]),
          },
        },
        configurable: true,
      });
      const result = await checkForUpdate();
      expect(result.hasUpdate).toBe(false);
      expect(result.message).toContain("No active service worker registered");
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

    it("waits for installing worker to transition to installed", async () => {
      let stateListener: (() => void) | undefined;
      const mockWorker = {
        state: "installing",
        addEventListener: vi.fn((event: string, cb: () => void) => {
          if (event === "statechange") stateListener = cb;
        }),
        removeEventListener: vi.fn(),
      } as unknown as ServiceWorker;

      const mockReg = {
        update: vi.fn().mockImplementation(async () => {
          // Worker transitions during/after update
          setTimeout(() => {
            (mockWorker as { state: string }).state = "installed";
            stateListener?.();
          }, 10);
        }),
        waiting: null,
        installing: mockWorker,
      } as unknown as ServiceWorkerRegistration;

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            getRegistration: vi.fn().mockResolvedValue(mockReg),
          },
        },
        configurable: true,
      });

      const result = await checkForUpdate(mockReg, 1000);
      expect(result.hasUpdate).toBe(true);
      expect(result.message).toBe("An update is available!");
    });

    it("handles updatefound event triggered during update", async () => {
      let updateFoundCb: (() => void) | undefined;
      const mockWorker = {
        state: "installed",
      } as unknown as ServiceWorker;

      const mockReg = {
        addEventListener: vi.fn((event: string, cb: () => void) => {
          if (event === "updatefound") updateFoundCb = cb;
        }),
        removeEventListener: vi.fn(),
        update: vi.fn().mockImplementation(async () => {
          (mockReg as { installing: ServiceWorker }).installing = mockWorker;
          updateFoundCb?.();
        }),
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

      const result = await checkForUpdate(mockReg, 1000);
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

    it("reports error message when update fails", async () => {
      const mockReg = {
        update: vi.fn().mockRejectedValue(new Error("Network connection error")),
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
      expect(result.message).toContain("Network connection error");
    });
  });

  describe("applyUpdate", () => {
    it("posts SKIP_WAITING to waiting worker and reloads on controllerchange", async () => {
      const postMessageMock = vi.fn();
      const reloadMock = vi.fn();
      let controllerListener: (() => void) | undefined;

      const mockReg = {
        waiting: { postMessage: postMessageMock } as unknown as ServiceWorker,
        installing: null,
      } as unknown as ServiceWorkerRegistration;

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            getRegistration: vi.fn().mockResolvedValue(mockReg),
            addEventListener: vi.fn((event: string, cb: () => void) => {
              if (event === "controllerchange") controllerListener = cb;
            }),
          },
        },
        configurable: true,
      });

      Object.defineProperty(globalThis, "window", {
        value: {
          location: { reload: reloadMock },
        },
        configurable: true,
      });

      const customUpdate = vi.fn().mockResolvedValue(undefined);
      await applyUpdate(mockReg, customUpdate, 500);

      expect(customUpdate).toHaveBeenCalledWith(true);
      expect(postMessageMock).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

      // Simulate controllerchange
      controllerListener?.();
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("reloads via fallback timer if controllerchange does not fire", async () => {
      const reloadMock = vi.fn();

      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            getRegistration: vi.fn().mockResolvedValue(undefined),
            getRegistrations: vi.fn().mockResolvedValue([]),
            addEventListener: vi.fn(),
          },
        },
        configurable: true,
      });

      Object.defineProperty(globalThis, "window", {
        value: {
          location: { reload: reloadMock },
        },
        configurable: true,
      });

      await applyUpdate(undefined, undefined, 20);
      await new Promise((r) => setTimeout(r, 40));

      expect(reloadMock).toHaveBeenCalledTimes(1);
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
