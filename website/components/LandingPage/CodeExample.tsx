import { useSnapshot } from "valtio";
import Highlight, { defaultProps } from "prism-react-renderer";
import { GettingStarted } from "./GettingStarted";
import { state, incDuration, decDuration } from "./state";

const exampleCode = (dur: number, count: number) => `
  const state = proxy({
    dur: ${dur},
    count: ${count}
  });
  const incDur = () => {++state.dur};
  const decDur = () => {--state.dur};
  const incCount = () => {
    ++state.count;
    setTimeout(incCount, 100 * state.dur);
  };

  incCount();

  const snap = useSnapshot(state)
  
  return (
    <div>
      <h3>{snap.dur}</h3>
      <button 
        disabled={snap.dur <= 1}
        onClick={decDur}>
        -
      </button>
      <button
        disabled={snap.dur >= 10}
        onClick={incDur}>
        +
      </button>
    </div>
  );
`;

export const CodeExample = () => {
  const snap = useSnapshot(state);
  return (
    <div className="code-container">
      <div className="code-container-inner">
        <div className="duration-changer">
          <h3 className="text-xl font-bold">{snap.dur}</h3>
          <div>
            <button
              className="counter"
              disabled={snap.dur <= 1}
              onClick={decDuration}
            >
              -
            </button>
            <button
              className="counter"
              disabled={snap.dur >= 10}
              onClick={incDuration}
            >
              +
            </button>
          </div>
        </div>
        <Highlight
          {...defaultProps}
          code={exampleCode(snap.dur, snap.count)}
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
