import React from "react";
interface Props {}

export default function DocLayout({
  children,
}: React.PropsWithChildren<Props>) {
  return <>{children}</>;
}
