import { GetStaticPaths, GetStaticProps } from "next";
import { DocLayout } from "~/components/layouts";
import MDXRenderer from "~/components/MDXRenderer";
import { formatSlug, getAllDocs, getDocBySlug } from "~/lib/mdx";

export const getStaticPaths: GetStaticPaths = async () => {
  const docs = getAllDocs();
  return {
    paths: docs.map((p) => ({
      params: {
        slug: formatSlug(p).split("/"),
      },
    })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  let slug = params?.slug!;
  if (Array.isArray(slug)) slug = slug.join("/");
  const doc = await getDocBySlug(slug);
  return {
    props: {
      doc,
    },
  };
};

interface Props {
  doc: Doc;
}

export default function Doc({ doc }: Props) {
  const { mdxSource, frontMatter } = doc;

  return (
    <>
      <DocLayout>
        <MDXRenderer mdxSource={mdxSource} frontMatter={frontMatter} />
      </DocLayout>
    </>
  );
}
