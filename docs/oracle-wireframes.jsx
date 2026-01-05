import React, { useState } from 'react';

const WeaveIcon = () => (
  <svg viewBox="0 0 40 40" className="w-8 h-8">
    <path
      d="M20 8 L12 16 L20 24 L28 16 Z M20 16 L12 24 L20 32 L28 24 Z"
      fill="none"
      stroke="#C4875A"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M8 20 L16 12 L24 20 L16 28 Z M16 20 L24 12 L32 20 L24 28 Z"
      fill="none"
      stroke="#C4875A"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const Phone = ({ children, label }) => (
  <div className="flex flex-col items-center">
    <div className="bg-gray-900 rounded-[2.5rem] p-2 shadow-2xl">
      <div className="bg-white rounded-[2rem] w-[280px] h-[560px] overflow-hidden relative">
        {/* Status bar */}
        <div className="h-10 bg-gray-50 flex items-center justify-between px-6">
          <span className="text-xs font-medium">09:41</span>
          <div className="w-20 h-6 bg-black rounded-full" />
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 border border-gray-400 rounded-sm">
              <div className="w-3 h-1 bg-gray-400 m-0.5" />
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
    {label && <p className="mt-3 text-sm text-gray-500 font-medium">{label}</p>}
  </div>
);

const Chip = ({ children, highlight }) => (
  <div className={`px-4 py-2.5 rounded-full text-sm ${
    highlight 
      ? 'bg-amber-100 text-amber-800 border border-amber-200' 
      : 'bg-gray-100 text-gray-700'
  }`}>
    {children}
  </div>
);

const FAB = ({ icon, position = 'right', variant = 'primary' }) => (
  <div className={`absolute bottom-6 ${position === 'right' ? 'right-4' : 'left-4'} 
    w-14 h-14 rounded-full shadow-lg flex items-center justify-center
    ${variant === 'primary' ? 'bg-amber-700' : 'bg-amber-50'}`}>
    <span className={variant === 'primary' ? 'text-white text-2xl' : ''}>
      {icon}
    </span>
  </div>
);

// Current State - Insights Tab
const CurrentInsights = () => (
  <Phone label="CURRENT: Insights Tab">
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-amber-700">✧</span>
          <span className="font-semibold text-amber-700">Insights</span>
          <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">6</span>
        </div>
        <div className="flex gap-4 text-gray-400 text-sm">
          <span>Circle</span>
          <span>⚙</span>
        </div>
      </div>
      
      {/* Content placeholder */}
      <div className="flex-1 space-y-3">
        <div className="bg-gray-50 rounded-xl p-4 h-20" />
        <div className="bg-gray-50 rounded-xl p-4 h-32" />
        <div className="bg-gray-50 rounded-xl p-4 h-24" />
      </div>
      
      {/* Problem indicators */}
      <div className="absolute bottom-24 left-4 right-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600">
          ⚠ Eye icon FAB = Oracle
        </div>
      </div>
      
      {/* FABs */}
      <FAB icon="👁" position="right" />
      <div className="absolute bottom-6 left-4 w-14 h-14 rounded-full bg-amber-50 shadow-lg flex items-center justify-center">
        <WeaveIcon />
      </div>
    </div>
  </Phone>
);

// Current State - Circle Tab
const CurrentCircle = () => (
  <Phone label="CURRENT: Circle Tab">
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-gray-400 text-sm">
          <span>Insights</span>
        </div>
        <span className="font-semibold text-amber-700">Circle</span>
        <span className="text-gray-400">⚙</span>
      </div>
      
      {/* Content placeholder */}
      <div className="flex-1 space-y-3">
        <div className="bg-gray-50 rounded-xl p-4 h-16" />
        <div className="bg-green-50 rounded-xl p-4 h-20" />
        <div className="bg-green-50 rounded-xl p-4 h-20" />
        <div className="bg-green-50 rounded-xl p-4 h-20" />
      </div>
      
      {/* Problem indicators */}
      <div className="absolute bottom-24 left-4 right-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-600">
          ⚠ Weave icon = Nudges (different!)
        </div>
      </div>
      
      {/* FABs */}
      <FAB icon="+" position="right" />
      <div className="absolute bottom-6 left-4 w-14 h-14 rounded-full bg-amber-50 shadow-lg flex items-center justify-center">
        <WeaveIcon />
      </div>
    </div>
  </Phone>
);

// Current Oracle View
const CurrentOracle = () => (
  <Phone label="CURRENT: Oracle View">
    <div className="bg-white h-full flex flex-col">
      {/* Handle */}
      <div className="flex justify-center pt-2">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-semibold">Journal</span>
        <span className="text-gray-400">✕</span>
      </div>
      
      {/* Problem: Tab bar that doesn't belong */}
      <div className="px-4 py-2 flex gap-2 text-xs">
        <div className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
          <span className="text-red-500">⚠</span> Feed
        </div>
        <div className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
          <span className="text-red-500">⚠</span> Reflections
        </div>
        <div className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
          <span className="text-red-500">⚠</span> Friends
        </div>
      </div>
      
      <div className="text-xs text-gray-400 px-4">Daily Insight Limit: 999 remaining</div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 mb-4">
          <WeaveIcon />
        </div>
        <h2 className="text-lg font-semibold mb-1">What's on your mind?</h2>
        <p className="text-sm text-gray-500 mb-4">Explore your friendships with guidance.</p>
        
        {/* Problem: Help me write button */}
        <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-full mb-4">
          <span className="text-red-500 text-sm">⚠ Help me write</span>
        </div>
        
        <p className="text-xs text-gray-400 mb-2">or ask about...</p>
        
        <div className="space-y-2 w-full">
          <Chip>Who should I see this week?</Chip>
          <Chip>Which friends need attention?</Chip>
        </div>
      </div>
      
      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
          <span className="text-gray-400 text-sm flex-1">Ask a question...</span>
          <span className="text-gray-300">▸</span>
        </div>
      </div>
    </div>
  </Phone>
);

// PROPOSED: Unified tabs
const ProposedInsights = () => (
  <Phone label="PROPOSED: Insights Tab">
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-amber-700">✧</span>
          <span className="font-semibold text-amber-700">Insights</span>
          <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">6</span>
        </div>
        <div className="flex gap-4 text-gray-400 text-sm">
          <span>Circle</span>
          <span>⚙</span>
        </div>
      </div>
      
      {/* Content placeholder */}
      <div className="flex-1 space-y-3">
        <div className="bg-gray-50 rounded-xl p-4 h-20" />
        <div className="bg-gray-50 rounded-xl p-4 h-32" />
        <div className="bg-gray-50 rounded-xl p-4 h-24" />
      </div>
      
      {/* Success indicators */}
      <div className="absolute bottom-24 left-4 right-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
          ✓ Weave icon → Oracle (consistent)
        </div>
      </div>
      
      {/* FABs - Note: Weave icon on left, Book on right */}
      <div className="absolute bottom-6 right-4 w-14 h-14 rounded-full bg-amber-700 shadow-lg flex items-center justify-center">
        <span className="text-white text-xl">📖</span>
      </div>
      <div className="absolute bottom-6 left-4 w-14 h-14 rounded-full bg-amber-50 shadow-lg flex items-center justify-center">
        <WeaveIcon />
      </div>
    </div>
  </Phone>
);

const ProposedCircle = () => (
  <Phone label="PROPOSED: Circle Tab">
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-4 text-gray-400 text-sm">
          <span>Insights</span>
        </div>
        <span className="font-semibold text-amber-700">Circle</span>
        <span className="text-gray-400">⚙</span>
      </div>
      
      {/* Content placeholder */}
      <div className="flex-1 space-y-3">
        <div className="bg-gray-50 rounded-xl p-4 h-16" />
        <div className="bg-green-50 rounded-xl p-4 h-20" />
        <div className="bg-green-50 rounded-xl p-4 h-20" />
        <div className="bg-green-50 rounded-xl p-4 h-20" />
      </div>
      
      {/* Success indicators */}
      <div className="absolute bottom-24 left-4 right-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
          ✓ Weave icon → Oracle (same action!)
        </div>
      </div>
      
      {/* FABs */}
      <FAB icon="+" position="right" />
      <div className="absolute bottom-6 left-4 w-14 h-14 rounded-full bg-amber-50 shadow-lg flex items-center justify-center">
        <WeaveIcon />
      </div>
    </div>
  </Phone>
);

// Proposed Oracle View
const ProposedOracle = () => (
  <Phone label="PROPOSED: Oracle View">
    <div className="bg-white h-full flex flex-col">
      {/* Handle */}
      <div className="flex justify-center pt-2">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>
      
      {/* Header - simplified */}
      <div className="flex items-center justify-end px-4 py-3">
        <span className="text-gray-400">✕</span>
      </div>
      
      {/* Main content - clean */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 mb-6">
          <WeaveIcon />
        </div>
        <h2 className="text-xl font-semibold mb-8">What's on your mind?</h2>
        
        <div className="space-y-3 w-full">
          <Chip highlight>✧ 6 insights waiting</Chip>
          <Chip>Who should I see today?</Chip>
          <Chip>Tell me about Hannah</Chip>
          <Chip>What are my social patterns?</Chip>
        </div>
      </div>
      
      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex items-center bg-gray-100 rounded-full px-4 py-3">
          <span className="text-gray-400 text-sm flex-1">Ask a question...</span>
          <span className="text-amber-600">▸</span>
        </div>
      </div>
      
      {/* Success badge */}
      <div className="absolute top-16 left-4 right-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700 text-center">
          ✓ Clean, focused, context-aware
        </div>
      </div>
    </div>
  </Phone>
);

// Context-aware Oracle variations
const OracleFromInsights = () => (
  <Phone label="Oracle from Insights">
    <div className="bg-white h-full flex flex-col">
      <div className="flex justify-center pt-2">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>
      <div className="flex items-center justify-end px-4 py-3">
        <span className="text-gray-400">✕</span>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 mb-4">
          <WeaveIcon />
        </div>
        <h2 className="text-lg font-semibold mb-6">What's on your mind?</h2>
        
        <div className="space-y-2 w-full">
          <Chip highlight>✧ 6 insights waiting</Chip>
          <Chip>Summarise my week</Chip>
          <Chip>How am I doing?</Chip>
          <Chip>What are my patterns?</Chip>
        </div>
        
        <p className="text-xs text-amber-600 mt-4">↑ Reflection-focused chips</p>
      </div>
      
      <div className="p-4 border-t">
        <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
          <span className="text-gray-400 text-sm flex-1">Ask a question...</span>
        </div>
      </div>
    </div>
  </Phone>
);

const OracleFromCircle = () => (
  <Phone label="Oracle from Circle">
    <div className="bg-white h-full flex flex-col">
      <div className="flex justify-center pt-2">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>
      <div className="flex items-center justify-end px-4 py-3">
        <span className="text-gray-400">✕</span>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 mb-4">
          <WeaveIcon />
        </div>
        <h2 className="text-lg font-semibold mb-6">What's on your mind?</h2>
        
        <div className="space-y-2 w-full">
          <Chip highlight>✧ 6 insights waiting</Chip>
          <Chip>Tell me about Hannah</Chip>
          <Chip>Who needs attention?</Chip>
          <Chip>Who should I see today?</Chip>
        </div>
        
        <p className="text-xs text-amber-600 mt-4">↑ Friend-focused chips</p>
      </div>
      
      <div className="p-4 border-t">
        <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
          <span className="text-gray-400 text-sm flex-1">Ask a question...</span>
        </div>
      </div>
    </div>
  </Phone>
);

export default function OracleWireframes() {
  const [view, setView] = useState('comparison');
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Global Oracle Wireframes</h1>
          <p className="text-gray-600">Visual reference for the proposal</p>
        </div>
        
        {/* View toggle */}
        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => setView('comparison')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              view === 'comparison' 
                ? 'bg-amber-700 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Before / After
          </button>
          <button
            onClick={() => setView('context')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              view === 'context' 
                ? 'bg-amber-700 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Context-Aware
          </button>
        </div>
        
        {view === 'comparison' && (
          <>
            {/* Current State */}
            <div className="mb-12">
              <h2 className="text-xl font-semibold text-gray-700 mb-6 text-center">
                <span className="text-red-500">✗</span> Current State — Fragmented Access
              </h2>
              <div className="flex justify-center gap-8 flex-wrap">
                <CurrentInsights />
                <CurrentCircle />
                <CurrentOracle />
              </div>
            </div>
            
            {/* Divider */}
            <div className="flex items-center gap-4 my-12">
              <div className="flex-1 h-px bg-gray-300" />
              <span className="text-2xl">↓</span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>
            
            {/* Proposed State */}
            <div>
              <h2 className="text-xl font-semibold text-gray-700 mb-6 text-center">
                <span className="text-green-500">✓</span> Proposed State — Unified Oracle
              </h2>
              <div className="flex justify-center gap-8 flex-wrap">
                <ProposedInsights />
                <ProposedCircle />
                <ProposedOracle />
              </div>
            </div>
          </>
        )}
        
        {view === 'context' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-6 text-center">
              Context-Aware Suggestion Chips
            </h2>
            <p className="text-center text-gray-500 mb-8 max-w-xl mx-auto">
              The Oracle adapts its suggestions based on where the user opened it from, 
              surfacing the most relevant queries for that context.
            </p>
            <div className="flex justify-center gap-8 flex-wrap">
              <OracleFromInsights />
              <OracleFromCircle />
            </div>
          </div>
        )}
        
        {/* Legend */}
        <div className="mt-12 flex justify-center gap-8 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded" />
            <span>Problem area</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded" />
            <span>Improvement</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-100 border border-amber-200 rounded" />
            <span>Highlighted chip</span>
          </div>
        </div>
      </div>
    </div>
  );
}
