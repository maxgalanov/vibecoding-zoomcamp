"use client"

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
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

// Mock CodeEditor component
jest.mock("@/components/code-editor", () => {
  return function MockCodeEditor({ value, onChange, language, onCursorChange }) {
    return (
      <div data-testid="code-editor">
        <textarea
          data-testid="code-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-language={language}
        />
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

describe("RoomPage", () => {
  const mockPush = jest.fn()
  const mockRoomId = "test123"

  const mockRoomData = {
    success: true,
    room: {
      id: mockRoomId,
      code: "// Test code",
      language: "javascript",
      participants: [
        {
          id: "user-1",
          username: "TestUser",
          status: "active",
          isCurrentUser: true,
          cursorColor: "#e91e63",
          selectionColor: "rgba(233, 30, 99, 0.3)",
        },
        {
          id: "mock-1",
          username: "Alice",
          status: "active",
          cursorColor: "#2196f3",
          selectionColor: "rgba(33, 150, 243, 0.3)",
        },
        {
          id: "mock-2",
          username: "Bob",
          status: "idle",
          cursorColor: "#4caf50",
          selectionColor: "rgba(76, 175, 80, 0.3)",
        },
      ],
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    localStorage.clear()
    localStorage.getItem.mockReturnValue("TestUser")
    useParams.mockReturnValue({ roomId: mockRoomId })
    useRouter.mockReturnValue({ push: mockPush })
    mockBackend.joinRoom.mockResolvedValue(mockRoomData)
    mockBackend.updateRoomCode.mockResolvedValue({ success: true })
    mockBackend.updateRoomLanguage.mockResolvedValue({
      success: true,
      code: "# Python code",
    })
    mockBackend.getDefaultCode.mockReturnValue("// Default code")
    mockBackend.executeCode.mockResolvedValue({ output: "Test output" })

    // Reset BroadcastChannel instances
    if (global.BroadcastChannel.reset) {
      global.BroadcastChannel.reset()
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("Room Loading", () => {
    it("should redirect to home if no username in localStorage", async () => {
      localStorage.getItem.mockReturnValue(null)

      render(<RoomPage />)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/")
      })
    })

    it("should show loading state initially", () => {
      render(<RoomPage />)

      expect(screen.getByText("Loading room...")).toBeInTheDocument()
    })

    it("should display room after loading", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText(`Room: ${mockRoomId}`)).toBeInTheDocument()
      })
    })

    it("should show error state when room fails to load", async () => {
      mockBackend.joinRoom.mockResolvedValue({ success: false })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("Failed to join room")).toBeInTheDocument()
      })
    })

    it("should show Go Home button on error", async () => {
      mockBackend.joinRoom.mockResolvedValue({ success: false })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Go Home" })).toBeInTheDocument()
      })
    })
  })

  describe("Participants List", () => {
    it("should display all participants", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("TestUser")).toBeInTheDocument()
        expect(screen.getByText("Alice")).toBeInTheDocument()
        expect(screen.getByText("Bob")).toBeInTheDocument()
      })
    })

    it("should show (You) indicator for current user", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("(You)")).toBeInTheDocument()
      })
    })

    it("should display participant count", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByText("3 in room")).toBeInTheDocument()
      })
    })
  })

  describe("Code Editor Actions", () => {
    it("should render code editor with initial code", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByTestId("code-editor")).toBeInTheDocument()
        expect(screen.getByTestId("code-textarea")).toHaveValue("// Test code")
      })
    })

    it("should update code when editor changes", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByTestId("code-textarea")).toBeInTheDocument()
      })

      const textarea = screen.getByTestId("code-textarea")
      fireEvent.change(textarea, { target: { value: "new code" } })

      // Advance timers to trigger debounced updateRoomCode
      jest.advanceTimersByTime(1100)

      await waitFor(() => {
        expect(mockBackend.updateRoomCode).toHaveBeenCalledWith(mockRoomId, "new code")
      })
    })

    it("should have language selector", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("combobox")).toBeInTheDocument()
      })
    })

    it("should have reset button", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Reset/i })).toBeInTheDocument()
      })
    })

    it("should reset code when reset button clicked", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Reset/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: /Reset/i }))

      await waitFor(() => {
        expect(mockBackend.getDefaultCode).toHaveBeenCalledWith("javascript")
        expect(mockBackend.updateRoomCode).toHaveBeenCalled()
      })
    })
  })

  describe("Code Execution", () => {
    it("should have Run button", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Run/i })).toBeInTheDocument()
      })
    })

    it("should execute code and display output", async () => {
      mockBackend.executeCode.mockResolvedValue({ output: "Hello, World!" })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Run/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: /Run/i }))

      await waitFor(() => {
        expect(screen.getByText("Hello, World!")).toBeInTheDocument()
      })
    })

    it("should show Running... state while executing", async () => {
      mockBackend.executeCode.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ output: "done" }), 100)),
      )

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Run/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: /Run/i }))

      expect(screen.getByRole("button", { name: /Running/i })).toBeInTheDocument()
    })

    it("should execute JavaScript and display output", async () => {
      // Now executeCode returns output directly (via WASM execution)
      mockBackend.executeCode.mockResolvedValue({ output: "test" })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByTestId("code-textarea")).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: /Run/i }))

      await waitFor(() => {
        expect(screen.getByText("test")).toBeInTheDocument()
      })
    })

    it("should show error message when execution fails with error", async () => {
      // executeCode now returns error in output
      mockBackend.executeCode.mockResolvedValue({ output: "Error: Test error", error: "Test error" })

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByTestId("code-textarea")).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: /Run/i }))

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument()
      })
    })

    it("should show execution failed message on network error", async () => {
      mockBackend.executeCode.mockRejectedValue(new Error("Network error"))

      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Run/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: /Run/i }))

      await waitFor(() => {
        expect(screen.getByText(/Execution failed/)).toBeInTheDocument()
      })
    })
  })

  describe("Copy Link", () => {
    it("should have Copy Link button", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Copy Link/i })).toBeInTheDocument()
      })
    })

    it("should copy room link to clipboard", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Copy Link/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: /Copy Link/i }))

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`http://localhost:3000/room/${mockRoomId}`)
      })
    })

    it("should show Copied! feedback after copying", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Copy Link/i })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole("button", { name: /Copy Link/i }))

      await waitFor(() => {
        expect(screen.getByText(/Copied!/)).toBeInTheDocument()
      })
    })
  })

  describe("Navigation", () => {
    it("should have back button", async () => {
      render(<RoomPage />)

      await waitFor(() => {
        const buttons = screen.getAllByRole("button")
        expect(buttons.length).toBeGreaterThan(0)
      })
    })
  })
})
