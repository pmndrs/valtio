type Dict = Record<string, any>;
interface Navigation {
  href: string;
  match?: RegExp;
  title: string;
  published?: boolean;
  isActive?: boolean;
}

interface Doc {
  mdxSource: string;
  frontMatter: Dict;
}
