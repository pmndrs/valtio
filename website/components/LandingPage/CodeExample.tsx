import { useSnapshot } from "valtio";
import Highlight, { defaultProps } from "prism-react-renderer";
import { GettingStarted } from "./GettingStarted";
import { state, incDuration, decDuration } from "./state";

const exampleCode = (duration: number, count: number) => `
  const state = proxy({
    duration: ${duration},
    count: ${count}
  });
  const incDuration = () => {
    ++state.duration;
  };
  const decDuration = () => {
    --state.duration;
  };
  const incrementCount = () => {
    ++state.count;
    setTimeout(incrementCount, 100 * state.duration);
  };

  incrementCount();

  const snap = useSnapshot(state)
  
  <div>
    <h3>
      {snap.duration}
    </h3>
    <button
      disabled={snap.duration <= 1}
      onClick={decDuration}>
      -
    </button>
    <button
      disabled={snapshot.duration >= 10}
      onClick={incDuration}>
      +
    </button>
  </div>
`;

export const CodeExample = () => {
  const snapshot = useSnapshot(state);
  return (
    <div className="code-container">
      <div className="code-container-inner">
        <div className="duration-changer">
          <h3 className="text-xl font-bold">
            {snapshot.duration}
            <small className="font-light"> sec</small>
          </h3>
          <div>
            <button
              className="counter"
              disabled={snapshot.duration <= 1}
              onClick={decDuration}
            >
              -
            </button>
            <button
              className="counter"
              disabled={snapshot.duration >= 10}
              onClick={incDuration}
            >
              +
            </button>
          </div>
        </div>
        <Highlight
          {...defaultProps}
          code={exampleCode(snapshot.duration, snapshot.count)}
          language="jsx"
          theme={undefined}
        >
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre className={className} style={style}>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line, key: i })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token, key })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
        <GettingStarted className="small-screen" />
      </div>
    </div>
  );
};
