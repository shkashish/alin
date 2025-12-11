import { create } from 'zustand'
// import { nanoid } from 'nanoid'
import { db } from '../firebase'
import { ref, push, update, onValue } from 'firebase/database'

export interface Message {
    id: string
    text: string
    response?: string
    timestamp: number
    planted: boolean
}

interface State {
    messages: Message[]
    isTyping: boolean
    isPlanting: boolean
    isLoading: boolean // AI loading state
    addMessage: (text: string) => void
    setResponse: (id: string, response: string) => void
    setLoading: (loading: boolean) => void
    startPlanting: (id: string) => void
    finishPlanting: (id: string) => void
    initialize: () => () => void // Returns unsubscribe function
}

export const useStore = create<State>((set) => ({
    messages: [],
    isTyping: false,
    isPlanting: false,
    isLoading: false,

    initialize: () => {
        const messagesRef = ref(db, 'messages')
        const unsubscribe = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val()
            if (data) {
                // Convert object to array
                const messageList = Object.entries(data).map(([key, value]: [string, any]) => ({
                    ...value,
                    id: key // Use Firebase key as ID
                }))
                set({ messages: messageList })
            } else {
                set({ messages: [] })
            }
        })
        return unsubscribe
    },

    addMessage: (text: string) => {
        const messagesRef = ref(db, 'messages')
        push(messagesRef, {
            text,
            timestamp: Date.now(),
            planted: false
        })
        set({ isTyping: true })
    },

    setResponse: (id: string, response: string) => {
        const messageRef = ref(db, `messages/${id}`)
        update(messageRef, { response })
        set({ isTyping: false })
    },

    setLoading: (loading: boolean) => set({ isLoading: loading }),

    startPlanting: (_id: string) => set({ isPlanting: true }),

    finishPlanting: (id: string) => {
        const messageRef = ref(db, `messages/${id}`)
        // We set isPlanting false LOCALLY to end the animation trigger
        // Then update the DB so it is permanently planted for everyone
        set({ isPlanting: false })
        update(messageRef, { planted: true })
    }
}))
