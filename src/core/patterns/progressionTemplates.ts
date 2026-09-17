export type ProgressionTemplate = { id: string; degrees: readonly number[]; sevenths?: readonly number[] };
export const PROGRESSIONS: readonly ProgressionTemplate[] = [
  { id: "I-I-V-I", degrees: [1,1,5,1] }, { id: "I-IV-V-I", degrees: [1,4,5,1] },
  { id: "I-vi-IV-V", degrees: [1,6,4,5] }, { id: "I-ii-V7-I", degrees: [1,2,5,1], sevenths:[2] },
  { id: "I-IV-I-V", degrees: [1,4,1,5] },
];
