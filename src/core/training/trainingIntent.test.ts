import { expect,it } from "vitest";
import { defaultTrainingRequest,parseTrainingRequest } from "./trainingIntent";

it("defaults hand evaluation to both when loading pre-hand-mode settings",()=>{
 const legacy={...defaultTrainingRequest()} as Record<string,unknown>;delete legacy.hands;
 expect(parseTrainingRequest(legacy).hands).toBe("both");
});

it("migrates legacy modes and jump settings",()=>{
 const legacy={...defaultTrainingRequest(),intent:"randomDecoding",rightHand:{...defaultTrainingRequest().rightHand,minJump:12,jumpFrequency:"occasional",jumpSize:"large"},leftHand:{...defaultTrainingRequest().leftHand,minJump:4,jumpFrequency:undefined,jumpSize:undefined}};
 const parsed=parseTrainingRequest(legacy);
 expect(parsed.emphasis).toBe("everything");
 expect(parsed.hands).toBe("right");
 expect("intent" in parsed).toBe(false);
 expect("jumpFrequency" in parsed.rightHand).toBe(false);
 expect(parsed.leftHand.jumpSize).toBe("moderate");
 expect("minJump" in parsed.rightHand).toBe(false);
});

it("migrates all legacy training intents to emphasis according to spec",()=>{
 expect(parseTrainingRequest({ ...defaultTrainingRequest(), intent: "general" }).emphasis).toBe("everything");
 expect(parseTrainingRequest({ ...defaultTrainingRequest(), intent: "patternsIntervals" }).emphasis).toBe("melodicPatterns");
 expect(parseTrainingRequest({ ...defaultTrainingRequest(), intent: "rhythm" }).emphasis).toBe("rhythm");
 const lh = parseTrainingRequest({ ...defaultTrainingRequest(), intent: "leftHand" });
 expect(lh.emphasis).toBe("everything");
 expect(lh.leftHand.enabled).toBe(true);
 const coord = parseTrainingRequest({ ...defaultTrainingRequest(), intent: "coordination" });
 expect(coord.emphasis).toBe("everything");
 expect(coord.hands).toBe("both");
 const nr = parseTrainingRequest({ ...defaultTrainingRequest(), intent: "noteRecognition" });
 expect(nr.emphasis).toBe("everything");
 expect(nr.hands).toBe("right");
});
