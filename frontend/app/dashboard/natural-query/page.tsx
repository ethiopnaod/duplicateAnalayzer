"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  Bot,
  User,
  Loader2,
  ArrowDown,
  RefreshCwIcon,
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
// Client-side AI query hook
const useAskAI = () => ({
  askAI: async (query: string) => {
    try {
      console.log('Sending query to AI:', query);
      const response = await fetch('/api/natural-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('AI Response:', result);
      return result;
    } catch (error) {
      console.error('Failed to query AI:', error);
      return { message: 'Failed to get AI response', success: false };
    }
  }
});
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm" // For tables, strikethrough, etc.

// === Types ===
type Message = {
  id: string
  type: "user" | "ai"
  content: string
}

// === API Response Type (Updated) ===
type QueryResponse = {
  message: string
  data: {
    markdown: string // ← Only this is returned now
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
}

const MessageItem: React.FC<MessageItemProps> = ({ message, index }) => {
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
          "max-w-3xl rounded-2xl px-4 py-3 text-sm break-words prose prose-sm prose-headings:font-semibold prose-p:leading-relaxed prose-pre:bg-muted prose-pre:rounded-xl prose-pre:p-3 prose-table:table-auto prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-lg shadow-sm"
            : "bg-card border text-card-foreground rounded-tl-lg shadow-sm",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed break-words">{message.content}</p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || "No results found."}</ReactMarkdown>
        )}
      </div>

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
    "Show me all organizations",
    "Find duplicate people",
    "List entities with missing names",
    "Count total duplicates"
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
          placeholder="Ask something like: 'Show me all organizations with more than 5 employees' or 'Find duplicates in the people table'"
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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content: `# Welcome to AI Query Assistant! 🤖

I'm your intelligent database assistant powered by Azure OpenAI. I can help you query your database using natural language.

## What you can ask:

**📊 Data Analysis:**
- "Show me all organizations with more than 10 employees"
- "Find the top 5 companies by revenue"
- "List all people in the marketing department"

**🔍 Duplicate Detection:**
- "Find duplicate organizations based on name and email"
- "Show me potential duplicate people with similar phone numbers"
- "List all entities that might be duplicates"

**📈 Reports:**
- "Generate a summary of all organizations"
- "Show me the distribution of people by department"
- "Create a report of duplicate entities"

**💡 Tips:**
- Be specific about what data you want
- Mention filters like dates, departments, or criteria
- Ask for summaries, counts, or detailed lists

Try asking me something about your data!`,
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
      const data = await askAIMutation.askAI(userMessage)

      // Add AI response with Markdown content
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "ai",
          content: (data?.data?.markdown && data.data.markdown.trim().length > 0) ? data.data.markdown : (data?.markdown && data.markdown.trim().length > 0) ? data.markdown : "No results found.",
        },
      ])
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
    <div className="flex flex-col h-screen max-h-screen bg-background">
      {/* Header */}
      <PageHeader
        title="AI Query Assistant"
        description="Powered by Azure OpenAI • Real-time database queries"
      />

      {/* Main Content Area */}
      <div className="w-full flex-1 overflow-hidden flex flex-col">
        {/* Chat Area */}
        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 relative px-4 md:px-6"
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
                />
                {messages.length === index + 1 && message.type === "ai" && retryConfig.showRetry && (
                  <div className="ml-[4rem] mt-1">
                    <Button size={"sm"} variant={"outline"} onClick={async () => {
                      await askAI(retryConfig.msg)
                    }}>
                      <RefreshCwIcon className="h-4 w-4" />
                      <span className="ml-1">Retry</span>
                    </Button>
                  </div>
                )}
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