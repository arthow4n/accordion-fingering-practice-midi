import { expect,it } from "vitest";
import { defaultTrainingRequest,parseTrainingRequest } from "./trainingIntent";

it("defaults hand evaluation to both when loading pre-hand-mode settings",()=>{
 const legacy={...defaultTrainingRequest()} as Record<string,unknown>;delete legacy.hands;
 expect(parseTrainingRequest(legacy).hands).toBe("both");
});
