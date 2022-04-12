import { useSpring } from "react-spring";
import { easeQuadInOut } from "d3-ease";
import { useSnapshot } from "valtio";
import { animationState } from "./animationState";

type AnimationName = "float" | "float-mid" | "float-rotate-mid" | "float-hi";
const floatAnimations = new Map<
  AnimationName,
  {
    from: { transform: string };
    to: { transform: string };
  }
>();

floatAnimations.set("float", {
  from: { transform: "translate3d(0, 0px, 0)" },
  to: { transform: "translate3d(0, -20px, 0)" },
});
floatAnimations.set("float-mid", {
  from: { transform: "translate3d(0, 0px, 0)" },
  to: { transform: "translate3d(0, -40px, 0)" },
});
floatAnimations.set("float-rotate-mid", {
  from: { transform: "translate3d(0, -50px, 0) rotate(0deg)" },
  to: { transform: "translate3d(0, 0px, 0) rotate(180deg)" },
});
floatAnimations.set("float-hi", {
  from: { transform: "translate3d(0, 0px, 0)" },
  to: { transform: "translate3d(0, -60px, 0)" },
});

const clamp = (num: number, min: number, max: number) =>
  Math.min(Math.max(num, min), max);

export function useFloatAnimation(
  animation: AnimationName,
  offset: number = 0
) {
  const snapshot = useSnapshot(animationState);
  const [style] = useSpring(
    () => ({
      loop: { reverse: true },
      config: {
        duration: clamp(snapshot.duration * 1000 + offset, 500, 10000),
        easing: easeQuadInOut,
      },
      ...floatAnimations.get(animation),
    }),
    [snapshot.duration]
  );
  return style;
}
