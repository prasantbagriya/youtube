import { useState } from "react";

const CATEGORIES = [
  "All",
  "Subscriptions",
  "Gaming",
  "Music",
  "Live Streams",
  "News",
  "Programming",
  "Podcasts",
  "Comedy",
  "Movies",
  "Sports",
  "Tech Reviews",
  "Food & Travel",
];

interface CategoryChipsProps {
  onSelect: (category: string) => void;
}

export function CategoryChips({ onSelect }: CategoryChipsProps) {
  const [active, setActive] = useState("All");

  const handleSelect = (cat: string) => {
    setActive(cat);
    onSelect(cat);
  };

  return (
    <div className="flex items-center gap-3 overflow-x-auto py-3 px-6 bg-white sticky top-0 z-30 no-scrollbar border-b border-[#e5e5e5] md:border-none">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => handleSelect(cat)}
          className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            active === cat
              ? "bg-[#0f0f0f] text-white"
              : "bg-[#f2f2f2] text-[#0f0f0f] hover:bg-[#e5e5e5]"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
