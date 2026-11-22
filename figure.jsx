import React from "react";
export function ConceptFigure({ unit, stage = 0 }) {
  const water = unit === "air";
  return (
    <div
      aria-hidden="true"
      className={"figure " + (water ? "water " : "plant ") + "stage" + stage}
    >
      {water ? (
        <>
          {Array.from({ length: 16 }, (_, i) => (
            <i
              key={i}
              style={{
                "--n": i,
                "--x": (i % 4) * 18,
                "--y": Math.floor(i / 4) * 18,
              }}
            />
          ))}
        </>
      ) : (
        <>
          <span className="sun" />
          <span className="stem" />
          <span className="leaf left" />
          <span className="leaf right" />
          <span className="soil" />
        </>
      )}
    </div>
  );
}
