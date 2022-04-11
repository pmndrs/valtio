import Link from "next/link";
import { proxy, useSnapshot, subscribe } from "valtio";
import Highlight, { defaultProps } from "prism-react-renderer";

const state = proxy({
  baseDuration: 4,
});

const incDuration = () => {
  ++state.baseDuration;
};
const decDuration = () => {
  --state.baseDuration;
};

subscribe(state, () => {
  document.documentElement.style.setProperty(
    "--base-animation-duration",
    state.baseDuration + "s"
  );
});

const exampleCode = `
  const state = proxy({
    baseDuration: 4
  });
  const incDuration = () => {
    ++state.baseDuration;
  };
  const decDuration = () => {
    --state.baseDuration;
  };
  
  subscribe(state, () => {
    document.documentElement.style.setProperty(
      "--base-animation-duration",
      state.baseDuration + "s"
    );
  });
  
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
      disabled={snapshot.baseDuration >= 6}
      onClick={incDuration}>
      +
    </button>
  </div>
`;

const GetStartedButton = ({ className }: { className: string }) => (
  <div
    className={`get-started inset-x-0 bottom-160 md:bottom-4 grid place-items-center gap-5 z-50 ${className}`}
  >
    <div className="">
      <Link href="/docs/introduction/getting-started">
        <a className="mt-14 bg-gray-900 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-50 text-white font-semibold h-12 px-6 rounded-lg w-full flex items-center justify-center sm:w-auto dark:bg-sky-500 dark:highlight-white/20 dark:hover:bg-sky-400">
          Get started
        </a>
      </Link>
    </div>
    <div>
      <p className="text-gray-700 font-medium">Proxy state made simple</p>
    </div>
  </div>
);

const CodeExample = () => {
  const snapshot = useSnapshot(state);
  return (
    <div className="code-container">
      <div className="code-container-inner">
        <div className="duration-changer">
          <h3 className="text-xl font-bold">{snapshot.baseDuration}</h3>
          <div>
            <button
              className="counter"
              disabled={snapshot.baseDuration <= 1}
              onClick={decDuration}
            >
              -
            </button>
            <button
              className="counter"
              disabled={snapshot.baseDuration >= 10}
              onClick={incDuration}
            >
              +
            </button>
          </div>
        </div>
        <Highlight
          {...defaultProps}
          code={exampleCode}
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
        <GetStartedButton className="small-screen" />
      </div>
    </div>
  );
};

const AnimatedShapes = () => {
  return (
    <>
      <svg
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="center valtio"
      >
        <path
          d="M773.98 485.864H732.964L695.251 607.419H693.547L655.94 485.864H614.818L673.092 649.5H715.706L773.98 485.864ZM825.067 652.803C850.742 652.803 866.083 640.764 873.114 627.021H874.393V649.5H911.467V539.983C911.467 496.73 876.204 483.733 844.989 483.733C810.579 483.733 784.158 499.074 775.636 528.903L811.644 534.017C815.479 522.831 826.346 513.243 845.202 513.243C863.1 513.243 872.901 522.405 872.901 538.491V539.131C872.901 550.21 861.289 550.743 832.418 553.832C800.671 557.241 770.309 566.723 770.309 603.584C770.309 635.757 793.853 652.803 825.067 652.803ZM835.082 624.464C818.995 624.464 807.489 617.114 807.489 602.945C807.489 588.136 820.38 581.957 837.638 579.507C847.759 578.122 868.001 575.565 873.008 571.517V590.8C873.008 609.017 858.306 624.464 835.082 624.464ZM970.81 431.318H932.245V649.5H970.81V431.318ZM1074.18 485.864H1041.9V446.659H1003.33V485.864H980.11V515.693H1003.33V606.673C1003.12 637.462 1025.49 652.589 1054.47 651.737C1065.44 651.418 1073.01 649.287 1077.16 647.902L1070.66 617.753C1068.53 618.286 1064.17 619.244 1059.37 619.244C1049.68 619.244 1041.9 615.835 1041.9 600.281V515.693H1074.18V485.864ZM1088.43 649.5H1127V485.864H1088.43V649.5ZM1107.82 462.639C1120.07 462.639 1130.09 453.264 1130.09 441.759C1130.09 430.146 1120.07 420.771 1107.82 420.771C1095.46 420.771 1085.45 430.146 1085.45 441.759C1085.45 453.264 1095.46 462.639 1107.82 462.639ZM1220.03 652.696C1267.97 652.696 1298.44 618.925 1298.44 568.321C1298.44 517.611 1267.97 483.733 1220.03 483.733C1172.09 483.733 1141.62 517.611 1141.62 568.321C1141.62 618.925 1172.09 652.696 1220.03 652.696ZM1220.25 621.801C1193.72 621.801 1180.72 598.151 1180.72 568.214C1180.72 538.278 1193.72 514.308 1220.25 514.308C1246.35 514.308 1259.34 538.278 1259.34 568.214C1259.34 598.151 1246.35 621.801 1220.25 621.801Z"
          fill="var(--theme-blue)"
        />
      </svg>
      <svg
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="top-right"
      >
        <g stroke="var(--theme-blue)">
          <circle
            className="fast-circle"
            cx="1338"
            cy="209"
            r="84"
            strokeWidth="6"
          />
          <g className="dot-grid">
            <circle cx="907.5" cy="145.5" r="3" strokeWidth="15" />
            <circle cx="907.5" cy="230.5" r="3" strokeWidth="15" />
            <circle cx="907.5" cy="315.5" r="3" strokeWidth="15" />
            <circle cx="1025.5" cy="145.5" r="3" strokeWidth="15" />
            <circle cx="1025.5" cy="230.5" r="3" strokeWidth="15" />
            <circle cx="1025.5" cy="315.5" r="3" strokeWidth="15" />
            <circle cx="1143.5" cy="145.5" r="3" strokeWidth="15" />
            <circle cx="1143.5" cy="230.5" r="3" strokeWidth="15" />
            <circle cx="1143.5" cy="315.5" r="3" strokeWidth="15" />
            <circle cx="1261.5" cy="145.5" r="3" strokeWidth="15" />
            <circle cx="1261.5" cy="230.5" r="3" strokeWidth="15" />
            <circle cx="1261.5" cy="315.5" r="3" strokeWidth="15" />
            <circle cx="1379.5" cy="145.5" r="3" strokeWidth="15" />
            <circle cx="1379.5" cy="230.5" r="3" strokeWidth="15" />
            <circle cx="1379.5" cy="315.5" r="3" strokeWidth="15" />
            <circle cx="1497.5" cy="145.5" r="3" strokeWidth="15" />
            <circle cx="1497.5" cy="230.5" r="3" strokeWidth="15" />
            <circle cx="1497.5" cy="315.5" r="3" strokeWidth="15" />
            <circle cx="1615.5" cy="145.5" r="3" strokeWidth="15" />
            <circle cx="1615.5" cy="230.5" r="3" strokeWidth="15" />
            <circle cx="1615.5" cy="315.5" r="3" strokeWidth="15" />
          </g>
        </g>
      </svg>
      <svg
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="top-left"
      >
        <circle
          className="donut"
          cx="474.5"
          cy="350.5"
          r="12"
          strokeWidth="40"
          stroke="var(--theme-blue)"
        />
        <g stroke="var(--theme-blue)" className="three-d-box">
          <line
            x1="101.834"
            y1="297.925"
            x2="192.834"
            y2="202.925"
            strokeWidth="6"
          />
          <line
            x1="299.834"
            y1="298.925"
            x2="390.834"
            y2="203.925"
            strokeWidth="6"
          />
          <line
            x1="301.834"
            y1="494.925"
            x2="392.834"
            y2="399.925"
            strokeWidth="6"
          />
          <line
            x1="104.834"
            y1="491.925"
            x2="195.834"
            y2="396.925"
            strokeWidth="6"
          />
          <rect
            x="103"
            y="297"
            width="200"
            height="197"
            fill="none"
            strokeWidth="6"
          />
          <rect
            x="192"
            y="204"
            width="200"
            height="197"
            fill="none"
            strokeWidth="6"
          />
        </g>
      </svg>
      <svg
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="bottom-left"
      >
        <g stroke="var(--theme-blue)" className="concentric-circles">
          <circle cx="-43" cy="1272" r="619" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="593" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="568" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="540" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="514" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="487" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="461" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="435" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="409" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="382" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="355" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="329" strokeWidth="6" />
          <circle cx="-43" cy="1272" r="303" strokeWidth="6" />
        </g>
      </svg>
      <svg
        viewBox="0 0 1920 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="bottom-right"
      >
        <g stroke="var(--theme-blue)">
          <rect
            className="spinning-box"
            x="650"
            y="750"
            width="100"
            height="100"
            strokeWidth="6"
          />
          <line
            className="line-1"
            x1="1275"
            y1="780"
            x2="1393"
            y2="780"
            strokeWidth="6"
          />
          <line
            className="line-2"
            x1="1095"
            y1="839"
            x2="1685"
            y2="839"
            strokeWidth="6"
          />
          <line
            className="line-3"
            x1="1275"
            y1="898"
            x2="1518"
            y2="898"
            strokeWidth="6"
          />
        </g>
      </svg>
    </>
  );
};

const Home = () => {
  return (
    <div className="min-h-screen landing-page-container">
      <CodeExample />
      <AnimatedShapes />
      <GetStartedButton className="large-screen" />
    </div>
  );
};

export default Home;
