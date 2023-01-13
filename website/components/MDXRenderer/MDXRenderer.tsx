import { getMDXComponent } from "mdx-bundler/client";
import { useMemo } from "react";
import { useCodesandboxTheme } from "~/hooks";

interface Props {
  mdxSource: string;
  frontMatter: Dict;
}

export default function MDXRenderer({ mdxSource, frontMatter }: Props) {
  useCodesandboxTheme(mdxSource);
  const Component = useMemo(() => getMDXComponent(mdxSource), [mdxSource]);
  return (
    <>
      <main>
        <Component />
      </main>
    </>
  );
}
