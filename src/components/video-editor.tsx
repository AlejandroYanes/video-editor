"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Play, Pause, Save, Music } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import Timeline from "@/components/timeline"
import VideoPreview from "@/components/video-preview"
import { type Track, TrackType, type TrackSegment } from "@/lib/types"

export default function VideoEditor() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [tracks, setTracks] = useState<Track[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState("")

  const videoRef = useRef<HTMLVideoElement>(null)

  // Track relationships between videos and their extracted audio
  const [videoAudioMap, setVideoAudioMap] = useState<Record<string, string>>({})

  // Keep track of original files for merging
  const [originalFiles, setOriginalFiles] = useState<Record<string, File>>({})

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return

    const file = e.target.files[0]
    const fileType = file.type.includes("video") ? TrackType.VIDEO : TrackType.AUDIO

    // Create a URL for the file
    const url = URL.createObjectURL(file)

    // Generate a unique ID for this file
    const fileId = Date.now().toString()

    // Store the original file
    setOriginalFiles((prev) => ({
      ...prev,
      [fileId]: file,
    }))

    // Create a new track
    const newTrack: Track = {
      id: Date.now().toString(),
      name: file.name,
      type: fileType,
      segments: [
        {
          id: Date.now().toString(),
          start: 0,
          end: 0, // We'll update this once we know the duration
          source: url,
          fileId: fileId,
        },
      ],
    }

    // Add the track to our tracks array
    setTracks((prev) => [...prev, newTrack])

    // If it's a video, load it to get its duration and extract audio
    if (fileType === TrackType.VIDEO) {
      const video = document.createElement("video")
      video.onloadedmetadata = async () => {
        // Update the end time of the segment
        setTracks((prev) =>
          prev.map((track) =>
            track.id === newTrack.id
              ? {
                  ...track,
                  segments: track.segments.map((seg) =>
                    seg.id === track.segments[0].id ? { ...seg, end: video.duration } : seg,
                  ),
                }
              : track,
          ),
        )

        // Set the duration of the editor if this is the first video
        if (duration === 0) {
          setDuration(video.duration)
        }

        // Extract audio from the video (client-side)
        await extractAudioFromVideoClientSide(url, video.duration, newTrack.id, file.name, fileId)
      }
      video.src = url
    }

    // If it's audio, we need to do something similar
    if (fileType === TrackType.AUDIO) {
      const audio = new Audio()
      audio.onloadedmetadata = () => {
        setTracks((prev) =>
          prev.map((track) =>
            track.id === newTrack.id
              ? {
                  ...track,
                  segments: track.segments.map((seg) =>
                    seg.id === track.segments[0].id ? { ...seg, end: audio.duration } : seg,
                  ),
                }
              : track,
          ),
        )

        // Update duration if needed
        if (duration === 0) {
          setDuration(audio.duration)
        }
      }
      audio.src = url
    }
  }

  // Client-side audio extraction using the video element directly
  const extractAudioFromVideoClientSide = async (
    videoUrl: string,
    videoDuration: number,
    videoTrackId: string,
    videoFileName: string,
    fileId: string,
  ) => {
    try {
      setProcessingStatus("Creating audio track...")
      setProcessingProgress(0)
      setIsProcessing(true)

      // Create an audio track that references the same file
      const audioTrack: Track = {
        id: Date.now().toString(),
        name: `${videoFileName.split(".")[0]} (Audio)`,
        type: TrackType.AUDIO,
        segments: [
          {
            id: Date.now().toString(),
            start: 0,
            end: videoDuration,
            source: videoUrl, // Use the same source as the video
            fileId: fileId, // Use the same file ID
            isAudioFromVideo: true, // Mark this as audio from video
          },
        ],
      }

      // Add the audio track
      setTracks((prev) => [...prev, audioTrack])

      // Store the relationship between video and audio tracks
      setVideoAudioMap((prev) => ({
        ...prev,
        [videoTrackId]: audioTrack.id,
      }))

      setProcessingProgress(100)
    } catch (error) {
      console.error("Error creating audio track:", error)
    } finally {
      setIsProcessing(false)
      setProcessingStatus("")
      setProcessingProgress(0)
    }
  }

  const handlePlayPause = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }

    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    setCurrentTime(videoRef.current.currentTime)
  }

  const handleSeek = (time: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = time
    setCurrentTime(time)
  }

  const cutSegment = (trackId: string, segmentId: string, cutPoint: number) => {
    // Cut the selected segment
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track

        const segmentIndex = track.segments.findIndex((seg) => seg.id === segmentId)
        if (segmentIndex === -1) return track

        const segment = track.segments[segmentIndex]

        // Don't cut if the cut point is at the start or end
        if (cutPoint <= segment.start || cutPoint >= segment.end) return track

        // Create two new segments from the cut
        const firstSegment: TrackSegment = {
          ...segment,
          end: cutPoint,
        }

        const secondSegment: TrackSegment = {
          ...segment,
          id: Date.now().toString(),
          start: cutPoint,
        }

        // Replace the original segment with the two new ones
        const newSegments = [...track.segments]
        newSegments.splice(segmentIndex, 1, firstSegment, secondSegment)

        return {
          ...track,
          segments: newSegments,
        }
      }),
    )

    // If this is a video track, also cut the corresponding audio track
    const audioTrackId = videoAudioMap[trackId]
    if (audioTrackId) {
      // Find the audio segment that corresponds to the video segment
      const audioTrack = tracks.find((t) => t.id === audioTrackId)
      if (audioTrack) {
        const audioSegmentId = audioTrack.segments[0]?.id
        if (audioSegmentId) {
          cutSegment(audioTrackId, audioSegmentId, cutPoint)
        }
      }
    }
  }

  const removeSegment = (trackId: string, segmentId: string) => {
    // Find the track and segment
    const track = tracks.find((t) => t.id === trackId)
    if (!track) return

    const segment = track.segments.find((s) => s.id === segmentId)
    if (!segment) return

    // If this is a video segment, also remove the corresponding audio segment
    if (track.type === TrackType.VIDEO) {
      const audioTrackId = videoAudioMap[trackId]
      if (audioTrackId) {
        const audioTrack = tracks.find((t) => t.id === audioTrackId)
        if (audioTrack) {
          // Find audio segments that overlap with this video segment
          const audioSegmentsToRemove = audioTrack.segments.filter(
            (audioSeg) => audioSeg.start >= segment.start && audioSeg.end <= segment.end,
          )

          // Remove each audio segment
          for (const audioSeg of audioSegmentsToRemove) {
            setTracks((prev) =>
              prev.map((t) => {
                if (t.id !== audioTrackId) return t

                return {
                  ...t,
                  segments: t.segments.filter((s) => s.id !== audioSeg.id),
                }
              }),
            )
          }
        }
      }
    }

    // Remove the segment from the track
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t

        return {
          ...t,
          segments: t.segments.filter((s) => s.id !== segmentId),
        }
      }),
    )

    // Remove tracks with no segments
    setTracks((prev) => prev.filter((t) => t.segments.length > 0))

    // If we're removing the current segment, update the current time
    if (segment.start <= currentTime && segment.end >= currentTime) {
      // Find the next available segment
      const allSegments = tracks
        .flatMap((t) => (t.type === TrackType.VIDEO ? t.segments : []))
        .sort((a, b) => a.start - b.start)

      const nextSegment = allSegments.find((s) => s.id !== segmentId && s.start > segment.end)

      const prevSegment = allSegments.reverse().find((s) => s.id !== segmentId && s.end < segment.start)

      if (nextSegment) {
        handleSeek(nextSegment.start)
      } else if (prevSegment) {
        handleSeek(prevSegment.start)
      } else {
        handleSeek(0)
      }
    }
  }

  const removeTrack = (trackId: string) => {
    // Remove the track
    setTracks((prev) => prev.filter((track) => track.id !== trackId))

    // If this is a video track, also remove its corresponding audio track
    const audioTrackId = videoAudioMap[trackId]
    if (audioTrackId) {
      setTracks((prev) => prev.filter((track) => track.id !== audioTrackId))

      // Update the video-audio map
      setVideoAudioMap((prev) => {
        const newMap = { ...prev }
        delete newMap[trackId]
        return newMap
      })
    }
  }

  const mergeVideos = async () => {
    if (!tracks.length) return

    setIsProcessing(true)
    setProcessingProgress(0)
    setProcessingStatus("Preparing files...")

    try {
      // Get all video segments
      const videoTracks = tracks.filter((track) => track.type === TrackType.VIDEO)
      const videoSegments = videoTracks.flatMap((track) =>
        track.segments.map((segment) => ({
          ...segment,
          trackId: track.id,
        })),
      )

      // Sort segments by start time
      videoSegments.sort((a, b) => a.start - b.start)

      if (videoSegments.length === 0) {
        throw new Error("No video segments to merge")
      }

      // Create a FormData object to send the files
      const formData = new FormData()

      // Add each unique video file to the form data
      const uniqueFileIds = new Set(videoSegments.map((segment) => segment.fileId))
      const fileIdToIndex = {} as Record<string, number>

      let index = 0
      for (const fileId of uniqueFileIds) {
        const file = originalFiles[fileId]
        if (file) {
          formData.append("videos", file)
          fileIdToIndex[fileId] = index
          index++
        }
      }

      // Prepare segment data for the server
      const segmentsForServer = videoSegments.map((segment) => ({
        fileIndex: fileIdToIndex[segment.fileId],
        start: segment.start,
        end: segment.end,
      }))

      formData.append("segments", JSON.stringify(segmentsForServer))

      setProcessingStatus("Uploading files to blob storage...")
      setProcessingProgress(30)

      // Send the files to our API route
      const response = await fetch("/api/merge-videos", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        // Try to get error details if available
        try {
          const errorData = await response.json()
          throw new Error(errorData.error || `Server error: ${response.status}`)
        } catch (jsonError) {
          throw new Error(`Server error: ${response.status}`)
        }
      }

      // Get the JSON response
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Unknown error occurred")
      }

      setProcessingStatus("Processing complete!")
      setProcessingProgress(100)

      // Create a download link for the processed video
      const a = document.createElement("a")
      a.href = data.url
      a.download = `merged_video_${Date.now()}.mp4`
      a.click()
    } catch (error) {
      console.error("Error merging videos:", error)
      alert(`Error: ${(error as Error).message || "Failed to merge videos"}`)
    } finally {
      setTimeout(() => {
        setIsProcessing(false)
        setProcessingProgress(0)
        setProcessingStatus("")
      }, 2000)
    }
  }

  // Effect to update the video preview when segments change
  useEffect(() => {
    // If the current time is not within any segment, find a valid segment
    const videoTracks = tracks.filter((t) => t.type === TrackType.VIDEO)
    if (videoTracks.length === 0) return

    const allSegments = videoTracks.flatMap((t) => t.segments)
    const currentSegment = allSegments.find((segment) => currentTime >= segment.start && currentTime <= segment.end)

    if (!currentSegment && allSegments.length > 0) {
      // Find the closest segment
      const nextSegment = allSegments.sort((a, b) => a.start - b.start).find((segment) => segment.start > currentTime)

      const prevSegment = allSegments.sort((a, b) => b.end - a.end).find((segment) => segment.end < currentTime)

      if (nextSegment) {
        handleSeek(nextSegment.start)
      } else if (prevSegment) {
        handleSeek(prevSegment.start)
      } else {
        handleSeek(allSegments[0].start)
      }
    }
  }, [tracks, currentTime])

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
        <VideoPreview ref={videoRef} tracks={tracks} currentTime={currentTime} onTimeUpdate={handleTimeUpdate} />

        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white">
            <div className="text-xl mb-4">{processingStatus}</div>
            <div className="w-64">
              <Progress value={processingProgress} className="h-2" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={handlePlayPause} disabled={!tracks.length || isProcessing}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <div className="text-sm">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between">
          <h3 className="text-lg font-medium">Timeline</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => document.getElementById("video-upload")?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Add Video
            </Button>
            <input
              id="video-upload"
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isProcessing}
            />

            <Button variant="outline" size="sm" onClick={() => document.getElementById("audio-upload")?.click()}>
              <Music className="h-4 w-4 mr-2" />
              Add Audio
            </Button>
            <input
              id="audio-upload"
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isProcessing}
            />
          </div>
        </div>

        <Timeline
          tracks={tracks}
          currentTime={currentTime}
          duration={duration}
          onCut={cutSegment}
          onRemoveSegment={removeSegment}
          onRemoveTrack={removeTrack}
          onSeek={handleSeek}
          disabled={isProcessing}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={mergeVideos} disabled={!tracks.length || isProcessing}>
          <Save className="h-4 w-4 mr-2" />
          Export Video
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
