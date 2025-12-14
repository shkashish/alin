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
    confirmedResponseId?: string // Track which response has been validated by the store
}

interface State {
    messages: Message[]
    isTyping: boolean
    isPlanting: boolean
    isLoading: boolean // AI loading state
    processingMessageId: string | null // Track which message is currently being processed
    addMessage: (text: string) => void
    setResponse: (id: string, response: string) => void
    setLoading: (loading: boolean) => void
    setProcessingMessage: (id: string | null) => void
    startPlanting: (id: string) => void
    finishPlanting: (id: string) => void
    initialize: () => () => void // Returns unsubscribe function
}

let updateTimeout: ReturnType<typeof setTimeout> | null = null
let pendingData: any = null
let lastUpdateTime = 0
let lastSetResponseId: string | null = null
let lastSetResponseValue: string | null = null
let confirmedMessageId: string | null = null // Track which message's response has been confirmed

export const useStore = create<State>((set) => ({
    messages: [],
    isTyping: false,
    isPlanting: false,
    isLoading: false,
    processingMessageId: null,

    initialize: () => {
        const messagesRef = ref(db, 'messages')
        const unsubscribe = onValue(messagesRef, (snapshot) => {
            const data = snapshot.val()
            console.log('[Store] Firebase data updated:', data)
            
            // Store the pending data
            pendingData = data
            const now = Date.now()
            
            // Clear existing timeout
            if (updateTimeout) clearTimeout(updateTimeout)
            
            // If this update came very soon after the last one (< 200ms), it's likely a partial write
            // Wait longer to let it complete
            const timeSinceLastUpdate = now - lastUpdateTime
            const debounceTime = timeSinceLastUpdate < 200 ? 300 : 100
            
            console.log('[Store] Debouncing update for', debounceTime, 'ms (last update was', timeSinceLastUpdate, 'ms ago)')
            
            // Debounce updates to avoid rendering stale data
            updateTimeout = setTimeout(() => {
                if (pendingData) {
                    if (pendingData) {
                        // Convert object to array and SORT BY TIMESTAMP
                        const messageList = Object.entries(pendingData)
                            .map(([key, value]: [string, any]) => ({
                                ...value,
                                id: key // Use Firebase key as ID
                            }))
                            .sort((a: Message, b: Message) => a.timestamp - b.timestamp)
                        
                        // If we just set a response, verify the message has the correct response
                        // before updating state
                        if (lastSetResponseId && lastSetResponseValue) {
                            const updatedMessage = messageList.find(m => m.id === lastSetResponseId)
                            if (updatedMessage && updatedMessage.response === lastSetResponseValue) {
                                console.log('[Store] ✅ Confirmed response was set correctly')
                                confirmedMessageId = lastSetResponseId
                                lastSetResponseId = null
                                lastSetResponseValue = null
                            } else if (updatedMessage && updatedMessage.response && updatedMessage.response !== lastSetResponseValue) {
                                console.log('[Store] ⚠️ Stale data detected, skipping update')
                                return // Skip this update, it's stale
                            }
                        }
                        
                        // Mark confirmed responses
                        const finalMessageList = messageList.map((m: Message) => 
                            m.id === confirmedMessageId ? { ...m, confirmedResponseId: confirmedMessageId } : m
                        )
                        
                        console.log('[Store] Message list order:', finalMessageList.map((m: Message) => ({
                            id: m.id.substring(0, 8),
                            text: m.text.substring(0, 20),
                            response: !!m.response,
                            planted: m.planted,
                            timestamp: m.timestamp
                        })))
                        set({ messages: finalMessageList })
                    } else {
                        set({ messages: [] })
                    }
                }
                pendingData = null
                lastUpdateTime = now
            }, debounceTime)
        })
        return unsubscribe
    },

    addMessage: (text: string) => {
        console.log('[Store] Adding message:', text)
        const messagesRef = ref(db, 'messages')
        push(messagesRef, {
            text,
            timestamp: Date.now(),
            planted: false
        })
        set({ isTyping: true })
    },

    setResponse: (id: string, response: string) => {
        console.log('[Store] Setting response for message:', id)
        console.log('[Store] Response length:', response.length)
        console.log('[Store] Response preview:', response.substring(0, 100))
        console.log('[Store] Full response being saved:', JSON.stringify(response))
        
        // Track what we're setting so we can detect stale data
        lastSetResponseId = id
        lastSetResponseValue = response
        
        const messageRef = ref(db, `messages/${id}`)
        update(messageRef, { response })
        set({ isTyping: false })
    },

    setProcessingMessage: (id: string | null) => set({ processingMessageId: id }),

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

// Export function to clear confirmed message when starting a new one
export function clearConfirmedResponse() {
    confirmedMessageId = null
}
