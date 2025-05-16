"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { type Track, TrackType } from "@/lib/types"

interface VideoPreviewProps {
  tracks: Track[]
  currentTime: number
  onTimeUpdate: () => void
}

const VideoPreview = forwardRef<HTMLVideoElement, VideoPreviewProps>(({ tracks, currentTime, onTimeUpdate }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRefs = useRef<HTMLAudioElement[]>([])

  // Forward the video ref
  useImperativeHandle(ref, () => videoRef.current as HTMLVideoElement)

  // Get the current video source
  const videoTracks = tracks.filter((track) => track.type === TrackType.VIDEO)
  const currentVideoSegment = findCurrentSegment(videoTracks, currentTime)

  // Get the current audio sources
  const audioTracks = tracks.filter((track) => track.type === TrackType.AUDIO)
  const currentAudioSegments = audioTracks.map((track) => findSegmentAtTime(track, currentTime)).filter(Boolean)

  // Sync audio with video
  useEffect(() => {
    if (!videoRef.current) return

    // Update audio elements
    audioRefs.current.forEach((audio, index) => {
      if (!audio) return

      if (Math.abs(audio.currentTime - videoRef.current!.currentTime) > 0.1) {
        audio.currentTime = videoRef.current!.currentTime
      }

      if (videoRef.current!.paused) {
        audio.pause()
      } else {
        audio.play().catch(() => {
          // Autoplay might be blocked
        })
      }
    })
  }, [currentTime])

  return (
    <>
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src={currentVideoSegment?.source}
        onTimeUpdate={onTimeUpdate}
        controls={false}
        // Mute the video if we have audio tracks that came from videos
        muted={audioTracks.some((track) => track.segments.some((segment) => segment.isAudioFromVideo))}
      />

      {/* Audio elements */}
      {currentAudioSegments.map(
        (segment, index) =>
          segment && (
            <audio
              key={index}
              ref={(el) => {
                if (el) audioRefs.current[index] = el
              }}
              src={segment.source}
              className="hidden"
            />
          ),
      )}
    </>
  )
})

VideoPreview.displayName = "VideoPreview"

export default VideoPreview

// Helper function to find the segment at a specific time
function findSegmentAtTime(track: Track, time: number) {
  return track.segments.find((segment) => time >= segment.start && time <= segment.end)
}

// Helper function to find the current video segment
function findCurrentSegment(videoTracks: Track[], currentTime: number) {
  if (videoTracks.length === 0) return null

  // Try to find a segment that contains the current time
  for (const track of videoTracks) {
    const segment = findSegmentAtTime(track, currentTime)
    if (segment) return segment
  }

  // If no segment contains the current time, find the closest one
  const allSegments = videoTracks.flatMap((track) => track.segments)

  if (allSegments.length === 0) return null

  // Sort by start time
  allSegments.sort((a, b) => a.start - b.start)

  // Find the first segment that starts after the current time
  const nextSegment = allSegments.find((segment) => segment.start > currentTime)

  // If there's a next segment, return it, otherwise return the last segment
  return nextSegment || allSegments[allSegments.length - 1]
}
