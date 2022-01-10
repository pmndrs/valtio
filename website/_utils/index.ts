// we ignore this now cause we can't import fs in browser
// and file_helpers uses fs
// export * from "./file_helpers";

export function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}
