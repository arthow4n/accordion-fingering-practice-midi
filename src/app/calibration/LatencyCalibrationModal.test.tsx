import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { LatencyCalibrationModal } from "./LatencyCalibrationModal";

describe("LatencyCalibrationModal", () => {
  const renderClean = (component: React.ReactElement) =>
    renderToString(component).replace(/<!--.*?-->/g, "");

  it("renders when closed as null", () => {
    const html = renderClean(
      <LatencyCalibrationModal
        isOpen={false}
        onClose={vi.fn()}
        currentLatencyMs={0}
        onSaveLatency={vi.fn()}
        onRegisterMidiListener={vi.fn()}
      />,
    );
    expect(html).toBe("");
  });

  it("renders calibration setup view with current latency offset when open", () => {
    const html = renderClean(
      <LatencyCalibrationModal
        isOpen={true}
        onClose={vi.fn()}
        currentLatencyMs={45}
        onSaveLatency={vi.fn()}
        onRegisterMidiListener={vi.fn()}
      />,
    );
    expect(html).toContain("MIDI Latency Calibration");
    expect(html).toContain("Metronome tempo:");
    expect(html).toContain("Active Latency Offset:");
    expect(html).toContain("+45 ms");
    expect(html).toContain("Start Calibration Test");
  });

  it("renders negative latency offset cleanly", () => {
    const html = renderClean(
      <LatencyCalibrationModal
        isOpen={true}
        onClose={vi.fn()}
        currentLatencyMs={-30}
        onSaveLatency={vi.fn()}
        onRegisterMidiListener={vi.fn()}
      />,
    );
    expect(html).toContain("-30 ms");
  });
});
