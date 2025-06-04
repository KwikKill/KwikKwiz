"use client"

import { JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { X, SmilePlus } from "lucide-react"

interface EmojiSelectorProps {
  onEmojiSelect: (emoji: string) => void
  className?: string
}

const EMOJIS = [
  { name: "heart", emoji: "❤️" },
  { name: "thumbs_up", emoji: "👍" },
  { name: "fire", emoji: "🔥" },
  { name: "clap", emoji: "👏" },
  { name: "smile", emoji: "😊" },
  { name: "laugh", emoji: "😂" },
  { name: "sad", emoji: "😢" },
  { name: "angry", emoji: "😠" },
  { name: "surprised", emoji: "😮" },
  { name: "wink", emoji: "😉" },
  { name: "star", emoji: "⭐" },
  { name: "party", emoji: "🎉" },
  { name: "thumbs_down", emoji: "👎" },
]

export function EmojiSelector({ onEmojiSelect, className }: EmojiSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleEmojiClick = (emojiName: string) => {
    onEmojiSelect(emojiName)
    //setIsOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      <Button variant="outline" size="lg" onClick={() => setIsOpen(!isOpen)} className="rounded-full w-16 h-16 p-0 cursor-pointer">
        {isOpen ? (
          <X className="w-12 h-12 text-gray-500" />
        ) : (
          <SmilePlus className="w-12 h-12 text-gray-500" />
        )}
      </Button>

      {isOpen && (
        <>
          {/* Emoji Circle */}
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 z-50">
            <div className="relative">
              {EMOJIS.map((emoji, index) => {
                // Arrange emojis in three rows, quarter circle (up-left)
                const rows = 3;
                // Distribute emojis: first row gets 1 less, last row gets 1 more
                const baseItemsPerRow = Math.floor(EMOJIS.length / rows);
                const remainder = EMOJIS.length % rows;
                // First row: -1, middle: base, last: +1
                const itemsPerRowArr = [
                  baseItemsPerRow + 1 + remainder,
                  baseItemsPerRow,
                  baseItemsPerRow -1,
                ];

                // Find row and position in row
                let row = 0, count = 0, posInRow = 0;
                for (let r = 0; r < rows; r++) {
                  if (index < count + itemsPerRowArr[r]) {
                    row = r;
                    posInRow = index - count;
                    break;
                  }
                  count += itemsPerRowArr[r];
                }

                const totalAngle = 90; // quarter circle
                const itemsInThisRow = itemsPerRowArr[row];
                // Spread items fully across the quarter circle
                const angleStep = itemsInThisRow > 1 ? totalAngle / (itemsInThisRow - 1) : 0;
                const angle = 270 - posInRow * angleStep;
                // Set different radius for each row
                const radii = [200, 140, 80];
                const radius = radii[row] || 80;

                const x = Math.cos((angle * Math.PI) / 180) * radius;
                const y = Math.sin((angle * Math.PI) / 180) * radius;

                return (
                  <Button
                    key={emoji.name}
                    variant="outline"
                    size="sm"
                    className="absolute w-12 h-12 p-0 rounded-full bg-background border-2 shadow-lg hover:scale-110 transition-transform"
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      transform: "translate(-50%, 0%)",
                    }}
                    onClick={() => handleEmojiClick(emoji.name)}
                  >
                    <span className="text-xl">{emoji.emoji}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
