import { useState } from "react";

export function RatingStars({ onSubmit }: { onSubmit: (rating: number) => void }) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="flex items-center gap-2">
      {[1,2,3,4,5].map((n) => (
        <button
          key={n}
          className={`h-10 w-10 rounded-full border ${selected >= n ? "bg-emerald-900 text-white" : "bg-white text-emerald-900"}`}
          onClick={() => setSelected(n)}
        >
          {n}
        </button>
      ))}
      <button
        className="ml-2 px-4 py-2 rounded-lg bg-emerald-900 text-white disabled:opacity-50"
        disabled={selected === 0}
        onClick={() => onSubmit(selected)}
      >
        Submit
      </button>
    </div>
  );
}
