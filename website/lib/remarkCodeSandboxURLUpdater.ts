import type { Node } from "unist";
import { visit } from "unist-util-visit";

const codesandboxBaseUrl = "https://codesandbox.io/s";

const defaultParams = {
  codemirror: 1,
  fontsize: 14,
  hidenavigation: 1,
  theme: "light",
  hidedevtools: 1,
};

interface LinkNode extends Node {
  url: string;
  children: {
    value: string;
  }[];
}

export const remarkCodeSandboxURLUpdater = (
  options = {
    params: defaultParams,
  }
) => {
  function visitor(linkNode: LinkNode) {
    if (
      linkNode.url.startsWith(codesandboxBaseUrl) &&
      linkNode.children[0]?.value
    ) {
      const url = new URL(linkNode.url);
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value + "");
      });
      linkNode.url = url.toString();
      linkNode.children[0].value = url.toString();
    }
  }

  function transform(tree: Node) {
    visit(tree, "link", visitor);
  }

  return transform;
};
