'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, DollarSign, Compass, ArrowRight, Sparkles } from 'lucide-react';

const cities = [
  { name: 'Delhi NCR, IN', lat: 28.6139, lon: 77.2090 },
  { name: 'Boston, MA', lat: 42.3592, lon: -71.0598 },
  { name: 'Cambridge, MA', lat: 42.3736, lon: -71.1097 },
  { name: 'New York, NY', lat: 40.7128, lon: -74.0060 },
  { name: 'San Francisco, CA', lat: 37.7749, lon: -122.4194 }
];

const availableInterests = [
  '💼 Internships',
  '🎓 Fellowships',
  '🏛️ Conferences',
  '🤖 Artificial Intelligence',
  '💻 Software & Programming',
  '🚀 Entrepreneurship',
  '📈 Business & Management',
  '💰 Finance & Investing',
  '📊 Data Science & Analytics',
  '🎨 Design & Creativity',
  '🎥 Media & Content Creation',
  '📣 Marketing & Branding',
  '🏛️ Policy Making & Governance',
  '⚖️ Law & Justice',
  '🩺 Healthcare & Medicine',
  '🔬 Science & Research',
  '🌱 Climate & Sustainability',
  '🛰️ Space & Aerospace',
  '🔐 Cybersecurity',
  '🎮 Gaming & Interactive Media',
  '🏗️ Engineering & Robotics',
  '🌍 International Relations',
  '🧠 Psychology & Human Behavior'
];

export default function Onboarding() {
  const router = useRouter();
  const [selectedCity, setSelectedCity] = useState(cities[0].name);
  const [budget, setBudget] = useState(100);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [userId, setUserId] = useState('019535d9-3df7-79fb-b466-fa907fa17f9e'); // Default test user ID
  const [educationLevel, setEducationLevel] = useState('Undergrad');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleStartOnboarding = (e: React.FormEvent) => {
    e.preventDefault();

    const cityData = cities.find(c => c.name === selectedCity) || cities[0];

    // Save configuration parameters to localStorage
    const userProfile = {
      userId,
      city: selectedCity,
      latitude: cityData.lat,
      longitude: cityData.lon,
      budget,
      interests: selectedInterests,
      educationLevel
    };

    localStorage.setItem('sidequest_profile', JSON.stringify(userProfile));
    console.log('[ONBOARDING] Profile saved:', userProfile);

    // Navigate to discover feed screen
    router.push('/discover');
  };

  return (
    <div className="min-h-screen bg-[#170F26] text-white flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-violet-600/20 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-amber-500/15 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-lg bg-[#1F1636]/60 backdrop-blur-xl border border-[#382C52]/80 p-8 rounded-3xl shadow-2xl relative z-10">
        
        {/* Title / Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-violet-600 to-amber-400 rounded-2xl shadow-lg mb-4">
            <Compass className="w-8 h-8 text-white animate-spin-slow" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-300 via-violet-200 to-amber-300">
            SideQuestre
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Discover local workshops, events, and hackathons tailored to you.
          </p>
        </div>

        <form onSubmit={handleStartOnboarding} className="space-y-6">
          {/* User ID input (prefilled with step-2 key) */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300 block">User Account ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-[#170F26] border border-[#382C52] rounded-xl px-4 py-3 text-slate-300 text-sm focus:outline-none focus:border-violet-500 transition"
              required
            />
          </div>

          {/* Location City Selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400" />
              Where are you looking for quests?
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-[#170F26] border border-[#382C52] rounded-xl px-4 py-3 text-slate-300 text-sm focus:outline-none focus:border-violet-500 transition"
            >
              {cities.map((city) => (
                <option key={city.name} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          {/* Highest Level of Education Selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400" />
              Highest Education Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['School', 'Undergrad', 'Masters'].map((level) => {
                const active = educationLevel === level;
                return (
                  <button
                    type="button"
                    key={level}
                    onClick={() => setEducationLevel(level)}
                    className={`py-2.5 px-3 rounded-xl border text-center text-xs font-semibold transition ${
                      active
                        ? 'bg-violet-500/10 border-violet-500 text-violet-300 shadow-lg shadow-violet-500/10'
                        : 'bg-[#170F26] border-[#382C52] text-slate-400 hover:border-[#4A3D6B]'
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Maximum Budget */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-400" />
                Maximum Budget Limit
              </label>
              <span className="text-sm font-bold text-amber-400">
                {budget === 0 ? 'Free Quests Only' : `$${budget}`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              step="10"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-violet-500 h-2 bg-[#170F26] rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>$0 (Free)</span>
              <span>$120</span>
              <span>$250+</span>
            </div>
          </div>

          {/* Interests selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Select Primary Interests
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2.5 bg-[#170F26] rounded-xl border border-[#382C52] custom-scrollbar">
              {mounted && availableInterests.map((interest) => {
                const selected = selectedInterests.includes(interest);
                return (
                  <button
                    type="button"
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`text-xs px-2.5 py-2 rounded-lg border transition duration-200 text-left truncate flex items-center gap-1.5 ${
                      selected
                        ? 'bg-violet-500/10 border-violet-500 text-violet-300 shadow-lg shadow-violet-500/10'
                        : 'bg-[#1F1636] border-[#382C52] text-slate-400 hover:border-[#4A3D6B]'
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Onboarding Button */}
          <button
            type="submit"
            className="w-full mt-4 bg-gradient-to-r from-violet-600 to-amber-400 hover:opacity-95 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 transition duration-300"
          >
            Enter Feed Dashboard
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
