import katex from 'katex';
import { Brain, Check, ChevronDown, ChevronUp, Clipboard } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { theme } from '../theme';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Map common language aliases to Prism language identifiers
const languageMap: Record<string, string> = {
  'js': 'javascript',
  'jsx': 'jsx',
  'ts': 'typescript',
  'tsx': 'tsx',
  'py': 'python',
  'rb': 'ruby',
  'sh': 'bash',
  'shell': 'bash',
  'zsh': 'bash',
  'yml': 'yaml',
  'md': 'markdown',
  'json': 'json',
  'html': 'markup',
  'xml': 'markup',
  'svg': 'markup',
};

const getPrettyLanguageName = (lang: string): string => {
  const prettyNames: Record<string, string> = {
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'python': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C',
    'csharp': 'C#',
    'go': 'Go',
    'rust': 'Rust',
    'swift': 'Swift',
    'kotlin': 'Kotlin',
    'ruby': 'Ruby',
    'php': 'PHP',
    'bash': 'Bash',
    'sql': 'SQL',
    'json': 'JSON',
    'yaml': 'YAML',
    'markdown': 'Markdown',
    'html': 'HTML',
    'css': 'CSS',
    'jsx': 'JSX',
    'tsx': 'TSX',
  };
  return prettyNames[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
};

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Settings from localStorage (managed in Settings page)
  let mathLatexEnabled = true;
  let katexOnlyEnabled = false;
  try {
    const m = localStorage.getItem('mathLatexEnabled');
    const k = localStorage.getItem('katexOnlyEnabled');
    if (m != null) mathLatexEnabled = m === '1';
    if (k != null) katexOnlyEnabled = k === '1';
  } catch { }

  // Post-render cleanup: remove any spacing artifacts from the DOM
  useEffect(() => {
    if (!containerRef.current || (!mathLatexEnabled && !katexOnlyEnabled)) return;

    const cleanupTimeout = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      // Pattern to match spacing commands
      const spacingPattern = /\/\s*\[[\d.]+[a-zA-Z]+\]|\[[\d.]+(?:pt|em|cm|mm|in|ex)\]/;

      // Find all text nodes containing spacing patterns
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      );

      const nodesToClean: Text[] = [];
      let node: Node | null;

      while ((node = walker.nextNode())) {
        if (node.textContent && spacingPattern.test(node.textContent)) {
          nodesToClean.push(node as Text);
        }
      }

      // Clean or remove the nodes
      nodesToClean.forEach(textNode => {
        if (textNode.textContent) {
          const cleaned = textNode.textContent
            .replace(/\/\s*\[[\d.]+[a-zA-Z]+\]/g, '')
            .replace(/\[[\d.]+(?:pt|em|cm|mm|in|ex)\]/g, '')
            .trim();

          if (cleaned) {
            textNode.textContent = cleaned;
          } else {
            textNode.remove();
          }
        }
      });

      // Remove any .katex-error elements containing spacing patterns
      const errors = container.querySelectorAll('.katex-error');
      errors.forEach(error => {
        const text = error.textContent || '';
        if (spacingPattern.test(text) || text.length < 10) {
          error.remove();
        }
      });

      // Remove any standalone error spans that only contain brackets/spacing
      const spans = container.querySelectorAll('span');
      spans.forEach(span => {
        const text = (span.textContent || '').trim();
        if (spacingPattern.test(text) && text.length < 15) {
          span.remove();
        }
      });
    }, 150); // Slightly longer delay to ensure complete rendering

    return () => clearTimeout(cleanupTimeout);
  }, [content, mathLatexEnabled, katexOnlyEnabled]);

  const handleCopyCode = async (code: string, lang: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(`${lang}-${code.slice(0, 50)}`);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Preprocess content
  // 1) Convert <think>/<reason>/<reasoning> blocks to fenced code with language 'reasoning'
  //    Handle both full tags and closing-only tags (</think>)
  // 2) Normalize LaTeX delimiters for remark-math.
  const baseProcessed = content
    // Handle full tags: <think>...</think>
    .replace(/<\s*(think|reason|reasoning)\s*>[\s\n]*([\s\S]*?)[\s\n]*<\s*\/\s*(think|reason|reasoning)\s*>/gi, (_m, _o1, inner) => {
      const cleaned = String(inner).trim();
      return `\n\n\`\`\`reasoning\n${cleaned}\n\`\`\`\n\n`;
    })
    // Handle closing-only tags: </think> (treat everything before it as reasoning)
    .replace(/^([\s\S]*?)<\s*\/\s*(think|reason|reasoning)\s*>/i, (_m, inner) => {
      const cleaned = String(inner).trim();
      if (cleaned) {
        return `\n\n\`\`\`reasoning\n${cleaned}\n\`\`\`\n\n`;
      }
      return '';
    })
  let processedContent = baseProcessed;
  if (mathLatexEnabled || katexOnlyEnabled) {
    // Helper function to clean LaTeX spacing commands without breaking math commands
    const cleanLatexSpacing = (text: string) => {
      return text
        // Only clean spacing commands: \\[...] but NOT \command[...]
        .replace(/\\\\\s*\[[\d.]+(?:pt|em|cm|mm|in|ex|pc|bp|dd|cc|sp)\]/g, ' ')
        // Clean standalone spacing brackets
        .replace(/(?<![a-zA-Z])\[[\d.]+(?:pt|em|cm|mm|in|ex|pc|bp|dd|cc|sp)\]/g, ' ')
        // Clean forward slash spacing
        .replace(/\/\s*\[[\d.]+(?:pt|em|cm|mm|in|ex|pc|bp|dd|cc|sp)\]/g, ' ')
        // Standalone backslash-backslash at end of line
        .replace(/\\\\\s*$/gm, ' ')
        .replace(/\\\\\s+/g, ' ');
    };

    processedContent = baseProcessed
      // Convert \[...\] to $$...$$ for display math
      .replace(/\\\[([\s\S]{2,}?)\\\]/g, (_: any, math: string) => {
        const cleaned = cleanLatexSpacing(math).trim();
        try {
          const html = katex.renderToString(cleaned, {
            displayMode: true,
            throwOnError: false,
            errorColor: '#94a3b8',
            strict: false,
            trust: true,
            output: 'html'
          });
          return `<div class="math-display">${html}</div>`;
        } catch (e) {
          return `$$${cleaned}$$`;
        }
      })
      // Convert \(...\) to $...$ for inline math
      .replace(/\\\(([\s\S]{1,}?)\\\)/g, (_: any, math: string) => {
        const cleaned = cleanLatexSpacing(math).trim();
        try {
          const html = katex.renderToString(cleaned, {
            displayMode: false,
            throwOnError: false,
            errorColor: '#94a3b8',
            strict: false,
            trust: true,
            output: 'html'
          });
          return `<span class="math-inline">${html}</span>`;
        } catch (e) {
          return `$${cleaned}$`;
        }
      })
      // Render display math $$...$$
      .replace(/\$\$([\s\S]+?)\$\$/g, (_: any, math: string) => {
        const cleaned = cleanLatexSpacing(math).trim();
        try {
          const html = katex.renderToString(cleaned, {
            displayMode: true,
            throwOnError: false,
            errorColor: '#94a3b8',
            strict: false,
            trust: true,
            output: 'html'
          });
          return `<div class="math-display">${html}</div>`;
        } catch (e) {
          return `$$${cleaned}$$`;
        }
      })
      // Render inline math $...$
      .replace(/\$([^\$\n]+?)\$/g, (_: any, math: string) => {
        const cleaned = cleanLatexSpacing(math).trim();
        try {
          const html = katex.renderToString(cleaned, {
            displayMode: false,
            throwOnError: false,
            errorColor: '#94a3b8',
            strict: false,
            trust: true,
            output: 'html'
          });
          return `<span class="math-inline">${html}</span>`;
        } catch (e) {
          return `$${cleaned}$`;
        }
      });
  }

  return (
    <div
      ref={containerRef}
      className={`markdown-content ${className}`}
      style={{
        fontSize: '15px',
        lineHeight: '1.7',
        color: theme.colors.text,
        width: '100%',
        maxWidth: '100%',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Code blocks with syntax highlighting
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            // Check if it's a code block: has language class OR contains newlines (multi-line)
            const isCodeBlock = !!match || codeString.includes('\n');
            const inline = !isCodeBlock;
            const rawLang = match ? match[1].toLowerCase() : '';
            const lang = languageMap[rawLang] || rawLang || 'text';
            const prettyLang = getPrettyLanguageName(lang);
            const codeKey = `${lang}-${codeString.slice(0, 50)}`;
            const isCopied = copiedCode === codeKey;
            const isReasoning = ['reason', 'reasoning', 'thinking', 'think', 'chain', 'thoughts'].includes(rawLang);
            const isMathFence = ['math', 'latex', 'tex', 'katex'].includes(rawLang);

            // Fenced math: render via KaTeX in display mode (only when enabled)
            if (!inline && match && isMathFence && (mathLatexEnabled || katexOnlyEnabled)) {
              let html = '';
              try {
                html = katex.renderToString(codeString, {
                  displayMode: true,
                  throwOnError: false,
                  errorColor: '#94a3b8',
                  strict: false,
                  trust: true,
                  output: 'html'
                });
              } catch (e) {
                html = `<pre style="color: #94a3b8;">${codeString.replace(/</g, '&lt;')}</pre>`;
              }
              return (
                <div style={{ margin: '16px 0', padding: '12px 14px', borderRadius: 12, border: `1px solid ${theme.colors.border}`, background: 'rgba(255,255,255,0.03)' }}>
                  <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              );
            }

            if (!inline && match && isReasoning) {
              const reasoningContent = codeString.trim() || 'Nothing to think, Skipped Reasoning';
              return (
                <div style={{
                  margin: '16px 0',
                  borderRadius: 14,
                  border: `1px solid rgba(255,255,255,0.1)`,
                  background: 'rgba(255,255,255,0.02)',
                  overflow: 'hidden',
                  width: '100%',
                  maxWidth: '100%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}>
                  <button
                    onClick={() => setReasoningOpen(!reasoningOpen)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      border: 'none',
                      background: 'rgba(255,255,255,0.04)',
                      color: theme.colors.text,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      borderBottom: reasoningOpen ? `1px solid rgba(255,255,255,0.08)` : 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.06)',
                      }}>
                        <Brain size={16} color={theme.colors.text} strokeWidth={2.5} />
                      </div>
                      <strong style={{
                        fontSize: 14,
                        letterSpacing: 0.2,
                        fontWeight: '600',
                      }}>
                        Reasoning Process
                      </strong>
                    </span>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: theme.colors.textMuted,
                      fontSize: 12,
                    }}>
                      <span style={{ fontWeight: 500 }}>
                        {reasoningOpen ? 'Hide' : 'Show'}
                      </span>
                      {reasoningOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>
                  {reasoningOpen && (
                    <div style={{
                      maxHeight: 500,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      background: 'rgba(0,0,0,0.2)',
                    }}>
                      <div style={{
                        padding: '20px 18px',
                        fontSize: 14,
                        lineHeight: 1.7,
                        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        color: 'rgba(255,255,255,0.9)',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        maxWidth: '100%',
                        letterSpacing: '0.01em',
                      }}>
                        {reasoningContent}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // If there's a match (language specified) or if inline prop is explicitly false, it's a code block
            return !inline && (match || codeString.includes('\n')) ? (
              <div style={{
                marginBottom: '16px',
                marginTop: '16px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: `1px solid ${theme.colors.border}`,
                background: 'rgba(255, 255, 255, 0.03)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '8px 16px',
                  borderBottom: `1px solid ${theme.colors.border}`,
                }}>
                  <div style={{
                    fontSize: '12px',
                    color: theme.colors.textMuted,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: theme.colors.primary,
                    }}></span>
                    {prettyLang}
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCopyCode(codeString, lang); }}
                    style={{
                      background: isCopied
                        ? 'rgba(99,102,241,0.15)'
                        : 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${isCopied
                        ? 'rgba(99,102,241,0.35)'
                        : theme.colors.border}`,
                      borderRadius: '6px',
                      padding: '6px 12px',
                      color: isCopied ? theme.colors.primary : theme.colors.text,
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCopied) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCopied) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      }
                    }}
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Clipboard size={14} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div style={{ maxHeight: 480, overflow: 'auto' }}>
                  <SyntaxHighlighter
                    style={vscDarkPlus as any}
                    language={lang}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      padding: '16px',
                      background: 'transparent',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                      minWidth: '100%'
                    }}
                    showLineNumbers={codeString.split('\n').length > 3}
                    wrapLines
                    {...props}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : (
              // Inline code
              <code
                className={className}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  color: theme.colors.text,
                  padding: '3px 7px',
                  borderRadius: '5px',
                  fontSize: '0.9em',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                  fontWeight: '500',
                  border: `1px solid ${theme.colors.border}`,
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          // Headings
          h1: ({ children }) => (
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              marginTop: '24px',
              marginBottom: '16px',
              color: theme.colors.text,
              borderBottom: `1px solid ${theme.colors.border}`,
              paddingBottom: '8px',
            }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginTop: '20px',
              marginBottom: '12px',
              color: theme.colors.text,
            }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              marginTop: '16px',
              marginBottom: '10px',
              color: theme.colors.text,
            }}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginTop: '14px',
              marginBottom: '8px',
              color: theme.colors.text,
            }}>
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 style={{
              fontSize: '16px',
              fontWeight: '600',
              marginTop: '12px',
              marginBottom: '6px',
              color: theme.colors.text,
            }}>
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 style={{
              fontSize: '15px',
              fontWeight: '600',
              marginTop: '10px',
              marginBottom: '6px',
              color: theme.colors.text,
            }}>
              {children}
            </h6>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p style={{
              marginTop: '0',
              marginBottom: '0',
              color: theme.colors.text,
              lineHeight: '1.7',
              whiteSpace: 'pre-wrap',
            }}>
              {children}
            </p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul style={{
              marginLeft: '24px',
              marginBottom: '12px',
              listStyleType: 'disc',
              color: theme.colors.text,
            }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol style={{
              marginLeft: '24px',
              marginBottom: '12px',
              color: theme.colors.text,
            }}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li style={{
              marginBottom: '6px',
              color: theme.colors.text,
              lineHeight: '1.6',
            }}>
              {children}
            </li>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: theme.colors.accentBlue,
                textDecoration: 'underline',
                fontWeight: '500',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#60A5FA'}
              onMouseLeave={(e) => e.currentTarget.style.color = theme.colors.accentBlue}
            >
              {children}
            </a>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote style={{
              borderLeft: `4px solid ${theme.colors.border}`,
              paddingLeft: '16px',
              marginLeft: '0',
              marginBottom: '12px',
              marginTop: '12px',
              color: theme.colors.textMuted,
              fontStyle: 'italic',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '0 8px 8px 0',
              padding: '12px 16px',
            }}>
              {children}
            </blockquote>
          ),

          // Tables
          table: ({ children }) => (
            <div style={{
              overflowX: 'auto',
              marginBottom: '16px',
              marginTop: '16px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
            }}>
              <table style={{
                borderCollapse: 'collapse',
                width: '100%',
              }}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead style={{
              background: 'rgba(255,255,255,0.04)',
            }}>
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody>
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr style={{
              borderBottom: `1px solid ${theme.colors.border}`,
            }}>
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th style={{
              border: `1px solid ${theme.colors.border}`,
              padding: '10px 14px',
              fontWeight: '600',
              textAlign: 'left',
              color: theme.colors.text,
            }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{
              border: `1px solid ${theme.colors.border}`,
              padding: '10px 14px',
              color: theme.colors.text,
            }}>
              {children}
            </td>
          ),

          // Horizontal rules
          hr: () => (
            <hr style={{
              border: 'none',
              borderTop: `1px solid ${theme.colors.border}`,
              margin: '20px 0',
            }} />
          ),

          // Strong and emphasis
          strong: ({ children }) => (
            <strong style={{
              fontWeight: '700',
              color: theme.colors.text,
            }}>
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em style={{
              fontStyle: 'italic',
              color: theme.colors.textMuted,
            }}>
              {children}
            </em>
          ),

          // Strikethrough (GFM)
          del: ({ children }) => (
            <del style={{
              textDecoration: 'line-through',
              color: theme.colors.textMuted,
            }}>
              {children}
            </del>
          ),

          // Task lists (GFM)
          input: (props) => (
            <input
              {...props}
              style={{
                marginRight: '8px',
                cursor: props.checked !== undefined ? 'not-allowed' : 'default',
              }}
              disabled
            />
          ),


          // Pre tag (wraps code blocks)
          pre: ({ children }) => (
            <div style={{ position: 'relative' }}>
              {children}
            </div>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
