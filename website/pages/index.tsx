import { AnimatedShapes } from "~/components/LandingPage/AnimatedShapes";
import { GettingStarted } from "~/components/LandingPage/GettingStarted";
import { CodeExample } from "~/components/LandingPage/CodeExample";

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
