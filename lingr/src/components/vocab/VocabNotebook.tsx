'use client'

import { useState } from 'react'
import type { VocabularyEntry } from '@/types'
import { format, parseISO, startOfWeek } from 'date-fns'
import toast from 'react-hot-toast'

interface VocabNotebookProps {
  vocabulary: VocabularyEntry[]
  partnerName: string
  languageName: string
}

export function VocabNotebook({ vocabulary, partnerName, languageName }: VocabNotebookProps) {
  const [viewMode, setViewMode] = useState<'all' | 'saved'>('all')
  const [selectedWord, setSelectedWord] = useState<VocabularyEntry | null>(null)

  const displayVocab = viewMode === 'saved'
    ? vocabulary.filter(v => v.user_saved)
    : vocabulary

  // Group by week
  const grouped = groupByWeek(displayVocab)

  const handleToggleSave = async (word: VocabularyEntry) => {
    try {
      await fetch('/api/vocabulary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: word.id, userSaved: !word.user_saved }),
      })

      if (!word.user_saved) {
        toast.success(`"${word.word}" saved`)
      }
    } catch {
      toast.error('Failed to update')
    }
  }

  return (
    <div className="notebook-page min-h-full">
      {/* Header */}
      <div
        className="px-6 pt-12 pb-4 safe-top"
        style={{ background: '#F5F0EB' }}
      >
        <h1
          className="font-playfair text-3xl text-[#1A1A1A] mb-1"
          style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}
        >
          Your Notebook
        </h1>
        <p className="text-[#888888] font-inter text-sm">
          Words from {partnerName} in {languageName}
        </p>

        {/* Tab toggles */}
        <div className="flex gap-1 mt-4 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.06)' }}>
          {(['all', 'saved'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="flex-1 py-2 rounded-lg font-inter text-[13px] font-medium transition-all capitalize"
              style={{
                background: viewMode === mode ? 'white' : 'transparent',
                color: viewMode === mode ? '#1A1A1A' : '#888888',
                boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {mode === 'all' ? 'All Words' : '★ Saved'}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4">
          <div className="text-center">
            <p className="font-playfair text-2xl text-[#1A1A1A]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {vocabulary.length}
            </p>
            <p className="text-[10px] text-[#888888] font-inter uppercase tracking-wide">encountered</p>
          </div>
          <div className="w-px h-8 bg-[#1A1A1A]/10" />
          <div className="text-center">
            <p className="font-playfair text-2xl text-[#1A1A1A]" style={{ fontFamily: 'Playfair Display, serif' }}>
              {vocabulary.filter(v => v.user_saved).length}
            </p>
            <p className="text-[10px] text-[#888888] font-inter uppercase tracking-wide">saved</p>
          </div>
        </div>
      </div>

      {/* Word list */}
      <div className="px-6 pb-8">
        {displayVocab.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-playfair italic text-xl text-[#888888] mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              {viewMode === 'saved' ? 'No saved words yet' : 'Your notebook is empty'}
            </p>
            <p className="text-[13px] text-[#AAAAAA] font-inter">
              {viewMode === 'saved'
                ? 'Tap a word in chat to save it here'
                : 'Start chatting with ' + partnerName + ' to fill it up'
              }
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([weekLabel, words]) => (
            <div key={weekLabel} className="mb-8">
              {/* Week heading */}
              <p
                className="text-[11px] text-[#AAAAAA] font-inter uppercase tracking-widest mb-3"
                style={{ letterSpacing: '0.1em' }}
              >
                {weekLabel}
              </p>

              {/* Words */}
              <div className="flex flex-col">
                {words.map((word, i) => (
                  <div key={word.id}>
                    <div
                      className="flex items-start justify-between py-3 cursor-pointer group"
                      onClick={() => setSelectedWord(selectedWord?.id === word.id ? null : word)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className="font-playfair text-[18px] text-[#1A1A1A]"
                            style={{ fontFamily: 'Playfair Display, serif' }}
                          >
                            {word.word}
                          </p>
                          {word.times_seen > 1 && (
                            <span className="text-[10px] text-[#888888] font-inter">
                              ×{word.times_seen}
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-[#888888] font-inter mt-0.5">
                          {word.translation}
                        </p>

                        {/* Expanded view */}
                        {selectedWord?.id === word.id && word.example_sentence && (
                          <div className="mt-2 p-3 rounded-xl animate-fade-in" style={{ background: 'rgba(0,0,0,0.04)' }}>
                            <p className="text-[12px] text-[#888888] font-inter italic">
                              &ldquo;{word.example_sentence}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Save button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleSave(word) }}
                        className="flex-shrink-0 ml-3 mt-0.5 transition-colors"
                        style={{ color: word.user_saved ? '#C0392B' : '#AAAAAA' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={word.user_saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                        </svg>
                      </button>
                    </div>

                    {/* Divider line (notebook ruled line style) */}
                    {i < words.length - 1 && (
                      <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selected word detail sheet */}
      {selectedWord && (
        <div
          className="fixed bottom-16 left-4 right-4 p-4 rounded-2xl animate-slide-up z-10"
          style={{
            background: 'white',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-playfair text-xl text-[#1A1A1A]" style={{ fontFamily: 'Playfair Display, serif' }}>
                {selectedWord.word}
              </p>
              <p className="text-[#888888] font-inter text-sm">{selectedWord.translation}</p>
            </div>
            <button onClick={() => setSelectedWord(null)} className="text-[#AAAAAA]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <p className="text-[11px] text-[#AAAAAA] font-inter mt-2">
            Seen {selectedWord.times_seen} time{selectedWord.times_seen !== 1 ? 's' : ''} ·{' '}
            {format(parseISO(selectedWord.saved_at), 'd MMM yyyy')}
          </p>
        </div>
      )}
    </div>
  )
}

function groupByWeek(vocabulary: VocabularyEntry[]): Record<string, VocabularyEntry[]> {
  const groups: Record<string, VocabularyEntry[]> = {}

  for (const word of vocabulary) {
    const date = parseISO(word.saved_at)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const label = format(weekStart, "'Week of' d MMM")

    if (!groups[label]) groups[label] = []
    groups[label].push(word)
  }

  return groups
}
