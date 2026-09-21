import { TICKS_PER_QUARTER, type Meter, type Tick } from "../model";
export type RhythmAtom = { duration: Tick; rest?: boolean; tie?: boolean };
export type RhythmCell = { id: string; meters: readonly string[]; atoms: readonly RhythmAtom[]; complexity: number; syncopated?: boolean };
const q = TICKS_PER_QUARTER;
export const RHYTHM_CELLS: readonly RhythmCell[] = [
  { id: "quarters", meters: ["4/4","3/4"], atoms: [{duration:q},{duration:q},{duration:q},{duration:q}], complexity:.05 },
  { id: "halves", meters: ["4/4"], atoms: [{duration:2*q},{duration:2*q}], complexity:.05 },
  { id: "paired-eighths", meters: ["4/4","3/4"], atoms: Array.from({length:8}, () => ({duration:q/2})), complexity:.2 },
  { id: "four-sixteenths", meters: ["4/4"], atoms: Array.from({length:16}, () => ({duration:q/4})), complexity:.55 },
  { id: "eighth-two-sixteenths", meters: ["4/4"], atoms: Array.from({length:4}, () => [{duration:q/2},{duration:q/4},{duration:q/4}]).flat(), complexity:.45 },
  { id: "two-sixteenths-eighth", meters: ["4/4"], atoms: Array.from({length:4}, () => [{duration:q/4},{duration:q/4},{duration:q/2}]).flat(), complexity:.45 },
  { id: "dotted-eighth-sixteenth", meters: ["4/4","3/4"], atoms: Array.from({length:4}, () => [{duration:3*q/4},{duration:q/4}]).flat(), complexity:.5 },
  { id: "dotted-quarter-eighth", meters: ["4/4"], atoms: [{duration:1.5*q},{duration:.5*q},{duration:1.5*q},{duration:.5*q}], complexity:.4 },
  { id: "quarter-rests", meters: ["4/4"], atoms: [{duration:q,rest:true},{duration:q},{duration:q},{duration:q}], complexity:.25 },
  { id: "syncopation", meters: ["4/4"], atoms: [{duration:q/2,rest:true},{duration:q,tie:true},{duration:q},{duration:q},{duration:q/2}], complexity:.7, syncopated:true },
  { id: "three-quarters", meters: ["3/4"], atoms: [{duration:q},{duration:q},{duration:q}], complexity:.05 },
  { id: "half-quarter", meters: ["3/4"], atoms: [{duration:2*q},{duration:q}], complexity:.05 },
  { id: "quarter-half", meters: ["3/4"], atoms: [{duration:q},{duration:2*q}], complexity:.05 },
  { id: "six-eight-basic", meters: ["6/8"], atoms: Array.from({length:6}, () => ({duration:q/2})), complexity:.15 },
  { id: "six-eight-compound", meters: ["6/8"], atoms: [{duration:1.5*q},{duration:1.5*q}], complexity:.1 },
];
export const meterId = (meter: Meter) => `${meter.beats}/${meter.beatUnit}`;
export const cellsForMeter = (meter: Meter) => RHYTHM_CELLS.filter((cell) => cell.meters.includes(meterId(meter)) && cell.atoms.reduce((s,a)=>s+a.duration,0) === meter.beats * q * 4 / meter.beatUnit);
