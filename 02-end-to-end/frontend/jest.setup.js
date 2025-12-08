import { jest } from "@jest/globals"
import "@testing-library/jest-dom"

// Mock BroadcastChannel
class MockBroadcastChannel {
  constructor(name) {
    this.name = name
    this.onmessage = null
    MockBroadcastChannel.instances.push(this)
  }

  postMessage(message) {
    MockBroadcastChannel.instances
      .filter((instance) => instance.name === this.name && instance !== this)
      .forEach((instance) => {
        if (instance.onmessage) {
          instance.onmessage({ data: message })
        }
      })
  }

  close() {
    const index = MockBroadcastChannel.instances.indexOf(this)
    if (index > -1) {
      MockBroadcastChannel.instances.splice(index, 1)
    }
  }

  static instances = []
  static reset() {
    MockBroadcastChannel.instances = []
  }
}

global.BroadcastChannel = MockBroadcastChannel

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString()
    }),
    removeItem: jest.fn((key) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
})

// Mock navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(""),
  },
  writable: true,
})

// Mock Worker
class MockWorker {
  constructor(url) {
    this.url = url
    this.onmessage = null
    this.onerror = null
  }

  postMessage(message) {
    // Simulate worker execution
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: { output: "Mock worker output", error: null } })
      }
    }, 10)
  }

  terminate() {}
}

global.Worker = MockWorker

// Mock window.location
delete window.location
window.location = {
  origin: "http://localhost:3000",
  href: "http://localhost:3000",
  pathname: "/",
  assign: jest.fn(),
  replace: jest.fn(),
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
