import { GetStaticPaths, GetStaticProps } from "next";
import { DocLayout } from "~/components/layouts";
import MDXRenderer from "~/components/MDXRenderer";
import { getSlugs, getAllDocs, getDocBySlug, getDocsNav } from "~/lib/mdx";

export const getStaticPaths: GetStaticPaths = async () => {
  const docs = getAllDocs();
  return {
    paths: docs.map((p) => ({
      params: {
        slug: getSlugs(p),
      },
    })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  let slug = params?.slug!;
  if (Array.isArray(slug)) slug = slug.join("/");
  const doc = await getDocBySlug(slug);
  const nav = getDocsNav();
  return {
    props: {
      doc,
      nav,
    },
  };
};

interface Props {
  doc: Doc;
  nav: Record<string, Navigation[]>;
}

export default function Doc({ doc, nav }: Props) {
  const { mdxSource, frontMatter } = doc;

  return (
    <>
      <DocLayout nav={nav} frontMatter={frontMatter}>
        <MDXRenderer mdxSource={mdxSource} frontMatter={frontMatter} />
      </DocLayout>
    </>
  );
}
