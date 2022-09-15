import { AnimatedShapes } from "~/components/LandingPage/AnimatedShapes";
import { GettingStarted } from "~/components/LandingPage/GettingStarted";
import { CodeExample } from "~/components/LandingPage/CodeExample";
import SEO from "~/components/SEO";

const Home = () => {
  return (
    <div className="min-h-screen landing-page-container">
      <SEO />
      <CodeExample />
      <AnimatedShapes />
      <GettingStarted className="large-screen" />
    </div>
  );
};

export default Home;
