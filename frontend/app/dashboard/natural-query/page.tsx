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
const MessageInput = ({ onSend, disabled, placeholder }: any) => (
  <div className="flex gap-2">
    <input
      type="text"
      placeholder={placeholder}
      disabled={disabled}
      className="flex-1 px-3 py-2 border rounded-md"
      onKeyPress={(e) => e.key === 'Enter' && onSend((e.target as HTMLInputElement).value)}
    />
    <button onClick={() => onSend('test')} disabled={disabled}>
      Send
    </button>
  </div>
);
import axios, { AxiosError } from "axios"
import axiosClient from "@/lib/axiosClient"
// Real backend hook for AI queries
const useAskAI = () => ({
  askAI: async (query: string) => {
    try {
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to query AI:', error);
      return { response: 'Failed to get AI response', success: false };
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
  if (error instanceof AxiosError) {
    if (error.response) {
      errMsg = error.response.data.message
    }
  } else if (error instanceof Error) {
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
        "flex gap-4 animate-in fade-in-0 slide-in-from-bottom-4 max-h-[80vh]",
        isUser ? "justify-end" : "justify-start",
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {!isUser && (
        <div className="flex-shrink-0">
          <div className="p-3 bg-primary rounded-2xl text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
        </div>
      )}

      <div
        className={cn(
          "max-w-4xl rounded-2xl px-6 py-4 text-sm break-words prose prose-sm prose-headings:font-semibold prose-p:leading-relaxed prose-pre:bg-muted prose-pre:rounded-xl prose-pre:p-4 prose-table:table-auto prose-th:bg-muted prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-lg"
            : "bg-card border text-card-foreground rounded-tl-lg",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed break-words">{message.content}</p>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || "No results found."}</ReactMarkdown>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0">
          <div className="p-3 bg-secondary rounded-2xl text-secondary-foreground">
            <User className="h-5 w-5" />
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
    <div className="flex gap-4 justify-start items-center animate-in fade-in-0 slide-in-from-bottom-4">
      <div className="p-3 bg-primary rounded-2xl text-primary-foreground">
        <Bot className="h-5 w-5" />
      </div>
      <div className="px-6 py-4 bg-card border rounded-2xl rounded-tl-lg text-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-card-foreground">Thinking...</span>
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
}) => (
  <div className="py-4 max-w-3xl w-full mx-auto">
    <form onSubmit={onSubmit} className="flex w-full gap-3">
      <div className="flex-1 relative">
        <MessageInput
          value={input}
          disabled={isTyping}
          onChange={(ev: React.ChangeEvent<HTMLTextAreaElement>) => setInput(ev.target.value)}
          placeholder="Ask something like: 'Show me bank accounts for Acme Inc'"
          className="rounded-md bg-neutral-100"
          rows={4}
          isGenerating={isGenerating}
        />
      </div>
    </form>
  </div>
)

// === Main Component ===
export default function NaturalLanguageQueryChat() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content:
        "Hello! I'm your AI Data Assistant. Ask me anything about your database in plain English — I’ll handle the rest and reply in clear, formatted Markdown.",
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
content: (data?.markdown && data.markdown.trim().length > 0) ? data.markdown : "No results found.",
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
        description="Powered by advanced AI • Real-time database queries"
      />

      {/* Main Content Area */}
      <div className="lg:pl-4 lg:pr-8 w-full flex-1 overflow-y-auto flex flex-col pt-4 max-w-5xl mx-auto">
        {/* Chat Area */}
        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 relative h-[50vh] px-6"
        >
          <ScrollToBottomButton
            showScrollButton={showScrollButton}
            onClick={scrollToBottom}
          />

          <div className="space-y-6 pb-6">
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

        <ChatInput
          input={input}
          isTyping={isTyping}
          onSubmit={handleSubmit}
          setInput={setInput}
          isGenerating={isGenerating}
        />
      </div>
    </div>
  )
}