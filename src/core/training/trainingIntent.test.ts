import { expect,it } from "vitest";
import { defaultTrainingRequest,parseTrainingRequest } from "./trainingIntent";

it("defaults hand evaluation to both when loading pre-hand-mode settings",()=>{
 const legacy={...defaultTrainingRequest()} as Record<string,unknown>;delete legacy.hands;
 expect(parseTrainingRequest(legacy).hands).toBe("both");
});

it("migrates legacy modes and jump settings",()=>{
 const legacy={...defaultTrainingRequest(),intent:"randomDecoding",rightHand:{...defaultTrainingRequest().rightHand,minJump:12,jumpFrequency:undefined,jumpSize:undefined},leftHand:{...defaultTrainingRequest().leftHand,minJump:4,jumpFrequency:undefined,jumpSize:undefined}};
 const parsed=parseTrainingRequest(legacy);
 expect(parsed.intent).toBe("noteRecognition");
 expect(parsed.rightHand.jumpFrequency).toBe("none");
 expect(parsed.leftHand.jumpSize).toBe("moderate");
 expect("minJump" in parsed.rightHand).toBe(false);
});
