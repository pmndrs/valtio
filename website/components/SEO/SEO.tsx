import Head from "next/head";

interface SeoProps {
  title?: string;
}

const defaultTitle = "Valtio, makes proxy-state simple for React and Vanilla";

export default function SEO({ title }:SeoProps) {
  return (
    <Head>
      <title>{title ? title.concat(' — ') : ''} {defaultTitle}</title>
    </Head>
  );
}
