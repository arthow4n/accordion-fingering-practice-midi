import { useEffect, useRef } from "react";
import { renderScore } from "./score";

export const App: React.FC = () => {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = el.current;
    if (!element) {
      return;
    }

    renderScore(element, [
      {
        bass: "C_3/4_Normal", notes: [{
          keys: ["c/4"],
          duration: "4",
        }, {
          keys: ["e/4"],
          duration: "4",
        }, {
          keys: ["g/4"],
          duration: "4",
        }]
      },
      {
        bass: "C_3/4_Alt", notes: [{
          keys: ["g/4"],
          duration: "4",
        }, {
          keys: ["e/4"],
          duration: "4",
        }, {
          keys: ["c/4"],
          duration: "4",
        },]
      }
    ])

    return () => {
      if (element) {
        element.innerHTML = "";
      }
    };
  }, []);

  return <div ref={el}></div>;
};
