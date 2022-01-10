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

const getAllFilesRecursively: (folder: string) => string[] = (folder) =>
  pipe(
    fs.readdirSync,
    map(pipe(pathJoinPrefix(folder), walkDir)),
    flattenArray
  )(folder);

export { getAllFilesRecursively };
