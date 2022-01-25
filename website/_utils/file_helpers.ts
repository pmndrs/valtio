import fs from "fs";
import path from "path";

type fn = (...args: any[]) => any;

const pipe =
  (...fns: fn[]) =>
  (x: any) =>
    fns.reduce((v, f) => f(v), x);

const flattenArray = (input: any[]) =>
  input.reduce(
    (acc, item) => [...acc, ...(Array.isArray(item) ? item : [item])],
    []
  );

const map = (fn: fn) => (input: string[]) => input.map(fn);

const walkDir = (fullPath: string) => {
  return fs.statSync(fullPath).isFile()
    ? fullPath
    : getAllFilesRecursively(fullPath);
};

const pathJoinPrefix = (prefix: string) => (extraPath: string) =>
  path.join(prefix, extraPath);

const filterMDX = (files: string[]) =>
  files.filter(
    (file) => path.extname(file) === ".mdx" || path.extname(file) === ".md"
  );

const getAllFilesRecursively: (folder: string) => string[] = (folder) =>
  pipe(
    fs.readdirSync,
    map(pipe(pathJoinPrefix(folder), walkDir)),
    flattenArray,
    filterMDX
  )(folder);

const slugify = (str: string) => {
  return (
    str
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/[^\w\-]+/g, "") // Remove all non-word chars
      .replace(/\-\-+/g, "-") // Replace multiple - with single -
      // .replace(/([A-Z])/g, "_$1") // Replace uppercase with _ and lowercase
      // .toLowerCase()
      .replace(/^_+/, "") // Trim _ from start of text
      .replace(/^-+/, "") // Trim - from start of text
      .replace(/-+$/, "")
  ); // Trim - from end of text
};

export { getAllFilesRecursively, slugify };
