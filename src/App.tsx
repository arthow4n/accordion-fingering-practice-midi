import { useEffect, useRef } from "react";
import { renderScore } from "./score";

export const App: React.FC = () => {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!el.current) {
      return;
    }

    renderScore(el.current);
  }, []);

  return <div ref={el}></div>;
};
