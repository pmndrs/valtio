## How to contribute

### Basic things to know before adding docs

- Docs live in `docs/` folder.
- Website lives in `website/` folder.
- Docs are written in `mdx` format.
- Docs filename shouldn't have spaces.
- Website would generate title and other metadata from graymatter in the file.
- You should be able to render condesandbox inside `mdx` files by simply adding the url for the same
- Once you have a doc, you can add it to the sidebar section by adding it to the nav in `getDocsNav` function inside `website/lib/mdx.ts`
