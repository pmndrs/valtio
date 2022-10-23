import Link from "next/link";

export const GettingStarted = ({ className }: { className: string }) => (
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
      <p className="text-gray-700 font-medium pb-8">Proxy state made simple</p>
    </div>
  </div>
);
