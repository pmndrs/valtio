import { GetStaticPaths, GetStaticProps } from 'next'
import { useRouter } from 'next/router'
import { DocLayout } from '~/components/layouts'
import MDXRenderer from '~/components/MDXRenderer'
import { getSlugs, getAllDocs, getDocBySlug, getDocsNav } from '~/lib/mdx'

export const getStaticPaths: GetStaticPaths = async ({ locales = ['en', 'zh'] }) => {
  const allPaths = []
  
  for (const locale of locales) {
    const docs = getAllDocs(locale)
    const localePaths = docs.map((p) => ({
      params: {
        slug: getSlugs(p),
      },
      locale,
    }))
    allPaths.push(...localePaths)
  }
  
  return {
    paths: allPaths,
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps = async ({ params, locale = 'en' }) => {
  let slug = params?.slug!
  if (Array.isArray(slug)) slug = slug.join('/')
  const doc = await getDocBySlug(slug, locale as string)
  const nav = getDocsNav(locale as string)
  return {
    props: {
      doc,
      nav,
    },
  }
}

interface Props {
  doc: Doc
  nav: Record<string, Navigation[]>
}

export default function Doc({ doc, nav }: Props) {
  const { mdxSource, frontMatter } = doc

  return (
    <>
      <DocLayout nav={nav} frontMatter={frontMatter}>
        <MDXRenderer mdxSource={mdxSource} frontMatter={frontMatter} />
      </DocLayout>
    </>
  )
}
