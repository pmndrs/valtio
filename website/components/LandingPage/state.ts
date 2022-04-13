import { proxy } from "valtio";

export const state = proxy({
  dur: 4,
  count: 0,
});

export const incDuration = () => {
  ++state.dur;
};

export const decDuration = () => {
  --state.dur;
};

const incrementCount = () => {
  ++state.count;
  setTimeout(incrementCount, 100 * state.dur);
};

incrementCount();
