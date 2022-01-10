type Dict = Record<string, any>;
interface Naivagation {
  name: string;
  href?: string;
  icon?: React.ReactElement;
  current?: boolean;
  children?: Naivagation[];
}

interface Doc {
  mdxSource: string;
  frontMatter: Dict;
}
