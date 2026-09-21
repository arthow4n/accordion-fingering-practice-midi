export type ProgressionTemplate = { id: string; degrees: readonly number[]; sevenths?: readonly number[] };
export const PROGRESSIONS: readonly ProgressionTemplate[] = [
  { id: "I-I-V-I", degrees: [1,1,5,1] }, { id: "I-IV-V-I", degrees: [1,4,5,1] },
  { id: "I-vi-IV-V", degrees: [1,6,4,5] }, { id: "I-ii-V7-I", degrees: [1,2,5,1], sevenths:[2] },
  { id: "I-IV-I-V", degrees: [1,4,1,5] },
  { id: "jump-nearby-occasional", degrees: [5,1,1,1] },
  { id: "jump-nearby-frequent", degrees: [5,1,5,1] },
  { id: "jump-moderate-occasional", degrees: [2,1,1,1] },
  { id: "jump-moderate-frequent", degrees: [2,1,2,1] },
  { id: "jump-large-occasional", degrees: [3,1,1,1] },
  { id: "jump-large-frequent", degrees: [3,1,3,1] },
  { id: "jump-very-large-occasional", degrees: [1,4,7,1] },
  { id: "jump-very-large-frequent", degrees: [1,7,4,7] },
];
