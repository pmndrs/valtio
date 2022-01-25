import type { NextPage } from "next";
import type { AppProps } from "next/app";

import "~/styles/tailwind.css";

type NextPageWithLayout = NextPage & {
  layoutProps: {
    meta: Dict;
    Layout?: React.FunctionComponent;
  };
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  return (
    <>
      <Component {...pageProps} />
    </>
  );
}
