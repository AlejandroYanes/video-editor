"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import type { Track } from "@/src/lib/types"
import { Scissors, Trash2 } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import { cn } from "@/src/lib/utils"

interface TimelineProps {
  tracks: Track[]
  currentTime: number
  duration: number
  onCut: (trackId: string, segmentId: string, cutPoint: number) => void
  onRemoveSegment: (trackId: string, segmentId: string) => void
  onRemoveTrack: (trackId: string) => void
  onSeek: (time: number) => void
  disabled?: boolean
}

export default function Timeline({
  tracks,
  currentTime,
  duration,
  onCut,
  onRemoveSegment,
  onRemoveTrack,
  onSeek,
  disabled = false,
}: TimelineProps) {
  const [selectedSegment, setSelectedSegment] = useState<{ trackId: string; segmentId: string } | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  const handleCut = () => {
    if (!selectedSegment) return
    onCut(selectedSegment.trackId, selectedSegment.segmentId, currentTime)
    setSelectedSegment(null)
  }

  const handleSegmentClick = (trackId: string, segmentId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setSelectedSegment({ trackId, segmentId })
  }

  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || disabled) return

    const rect = timelineRef.current.getBoundingClientRect()
    const clickPosition = event.clientX - rect.left
    const percentage = clickPosition / rect.width
    const newTime = percentage * duration

    onSeek(Math.max(0, Math.min(newTime, duration)))
  }

  const handleMouseDown = () => {
    isDraggingRef.current = true
  }

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current || !timelineRef.current || disabled) return

      const rect = timelineRef.current.getBoundingClientRect()
      const mousePosition = event.clientX - rect.left
      const percentage = mousePosition / rect.width
      const newTime = percentage * duration

      onSeek(Math.max(0, Math.min(newTime, duration)))
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [duration, onSeek, disabled])

  if (!tracks.length) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
        No tracks added. Upload a file to get started.
      </div>
    )
  }

  // Group tracks by their relationships (video tracks with their audio tracks)
  const videoTracks = tracks.filter((track) => track.type === "video")

  return (
    <div className="space-y-4">
      <div
        ref={timelineRef}
        className="relative h-8 bg-gray-100 rounded-md cursor-pointer mb-2"
        onClick={handleTimelineClick}
      >
        {/* Current time indicator/playhead */}
        <div
          className="absolute top-0 h-full w-1 bg-red-500 z-10 cursor-ew-resize"
          style={{ left: `calc(${(currentTime / Math.max(duration, 0.1)) * 100}% - 2px)` }}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute -left-2 -top-6 text-xs text-red-500 whitespace-nowrap">
            {formatTime(currentTime)}
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45"></div>
        </div>
      </div>

      {videoTracks.map((videoTrack) => {
        // Find the corresponding audio track
        const audioTrack = tracks.find(
          (track) => track.type === "audio" && track.segments.some((seg) => seg.isAudioFromVideo),
        )

        return (
          <div key={videoTrack.id} className="space-y-1 mb-6">
            {/* Video track */}
            <div className="flex items-center gap-2">
              <div className="w-24 truncate text-sm font-medium flex items-center">
                <span className="mr-2">{videoTrack.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onRemoveTrack(videoTrack.id)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <div className="flex-1 h-16 bg-gray-100 rounded-md relative">
                {videoTrack.segments.map((segment) => (
                  <div
                    key={segment.id}
                    className={cn(
                      "absolute top-0 h-full rounded-md cursor-pointer transition-all flex items-center justify-between px-2",
                      selectedSegment?.segmentId === segment.id
                        ? "bg-blue-200 border-2 border-blue-500"
                        : "bg-blue-100 hover:bg-blue-200",
                    )}
                    style={{
                      left: `${(segment.start / Math.max(duration, 0.1)) * 100}%`,
                      width: `${((segment.end - segment.start) / Math.max(duration, 0.1)) * 100}%`,
                    }}
                    onClick={(e) => handleSegmentClick(videoTrack.id, segment.id, e)}
                  >
                    <div className="text-xs truncate">
                      {formatTime(segment.start)} - {formatTime(segment.end)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-70 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveSegment(videoTrack.id, segment.id)
                      }}
                      disabled={disabled}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Audio track (if exists) */}
            {audioTrack && (
              <div className="flex items-center gap-2 ml-6">
                <div className="w-24 truncate text-sm font-medium flex items-center">
                  <span className="mr-2">Audio</span>
                </div>
                <div className="flex-1 h-10 bg-gray-100 rounded-md relative">
                  {audioTrack.segments.map((segment) => {
                    // Find the corresponding video segment
                    const videoSegment = videoTrack.segments.find(
                      (vs) => segment.start >= vs.start && segment.end <= vs.end,
                    )

                    if (!videoSegment) return null

                    return (
                      <div
                        key={segment.id}
                        className={cn("absolute top-0 h-full rounded-md transition-all", "bg-green-100")}
                        style={{
                          left: `${(segment.start / Math.max(duration, 0.1)) * 100}%`,
                          width: `${((segment.end - segment.start) / Math.max(duration, 0.1)) * 100}%`,
                        }}
                      >
                        <div className="h-full w-full bg-green-100 opacity-70"></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Standalone audio tracks (not associated with videos) */}
      {tracks
        .filter((track) => track.type === "audio" && !track.segments.some((seg) => seg.isAudioFromVideo))
        .map((track) => (
          <div key={track.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-24 truncate text-sm font-medium flex items-center">
                <span className="mr-2">{track.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onRemoveTrack(track.id)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <div className="flex-1 h-16 bg-gray-100 rounded-md relative">
                {track.segments.map((segment) => (
                  <div
                    key={segment.id}
                    className={cn(
                      "absolute top-0 h-full rounded-md cursor-pointer transition-all flex items-center justify-between px-2",
                      selectedSegment?.segmentId === segment.id
                        ? "bg-green-200 border-2 border-green-500"
                        : "bg-green-100 hover:bg-green-200",
                    )}
                    style={{
                      left: `${(segment.start / Math.max(duration, 0.1)) * 100}%`,
                      width: `${((segment.end - segment.start) / Math.max(duration, 0.1)) * 100}%`,
                    }}
                    onClick={(e) => handleSegmentClick(track.id, segment.id, e)}
                  >
                    <div className="text-xs truncate">
                      {formatTime(segment.start)} - {formatTime(segment.end)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-70 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveSegment(track.id, segment.id)
                      }}
                      disabled={disabled}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleCut} disabled={!selectedSegment || disabled}>
          <Scissors className="h-4 w-4 mr-2" />
          Cut at Current Position
        </Button>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}
