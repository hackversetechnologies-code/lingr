import { create } from 'zustand'
import type { Message, UserPartner, VocabularyEntry } from '@/types'

// ============================================
// CHAT STORE
// ============================================

interface ChatState {
  messages: Message[]
  userPartner: UserPartner | null
  isLoading: boolean
  isTyping: boolean
  isRecording: boolean
  remainingMessages: number
  error: string | null

  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
  addMessage: (message: Message) => void
  setUserPartner: (up: UserPartner | null) => void
  setIsLoading: (loading: boolean) => void
  setIsTyping: (typing: boolean) => void
  setIsRecording: (recording: boolean) => void
  setRemainingMessages: (count: number) => void
  setError: (error: string | null) => void
  markMessagesRead: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  userPartner: null,
  isLoading: false,
  isTyping: false,
  isRecording: false,
  remainingMessages: 20,
  error: null,

  setMessages: (messages) =>
    set((state) => ({
      messages: typeof messages === 'function' ? messages(state.messages) : messages,
    })),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setUserPartner: (userPartner) => set({ userPartner }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsTyping: (isTyping) => set({ isTyping }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setRemainingMessages: (remainingMessages) => set({ remainingMessages }),
  setError: (error) => set({ error }),
  markMessagesRead: () =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.role === 'assistant' ? { ...m, is_read: true } : m
      ),
    })),
}))

// ============================================
// VOCABULARY STORE
// ============================================

interface VocabState {
  vocabulary: VocabularyEntry[]
  isLoading: boolean

  setVocabulary: (vocab: VocabularyEntry[]) => void
  addWord: (word: VocabularyEntry) => void
  toggleSaved: (wordId: string) => void
  setIsLoading: (loading: boolean) => void
}

export const useVocabStore = create<VocabState>((set) => ({
  vocabulary: [],
  isLoading: false,

  setVocabulary: (vocabulary) => set({ vocabulary }),
  addWord: (word) =>
    set((state) => ({ vocabulary: [word, ...state.vocabulary] })),
  toggleSaved: (wordId) =>
    set((state) => ({
      vocabulary: state.vocabulary.map((w) =>
        w.id === wordId ? { ...w, user_saved: !w.user_saved } : w
      ),
    })),
  setIsLoading: (isLoading) => set({ isLoading }),
}))

// ============================================
// TRANSLATE OVERLAY STORE
// ============================================

interface TranslateState {
  isOpen: boolean
  word: string
  translation: string
  messageId: string | null

  open: (word: string, translation: string, messageId: string) => void
  close: () => void
}

export const useTranslateStore = create<TranslateState>((set) => ({
  isOpen: false,
  word: '',
  translation: '',
  messageId: null,

  open: (word, translation, messageId) =>
    set({ isOpen: true, word, translation, messageId }),
  close: () => set({ isOpen: false }),
}))

// ============================================
// USER STORE
// ============================================

interface UserState {
  subscriptionTier: 'free' | 'plus' | 'pro'
  setSubscriptionTier: (tier: 'free' | 'plus' | 'pro') => void
}

export const useUserStore = create<UserState>((set) => ({
  subscriptionTier: 'free',
  setSubscriptionTier: (subscriptionTier) => set({ subscriptionTier }),
}))
