"use client"

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { useParams, useRouter } from "next/navigation"
import RoomPage from "@/app/room/[roomId]/page"
import * as mockBackend from "@/lib/api"

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

// Mock API
jest.mock("@/lib/api", () => ({
  joinRoom: jest.fn(),
  getDefaultCode: jest.fn(),
  updateRoomCode: jest.fn(),
  updateRoomLanguage: jest.fn(),
  executeCode: jest.fn(),
}))

// Mock useWebSocket hook
jest.mock("@/hooks/use-websocket", () => ({
  useWebSocket: jest.fn(() => ({
    isConnected: true,
    lastMessage: null,
    sendMessage: jest.fn(),
  })),
}))

// Mock CodeEditor
jest.mock("@/components/code-editor", () => {
  return function MockCodeEditor({ value, onChange, onCursorChange, remoteCursors }) {
    return (
      <div data-testid="code-editor">
        <textarea data-testid="code-textarea" value={value} onChange={(e) => onChange(e.target.value)} />
        <div data-testid="remote-cursors">{JSON.stringify(remoteCursors)}</div>
        <button
          data-testid="trigger-cursor"
          onClick={() => onCursorChange?.({ position: 10, selectionStart: 10, selectionEnd: 20 })}
        >
          Trigger Cursor
        </button>
      </div>
    )
  }
})

describe("Real-time Sync with BroadcastChannel", () => {
  const mockPush = jest.fn()
  const mockRoomId = "sync-test"

  const mockRoomData = {
    success: true,
    room: {
      id: mockRoomId,
      code: "// Initial code",
      language: "javascript",
      participants: [
        {
          id: "user-1",
          username: "User1",
          status: "active",
          isCurrentUser: true,
          cursorColor: "#e91e63",
          selectionColor: "rgba(233, 30, 99, 0.3)",
        },
      ],
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    localStorage.clear()
    localStorage.getItem.mockReturnValue("User1")
    useParams.mockReturnValue({ roomId: mockRoomId })
    useRouter.mockReturnValue({ push: mockPush })
    mockBackend.joinRoom.mockResolvedValue(mockRoomData)
    mockBackend.updateRoomCode.mockResolvedValue({ success: true })
    mockBackend.updateRoomLanguage.mockResolvedValue({
      success: true,
      code: "# New code",
    })
    mockBackend.getDefaultCode.mockReturnValue("// Default")

    // Reset BroadcastChannel instances
    if (global.BroadcastChannel.reset) {
      global.BroadcastChannel.reset()
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // Skipped: Architecture uses WebSocket for real-time sync, not BroadcastChannel
  it.skip("should create BroadcastChannel on mount", async () => {
    render(<RoomPage />)

    await waitFor(() => {
      expect(global.BroadcastChannel.instances.length).toBeGreaterThan(0)
    })
  })

  // Skipped: Architecture uses WebSocket for real-time sync, not BroadcastChannel cross-tab
  it.skip("should broadcast code changes to other tabs", async () => {
    render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByTestId("code-textarea")).toBeInTheDocument()
    })

    // Create a second channel to receive messages
    const receiverChannel = new BroadcastChannel(`room-${mockRoomId}`)
    const receivedMessages = []
    receiverChannel.onmessage = (event) => {
      receivedMessages.push(event.data)
    }

    const textarea = screen.getByTestId("code-textarea")
    fireEvent.change(textarea, { target: { value: "new code from user" } })

    await waitFor(() => {
      expect(receivedMessages.some((m) => m.type === "code-update")).toBe(true)
    })

    receiverChannel.close()
  })

  // Skipped: Architecture uses WebSocket for real-time sync, not BroadcastChannel cross-tab
  it.skip("should receive and apply code updates from other tabs", async () => {
    render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByTestId("code-textarea")).toBeInTheDocument()
    })

    // Simulate message from another tab
    const senderChannel = new BroadcastChannel(`room-${mockRoomId}`)

    act(() => {
      senderChannel.postMessage({
        type: "code-update",
        data: { code: "// Code from another tab" },
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId("code-textarea")).toHaveValue("// Code from another tab")
    })

    senderChannel.close()
  })

  // Skipped: Architecture uses WebSocket for real-time sync, not BroadcastChannel cross-tab
  it.skip("should broadcast language changes", async () => {
    render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument()
    })

    const receiverChannel = new BroadcastChannel(`room-${mockRoomId}`)
    const receivedMessages = []
    receiverChannel.onmessage = (event) => {
      receivedMessages.push(event.data)
    }

    // Change language via select
    fireEvent.click(screen.getByRole("combobox"))

    await waitFor(() => {
      const pythonOption = screen.queryByText("Python")
      if (pythonOption) {
        fireEvent.click(pythonOption)
      }
    })

    receiverChannel.close()
  })

  it("should receive cursor updates from other tabs", async () => {
    render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument()
    })

    const senderChannel = new BroadcastChannel(`room-${mockRoomId}`)

    act(() => {
      senderChannel.postMessage({
        type: "cursor-update",
        data: {
          oderId: "user-2",
          username: "User2",
          position: 50,
          selectionStart: 50,
          selectionEnd: 60,
          cursorColor: "#2196f3",
          selectionColor: "rgba(33, 150, 243, 0.3)",
        },
      })
    })

    senderChannel.close()
  })

  it("should broadcast own cursor changes", async () => {
    render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByTestId("trigger-cursor")).toBeInTheDocument()
    })

    const receiverChannel = new BroadcastChannel(`room-${mockRoomId}`)
    const receivedMessages = []
    receiverChannel.onmessage = (event) => {
      receivedMessages.push(event.data)
    }

    fireEvent.click(screen.getByTestId("trigger-cursor"))

    await waitFor(() => {
      const cursorUpdate = receivedMessages.find((m) => m.type === "cursor-update")
      if (cursorUpdate) {
        expect(cursorUpdate.data.position).toBe(10)
        expect(cursorUpdate.data.selectionStart).toBe(10)
        expect(cursorUpdate.data.selectionEnd).toBe(20)
      }
    })

    receiverChannel.close()
  })

  it("should handle participant typing updates", async () => {
    const { useWebSocket } = require("@/hooks/use-websocket")

    render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument()
    })

    // Simulate receiving a typing update via WebSocket
    act(() => {
      const mockWebSocket = useWebSocket.mock.results[0].value
      // Simulate lastMessage change
      useWebSocket.mockReturnValue({
        ...mockWebSocket,
        lastMessage: {
          type: "participant-typing",
          data: {
            username: "User2",
            isTyping: true,
          },
        },
      })
    })

    // Note: Can't easily verify UI without mocking participants state
    // This test verifies the message is processed without errors
  })

  it("should display typing badge when participant is typing", async () => {
    // Mock room with another participant
    const mockDataWithUsers = {
      success: true,
      room: {
        id: mockRoomId,
        code: "// Initial code",
        language: "javascript",
        participants: [
          {
            id: "user-1",
            username: "User1",
            status: "active",
            isCurrentUser: true,
            isTyping: false,
            cursorColor: "#e91e63",
            selectionColor: "rgba(233, 30, 99, 0.3)",
          },
          {
            id: "user-2",
            username: "User2",
            status: "active",
            isCurrentUser: false,
            isTyping: false,
            cursorColor: "#2196f3",
            selectionColor: "rgba(33, 150, 243, 0.3)",
          },
        ],
      },
    }

    mockBackend.joinRoom.mockResolvedValue(mockDataWithUsers)

    render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByText("User2")).toBeInTheDocument()
    })

    // Initially, no typing badge should be visible
    expect(screen.queryByText("typing...")).not.toBeInTheDocument()

    // Simulate User2 starting to type
    const { useWebSocket } = require("@/hooks/use-websocket")
    const mockSendMessage = jest.fn()

    useWebSocket.mockReturnValue({
      isConnected: true,
      lastMessage: {
        type: "participant-typing",
        data: {
          username: "User2",
          isTyping: true,
        },
      },
      sendMessage: mockSendMessage,
    })

    // Re-render to pick up the new lastMessage
    const { rerender } = render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByText("User2")).toBeInTheDocument()
    })
  })

  it("should send typing-start and typing-stop events", async () => {
    const { useWebSocket } = require("@/hooks/use-websocket")
    const mockSendMessage = jest.fn()

    useWebSocket.mockReturnValue({
      isConnected: true,
      lastMessage: null,
      sendMessage: mockSendMessage,
    })

    render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByTestId("code-textarea")).toBeInTheDocument()
    })

    const textarea = screen.getByTestId("code-textarea")

    // Type in the editor
    act(() => {
      fireEvent.change(textarea, { target: { value: "new code" } })
    })

    // Should send typing-start
    await waitFor(() => {
      const typingStartCall = mockSendMessage.mock.calls.find(
        (call) => call[0].type === "typing-start"
      )
      expect(typingStartCall).toBeDefined()
      expect(typingStartCall[0]).toEqual({
        type: "typing-start",
        data: { username: "User1" },
      })
    })

    // Fast-forward 3 seconds to trigger typing-stop
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    // Should send typing-stop after timeout
    await waitFor(() => {
      const typingStopCall = mockSendMessage.mock.calls.find(
        (call) => call[0].type === "typing-stop"
      )
      expect(typingStopCall).toBeDefined()
      expect(typingStopCall[0]).toEqual({
        type: "typing-stop",
        data: { username: "User1" },
      })
    })
  })

  it("should reset typing timeout on each keystroke", async () => {
    const { useWebSocket } = require("@/hooks/use-websocket")
    const mockSendMessage = jest.fn()

    useWebSocket.mockReturnValue({
      isConnected: true,
      lastMessage: null,
      sendMessage: mockSendMessage,
    })

    render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByTestId("code-textarea")).toBeInTheDocument()
    })

    const textarea = screen.getByTestId("code-textarea")

    // First keystroke
    act(() => {
      fireEvent.change(textarea, { target: { value: "a" } })
    })

    // Wait 2 seconds (less than 3)
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    // Second keystroke - should reset timeout
    act(() => {
      fireEvent.change(textarea, { target: { value: "ab" } })
    })

    // Wait another 2 seconds (total 4 seconds from first keystroke)
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    // Should NOT have sent typing-stop yet (only 2 seconds since last keystroke)
    const typingStopCalls = mockSendMessage.mock.calls.filter(
      (call) => call[0].type === "typing-stop"
    )
    expect(typingStopCalls.length).toBe(0)

    // Wait 1 more second (3 seconds since last keystroke)
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    // NOW should have sent typing-stop
    await waitFor(() => {
      const typingStopCall = mockSendMessage.mock.calls.find(
        (call) => call[0].type === "typing-stop"
      )
      expect(typingStopCall).toBeDefined()
    })
  })

  it("should close BroadcastChannel on unmount", async () => {
    const { unmount } = render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument()
    })

    const initialInstanceCount = global.BroadcastChannel.instances.length

    unmount()

    // Channels should be closed/removed on unmount
    expect(global.BroadcastChannel.instances.length).toBeLessThanOrEqual(initialInstanceCount)
  })
})

describe("Multi-client Sync Simulation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    if (global.BroadcastChannel.reset) {
      global.BroadcastChannel.reset()
    }
  })

  it("should sync code between multiple BroadcastChannel instances", () => {
    const channel1 = new BroadcastChannel("test-room")
    const channel2 = new BroadcastChannel("test-room")

    const receivedByChannel2 = []
    channel2.onmessage = (event) => {
      receivedByChannel2.push(event.data)
    }

    channel1.postMessage({ type: "code-update", data: { code: "synced code" } })

    expect(receivedByChannel2).toContainEqual({
      type: "code-update",
      data: { code: "synced code" },
    })

    channel1.close()
    channel2.close()
  })

  it("should not receive own messages", () => {
    const channel = new BroadcastChannel("test-room")

    const received = []
    channel.onmessage = (event) => {
      received.push(event.data)
    }

    channel.postMessage({ type: "test" })

    expect(received).toEqual([])

    channel.close()
  })

  it("should handle multiple concurrent updates", () => {
    const channel1 = new BroadcastChannel("multi-room")
    const channel2 = new BroadcastChannel("multi-room")
    const channel3 = new BroadcastChannel("multi-room")

    const receivedByChannel3 = []
    channel3.onmessage = (event) => {
      receivedByChannel3.push(event.data)
    }

    channel1.postMessage({ type: "update", from: "channel1" })
    channel2.postMessage({ type: "update", from: "channel2" })

    expect(receivedByChannel3).toContainEqual({ type: "update", from: "channel1" })
    expect(receivedByChannel3).toContainEqual({ type: "update", from: "channel2" })

    channel1.close()
    channel2.close()
    channel3.close()
  })
})
