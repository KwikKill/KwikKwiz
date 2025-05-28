import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return new NextResponse(
    JSON.stringify({
      success: true,
      message: "WebSocket server is running",
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }
  );
}