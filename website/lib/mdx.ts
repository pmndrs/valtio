import { bundleMDX } from "mdx-bundler";
import fs from "fs";
import matter from "gray-matter";
import path from "path";
import { getAllFilesRecursively } from "_utils/file_helpers";

// Remark packages
import remarkGfm from "remark-gfm";
import oembedTransformer from "@remark-embedder/transformer-oembed";
import remarkEmbedder from "@remark-embedder/core";
import type { TransformerInfo } from "@remark-embedder/core";

// Rehype packages
import rehypePrismPlus from "rehype-prism-plus";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import type * as U from "unified";

const root = path.resolve(process.cwd(), "../");
const docsPath = path.join(root, "docs");

function handleEmbedderError({ url }: { url: string }) {
  return `<p>Error embedding <a href="${url}">${url}</a>.`;
}

type GottenHTML = string | null;
function handleEmbedderHtml(html: GottenHTML, info: TransformerInfo) {
  if (!html) return null;

  const url = new URL(info.url);
  // matches youtu.be and youtube.com
  if (/youtu\.?be/.test(url.hostname)) {
    // this allows us to set youtube embeds to 100% width and the
    // height will be relative to that width with a good aspect ratio
    return makeEmbed(html, "youtube");
  }
  if (url.hostname.includes("codesandbox.io")) {
    return makeEmbed(html, "codesandbox", "80%");
  }
  return html;
}

function makeEmbed(html: string, type: string, heightRatio = "56.25%") {
  return `
  <div class="embed" data-embed-type="${type}">
    <div style="padding-bottom: ${heightRatio}">
      ${html}
    </div>
  </div>
`;
}

const remarkPlugins: U.PluggableList = [
  [
    // @ts-expect-error
    remarkEmbedder,
    {
      handleError: handleEmbedderError,
      handleHTML: handleEmbedderHtml,
      transformers: [oembedTransformer],
    },
  ],
];

export function getAllDocs() {
  const files = getAllFilesRecursively(docsPath);
  // Only want to return docs/path and ignore root, replace is needed to work on Windows
  return files.map((file) =>
    file.slice(docsPath.length + 1).replace(/\\/g, "/")
  );
}

export function formatSlug(slug: string) {
  return slug.replace(/\.(mdx|md)/, "");
}

export function dateSortDesc(a: any, b: any) {
  if (a > b) return -1;
  if (a < b) return 1;
  return 0;
}

export async function getDocBySlug(slug: string) {
  const mdxPath = path.join(docsPath, `${slug}.mdx`);
  const mdPath = path.join(docsPath, `${slug}.md`);
  const source = fs.existsSync(mdxPath)
    ? fs.readFileSync(mdxPath, "utf8")
    : fs.readFileSync(mdPath, "utf8");

  // https://github.com/kentcdodds/mdx-bundler#nextjs-esbuild-enoent
  if (process.platform === "win32") {
    process.env.ESBUILD_BINARY_PATH = path.join(
      root,
      "node_modules",
      "esbuild",
      "esbuild.exe"
    );
  } else {
    process.env.ESBUILD_BINARY_PATH = path.join(
      root,
      "node_modules",
      "esbuild",
      "bin",
      "esbuild"
    );
  }

  // Parsing frontmatter here to pass it in as options to rehype plugin
  const { data: frontmatter } = matter(source);
  const { code } = await bundleMDX({
    source,
    // mdx imports can be automatically source from the components directory
    cwd: path.join(root, "components"),
    xdmOptions(options) {
      // this is the recommended way to add custom remark/rehype plugins:
      // The syntax might look weird, but it protects you in case we add/remove
      // plugins in the future.
      options.remarkPlugins = [
        ...(options.remarkPlugins ?? []),
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: "wrap" }],
        remarkGfm,
        ...remarkPlugins,
      ];
      options.rehypePlugins = [
        ...(options.rehypePlugins ?? []),
        rehypeSlug,
        rehypeAutolinkHeadings,
        [rehypePrismPlus, { ignoreMissing: true }],
      ];
      return options;
    },
    esbuildOptions: (options) => {
      options.loader = {
        ...options.loader,
        ".js": "jsx",
        ".ts": "tsx",
      };
      return options;
    },
  });

  return {
    mdxSource: code,
    frontMatter: {
      slug: slug || null,
      fileName: fs.existsSync(mdxPath) ? `${slug}.mdx` : `${slug}.md`,
      ...frontmatter,
      date: frontmatter.date ? new Date(frontmatter.date).toISOString() : null,
    },
  };
}

// export async function getAllFilesFrontMatter(folder: string) {
//   const prefixPaths = path.join(root, "docs", folder);

//   const files = getAllFilesRecursively(prefixPaths);

//   const allFrontMatter: any[] = [];

//   files.forEach((file) => {
//     // Replace is needed to work on Windows
//     const fileName = file.slice(prefixPaths.length + 1).replace(/\\/g, "/");
//     // Remove Unexpected File
//     if (path.extname(fileName) !== ".md" && path.extname(fileName) !== ".mdx") {
//       return;
//     }
//     const source = fs.readFileSync(file, "utf8");
//     const { data: frontmatter } = matter(source);
//     if (frontmatter.draft !== true) {
//       allFrontMatter.push({
//         ...frontmatter,
//         slug: formatSlug(fileName),
//         date: frontmatter.date
//           ? new Date(frontmatter.date).toISOString()
//           : null,
//       });
//     }
//   });

//   return allFrontMatter.sort((a, b) => dateSortDesc(a.date, b.date));
// }