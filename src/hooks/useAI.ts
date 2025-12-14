
import { useEffect, useRef } from 'react'
import { useStore, clearConfirmedResponse } from './useStore'

export function useAI() {
    const messages = useStore(state => state.messages)
    const setResponse = useStore(state => state.setResponse)
    const setLoading = useStore(state => state.setLoading)
    const setProcessingMessage = useStore(state => state.setProcessingMessage)

    // Track which message ID is currently being processed to prevent duplicate requests (race conditions)
    const processingRef = useRef<string | null>(null)
    const setResponseRef = useRef(setResponse)
    const setLoadingRef = useRef(setLoading)
    const setProcessingMessageRef = useRef(setProcessingMessage)

    // Keep refs in sync
    useEffect(() => {
        setResponseRef.current = setResponse
        setLoadingRef.current = setLoading
        setProcessingMessageRef.current = setProcessingMessage
    }, [setResponse, setLoading, setProcessingMessage])

    useEffect(() => {
        const activeMessage = messages.find(m => !m.response && !m.planted)

        console.log('[useAI] Effect triggered. Active message:', activeMessage?.id, 'Processing:', processingRef.current)
        if (activeMessage) {
            console.log('[useAI] Active message BEFORE processing:', {
                id: activeMessage.id,
                text: activeMessage.text,
                response: activeMessage.response,
                planted: activeMessage.planted
            })
        }

        // Don't process if already processing this message
        if (activeMessage && processingRef.current !== activeMessage.id) {
            console.log(`[useAI] ✅ Starting to process message: ${activeMessage.id}`)
            processingRef.current = activeMessage.id
            clearConfirmedResponse() // Clear previous message's confirmed response
            setProcessingMessageRef.current(activeMessage.id) // Mark as processing in store
            setLoadingRef.current(true)

            const fetchResponse = async (retryCount = 0) => {
                console.log(`[useAI] 📡 Connecting to /api/chat... (Attempt ${retryCount + 1})`)

                try {
                    const requestBody = {
                        model: "google/gemma-2-9b-it",
                        messages: [
                            { role: "system", content: "You are an ancient philosopher and a magician. Respond with profound wisdom and poetry in 5-7 sentences" },
                            { role: "user", content: activeMessage.text }
                        ],
                        max_tokens: 200,
                        temperature: 0.7
                    }
                    
                    console.log(`[useAI] 📤 Request body:`, JSON.stringify(requestBody, null, 2))
                    
                    const res = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    })

                    if (!res.ok) {
                        const err = await res.text()
                        console.error(`[useAI] ❌ HTTP Error: ${res.status} - ${err}`)
                        // If 500 or 429, throw to trigger retry. 
                        throw new Error(`Server Error: ${res.status} - ${err} `)
                    }

                    const data = await res.json()
                    console.log(`[useAI] 📥 Response data:`, JSON.stringify(data, null, 2))

                    // Parse OpenAI-compatible response
                    const text = data.choices?.[0]?.message?.content

                    if (!text) {
                        console.error(`[useAI] ❌ Empty response from AI`)
                        throw new Error("Empty response from AI")
                    }

                    console.log(`[useAI] ✅ Got response from API: ${text.substring(0, 100)}...`)
                    console.log(`[useAI] Setting response for message ${activeMessage.id}`)
                    console.log(`[useAI] Response before trim: ${JSON.stringify(text)}`)
                    const trimmedText = text.trim()
                    console.log(`[useAI] Response after trim: ${JSON.stringify(trimmedText)}`)
                    setResponseRef.current(activeMessage.id, trimmedText)
                    processingRef.current = null // Reset on success
                    setProcessingMessageRef.current(null) // Clear processing flag
                    setLoadingRef.current(false)
                    console.log(`[useAI] ✅ Message processed successfully`)

                } catch (error) {
                    console.error(`[useAI] ❌ AI Error (Attempt ${retryCount + 1}):`, error)

                    if (retryCount < 2) {
                        // Retry after short delay - DON'T show error yet
                        console.log(`[useAI] 🔄 Retrying in 1 second...`)
                        setTimeout(() => fetchResponse(retryCount + 1), 1000)
                        return // Exit early, don't execute finally block
                    }

                    // All retries exhausted - silently fail
                    console.error('[useAI] ❌ All retry attempts failed. Giving up.')
                    processingRef.current = null // Reset on failure
                    setLoadingRef.current(false) // Stop loading on final failure
                }
            }

            fetchResponse()
        } else if (activeMessage) {
            console.log(`[useAI] ⏸️ Skipping processing. Already processing: ${processingRef.current === activeMessage.id}`)
        }
    }, [messages])
}

