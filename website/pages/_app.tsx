import type { NextPage } from "next";
import type { AppProps } from "next/app";

import "~/styles/tailwind.css";
import "~/styles/prism-theme.css";
import "~/styles/landing-page.css";

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
