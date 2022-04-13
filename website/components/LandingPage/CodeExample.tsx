import { useSnapshot } from "valtio";
import Highlight, { defaultProps } from "prism-react-renderer";
import { GettingStarted } from "./GettingStarted";
import { animationState, incDuration, decDuration } from "./animationState";

const exampleCode = (duration: number, count: number) => `
  const animationState = proxy({
    durationInSec: ${duration},
    count: ${count}
  });
  const incDuration = () => {
    ++animationState.durationInSec;
  };
  const decDuration = () => {
    --animationState.durationInSec;
  };

  setInterval(() => {
    ++animationState.count;
  }, 100);
  
  <div>
    <h3>
      {snapshot.durationInSec}
    </h3>
    <button
      disabled={snapshot.durationInSec <= 1}
      onClick={decDuration}>
      -
    </button>
    <button
      disabled={snapshot.durationInSec >= 10}
      onClick={incDuration}>
      +
    </button>
  </div>
`;

export const CodeExample = () => {
  const snapshot = useSnapshot(animationState);
  return (
    <div className="code-container">
      <div className="code-container-inner">
        <div className="duration-changer">
          <h3 className="text-xl font-bold">
            {snapshot.duration}
            <small className="font-light">sec</small>
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
