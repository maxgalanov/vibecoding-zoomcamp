"use client"

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useRouter, useParams } from "next/navigation"
import HomePage from "@/app/page"
import RoomPage from "@/app/room/[roomId]/page"
import * as mockBackend from "@/lib/api"


// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}))

// Mock API
jest.mock("@/lib/api", () => ({
  createRoom: jest.fn(),
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
  return function MockCodeEditor({ value, onChange }) {
    return <textarea data-testid="code-textarea" value={value} onChange={(e) => onChange(e.target.value)} />
  }
})

describe("Full Application Flow", () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    useRouter.mockReturnValue({ push: mockPush })

    if (global.BroadcastChannel.reset) {
      global.BroadcastChannel.reset()
    }
  })

  describe("User Journey: Login -> Create Room -> Code -> Run", () => {
    it("should complete full user journey", async () => {
      // Step 1: User visits home page (not logged in)
      const { rerender } = render(<HomePage />)

      expect(screen.getByLabelText("Username")).toBeInTheDocument()

      // Step 2: User enters username and logs in
      fireEvent.change(screen.getByLabelText("Username"), {
        target: { value: "TestUser" },
      })
      fireEvent.click(screen.getByRole("button", { name: "Continue" }))

      expect(localStorage.setItem).toHaveBeenCalledWith("codeInterview_username", "TestUser")

      // Step 3: User creates a room
      localStorage.getItem.mockReturnValue("TestUser")
      mockBackend.createRoom.mockResolvedValue({ roomId: "test123" })

      rerender(<HomePage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Create Room" })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: "Create Room" }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/room/test123")
      })
    })
  })

  describe("User Journey: Join Room via Link", () => {
    it("should allow joining room via link input", async () => {
      localStorage.getItem.mockReturnValue("JoiningUser")

      render(<HomePage />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Join existing room/)).toBeInTheDocument()
      })

      fireEvent.change(screen.getByLabelText(/Join existing room/), {
        target: { value: "http://localhost:3000/room/shared123" },
      })

      fireEvent.click(screen.getByRole("button", { name: "Join Room" }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/room/shared123")
      })
    })
  })

  describe("Room Collaboration Flow", () => {
    const mockRoomData = {
      success: true,
      room: {
        id: "collab-room",
        code: "// Collaborative code",
        language: "javascript",
        participants: [
          { id: "user-1", username: "User1", isCurrentUser: true, cursorColor: "#e91e63" },
          { id: "user-2", username: "User2", cursorColor: "#2196f3" },
        ],
      },
    }

    beforeEach(() => {
      localStorage.getItem.mockReturnValue("User1")
      useParams.mockReturnValue({ roomId: "collab-room" })
      mockBackend.joinRoom.mockResolvedValue(mockRoomData)
      mockBackend.updateRoomCode.mockResolvedValue({ success: true })
      mockBackend.executeCode.mockResolvedValue({ output: "Result: 42" })
    })

    it("should display room with participants", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("User1")).toBeInTheDocument()
        expect(screen.getByText("User2")).toBeInTheDocument()
        expect(screen.getByText("2 in room")).toBeInTheDocument()
      })
    })

    it("should allow code editing", async () => {
      jest.useFakeTimers()

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByTestId("code-textarea")).toBeInTheDocument()
      })

      fireEvent.change(screen.getByTestId("code-textarea"), {
        target: { value: "console.log('Hello')" },
      })

      // Advance timers to trigger debounced updateRoomCode
      jest.advanceTimersByTime(1100)

      await waitFor(() => {
        expect(mockBackend.updateRoomCode).toHaveBeenCalledWith("collab-room", "console.log('Hello')")
      })

      jest.useRealTimers()
    })

    it("should allow code execution", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Run/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: /Run/i }))

      await waitFor(() => {
        expect(screen.getByText("Result: 42")).toBeInTheDocument()
      })
    })
  })

  describe("Error Handling Flow", () => {
    it("should handle room creation failure gracefully", async () => {
      localStorage.getItem.mockReturnValue("TestUser")
      mockBackend.createRoom.mockRejectedValue(new Error("Network error"))

      render(<HomePage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Create Room" })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: "Create Room" }))

      await waitFor(() => {
        expect(screen.getByText(/Failed to create room/)).toBeInTheDocument()
      })

      // App should not freeze - user can try again
      expect(screen.getByRole("button", { name: "Create Room" })).not.toBeDisabled()
    })

    it("should handle room join failure gracefully", async () => {
      localStorage.getItem.mockReturnValue("TestUser")
      useParams.mockReturnValue({ roomId: "failing-room" })
      mockBackend.joinRoom.mockResolvedValue({ success: false })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("Failed to join room")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Go Home" })).toBeInTheDocument()
      })
    })

    it("should handle code execution failure gracefully", async () => {
      localStorage.getItem.mockReturnValue("TestUser")
      useParams.mockReturnValue({ roomId: "exec-fail-room" })
      mockBackend.joinRoom.mockResolvedValue({
        success: true,
        room: {
          id: "exec-fail-room",
          code: "// Code",
          language: "javascript",
          participants: [{ id: "user-1", username: "TestUser", isCurrentUser: true }],
        },
      })
      mockBackend.executeCode.mockRejectedValue(new Error("Execution failed"))

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Run/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: /Run/i }))

      await waitFor(() => {
        expect(screen.getByText(/Execution failed/)).toBeInTheDocument()
      })

      // Run button should be re-enabled after failure
      expect(screen.getByRole("button", { name: /Run/i })).not.toBeDisabled()
    })
  })
})

describe("localStorage and Session Handling", () => {
  beforeEach(() => {
    localStorage.clear()
    useRouter.mockReturnValue({ push: jest.fn() })
  })

  it("should persist username across page reloads", () => {
    // First render - login
    localStorage.getItem.mockReturnValue(null)
    const { rerender } = render(<HomePage />)

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "PersistentUser" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(localStorage.setItem).toHaveBeenCalledWith("codeInterview_username", "PersistentUser")

    // Second render - should be logged in
    localStorage.getItem.mockReturnValue("PersistentUser")
    rerender(<HomePage />)

    expect(screen.getByText("PersistentUser")).toBeInTheDocument()
  })

  it("should clear session on logout", () => {
    localStorage.getItem.mockReturnValue("LoggingOutUser")

    render(<HomePage />)

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }))

    expect(localStorage.removeItem).toHaveBeenCalledWith("codeInterview_username")
  })
})

describe("Clipboard API", () => {
  beforeEach(() => {
    localStorage.getItem.mockReturnValue("TestUser")
    useParams.mockReturnValue({ roomId: "clipboard-test" })
    mockBackend.joinRoom.mockResolvedValue({
      success: true,
      room: {
        id: "clipboard-test",
        code: "// Code",
        language: "javascript",
        participants: [{ id: "user-1", username: "TestUser", isCurrentUser: true }],
      },
    })
  })

  it("should copy room link using clipboard API", async () => {
    render(<RoomPage />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Copy Link/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /Copy Link/i }))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("http://localhost:3000/room/clipboard-test")
    })
  })
})
