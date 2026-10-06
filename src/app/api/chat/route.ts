import { addMessage, sendHistory, subscribe } from "@/lib/chat-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      sendHistory(send);
      unsubscribe = subscribe(send);

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 25_000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  let body: { username?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = body.username ?? "";
  const text = body.text ?? "";

  try {
    const message = addMessage(username, text);
    return Response.json({ message });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send message";
    return Response.json({ error: message }, { status: 400 });
  }
}