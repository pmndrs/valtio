import { proxy } from "valtio";

export const state = proxy({
  duration: 4,
  count: 0,
});

export const incDuration = () => {
  ++state.duration;
};

export const decDuration = () => {
  --state.duration;
};

const incrementCount = () => {
  ++state.count;
  setTimeout(incrementCount, 100 * state.duration);
};

incrementCount();
