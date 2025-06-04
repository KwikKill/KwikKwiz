"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface FloatingEmojiProps {
  emoji: string
  onComplete: () => void
  startX?: number
}

const EMOJI_MAP: Record<string, string> = {
  heart: "❤️",
  thumbs_up: "👍",
  fire: "🔥",
  clap: "👏",
  smile: "😊",
  laugh: "😂",
  sad: "😢",
  angry: "😠",
  surprised: "😮",
  wink: "😉",
  star: "⭐",
  party: "🎉",
  thumbs_down: "👎",
}

export function FloatingEmoji({ emoji, onComplete, startX }: FloatingEmojiProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [position, setPosition] = useState({
    x: startX || Math.random() * (window.innerWidth - 60),
    y: window.innerHeight - 100,
  })

  useEffect(() => {
    const duration = 3000 // 3 seconds
    const startTime = Date.now()
    const startY = position.y
    const endY = -100 // Move above screen
    const baseX = position.x
    const maxDrift = 50 // Maximum horizontal drift

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      if (progress >= 1) {
        setIsVisible(false)
        onComplete()
        return
      }

      // Easing function for smooth movement
      const easeOut = 1 - Math.pow(1 - progress, 3)

      // Calculate new position
      const newY = startY + (endY - startY) * easeOut

      // Add horizontal drift with sine wave
      const drift = Math.sin(progress * Math.PI * 2) * maxDrift * progress
      const newX = baseX + drift

      setPosition({ x: newX, y: newY })

      requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [position.x, position.y, onComplete])

  if (!isVisible) return null

  const opacity = Math.max(0, 1 - (window.innerHeight - position.y) / window.innerHeight)

  return (
    <div
      className={cn("fixed pointer-events-none z-50 text-4xl select-none transition-opacity duration-100")}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        opacity,
        transform: "translate(-50%, -50%)",
      }}
    >
      {EMOJI_MAP[emoji] || emoji}
    </div>
  )
}
