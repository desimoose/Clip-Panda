"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CaptionStylePicker } from "@/components/CaptionStylePicker";

interface ClipCandidate {
  startMs: number;
  endMs: number;
  reason: string;
}

interface Highlight {
  timestampMs: number;
  captionText: string;
}

export default function EpisodePage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const router = useRouter();
  const [mode, setMode] = useState<"storyboard" | "highlights">("highlights");
  const [captionStyleId, setCaptionStyleId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ClipCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ClipCandidate | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function loadStoryboardCandidates() {
    const response = await fetch(`/api/episodes/${episodeId}/clip-candidates`);
    const json = await response.json();
    setCandidates(json.candidates);
  }

  async function loadHighlights() {
    const response = await fetch(`/api/episodes/${episodeId}/highlights?count=15`);
    const json = await response.json();
    setHighlights(json.highlights);
  }

  async function createCarousel() {
    if (!captionStyleId) return;
    setSubmitting(true);

    const body =
      mode === "highlights"
        ? { mode: "highlights", captionStyleId, highlights }
        : {
            mode: "storyboard",
            captionStyleId,
            clipStartMs: selectedCandidate!.startMs,
            clipEndMs: selectedCandidate!.endMs,
            slideCount: 15,
          };

    const response = await fetch(`/api/episodes/${episodeId}/carousels`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setSubmitting(false);

    if (response.ok) {
      const json = await response.json();
      router.push(`/carousels/${json.carouselId}`);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Build a carousel</h1>

      <div className="flex gap-2">
        <button
          className={mode === "highlights" ? "font-bold underline" : ""}
          onClick={() => {
            setMode("highlights");
            loadHighlights();
          }}
        >
          Highlights mode
        </button>
        <button
          className={mode === "storyboard" ? "font-bold underline" : ""}
          onClick={() => {
            setMode("storyboard");
            loadStoryboardCandidates();
          }}
        >
          Storyboard mode
        </button>
      </div>

      {mode === "highlights" && (
        <p className="text-sm text-gray-600">{highlights.length} highlight moments found.</p>
      )}

      {mode === "storyboard" && (
        <ul className="space-y-2">
          {candidates.map((candidate) => (
            <li key={candidate.startMs}>
              <button
                className={`border rounded p-2 w-full text-left ${
                  selectedCandidate?.startMs === candidate.startMs ? "bg-gray-100" : ""
                }`}
                onClick={() => setSelectedCandidate(candidate)}
              >
                {(candidate.startMs / 1000).toFixed(0)}s–{(candidate.endMs / 1000).toFixed(0)}s:{" "}
                {candidate.reason}
              </button>
            </li>
          ))}
        </ul>
      )}

      <CaptionStylePicker value={captionStyleId} onChange={setCaptionStyleId} />

      <button
        onClick={createCarousel}
        disabled={
          submitting ||
          !captionStyleId ||
          (mode === "highlights" && highlights.length === 0) ||
          (mode === "storyboard" && !selectedCandidate)
        }
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Generate carousel"}
      </button>
    </div>
  );
}
