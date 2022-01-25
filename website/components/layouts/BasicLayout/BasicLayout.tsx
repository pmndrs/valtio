import React from "react";

interface Props {}
export default function BasicLayout({
  children,
}: React.PropsWithChildren<Props>) {
  return (
    <>
      <main className="max-w-3xl mx-auto relative z-20 pt-10 xl:max-w-none">
        {children}
      </main>
    </>
  );
}
