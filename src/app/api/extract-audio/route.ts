import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  return NextResponse.json({
    message:
      "This is a simplified API endpoint for the preview environment. In a real implementation, this would extract audio server-side.",
  })
}
