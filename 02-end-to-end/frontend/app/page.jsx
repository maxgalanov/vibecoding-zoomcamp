"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { getRoom, joinRoom, getParticipants, updateRoomCode, updateRoomLanguage, executeCode, leaveRoom, getDefaultCode, createRoom } from "@/lib/api"

export default function HomePage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [roomLink, setRoomLink] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [storedUsername, setStoredUsername] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const saved = localStorage.getItem("codeInterview_username")
    if (saved) {
      setStoredUsername(saved)
      setIsLoggedIn(true)
    }
  }, [])

  const handleLogin = (e) => {
    e.preventDefault()
    if (username.trim()) {
      localStorage.setItem("codeInterview_username", username.trim())
      setStoredUsername(username.trim())
      setIsLoggedIn(true)
      setUsername("")
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("codeInterview_username")
    setStoredUsername("")
    setIsLoggedIn(false)
  }

  const handleCreateRoom = async () => {
    setIsCreating(true)
    setError("")
    try {
      const { roomId } = await createRoom()
      router.push(`/room/${roomId}`)
    } catch (err) {
      setError("Failed to create room. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinRoom = (e) => {
    e.preventDefault()
    setError("")

    if (!roomLink.trim()) {
      setError("Please enter a room link or ID")
      return
    }

    // Extract room ID from link or use directly
    let roomId = roomLink.trim()
    if (roomLink.includes("/room/")) {
      roomId = roomLink.split("/room/")[1]
    }

    if (roomId) {
      router.push(`/room/${roomId}`)
    } else {
      setError("Invalid room link")
    }
  }

  if (!isLoggedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold">Code Interview</CardTitle>
            <CardDescription>Enter your username to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={!username.trim()}>
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">Code Interview</CardTitle>
          <CardDescription>
            Welcome, <span className="font-medium text-foreground">{storedUsername}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Button onClick={handleCreateRoom} className="w-full" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Room"}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <form onSubmit={handleJoinRoom} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="roomLink">Join existing room</Label>
              <Input
                id="roomLink"
                type="text"
                placeholder="Enter room link or ID"
                value={roomLink}
                onChange={(e) => setRoomLink(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" className="w-full">
              Join Room
            </Button>
          </form>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <div className="pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full text-muted-foreground">
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
