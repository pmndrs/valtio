import { Fragment, useEffect, useState } from "react";
import type { NextPage } from "next";
import type { AppProps } from "next/app";

import "~/styles/tailwind.css";

import { Header, BasicLayout } from "~/components/layouts";
import { Router } from "next/router";

type NextPageWithLayout = NextPage & {
  layoutProps: {
    meta: Dict;
    Layout?: React.FunctionComponent;
  };
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function MyApp({
  Component,
  pageProps,
  router,
}: AppPropsWithLayout) {
  let [navIsOpen, setNavIsOpen] = useState(false);

  useEffect(() => {
    if (!navIsOpen) return;
    function handleRouteChange() {
      setNavIsOpen(false);
    }
    Router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      Router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [navIsOpen]);
  const showHeader = router.pathname !== "/";
  // Use the layout defined at the page level, if available
  const Layout = Component.layoutProps?.Layout || Fragment;
  const layoutProps = Component.layoutProps?.Layout
    ? { layoutProps: Component.layoutProps, navIsOpen, setNavIsOpen }
    : {};
  const meta = Component.layoutProps?.meta || {};
  const description =
    meta.metaDescription || meta.description || "Documentation for the Valtio.";

  let section =
    meta.section ||
    Object.entries(
      // @ts-ignore
      (Component.layoutProps?.Layout?.nav as Record<string, Navigation[]>) ?? {}
    ).find(([, items]) =>
      items.find(({ href }: { href: string }) => href === router.asPath)
    )?.[0];

  return (
    <>
      {showHeader && (
        <Header
          // @ts-ignore
          hasNav={Boolean(Component.layoutProps?.Layout?.nav)}
          navIsOpen={navIsOpen}
          onNavToggle={(isOpen: boolean) => setNavIsOpen(isOpen)}
          title={meta.title}
          section={section}
        />
      )}
      <Layout {...layoutProps}>
        <Component {...pageProps} />
      </Layout>
    </>
  );
}
