import type { NextPage } from "next";
import Link from "next/link";

const Home: NextPage = () => {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundImage: 'url("./logo.svg")', backgroundSize: "cover" }}
    >
      <figure className="w-full h-full absolute">
        <figcaption className="sr-only">proxy state made simple</figcaption>
      </figure>
      <div className="absolute inset-x-0 bottom-14 grid place-items-center gap-5">
        <div className="">
          <Link href="/docs/introduction/getting-started">
            <a className="bg-gray-900 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-50 text-white font-semibold h-12 px-6 rounded-lg w-full flex items-center justify-center sm:w-auto dark:bg-sky-500 dark:highlight-white/20 dark:hover:bg-sky-400">
              Get started
            </a>
          </Link>
        </div>
        <div>
          <p className="text-gray-700 font-medium">Proxy state made simple</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
