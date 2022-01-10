import type { NextPage } from "next";
import Link from "next/link";

const Home: NextPage = () => {
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="space-y-12">
        <h1 className="text-gray-900 font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight text-center dark:text-white">
          Valtio
        </h1>
        <Link href="/docs/basic/useSnapshot">
          <a className="bg-gray-900 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-50 text-white font-semibold h-12 px-6 rounded-lg w-full flex items-center justify-center sm:w-auto dark:bg-sky-500 dark:highlight-white/20 dark:hover:bg-sky-400">
            Get started
          </a>
        </Link>
      </div>
    </div>
  );
};

export default Home;
