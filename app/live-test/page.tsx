import LiveChat from "@/components/chat/LiveChat";

type Props = {
  searchParams?: Promise<{
    webinarId?: string;
    sessionId?: string;
    playbackSec?: string;
  }>;
};

export default async function LiveTestPage({ searchParams }: Props) {
  const qs = searchParams ? await searchParams : {};
  const webinarId = qs.webinarId?.trim() || "demo-webinar";
  const sessionId = qs.sessionId?.trim() || `live-test-${webinarId}`;
  const playbackSec = Number.isFinite(Number(qs.playbackSec))
    ? Math.max(0, Math.floor(Number(qs.playbackSec)))
    : 600;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold">WebinarAPP Live Chat Test</h1>
        <p className="mt-2 text-sm text-slate-600">
          Open this page in 2 tabs to test realtime chat and AI replies.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Testing webinarId=<span className="font-mono">{webinarId}</span>, sessionId=
          <span className="font-mono">{sessionId}</span>, playbackSec=
          <span className="font-mono">{playbackSec}</span>
        </p>

        <div className="mt-6">
          <LiveChat webinarId={webinarId} sessionId={sessionId} playbackSec={playbackSec} />
        </div>
      </div>
    </main>
  );
}
