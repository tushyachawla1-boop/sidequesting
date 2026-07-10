'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { X, Heart, Bookmark, RefreshCw, Compass, MapPin, DollarSign, Calendar, Sparkles, ExternalLink } from 'lucide-react';

interface QuestFeedItem {
  id: string;
  title: string;
  organizer: string;
  status: string;
  lifecycle_type: string;
  price: number;
  currency: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  tags: string[];
  start_date: string;
  tagAffinity: number;
  semanticSimilarity: number;
  feed_deck: 'high_affinity' | 'semantic_adjacent' | 'wildcard';
  summary: string;
  raw_source_url?: string;
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

const getLifecycleBadgeStyle = (type: string) => {
  const t = type.toLowerCase();
  if (t === 'workshop') return 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300';
  if (t === 'hackathon') return 'bg-rose-500/15 border border-rose-500/30 text-rose-300';
  if (t === 'course' || t === 'fellowship') return 'bg-amber-500/15 border border-amber-500/30 text-amber-300';
  if (t === 'internship') return 'bg-violet-500/15 border border-violet-500/30 text-violet-300';
  return 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300';
};

export default function Discover() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [quests, setQuests] = useState<QuestFeedItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Framer Motion motion values for drag tracking
  const dragX = useMotionValue(0);
  
  // Transform horizontal drag offset (x) into tilt rotation and opacity overlays
  const rotate = useTransform(dragX, [-200, 200], [-25, 25]);
  const opacityLike = useTransform(dragX, [0, 100], [0, 1]);
  const opacityNope = useTransform(dragX, [-100, 0], [1, 0]);

  useEffect(() => {
    const savedProfile = localStorage.getItem('sidequest_profile');
    if (!savedProfile) {
      router.push('/');
      return;
    }
    const parsedProfile = JSON.parse(savedProfile);
    setProfile(parsedProfile);

    const fetchFeed = async () => {
      try {
        setLoading(true);
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const url = new URL(`${apiBaseUrl}/api/v1/quests/feed`);
        url.searchParams.append('user_id', parsedProfile.userId);
        url.searchParams.append('lat', parsedProfile.latitude.toString());
        url.searchParams.append('lon', parsedProfile.longitude.toString());
        url.searchParams.append('radius_miles', '50');
        url.searchParams.append('max_budget', parsedProfile.budget.toString());
        url.searchParams.append('education_level', parsedProfile.educationLevel || 'Undergrad');
        if (parsedProfile.interests && parsedProfile.interests.length > 0) {
          url.searchParams.append('interests', parsedProfile.interests.join(','));
        }

        const res = await fetch(url.toString());
        if (!res.ok) {
          throw new Error('Failed to load quest feeds from API');
        }
        const data = await res.json();
        setQuests(data.feed || []);
      } catch (err: any) {
        console.error('[DISCOVER] Error fetching feed:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, [router]);

  const handleSwipe = async (action: 'Interested' | 'Skipped') => {
    if (currentIndex >= quests.length) return;

    const quest = quests[currentIndex];
    
    // 1. Post swipe to backend API
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      await fetch(`${apiBaseUrl}/swipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: profile.userId,
          quest_id: quest.id,
          action: action
        })
      });
      console.log(`[SWIPE] Swiped ${action} on Quest ${quest.id}`);
    } catch (err) {
      console.error('[SWIPE] Failed to post swipe to backend:', err);
    }

    // 2. If Interested, save to bookmarks
    if (action === 'Interested') {
      const savedList = localStorage.getItem('sidequest_saved') || '[]';
      const parsedList = JSON.parse(savedList) as QuestFeedItem[];
      if (!parsedList.some(item => item.id === quest.id)) {
        localStorage.setItem('sidequest_saved', JSON.stringify([...parsedList, quest]));
        console.log('[BOOKMARK] Saved quest:', quest.title);
      }
    }

    // Reset drag value and increment card index
    dragX.set(0);
    setCurrentIndex(prev => prev + 1);
  };

  const handleDragEnd = (_event: any, info: any) => {
    const threshold = 120; // Trigger distance in pixels
    const offset = info.offset.x;

    if (offset > threshold) {
      handleSwipe('Interested');
    } else if (offset < -threshold) {
      handleSwipe('Skipped');
    }
  };

  const resetFeed = () => {
    setCurrentIndex(0);
    dragX.set(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center">
        <Compass className="w-12 h-12 text-violet-500 animate-spin-slow mb-4" />
        <p className="text-slate-400 text-sm">Searching the grid for adjacent quests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6 text-center">
        <div className="p-3 bg-red-600/20 border border-red-500/30 rounded-full mb-4">
          <X className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-red-400 font-bold mb-2">Backend Connection Failed</p>
        <p className="text-slate-400 max-w-sm text-sm mb-6">
          Make sure your Express API server is active on <code className="bg-slate-900 px-1.5 py-0.5 rounded text-white">http://localhost:5001</code>.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-2.5 px-6 rounded-xl transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const hasCards = currentIndex < quests.length;
  const currentCard = hasCards ? quests[currentIndex] : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center relative overflow-hidden p-4 select-none">
      {/* Background radial gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-rose-600/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-violet-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Header bar */}
      <header className="w-full max-w-md flex justify-between items-center py-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-tr from-rose-500 via-pink-500 to-violet-600 rounded-xl">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
            SideQuestre
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/saved')}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition text-slate-300 flex items-center gap-1.5 text-xs font-semibold"
          >
            <Bookmark className="w-4 h-4 text-rose-400" />
            Saved
          </button>
          <button
            onClick={() => router.push('/')}
            className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition text-slate-300"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Main card deck swipe area */}
      <main className="flex-1 w-full max-w-md flex flex-col justify-center py-8 relative z-10">
        <div className="relative w-full aspect-[3/4] max-h-[500px]">
          <AnimatePresence>
            {hasCards && currentCard ? (
              <motion.div
                key={currentCard.id}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                style={{ x: dragX, rotate }}
                onDragEnd={handleDragEnd}
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between cursor-grab active:cursor-grabbing select-none"
              >
                {/* LIKE (Green) overlay */}
                <motion.div
                  style={{ opacity: opacityLike }}
                  className="absolute inset-0 bg-emerald-500/25 border-4 border-emerald-500 rounded-3xl flex items-center justify-center pointer-events-none z-20"
                >
                  <span className="text-emerald-400 border-4 border-emerald-400 font-extrabold text-3xl px-6 py-3 rounded-xl uppercase tracking-widest rotate-[-12deg]">
                    Interested
                  </span>
                </motion.div>

                {/* NOPE (Red) overlay */}
                <motion.div
                  style={{ opacity: opacityNope }}
                  className="absolute inset-0 bg-red-500/25 border-4 border-red-500 rounded-3xl flex items-center justify-center pointer-events-none z-20"
                >
                  <span className="text-red-400 border-4 border-red-400 font-extrabold text-3xl px-6 py-3 rounded-xl uppercase tracking-widest rotate-[12deg]">
                    Skipped
                  </span>
                </motion.div>

                <div>
                  {/* Category & Deck indicator */}
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <span className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full ${getLifecycleBadgeStyle(currentCard.lifecycle_type)}`}>
                      {currentCard.lifecycle_type}
                    </span>
                    
                    <span className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full border ${
                      currentCard.feed_deck === 'high_affinity'
                        ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-300'
                        : currentCard.feed_deck === 'semantic_adjacent'
                        ? 'bg-blue-600/20 border-blue-500/30 text-blue-300'
                        : 'bg-amber-600/20 border-amber-500/30 text-amber-300'
                    }`}>
                      {currentCard.feed_deck.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Title & Host */}
                  <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
                    {currentCard.title}
                  </h2>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
                      Hosted by <span className="text-slate-200 font-semibold">{currentCard.organizer}</span>
                    </p>
                    {currentCard.raw_source_url && (
                      <a
                        href={currentCard.raw_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 hover:text-rose-350 transition shrink-0 bg-rose-950/20 px-2.5 py-1 rounded-lg border border-rose-900/50"
                        onClick={(e) => e.stopPropagation()} // Prevent card drag trigger
                      >
                        Apply Now
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {/* Metadata fields */}
                  <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-rose-450 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 block">COST</span>
                        <span className="text-xs font-semibold text-slate-200">
                          {currentCard.price === 0 ? 'Free' : `$${currentCard.price}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-rose-450 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 block">LOCATION</span>
                        <span className="text-xs font-semibold text-slate-200 truncate block max-w-[120px]">
                          {currentCard.formatted_address}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-rose-450 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 block">DATE</span>
                        <span className="text-xs font-semibold text-slate-200">
                          {new Date(currentCard.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-rose-450 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 block">AFFINITY</span>
                        <span className="text-xs font-semibold text-slate-200">
                          Match Score: {currentCard.tagAffinity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Summary */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">AI Summary</span>
                    <p className="text-slate-300 text-sm leading-relaxed font-normal">
                      {currentCard.summary}
                    </p>
                  </div>
                </div>

                {/* Footer tags */}
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {currentCard.tags.slice(0, 4).map((tag, idx) => (
                    <span key={idx} className={`text-[10px] px-2 py-1 rounded ${getTagBadgeStyle(tag)}`}>
                      #{tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col justify-center items-center text-center aspect-[3/4] max-h-[500px]">
                <div className="p-4 bg-rose-600/10 border border-rose-500/20 rounded-full mb-4">
                  <Compass className="w-10 h-10 text-rose-450 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold mb-1">That's All the Quests!</h3>
                <p className="text-slate-400 text-xs max-w-xs mb-6">
                  You have swiped through all active listings within your radius bubble and budget cap.
                </p>
                <button
                  onClick={resetFeed}
                  className="bg-gradient-to-r from-rose-500 via-pink-500 to-violet-600 hover:opacity-95 text-white text-xs font-bold py-3 px-6 rounded-xl transition duration-200"
                >
                  Reset Swiping Feed
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom swipe helper buttons */}
      {hasCards && (
        <footer className="w-full max-w-md flex justify-center gap-6 py-4 relative z-10">
          <button
            onClick={() => handleSwipe('Skipped')}
            className="w-14 h-14 bg-slate-900 border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-400 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <X className="w-6 h-6" />
          </button>
          <button
            onClick={() => handleSwipe('Interested')}
            className="w-14 h-14 bg-gradient-to-tr from-rose-500 via-pink-500 to-violet-600 text-white rounded-full shadow-lg shadow-rose-500/20 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <Heart className="w-6 h-6 fill-current" />
          </button>
        </footer>
      )}
    </div>
  );
}
