import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useRouter } from "next/navigation"
import HomePage from "@/app/page"
import * as mockBackend from "@/lib/api"


// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}))

// Mock API
jest.mock("@/lib/api", () => ({
  createRoom: jest.fn(),
}))

describe("HomePage", () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    useRouter.mockReturnValue({ push: mockPush })
  })

  describe("Login Flow", () => {
    it("should show login form when not logged in", () => {
      render(<HomePage />)

      expect(screen.getByText("Code Interview")).toBeInTheDocument()
      expect(screen.getByLabelText("Username")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument()
    })

    it("should disable continue button when username is empty", () => {
      render(<HomePage />)

      const button = screen.getByRole("button", { name: "Continue" })
      expect(button).toBeDisabled()
    })

    it("should enable continue button when username is entered", () => {
      render(<HomePage />)

      const input = screen.getByLabelText("Username")
      fireEvent.change(input, { target: { value: "TestUser" } })

      const button = screen.getByRole("button", { name: "Continue" })
      expect(button).not.toBeDisabled()
    })

    it("should save username to localStorage on login", () => {
      render(<HomePage />)

      const input = screen.getByLabelText("Username")
      fireEvent.change(input, { target: { value: "TestUser" } })

      const button = screen.getByRole("button", { name: "Continue" })
      fireEvent.click(button)

      expect(localStorage.setItem).toHaveBeenCalledWith("codeInterview_username", "TestUser")
    })

    it("should show main interface after login", async () => {
      localStorage.getItem.mockReturnValue("TestUser")

      render(<HomePage />)

      await waitFor(() => {
        expect(screen.getByText(/Welcome/)).toBeInTheDocument()
        expect(screen.getByText("TestUser")).toBeInTheDocument()
      })
    })
  })

  describe("Room Creation", () => {
    beforeEach(() => {
      localStorage.getItem.mockReturnValue("TestUser")
    })

    it("should show Create Room button when logged in", () => {
      render(<HomePage />)

      expect(screen.getByRole("button", { name: "Create Room" })).toBeInTheDocument()
    })

    it("should create room and navigate on button click", async () => {
      mockBackend.createRoom.mockResolvedValue({ roomId: "abc123" })

      render(<HomePage />)

      const button = screen.getByRole("button", { name: "Create Room" })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockBackend.createRoom).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith("/room/abc123")
      })
    })

    it("should show loading state while creating room", async () => {
      mockBackend.createRoom.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ roomId: "abc123" }), 100)),
      )

      render(<HomePage />)

      const button = screen.getByRole("button", { name: "Create Room" })
      fireEvent.click(button)

      expect(screen.getByRole("button", { name: "Creating..." })).toBeInTheDocument()
    })

    it("should show error message when room creation fails", async () => {
      mockBackend.createRoom.mockRejectedValue(new Error("Failed"))

      render(<HomePage />)

      const button = screen.getByRole("button", { name: "Create Room" })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText(/Failed to create room/)).toBeInTheDocument()
      })
    })
  })

  describe("Joining Room", () => {
    beforeEach(() => {
      localStorage.getItem.mockReturnValue("TestUser")
    })

    it("should show join room input", () => {
      render(<HomePage />)

      expect(screen.getByLabelText(/Join existing room/)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Join Room" })).toBeInTheDocument()
    })

    it("should navigate to room when valid room ID is entered", async () => {
      render(<HomePage />)

      const input = screen.getByLabelText(/Join existing room/)
      fireEvent.change(input, { target: { value: "xyz789" } })

      const button = screen.getByRole("button", { name: "Join Room" })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/room/xyz789")
      })
    })

    it("should extract room ID from full URL", async () => {
      render(<HomePage />)

      const input = screen.getByLabelText(/Join existing room/)
      fireEvent.change(input, {
        target: { value: "http://localhost:3000/room/xyz789" },
      })

      const button = screen.getByRole("button", { name: "Join Room" })
      fireEvent.click(button)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/room/xyz789")
      })
    })

    it("should show error when room link is empty", async () => {
      render(<HomePage />)

      const button = screen.getByRole("button", { name: "Join Room" })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText(/Please enter a room link/)).toBeInTheDocument()
      })
    })
  })

  describe("Logout", () => {
    beforeEach(() => {
      localStorage.getItem.mockReturnValue("TestUser")
    })

    it("should show sign out button when logged in", () => {
      render(<HomePage />)

      expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument()
    })

    it("should clear localStorage and show login form on sign out", async () => {
      const { rerender } = render(<HomePage />)

      const signOutButton = screen.getByRole("button", { name: "Sign out" })
      fireEvent.click(signOutButton)

      expect(localStorage.removeItem).toHaveBeenCalledWith("codeInterview_username")
    })
  })
})
