import { proxy } from "valtio";

export const animationState = proxy({
  duration: 4,
});

export const incDuration = () => {
  ++animationState.duration;
};

export const decDuration = () => {
  --animationState.duration;
};
