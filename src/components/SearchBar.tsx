import { Search } from "lucide-react";
import { useState, FormEvent } from "react";

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-center w-full max-w-2xl mx-auto"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search videos..."
        className="w-full h-10 px-4 py-2 pl-10 text-sm bg-slate-100 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-400 focus:bg-white text-slate-900 placeholder-slate-400 transition-all"
      />
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Search size={18} />
      </div>
      <button
        type="submit"
        className="absolute right-2 px-4 py-1 text-xs font-bold bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
