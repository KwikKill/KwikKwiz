"use client"

import React from "react"

import { useState, useCallback } from "react"
import { FloatingEmoji } from "./floating-emoji"

interface EmojiRainProps {
  className?: string
}

interface ActiveEmoji {
  id: string
  emoji: string
  startX?: number
}

export function EmojiRain({ className }: EmojiRainProps) {
  const [activeEmojis, setActiveEmojis] = useState<ActiveEmoji[]>([])

  const addEmoji = useCallback((emoji: string, startX?: number) => {
    const id = Math.random().toString(36).substr(2, 9)
    setActiveEmojis((prev) => [...prev, { id, emoji, startX }])
  }, [])

  const removeEmoji = useCallback((id: string) => {
    setActiveEmojis((prev) => prev.filter((e) => e.id !== id))
  }, [])

  // Expose addEmoji function globally so it can be called from socket events
  React.useEffect(() => {
    ;(window as any).addEmojiReaction = addEmoji
    return () => {
      delete (window as any).addEmojiReaction
    }
  }, [addEmoji])

  return (
    <div className={className}>
      {activeEmojis.map(({ id, emoji, startX }) => (
        <FloatingEmoji key={id} emoji={emoji} startX={startX} onComplete={() => removeEmoji(id)} />
      ))}
    </div>
  )
}
