export enum TrackType {
  VIDEO = "video",
  AUDIO = "audio",
}

export interface TrackSegment {
  id: string
  start: number
  end: number
  source: string
  fileId: string
  isAudioFromVideo?: boolean
}

export interface Track {
  id: string
  name: string
  type: TrackType
  segments: TrackSegment[]
}
