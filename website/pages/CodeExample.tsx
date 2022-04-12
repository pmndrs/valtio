import { useSnapshot } from "valtio";
import Highlight, { defaultProps } from "prism-react-renderer";
import { GettingStarted } from "./GettingStarted";
import { animationState, incDuration, decDuration } from "./animationState";

const exampleCode = (duration: number) => `
  const animationState = proxy({
    duration: ${duration},
  });
  const incDuration = () => {
    ++animationState.duration;
  };
  const decDuration = () => {
    --animationState.duration;
  };
  
  <div>
    <h3>
      {snapshot.baseDuration}
    </h3>
    <button
      disabled={snapshot.baseDuration <= 3}
      onClick={decDuration}>
      -
    </button>
    <button
      disabled={snapshot.duration >= 6}
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
          <h3 className="text-xl font-bold">{snapshot.duration}</h3>
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
          code={exampleCode(snapshot.duration)}
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
