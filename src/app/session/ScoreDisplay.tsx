import { useEffect, useRef } from "react";
import { exerciseToAbc } from "../../adapters/abc/exerciseToAbc";
import { renderScore } from "../../adapters/abc/renderScore";
import type { SightReadingStatus } from "../../application/sightReadingCoordinator";
import type { Exercise } from "../../core/model";
import type { ReviewAnnotation } from "../../core/performance/reviewAnnotations";

export interface ScoreDisplayProps {
  exercise: Exercise;
  markedOnset?: number;
  reviewAnnotations: ReviewAnnotation[];
  status: SightReadingStatus;
}

export function ScoreDisplay({
  exercise,
  markedOnset,
  reviewAnnotations,
  status,
}: ScoreDisplayProps) {
  const scoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scoreRef.current) {
      const abc = exerciseToAbc(exercise, {
        markedOnset,
        reviewAnnotations: status === "review" ? reviewAnnotations : undefined,
      });
      renderScore(scoreRef.current, abc);
    }
  }, [exercise, markedOnset, reviewAnnotations, status]);

  return <div className="track" ref={scoreRef} />;
}
