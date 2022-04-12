import { AnimatedShapes } from "./AnimatedShapes";
import { GettingStarted } from "./GettingStarted";
import { CodeExample } from "./CodeExample";

const Home = () => {
  return (
    <div className="min-h-screen landing-page-container">
      <CodeExample />
      <AnimatedShapes />
      <GettingStarted className="large-screen" />
    </div>
  );
};

export default Home;
