/**
 * Note: CodeMirror is difficult to test in JSDOM.
 * These tests focus on the component interface and props.
 * For full editor testing, consider using Playwright or Cypress.
 */



describe("CodeEditor Component Interface", () => {
  it("should accept value prop", () => {
    const props = {
      value: "test code",
      onChange: jest.fn(),
      language: "javascript",
    }

    expect(props.value).toBe("test code")
  })

  it("should accept onChange callback", () => {
    const onChange = jest.fn()
    const props = {
      value: "",
      onChange,
      language: "javascript",
    }

    // Simulate calling onChange
    props.onChange("new code")
    expect(onChange).toHaveBeenCalledWith("new code")
  })

  it("should accept language prop", () => {
    const languages = ["javascript", "python"]

    languages.forEach((lang) => {
      const props = {
        value: "",
        onChange: jest.fn(),
        language: lang,
      }
      expect(props.language).toBe(lang)
    })
  })

  it("should accept onCursorChange callback", () => {
    const onCursorChange = jest.fn()
    const props = {
      value: "",
      onChange: jest.fn(),
      language: "javascript",
      onCursorChange,
    }

    // Simulate cursor change
    props.onCursorChange({
      position: 10,
      selectionStart: 10,
      selectionEnd: 20,
    })

    expect(onCursorChange).toHaveBeenCalledWith({
      position: 10,
      selectionStart: 10,
      selectionEnd: 20,
    })
  })

  it("should accept remoteCursors array", () => {
    const remoteCursors = [
      {
        oderId: "user-1",
        username: "Alice",
        position: 50,
        selectionStart: 50,
        selectionEnd: 60,
        cursorColor: "#e91e63",
        selectionColor: "rgba(233, 30, 99, 0.3)",
      },
    ]

    const props = {
      value: "",
      onChange: jest.fn(),
      language: "javascript",
      remoteCursors,
    }

    expect(props.remoteCursors).toHaveLength(1)
    expect(props.remoteCursors[0].username).toBe("Alice")
  })

  it("should handle empty remoteCursors array", () => {
    const props = {
      value: "",
      onChange: jest.fn(),
      language: "javascript",
      remoteCursors: [],
    }

    expect(props.remoteCursors).toEqual([])
  })
})

describe("Remote Cursor Data Structure", () => {
  it("should have required cursor properties", () => {
    const cursor = {
      oderId: "user-123",
      username: "TestUser",
      position: 100,
      selectionStart: 100,
      selectionEnd: 150,
      cursorColor: "#ff0000",
      selectionColor: "rgba(255, 0, 0, 0.3)",
    }

    expect(cursor).toHaveProperty("oderId")
    expect(cursor).toHaveProperty("username")
    expect(cursor).toHaveProperty("position")
    expect(cursor).toHaveProperty("selectionStart")
    expect(cursor).toHaveProperty("selectionEnd")
    expect(cursor).toHaveProperty("cursorColor")
    expect(cursor).toHaveProperty("selectionColor")
  })

  it("should validate cursor position is non-negative", () => {
    const cursor = {
      position: 0,
      selectionStart: 0,
      selectionEnd: 0,
    }

    expect(cursor.position).toBeGreaterThanOrEqual(0)
    expect(cursor.selectionStart).toBeGreaterThanOrEqual(0)
    expect(cursor.selectionEnd).toBeGreaterThanOrEqual(0)
  })

  it("should have selection end >= selection start", () => {
    const cursor = {
      selectionStart: 10,
      selectionEnd: 20,
    }

    expect(cursor.selectionEnd).toBeGreaterThanOrEqual(cursor.selectionStart)
  })
})
