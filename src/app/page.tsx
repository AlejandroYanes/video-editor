import VideoEditor from "@/components/video-editor"

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Simple Video Editor</h1>
        <VideoEditor />
      </div>
    </main>
  )
}
