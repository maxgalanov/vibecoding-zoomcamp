"use client"

import { useEffect, useRef, useCallback } from "react"
import { EditorView, basicSetup } from "codemirror"
import { EditorState, StateField, StateEffect } from "@codemirror/state"
import { Decoration, WidgetType } from "@codemirror/view"
import { javascript } from "@codemirror/lang-javascript"
import { python } from "@codemirror/lang-python"
import { oneDark } from "@codemirror/theme-one-dark"

const languageExtensions = {
  javascript: javascript(),
  python: python(),
}

class CursorWidget extends WidgetType {
  constructor(username, color, isOnFirstLine) {
    super()
    this.username = username
    this.color = color
    this.isOnFirstLine = isOnFirstLine
  }

  toDOM() {
    const wrapper = document.createElement("span")
    wrapper.className = "cm-remote-cursor"
    wrapper.style.cssText = `
      position: relative;
      border-left: 2px solid ${this.color};
      margin-left: -1px;
      pointer-events: none;
    `

    const flag = document.createElement("span")
    flag.className = "cm-remote-cursor-flag"
    flag.textContent = this.username

    // Position at bottom if on first line, otherwise top
    const positionStyle = this.isOnFirstLine
      ? `top: 20px; border-radius: 0 3px 3px 3px;` // Below the line
      : `top: -18px; border-radius: 3px 3px 3px 0;` // Above the line

    flag.style.cssText = `
      position: absolute;
      ${positionStyle}
      left: -1px;
      background: ${this.color};
      color: white;
      font-size: 10px;
      padding: 1px 4px;
      white-space: nowrap;
      font-family: system-ui, sans-serif;
      z-index: 10;
    `

    wrapper.appendChild(flag)
    return wrapper
  }

  eq(other) {
    return other.username === this.username && other.color === this.color && other.isOnFirstLine === this.isOnFirstLine
  }
}

const setRemoteCursors = StateEffect.define()

const remoteCursorsField = StateField.define({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setRemoteCursors)) {
        const { cursors } = effect.value
        const decorationList = []

        cursors.forEach(({ position, selectionStart, selectionEnd, username, cursorColor, selectionColor }) => {
          // Clamp positions to valid range
          const docLength = tr.state.doc.length
          const clampedPos = Math.min(Math.max(0, position), docLength)
          const clampedStart = Math.min(Math.max(0, selectionStart), docLength)
          const clampedEnd = Math.min(Math.max(0, selectionEnd), docLength)

          // Check if cursor is on the first line
          const line = tr.state.doc.lineAt(clampedPos)
          const isOnFirstLine = line.number === 1

          // Add cursor widget
          decorationList.push({
            from: clampedPos,
            to: clampedPos,
            decoration: Decoration.widget({
              widget: new CursorWidget(username, cursorColor, isOnFirstLine),
              side: 1,
            }),
          })

          // Add selection highlight if there's a selection
          if (clampedStart !== clampedEnd) {
            const from = Math.min(clampedStart, clampedEnd)
            const to = Math.max(clampedStart, clampedEnd)
            decorationList.push({
              from,
              to,
              decoration: Decoration.mark({
                class: "cm-remote-selection",
                attributes: {
                  style: `background-color: ${selectionColor};`,
                },
              }),
            })
          }
        })

        // Sort decorations by position
        decorationList.sort((a, b) => a.from - b.from || a.to - b.to)
        return Decoration.set(decorationList.map((d) => d.decoration.range(d.from, d.to)))
      }
    }
    return decorations.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

export default function CodeEditor({ value, onChange, language, onCursorChange, remoteCursors = [] }) {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const isExternalUpdate = useRef(false)

  const handleSelectionChange = useCallback(
    (update) => {
      if (onCursorChange && update.selectionSet) {
        const selection = update.state.selection.main
        onCursorChange({
          position: selection.head,
          selectionStart: selection.from,
          selectionEnd: selection.to,
        })
      }
    },
    [onCursorChange],
  )

  useEffect(() => {
    if (!editorRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isExternalUpdate.current) {
        onChange(update.state.doc.toString())
      }
      isExternalUpdate.current = false

      handleSelectionChange(update)
    })

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        languageExtensions[language] || javascript(),
        oneDark,
        updateListener,
        remoteCursorsField, // Add remote cursors field
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { fontFamily: "var(--font-mono)", fontSize: "14px" },
          ".cm-gutters": { fontFamily: "var(--font-mono)", fontSize: "14px" },
          ".cm-remote-selection": {
            mixBlendMode: "multiply",
          },
        }),
      ],
    })

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    })

    return () => {
      viewRef.current?.destroy()
    }
  }, [language])

  // Update editor content when value changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString()
      if (currentContent !== value) {
        isExternalUpdate.current = true
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: value,
          },
        })
      }
    }
  }, [value])

  useEffect(() => {
    if (viewRef.current && remoteCursors.length >= 0) {
      viewRef.current.dispatch({
        effects: setRemoteCursors.of({ cursors: remoteCursors }),
      })
    }
  }, [remoteCursors])

  return <div ref={editorRef} className="h-full w-full" />
}
