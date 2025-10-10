import katex from 'katex';
import { Check, Clipboard } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
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
  // Settings from localStorage (managed in Settings page)
  let mathLatexEnabled = true;
  let katexOnlyEnabled = false;
  try {
    const m = localStorage.getItem('mathLatexEnabled');
    const k = localStorage.getItem('katexOnlyEnabled');
    if (m != null) mathLatexEnabled = m === '1';
    if (k != null) katexOnlyEnabled = k === '1';
  } catch {}

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
  //    so our renderer shows them as collapsible sections.
  // 2) Normalize LaTeX delimiters for remark-math.
  const baseProcessed = content
    .replace(/<\s*(think|reason|reasoning)\s*>[\s\n]*([\s\S]*?)[\s\n]*<\s*\/\s*(think|reason|reasoning)\s*>/gi, (_m, _o1, inner) => {
      const cleaned = String(inner).trim();
      // Wrap into fenced code block labeled as reasoning
      return `\n\n\`\`\`reasoning\n${cleaned}\n\`\`\`\n\n`;
    })
  let processedContent = baseProcessed;
  if (mathLatexEnabled || katexOnlyEnabled) {
    processedContent = baseProcessed
      // Convert \[...\] to $$...$$ for display math
      .replace(/\\\[([\s\S]*?)\\\]/g, (_: any, math: string) => `$$${math}$$`)
      // Convert \\(...\\) to $...$ for inline math
      .replace(/\\\(([\s\S]*?)\\\)/g, (_: any, math: string) => `$${math}$`);
  }

  return (
    <div className={`markdown-content ${className}`} style={{ 
      fontSize: '15px', 
      lineHeight: '1.7',
      color: theme.colors.text,
    }}>
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          ...(mathLatexEnabled || katexOnlyEnabled ? [remarkMath] as any : []),
        ]}
        rehypePlugins={(mathLatexEnabled || katexOnlyEnabled)
          ? [[rehypeKatex as any, { strict: false, throwOnError: false, trust: true, fleqn: false }]]
          : []}
        components={{
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
              marginBottom: '12px', 
              color: theme.colors.text,
              lineHeight: '1.7',
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
          
          // Code blocks with syntax highlighting
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const inline = !match;
            const rawLang = match ? match[1].toLowerCase() : '';
            const lang = languageMap[rawLang] || rawLang || 'text';
            const prettyLang = getPrettyLanguageName(lang);
            const codeString = String(children).replace(/\n$/, '');
            const codeKey = `${lang}-${codeString.slice(0, 50)}`;
            const isCopied = copiedCode === codeKey;
            const isReasoning = ['reason', 'reasoning', 'thinking', 'think', 'chain', 'thoughts'].includes(rawLang);
            const isMathFence = ['math', 'latex', 'tex', 'katex'].includes(rawLang);
            
            // Fenced math: render via KaTeX in display mode (only when enabled)
            if (!inline && match && isMathFence && (mathLatexEnabled || katexOnlyEnabled)) {
              let html = '';
              try {
                html = katex.renderToString(codeString, { displayMode: true, throwOnError: false });
              } catch (e) {
                html = `<pre>${codeString.replace(/</g,'&lt;')}</pre>`;
              }
              return (
                <div style={{ margin: '16px 0', padding: '12px 14px', borderRadius: 12, border: `1px solid ${theme.colors.border}`, background: 'rgba(255,255,255,0.03)' }}>
                  <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              );
            }

            if (!inline && match && isReasoning) {
              return (
                <details style={{
                  margin: '12px 0',
                  borderRadius: 12,
                  border: `1px solid ${theme.colors.border}`,
                  background: 'rgba(255,255,255,0.03)'
                }}>
                  <summary style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: `1px solid ${theme.colors.border}`,
                    color: theme.colors.text
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: theme.colors.primary, display: 'inline-block' }} />
                      <strong style={{ fontSize: 12, letterSpacing: 0.4 }}>Reasoning</strong>
                    </span>
                    <span style={{ opacity: 0.7, fontSize: 12 }}>(click to expand)</span>
                  </summary>
                  <pre style={{
                    margin: 0,
                    padding: 14,
                    overflowX: 'auto',
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                    color: theme.colors.text,
                    background: 'transparent'
                  }}>
                    {codeString}
                  </pre>
                </details>
              );
            }

            return !inline && match ? (
              <details style={{ 
                marginBottom: '16px',
                marginTop: '16px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: `1px solid ${theme.colors.border}`,
                background: 'rgba(255, 255, 255, 0.03)'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  userSelect: 'none',
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
                </summary>
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
                  }}
                  showLineNumbers={codeString.split('\n').length > 3}
                  wrapLines
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </details>
            ) : (
              // Inline code
              <code
                className={className}
                style={{
                  background: 'rgba(255,255,255,0.08)',
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
