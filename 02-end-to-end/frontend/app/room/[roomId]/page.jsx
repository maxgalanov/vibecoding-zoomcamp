"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Copy, Play, RotateCcw, ArrowLeft, Check } from "lucide-react"
import { joinRoom, getDefaultCode, updateRoomCode, updateRoomLanguage, executeCode } from "@/lib/api"
import CodeEditor from "@/components/code-editor"
import { useWebSocket } from "@/hooks/use-websocket"

// Debounce delay for persisting code to database (ms)
const CODE_PERSIST_DEBOUNCE_MS = 1000

// Throttle delays for WebSocket messages (ms)
const CODE_WS_THROTTLE_MS = 50    // Send code updates at most every 50ms
const CURSOR_WS_THROTTLE_MS = 100 // Send cursor updates at most every 100ms

const LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
]

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId

  const [username, setUsername] = useState("")
  const [code, setCode] = useState("")
  const [language, setLanguage] = useState("javascript")
  const [participants, setParticipants] = useState([])
  const [output, setOutput] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [remoteCursors, setRemoteCursors] = useState([])
  const [currentUserId, setCurrentUserId] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const { isConnected, lastMessage, sendMessage } = useWebSocket(roomId, username)
  const isRemoteUpdateRef = useRef(false)
  const persistTimerRef = useRef(null)
  const codeThrottleRef = useRef(null)
  const cursorThrottleRef = useRef(null)
  const pendingCodeRef = useRef(null)
  const pendingCursorRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Initialize room and BroadcastChannel
  useEffect(() => {
    const storedUsername = localStorage.getItem("codeInterview_username")
    if (!storedUsername) {
      router.push("/")
      return
    }
    setUsername(storedUsername)

    const initRoom = async () => {
      try {
        const result = await joinRoom(roomId, storedUsername)
        if (result.success) {
          setCode(result.room.code)
          setLanguage(result.room.language)
          setParticipants(result.room.participants)
          const currentUser = result.room.participants.find((p) => p.isCurrentUser)
          if (currentUser) {
            setCurrentUserId(currentUser.id)
          }
        } else {
          setError(result.error || "Failed to join room")
        }
      } catch (err) {
        setError("Failed to load room. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    initRoom()
  }, [roomId, router])

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return

    const { type, data, username: senderUsername } = lastMessage

    switch (type) {
      case "code-update":
        isRemoteUpdateRef.current = true
        setCode(data.code)
        break
      case "language-update":
        isRemoteUpdateRef.current = true
        setLanguage(data.language)
        setCode(data.code)
        break
      case "cursor-update":
        // Don't show cursor for current user (handled locally mostly, but good to filter)
        // Note: cursor-update messages have username inside data, not at top level
        if (data.username === username) return
        setRemoteCursors((prev) => {
          const filtered = prev.filter((c) => c.oderId !== data.oderId)
          return [...filtered, data]
        })
        break
      case "join":
        // Refresh participants list or add locally
        // For now, simpler to just re-fetch or trust the backend to keep us in sync?
        // ideally we just add to list if not present
        // But we lack full participant details in the join event unless we send them.
        // Let's just fetch participants again? Or just toast?
        // The current mock logic didn't really fetch dynamic participants well besides initial load.
        // Let's re-fetch room info to get updated participants list
        joinRoom(roomId, username).then(res => {
          if (res.success) setParticipants(res.room.participants)
        })
        break
      case "leave":
        setParticipants(prev => prev.filter(p => p.username !== senderUsername))
        setRemoteCursors(prev => prev.filter(c => c.username !== senderUsername))
        break
      case "participant-typing":
        // Update typing status for the participant
        if (data.username !== username) {
          setParticipants(prev =>
            prev.map(p =>
              p.username === data.username
                ? { ...p, isTyping: data.isTyping }
                : p
            )
          )
        }
        break
    }
  }, [lastMessage, username, roomId])



  // Handle cursor changes with throttling
  const handleCursorChange = useCallback(
    (cursorData) => {
      if (!currentUserId) return

      const currentUser = participants.find((p) => p.isCurrentUser)
      if (!currentUser) return

      // Store pending cursor data
      pendingCursorRef.current = {
        type: "cursor-update",
        data: {
          oderId: currentUserId,
          username: currentUser.username,
          position: cursorData.position,
          selectionStart: cursorData.selectionStart,
          selectionEnd: cursorData.selectionEnd,
          cursorColor: currentUser.cursorColor,
          selectionColor: currentUser.selectionColor,
        },
      }

      // Throttle: only send if not already scheduled
      if (!cursorThrottleRef.current) {
        cursorThrottleRef.current = setTimeout(() => {
          if (pendingCursorRef.current) {
            sendMessage(pendingCursorRef.current)
            pendingCursorRef.current = null
          }
          cursorThrottleRef.current = null
        }, CURSOR_WS_THROTTLE_MS)
      }
    },
    [currentUserId, participants, sendMessage],
  )

  // Handle code changes - throttle WebSocket, debounce database writes
  const handleCodeChange = useCallback(
    (newCode) => {
      setCode(newCode)

      if (!isRemoteUpdateRef.current) {
        // Typing indicator logic
        if (!isTyping) {
          setIsTyping(true)
          sendMessage({
            type: "typing-start",
            data: { username },
          })
        }

        // Clear existing typing timeout and set a new one
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false)
          sendMessage({
            type: "typing-stop",
            data: { username },
          })
        }, 3000) // Stop typing after 3 seconds of inactivity

        // Store pending code for throttled send
        pendingCodeRef.current = newCode

        // Throttle WebSocket broadcast (send at most every CODE_WS_THROTTLE_MS)
        if (!codeThrottleRef.current) {
          // Send immediately on first change
          sendMessage({
            type: "code-update",
            data: { code: newCode },
          })

          codeThrottleRef.current = setTimeout(() => {
            // Send latest pending code if different from what we sent
            if (pendingCodeRef.current !== null) {
              sendMessage({
                type: "code-update",
                data: { code: pendingCodeRef.current },
              })
              pendingCodeRef.current = null
            }
            codeThrottleRef.current = null
          }, CODE_WS_THROTTLE_MS)
        }

        // Debounce database persistence to avoid excessive writes
        if (persistTimerRef.current) {
          clearTimeout(persistTimerRef.current)
        }
        persistTimerRef.current = setTimeout(() => {
          updateRoomCode(roomId, newCode)
        }, CODE_PERSIST_DEBOUNCE_MS)
      }
      isRemoteUpdateRef.current = false
    },
    [roomId, sendMessage, isTyping, username],
  )

  // Handle language change
  const handleLanguageChange = async (newLanguage) => {
    setLanguage(newLanguage)
    const result = await updateRoomLanguage(roomId, newLanguage)
    if (result.success) {
      setCode(result.code)

      // Broadcast via WebSocket
      sendMessage({
        type: "language-update",
        data: { language: newLanguage, code: result.code },
      })
    }
  }

  // Reset code to default
  const handleReset = () => {
    const defaultCode = getDefaultCode(language)
    setCode(defaultCode)
    updateRoomCode(roomId, defaultCode)
    setOutput("")

    if (isConnected) {
      sendMessage({
        type: "code-update",
        data: { code: defaultCode },
      })
    }
  }

  // Execute code (all execution happens client-side via WASM)
  const handleRun = async () => {
    setIsRunning(true)
    setOutput("")

    try {
      const result = await executeCode(code, language, {
        onPyodideLoading: () => setOutput("Loading Python runtime..."),
      })
      setOutput(result.output)
    } catch (err) {
      setOutput("Execution failed. Please try again.")
    } finally {
      setIsRunning(false)
    }
  }

  // Copy room link
  const handleCopyLink = async () => {
    const link = `${window.location.origin}/room/${roomId}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading room...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button onClick={() => router.push("/")} variant="secondary">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-sm">Room: {roomId}</h1>
            <p className="text-xs text-muted-foreground">Logged in as {username}</p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2 bg-transparent">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy Link"}
        </Button>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Code editor */}
        <div className="flex-1 flex flex-col border-r">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1">
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            </div>

            <Button size="sm" onClick={handleRun} disabled={isRunning} className="gap-1">
              <Play className="h-3 w-3" />
              {isRunning ? "Running..." : "Run"}
            </Button>
          </div>

          {/* Code editor */}
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              value={code}
              onChange={handleCodeChange}
              language={language}
              onCursorChange={handleCursorChange}
              remoteCursors={remoteCursors}
            />
          </div>

          {/* Output panel */}
          <div className="h-32 border-t bg-muted/20">
            <div className="px-4 py-2 border-b bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">Output</span>
            </div>
            <pre className="p-4 text-sm font-mono overflow-auto h-[calc(100%-36px)] whitespace-pre-wrap">
              {output || "Click 'Run' to execute your code"}
            </pre>
          </div>
        </div>

        {/* Right: Participants */}
        <aside className="w-64 flex flex-col bg-card">
          <div className="px-4 py-3 border-b">
            <h2 className="font-medium text-sm">Participants</h2>
            <p className="text-xs text-muted-foreground">{participants.length} in room</p>
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-1">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor:
                        participant.cursorColor || (participant.status === "active" ? "#22c55e" : "#eab308"),
                    }}
                  />
                  <span className="text-sm">
                    {participant.username}
                    {participant.isCurrentUser && <span className="text-muted-foreground ml-1">(You)</span>}
                  </span>
                </div>
                {participant.isTyping && (
                  <Badge variant="secondary" className="text-xs">
                    typing...
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  )
}
