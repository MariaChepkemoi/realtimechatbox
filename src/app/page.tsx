import { ChatBox } from "@/components/ChatBox";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <main className="w-full">
        <ChatBox />
      </main>
    </div>
  );
}
