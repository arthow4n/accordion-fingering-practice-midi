import {expect,it,vi} from "vitest";
import {generateFirstValidCandidate} from "./generateCandidate";

it("uses the first candidate that generates successfully",()=>{
 const generate=vi.fn((seed:number)=>{if(seed<3)throw new Error(`rejected ${seed}`);return `exercise ${seed}`;});
 expect(generateFirstValidCandidate([1,2,3,4],generate)).toEqual({seed:3,value:"exercise 3"});
 expect(generate).toHaveBeenCalledTimes(3);
});

it("preserves the final rejection and rejects an empty candidate list",()=>{
 expect(()=>generateFirstValidCandidate([1,2],seed=>{throw new Error(`rejected ${seed}`);})).toThrow("rejected 2");
 expect(()=>generateFirstValidCandidate([],seed=>seed)).toThrow("No generation seeds were provided");
});
