import { getMDXComponent } from "mdx-bundler/client";
import { useMemo } from "react";
interface Props {
  mdxSource: string;
  frontMatter: Dict;
}

export default function MDXRenderer({ mdxSource, frontMatter }: Props) {
  const Component = useMemo(() => getMDXComponent(mdxSource), [mdxSource]);
  return (
    <>
      <main>
        <Component />
      </main>
    </>
  );
}
