'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Calendar, MapPin, DollarSign, ExternalLink, Bookmark } from 'lucide-react';

interface SavedQuest {
  id: string;
  title: string;
  organizer: string;
  price: number;
  currency: string;
  formatted_address: string;
  tags: string[];
  start_date: string;
  summary: string;
  raw_source_url: string;
}

const getTagBadgeStyle = (tag: string) => {
  const t = tag.toLowerCase();
  if (t.includes('volunteer')) {
    return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  } else if (t.includes('fellow')) {
    return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  } else if (t.includes('humanities') || t.includes('art') || t.includes('heritage') || t.includes('design') || t.includes('uiux') || t.includes('creative')) {
    return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
  } else if (t.includes('quantum') || t.includes('physic') || t.includes('ai') || t.includes('comput') || t.includes('algorithm') || t.includes('learning')) {
    return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
  } else if (t.includes('outdoor') || t.includes('sailing') || t.includes('adventure') || t.includes('sport') || t.includes('environment')) {
    return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
  }
  return 'bg-slate-950 text-slate-400 border border-slate-800/80';
};

export default function SavedQuests() {
  const router = useRouter();
  const [savedQuests, setSavedQuests] = useState<SavedQuest[]>([]);

  useEffect(() => {
    // Fetch bookmarks from localStorage
    const bookmarks = localStorage.getItem('sidequest_saved') || '[]';
    setSavedQuests(JSON.parse(bookmarks));
  }, []);

  const removeBookmark = (id: string) => {
    const updated = savedQuests.filter(q => q.id !== id);
    setSavedQuests(updated);
    localStorage.setItem('sidequest_saved', JSON.stringify(updated));
    console.log(`[BOOKMARK] Removed quest ID: ${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center relative overflow-hidden p-4">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-rose-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-violet-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Header bar */}
      <header className="w-full max-w-2xl flex justify-between items-center py-4 relative z-10 border-b border-slate-900 mb-6">
        <button
          onClick={() => router.push('/discover')}
          className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition text-slate-300 flex items-center gap-2 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discover
        </button>
        
        <div className="flex items-center gap-1.5">
          <Bookmark className="w-5 h-5 text-rose-400" />
          <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Saved Quests
          </span>
        </div>
      </header>

      {/* Dashboard view list */}
      <main className="flex-1 w-full max-w-2xl relative z-10 space-y-4 pb-12">
        {savedQuests.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {savedQuests.map((quest) => (
              <div
                key={quest.id}
                className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700/80 transition duration-200"
              >
                <div>
                  {/* Title & Action header */}
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
                      {quest.title}
                    </h3>
                    <button
                      onClick={() => removeBookmark(quest.id)}
                      className="p-2 bg-slate-950 border border-slate-800 hover:border-red-950 hover:text-red-400 rounded-lg text-slate-400 transition"
                      title="Remove Bookmark"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Host info */}
                  <p className="text-slate-400 text-xs mb-4">
                    Hosted by <span className="text-slate-200 font-semibold">{quest.organizer}</span>
                  </p>

                  {/* Metadata fields */}
                  <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/40">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-rose-400" />
                      <span>{quest.price === 0 ? 'Free' : `${quest.currency === 'INR' ? '₹' : '$'}${quest.price}`}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-400" />
                      <span className="truncate max-w-[150px]">{quest.formatted_address}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span className="font-semibold">Open Now</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    {quest.summary}
                  </p>
                </div>

                {/* Footer tags and Link action */}
                <div className="flex justify-between items-center mt-2 border-t border-slate-800/60 pt-4">
                  <div className="flex flex-wrap gap-1">
                    {quest.tags.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className={`text-[10px] px-2 py-0.5 rounded ${getTagBadgeStyle(tag)}`}>
                        #{tag}
                      </span>
                    ))}
                  </div>

                  {/* External registration link */}
                  {quest.raw_source_url && (
                    <a
                      href={quest.raw_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-rose-450 hover:text-rose-400 transition"
                    >
                      Register
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty Saved state */
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center flex flex-col justify-center items-center">
            <Bookmark className="w-12 h-12 text-slate-600 mb-4" />
            <h3 className="text-lg font-bold mb-1">No Saved Bookmarks</h3>
            <p className="text-slate-400 text-xs max-w-xs mb-6">
              Swipe Right ("Interested") on quest cards in discover mode to save bookmarks here.
            </p>
            <button
              onClick={() => router.push('/discover')}
              className="bg-gradient-to-r from-rose-500 via-pink-500 to-violet-600 hover:opacity-95 text-white text-xs font-bold py-3 px-6 rounded-xl transition duration-200"
            >
              Start Discovering
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
