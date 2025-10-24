"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  Bot,
  User,
  Loader2,
  ArrowDown,
  RefreshCwIcon,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { PageHeader } from "@/components/custom/PageHeader"
// Real MessageInput component
const MessageInput = ({ 
  value, 
  onChange, 
  onSend, 
  disabled, 
  placeholder, 
  className,
  rows = 1,
  isGenerating 
}: { 
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: (message: string) => void; 
  disabled: boolean; 
  placeholder: string;
  className?: string;
  rows?: number;
  isGenerating?: boolean;
}) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && onSend) {
        onSend(value.trim());
      }
    }
  };

  const handleSend = () => {
    if (value.trim() && onSend) {
      onSend(value.trim());
    }
  };

  return (
    <div className="flex gap-2 w-full">
      <textarea
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={onChange}
        onKeyPress={handleKeyPress}
        rows={rows}
        className={`flex-1 px-4 py-3 border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      />
      <Button 
        onClick={handleSend} 
        disabled={disabled || !value.trim() || isGenerating}
        className="px-6 py-3 h-auto"
        type="button"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Send"
        )}
      </Button>
    </div>
  );
};
// Client-side AI query hook (Azure flow: analyze → sql)
const useAskAI = () => ({
  askAI: async (query: string) => {
    try {
      // 1) Decision/analysis (db selection + rationale + plan)
      const analysisRes = await fetch('/api/ai/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query })
      });
      if (!analysisRes.ok) throw new Error(`Failed analysis: ${analysisRes.status}`);
      const analysis = await analysisRes.json();

      // 2) SQL generation with plan
      const response = await fetch('/api/natural-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, plan: analysis?.plan })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // If the new backend shape is returned, transform to markdown (include analysis answer)
      if (result && (result.db_name || result.sql)) {
        const db = result.db_name || analysis?.db_name || 'unknown';
        const sql = result.sql || '';
        const params = Array.isArray(result.params) ? result.params : [];
        const notes = typeof result.notes === 'string' ? result.notes : '';
        const answer = typeof analysis?.answer === 'string' ? analysis.answer : '';
        const rationale = typeof analysis?.rationale === 'string' ? analysis.rationale : '';

        const suggestions: string[] = [
          `Filter by date range (e.g., "in June 2025")`,
          `Add a LIMIT if you want fewer rows`,
          `Ask for a count instead of full rows`,
        ];

        const markdown = `## Detected database: ${db}\n\n` +
          `### Question\n\n${query}\n\n` +
          (answer ? `### Answer\n\n${answer}\n\n` : '') +
          (rationale ? `### Rationale\n\n${rationale}\n\n` : '') +
          (sql ? `### SQL\n\n\`\`\`sql\n${sql}\n\`\`\`\n\n` : '') +
          (params.length ? `### Params\n\n- ${params.map((p: any) => `\`${String(p)}\``).join(' | ')}\n\n` : '') +
          (notes ? `### Notes\n\n${notes}\n\n` : '') +
          `### Tips\n\n- ${suggestions.join('\n- ')}`;

        return { data: { markdown, sql, question: query, copyableQuestion: query, copyableAnswer: markdown } } as any;
      }

      // Otherwise, pass through legacy shape
      return result;
    } catch (error) {
      return { message: 'Failed to get AI response', success: false };
    }
  }
});
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm" // For tables, strikethrough, etc.

// Custom markdown component with copy button for SQL blocks
const CustomMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('SQL copied to clipboard')
    } catch (err) {
      toast.error('Failed to copy SQL')
    }
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: ({ className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '')
          const language = match ? match[1] : ''
          const code = String(children).replace(/\n$/, '')
          const inline = !className?.includes('language-')
          
          if (!inline && language === 'sql') {
            return (
              <div className="relative group">
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => copyToClipboard(code)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )
          }
          
          return (
            <code className={className} {...props}>
              {children}
            </code>
          )
        }
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// === Types ===
type Message = {
  id: string
  type: "user" | "ai"
  content: string
  meta?: {
    question?: string
    copyableQuestion?: string
    copyableAnswer?: string
    sql?: string
  }
}

// === API Response Type (Updated) ===
type QueryResponse = {
  message?: string
  data?: {
    markdown: string
    sql?: string
    question?: string
    copyableQuestion?: string
    copyableAnswer?: string
  }
}

// === Helper Functions ===
function getServiceErrMsg(error: unknown, message?: string) {
  let errMsg = message
  if (error instanceof Error) {
    if (error.message) {
      errMsg = error.message
    }
  }
  return errMsg
}

// === Components ===
interface MessageItemProps {
  message: Message
  index: number
  onAskAgain?: (q: string) => void
}

const MessageItem: React.FC<MessageItemProps> = ({ message, index, onAskAgain }) => {
  const isUser = message.type === "user"

  return (
    <div
      className={cn(
        "flex gap-3 animate-in fade-in-0 slide-in-from-bottom-4 max-w-5xl mx-auto",
        isUser ? "justify-end" : "justify-start",
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="p-2 bg-primary rounded-full text-primary-foreground shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
        </div>
      )}

      <div
        className={cn(
          "max-w-3xl rounded-2xl px-4 py-3 text-sm break-words prose prose prose-sm prose-headings:font-semibold prose-p:leading-relaxed prose-pre:bg-muted prose-pre:rounded-xl prose-pre:p-3 prose-table:table-auto prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-lg shadow-sm"
            : "bg-card border text-card-foreground rounded-tl-lg shadow-sm",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed break-words">{message.content}</p>
        ) : (
          <CustomMarkdown content={message.content || "No results found."} />
        )}
      </div>

      {/* Per-message controls for AI messages */}
      {!isUser && (
        <div className="flex gap-2 mt-1">
          {message.meta?.sql && (
            <Button
              size={"sm"}
              variant={"default"}
              onClick={async () => {
                try { await navigator.clipboard.writeText(message.meta!.sql!); toast.success('SQL copied'); } catch { toast.error('Failed to copy'); }
              }}
            >
              Copy SQL
            </Button>
          )}
          {(message.meta?.copyableQuestion || message.meta?.question) && (
            <Button
              size={"sm"}
              variant={"outline"}
              onClick={async () => {
                const q = message.meta?.copyableQuestion || message.meta?.question || ""
                try { await navigator.clipboard.writeText(q); toast.success('Question copied'); } catch { toast.error('Failed to copy'); }
              }}
            >
              Copy Question
            </Button>
          )}
          {(message.meta?.copyableAnswer || message.content) && (
            <Button
              size={"sm"}
              variant={"outline"}
              onClick={async () => {
                const a = message.meta?.copyableAnswer || message.content || ""
                try { await navigator.clipboard.writeText(a); toast.success('Answer copied'); } catch { toast.error('Failed to copy'); }
              }}
            >
              Copy Answer
            </Button>
          )}
          {(message.meta?.question || message.meta?.copyableQuestion) && (
            <Button
              size={"sm"}
              variant={"secondary"}
              onClick={async () => {
                const q = message.meta?.question || message.meta?.copyableQuestion || ""
                if (q && onAskAgain) { await onAskAgain(q) }
              }}
            >
              Ask Again
            </Button>
          )}
        </div>
      )}

      {isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="p-2 bg-secondary rounded-full text-secondary-foreground shadow-sm">
            <User className="h-4 w-4" />
          </div>
        </div>
      )}
    </div>
  )
}

interface TypingIndicatorProps {
  isTyping: boolean
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isTyping }) => {
  if (!isTyping) return null

  return (
    <div className="flex gap-3 justify-start items-center animate-in fade-in-0 slide-in-from-bottom-4 max-w-5xl mx-auto">
      <div className="flex-shrink-0 mt-1">
        <div className="p-2 bg-primary rounded-full text-primary-foreground shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
      </div>
      <div className="px-4 py-3 bg-card border rounded-2xl rounded-tl-lg text-sm shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-card-foreground">AI is analyzing your query...</span>
        </div>
      </div>
    </div>
  )
}

interface ScrollToBottomButtonProps {
  showScrollButton: boolean
  onClick: () => void
}

const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  showScrollButton,
  onClick
}) => {
  if (!showScrollButton) return null

  return (
    <Button
      onClick={onClick}
      className="absolute right-4 bottom-4 z-10 flex items-center gap-2 px-4 py-2 text-sm rounded-full shadow-lg hover:shadow-xl transition-all duration-200 opacity-95 group"
    >
      <span className="transform transition-transform group-hover:translate-y-[-2px]">
        Scroll
      </span>
      <div className="transform transition-transform group-hover:translate-y-1">
        <ArrowDown />
      </div>
    </Button>
  )
}

interface ChatInputProps {
  input: string
  isTyping: boolean
  isGenerating: boolean
  onSubmit: (e: React.FormEvent) => void
  setInput: (value: string) => void
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  isTyping,
  onSubmit,
  setInput,
  isGenerating
}) => {
  const handleSend = (message: string) => {
    if (message.trim()) {
      setInput(message);
      onSubmit({ preventDefault: () => {} } as React.FormEvent);
    }
  };

  const exampleQueries = [
    "Top 10 organisations by revenue in 2024",
    "People created in June 2025",
    "Show organisations with email domain 'example.com'",
    "Count organisations by country"
  ];

  const handleExampleClick = (query: string) => {
    setInput(query);
  };

  return (
    <div className="py-4 max-w-4xl w-full mx-auto px-4">
      {/* Example Queries */}
      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-2">Try these examples:</p>
        <div className="flex flex-wrap gap-2">
          {exampleQueries.map((query, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleExampleClick(query)}
              disabled={isTyping || isGenerating}
              className="text-xs h-7"
            >
              {query}
            </Button>
          ))}
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex w-full">
        <MessageInput
          value={input}
          disabled={isTyping}
          onChange={(ev: React.ChangeEvent<HTMLTextAreaElement>) => setInput(ev.target.value)}
          onSend={handleSend}
          placeholder="Ask in plain English: e.g., 'Top 10 organisations by revenue in 2024' or 'People created in June 2025'. The assistant detects the DB (entities/dms) and generates safe, parameterized SQL."
          className="bg-background border-2"
          rows={3}
          isGenerating={isGenerating}
        />
      </form>
    </div>
  )
}

// === Main Component ===
export default function NaturalLanguageQueryChat() {
  const [input, setInput] = useState("")
  const [lastSql, setLastSql] = useState("")
  const [lastResponse, setLastResponse] = useState<{ question?: string; copyableQuestion?: string; copyableAnswer?: string; markdown?: string; sql?: string } | null>(null)
  const [backendOk, setBackendOk] = useState<boolean | null>(null)
  const [vectorServiceOk, setVectorServiceOk] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content: `# Natural Query → SQL Generator 🤖

I convert your natural language into safe, parameterized SQL using **local vector search** and **Azure OpenAI**. I automatically detect whether your query targets the Entities or DMS schema by analyzing relevant schema chunks.

## 🚀 Powered by:
- **Local Vector Search**: Xenova/all-MiniLM-L6-v2 embeddings
- **Azure OpenAI**: GPT-4 for SQL generation
- **Schema Analysis**: Intelligent database detection

## What you can ask

**📊 Analytics:**
- "Top 10 organisations by revenue in 2024"
- "Monthly new people in June 2025"
- "Count organisations by country"

**🧭 Data Discovery:**
- "Show organisations with email domain 'example.com'"
- "People with missing last name"
- "Recent entities created last 7 days"

**💡 Tips:**
- Be specific and include filters (date ranges, names, countries)
- Ask for counts when you want aggregates
- The assistant applies limits to keep results safe
- Vector search finds the most relevant schema context automatically

Ask a question to get the SQL!`,
    },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [retryConfig, setRetryConfig] = useState({
    showRetry: false,
    msg: ""
  })

  const [isGenerating, setIsGenerating] = useState(false)

  const scrollBottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll
  useEffect(() => {
    if (scrollBottomRef.current) {
      scrollBottomRef.current.scrollIntoView({
        behavior: "smooth"
      })
    }
  }, [messages])

  // Health check backend AI service
  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const r = await fetch('/api/ai/health')
        if (!mounted) return
        setBackendOk(r.ok)
      } catch {
        if (!mounted) return
        setBackendOk(false)
      }
    }
    check()
    const id = setInterval(check, 15000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  // Health check vector service (integrated)
  useEffect(() => {
    let mounted = true
    const check = async () => {
      try {
        const r = await fetch('/api/vector-health')
        if (!mounted) return
        setVectorServiceOk(r.ok)
      } catch {
        if (!mounted) return
        setVectorServiceOk(false)
      }
    }
    check()
    const id = setInterval(check, 15000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return

    const handleScroll = () => {
      const isScrolledNearBottom =
        scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight < 100

      setShowScrollButton(!isScrolledNearBottom)
    }

    scrollArea.addEventListener("scroll", handleScroll)
    handleScroll()

    return () => scrollArea.removeEventListener("scroll", handleScroll)
  }, [messages])

  const askAIMutation = useAskAI()

  const askAI = async (input: string) => {
    if (!input.trim()) return

    // toast.info(input)

    const userMessage = input.trim()
    setIsTyping(true)

    setRetryConfig({
      msg: "",
      showRetry: false
    })

    // Add user message
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      type: "user",
      content: userMessage
    }])

    try {
      setIsGenerating(true)
      const data: QueryResponse = await askAIMutation.askAI(userMessage)

      // Add AI response with Markdown content
      const aiContent = (data?.data?.markdown && data.data.markdown.trim().length > 0)
        ? data.data.markdown
        : (data as any)?.markdown && (data as any).markdown.trim().length > 0
          ? (data as any).markdown
          : "No results found."

      const respData = data?.data
      let meta: Message["meta"] = undefined
      if (respData) {
        setLastSql(respData.sql || "")
        meta = {
          question: respData.question || userMessage,
          copyableQuestion: respData.copyableQuestion || respData.question || userMessage,
          copyableAnswer: respData.copyableAnswer || respData.markdown || aiContent,
          sql: respData.sql,
        }
      } else {
        const legacySql = (data as any)?.data?.sql || (data as any)?.sql || ""
        const legacyMarkdown = (data as any)?.data?.markdown || (data as any)?.markdown || aiContent
        setLastSql(legacySql)
        meta = {
          question: userMessage,
          copyableQuestion: userMessage,
          copyableAnswer: legacyMarkdown,
          sql: legacySql,
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "ai",
          content: aiContent,
          meta,
        },
      ])

      // Track last response details for copy/re-ask buttons
      if (respData) {
        setLastSql(respData.sql || "")
        setLastResponse({
          question: respData.question,
          copyableQuestion: respData.copyableQuestion || respData.question,
          copyableAnswer: respData.copyableAnswer || respData.markdown || aiContent,
          markdown: respData.markdown,
          sql: respData.sql,
        })
      } else {
        // Legacy path from useAskAI fallback shape
        const legacySql = (data as any)?.data?.sql || (data as any)?.sql || ""
        const legacyMarkdown = (data as any)?.data?.markdown || (data as any)?.markdown || ""
        setLastSql(legacySql)
        setLastResponse({ markdown: legacyMarkdown, sql: legacySql })
      }
    } catch (err: unknown) {
      let errMsg = "No results found"
      if (err instanceof Error) {
        errMsg = err.message
      }

      setRetryConfig({
        msg: input,
        showRetry: true
      })
      // toast.error("Query Failed", { description: errMsg })
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "ai",
          content: `❌ ${errMsg}. Please refine your question or try different filters.`,
        },
      ])
    } finally {
      setInput("")
      setIsTyping(false)
      setIsGenerating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await askAI(input)
  }

  const scrollToBottom = () => {
    scrollBottomRef.current?.scrollIntoView({
      behavior: "smooth"
    })
  }

  return (
    <div className="flex flex-col h-screen max-h-screen bg-background overflow-hidden">
      {/* Header */}
      <PageHeader
        title="AI Query → SQL Generator"
        description="Routes your question to the right DB and returns safe SQL"
      />
      <div className="px-4 md:px-6 pb-2 flex gap-2 flex-wrap">
        {/* Backend AI Status */}
        {backendOk === true && (
          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs bg-green-500 text-white">
            <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
            Backend AI: Connected
          </span>
        )}
        {backendOk === false && (
          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs bg-red-500 text-white">
            <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
            Backend AI: Unavailable
          </span>
        )}
        {backendOk === null && (
          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs bg-gray-500 text-white">
            <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
            Backend AI: Checking…
          </span>
        )}

        {/* Vector Service Status */}
        {vectorServiceOk === true && (
          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs bg-green-500 text-white">
            <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
            Vector Search: Connected
          </span>
        )}
        {vectorServiceOk === false && (
          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs bg-red-500 text-white">
            <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
            Vector Search: Unavailable
          </span>
        )}
        {vectorServiceOk === null && (
          <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs bg-gray-500 text-white">
            <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
            Vector Search: Checking…
          </span>
        )}

        {/* Embeddings Status */}
        <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs bg-blue-500 text-white">
          <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
          Embeddings: {vectorServiceOk === true ? "Local (Xenova)" : "Azure OpenAI"}
        </span>
      </div>

      {/* Main Content Area */}
      <div className="w-full flex-1 overflow-hidden flex flex-col">
        {/* Chat Area */}
        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 relative px-4 md:px-6 h-0"
        >
          <ScrollToBottomButton
            showScrollButton={showScrollButton}
            onClick={scrollToBottom}
          />

          <div className="space-y-6 pb-6 pt-4">
            {messages.map((message, index) => (
              <div key={message.id}>
                <MessageItem
                  message={message}
                  index={index}
                  onAskAgain={askAI}
                />
              </div>
            ))}

            <TypingIndicator isTyping={isTyping} />
          </div>

          <div ref={scrollBottomRef} className="h-4" />
        </ScrollArea>

        {/* Fixed Input Area */}
        <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <ChatInput
            input={input}
            isTyping={isTyping}
            onSubmit={handleSubmit}
            setInput={setInput}
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  )
}