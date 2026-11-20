// Resolve a Markdown destination against its source file inside the project.
export function markdownProjectPath(documentPath: string, destination: string) {
  if (!destination || /^(?:[a-z][a-z0-9+.-]*:|[\/#])/i.test(destination)) return null;
  const pathname = destination.split(/[?#]/, 1)[0];
  if (!pathname) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.startsWith("/") || /[\\\0]/.test(decoded)) return null;

  const parts = documentPath.split("/").slice(0, -1);
  for (const part of decoded.split("/")) {
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else if (part && part !== ".") {
      parts.push(part);
    }
  }
  return parts.join("/") || null;
}
