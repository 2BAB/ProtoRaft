import remarkParse from "remark-parse";
import { unified } from "unified";
import { markdownProjectPath } from "../src/markdown-path";

const markdown = unified().use(remarkParse);

export function markdownAssetPaths(filename: string, content: string) {
  const tree = markdown.parse(content);
  const definitions = new Map<string, string>();
  const destinations: string[] = [];
  const references: string[] = [];
  type MarkdownNode = {
    type: string;
    url?: string;
    identifier?: string;
    children?: MarkdownNode[];
  };

  const visit = (node: MarkdownNode) => {
    if (node.type === "definition" && node.identifier && node.url && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url);
    }
    if ((node.type === "image" || node.type === "link") && node.url) {
      destinations.push(node.url);
    }
    if ((node.type === "imageReference" || node.type === "linkReference") && node.identifier) {
      references.push(node.identifier);
    }
    node.children?.forEach(visit);
  };
  visit(tree);
  for (const reference of references) {
    const url = definitions.get(reference);
    if (url) destinations.push(url);
  }
  return destinations.map((url) => markdownProjectPath(filename, url))
    .filter((path): path is string => Boolean(path && /\.(png|jpe?g|webp|gif|svg)$/i.test(path)));
}
