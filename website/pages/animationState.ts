import { proxy } from "valtio";

export const animationState = proxy({
  duration: 4,
  count: 0,
});

export const incDuration = () => {
  ++animationState.duration;
};

export const decDuration = () => {
  --animationState.duration;
};

setInterval(() => {
  ++animationState.count;
}, 100);
