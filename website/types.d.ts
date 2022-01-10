type Dict = Record<string, any>;
interface Navigation {
  name: string;
  href?: string;
  icon?: React.ReactElement;
  current?: boolean;
  children?: Navigation[];
}

interface Doc {
  mdxSource: string;
  frontMatter: Dict;
}

declare module "nightwind/helper";
