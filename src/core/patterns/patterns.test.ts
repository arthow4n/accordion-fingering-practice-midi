import { expect,it } from "vitest";
import { transformPattern } from "./melodicPatterns";
it("sequences a relationship diatonically",()=>expect(transformPattern([0,2,4,2],"sequenceUp")).toEqual([1,3,5,3]));
