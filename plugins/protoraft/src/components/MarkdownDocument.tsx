import mermaid from "mermaid";
import { useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  themeVariables: {
    background: "#ffffff",
    primaryColor: "#f5f1e8",
    primaryTextColor: "#171717",
    primaryBorderColor: "#b9aa89",
    lineColor: "#6f6f6f",
    secondaryColor: "#f5f5f5",
    tertiaryColor: "#ffffff",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: "13px",
  },
});

function MermaidDiagram({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let disposed = false;
    setError(false);

    mermaid
      .render(`protoraft-${id}`, chart)
      .then(({ svg, bindFunctions }) => {
        if (disposed || !containerRef.current) {
          return;
        }
        containerRef.current.innerHTML = svg;
        bindFunctions?.(containerRef.current);
      })
      .catch(() => {
        if (!disposed) {
          setError(true);
        }
      });

    return () => {
      disposed = true;
    };
  }, [chart, id]);

  if (error) {
    return <pre className="diagram-error">{chart}</pre>;
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram"
      aria-label="Flow diagram"
    />
  );
}

export function MarkdownDocument({ content }: { content: string }) {
  return (
    <article className="markdown-document">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const language = /language-([\w-]+)/.exec(className ?? "")?.[1];
            if (language === "mermaid") {
              return (
                <MermaidDiagram chart={String(children).replace(/\n$/, "")} />
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a({ children, ...props }) {
            return (
              <a {...props} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
