import {
  Annotation,
  AnnotationHorizontalJustify,
  AnnotationVerticalJustify,
  BarlineType,
  Factory,
  Font,
} from "vexflow";
import { Measure } from "./score.types";

export const renderScore = (elementId: HTMLDivElement, measures: Measure[]) => {
  // Ref: Vexflow's test page contains a lot of exmaples of how to draw things https://www.vexflow.com/tests/

  // TODO: Clean up all this messy code that's really just for "hello world", spent already a whole hour just to understand how to get things to look okay.
  const width = 500;
  const factory = new Factory({
    renderer: {
      // This actually accepts HTMLDivElement, force casting type just to comply with the current typing.
      elementId: elementId as unknown as string,
      width: width * measures.length + 10,
      height: 250,
    },
  });

  let x = 0;
  const y = 0;

  const appendSystem = () => {
    const system = factory.System({ x, y, width });
    x += width;
    return system;
  };

  for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
    const measure = measures[measureIndex];
    const { timeSignature, notes } = measure;

    const stave = factory
      .Stave({
        x,
        y,
        width,
      })
      .setEndBarType(BarlineType.SINGLE);

    if (measureIndex === 0) {
      stave.addClef("treble").addTimeSignature(timeSignature);
    }

    const system = appendSystem();

    const notesAsTickables = notes.map(
      ({ keys, duration, bassDisplayName, isCurrentProgress }) => {
        const staveNote = factory.StaveNote({
          keys,
          duration,
          auto_stem: true,
        });
        // TODO: Colour the current note to play
        // .setStyle({ fillStyle: "red", strokeStyle: "red" })

        if (bassDisplayName) {
          staveNote.addModifier(
            new Annotation(bassDisplayName)
              .setFont(Font.SANS_SERIF, "1.5em")
              .setJustification(AnnotationHorizontalJustify.LEFT)
              .setVerticalJustification(AnnotationVerticalJustify.TOP),
          );
        }

        if (isCurrentProgress) {
          staveNote.setStyle({ fillStyle: "red", strokeStyle: "red" });
        }

        return staveNote;
      },
    );

    const voices = [
      factory.Voice({ time: timeSignature }).addTickables(notesAsTickables),
    ];

    system.addStave({ stave, voices });
  }

  factory.draw();
};

// Code example memo:
// {
//   const timeSignature = "3/4";
//   const stave = factory
//     .Stave({
//       x,
//       y,
//       width,
//     })
//     .addClef("treble")
//     .addTimeSignature(timeSignature)
//     .setEndBarType(BarlineType.SINGLE);

//   const system = appendSystem();

//   const notes = [
//     factory
//       .StaveNote({ keys: ["c/4"], duration: "4" })
//       .addModifier(
//         new Annotation("C")
//           .setFont(Font.SANS_SERIF, "1.5em")
//           .setJustification(AnnotationHorizontalJustify.LEFT)
//           .setVerticalJustification(AnnotationVerticalJustify.TOP),
//       )
//       .setStyle({ fillStyle: "red", strokeStyle: "red" }),
//     factory.StaveNote({ keys: ["c/4"], duration: "4" }),
//     factory.GhostNote({ duration: "4" }),
//   ];
//   const voices = [factory.Voice({ time: timeSignature }).addTickables(notes)];

//   system.addStave({ stave, voices });
// }

// {
//   const timeSignature = "3/4";
//   const stave = factory
//     .Stave({
//       x,
//       y,
//       width,
//     })
//     .setEndBarType(BarlineType.SINGLE);

//   const system = appendSystem();

//   const notes = [
//     factory
//       .StaveNote({ keys: ["c/4"], duration: "4" })
//       .addModifier(
//         new Annotation("G")
//           .setFont(Font.SANS_SERIF, "1.5em")
//           .setJustification(AnnotationHorizontalJustify.LEFT)
//           .setVerticalJustification(AnnotationVerticalJustify.TOP),
//       )
//       .setStyle({ fillStyle: "blue", strokeStyle: "blue" }),
//     factory
//       .StaveNote({ keys: ["c/4"], duration: "4" })
//       .setStyle({ fillStyle: "blue", strokeStyle: "blue" }),
//     factory
//       .StaveNote({ keys: ["c/4"], duration: "4" })
//       .setStyle({ fillStyle: "blue", strokeStyle: "blue" }),
//   ];
//   const voices = [factory.Voice({ time: timeSignature }).addTickables(notes)];

//   system.addStave({ stave, voices });
// }
