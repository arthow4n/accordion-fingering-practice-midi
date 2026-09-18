import { expect,it } from "vitest";
import { defaultTrainingRequest } from "../../core/training/trainingIntent";
import { parseStoredSettings } from "./settingsPersistence";

it("round-trips shareable settings and rejects invalid URL state",()=>{
 const settings=defaultTrainingRequest();settings.tempoBpm=96;
 expect(parseStoredSettings(JSON.stringify(settings))?.tempoBpm).toBe(96);
 expect(parseStoredSettings("not json")).toBeUndefined();
});
