
import { useEffect, useRef } from 'react'
import { useStore } from './useStore'

export function useAI() {
    const messages = useStore(state => state.messages)
    const setResponse = useStore(state => state.setResponse)
    const setLoading = useStore(state => state.setLoading)

    // Track which message ID is currently being processed to prevent duplicate requests (race conditions)
    const processingRef = useRef<string | null>(null)

    useEffect(() => {
        const activeMessage = messages.find(m => !m.response && !m.planted)

        if (activeMessage && processingRef.current !== activeMessage.id) {
            processingRef.current = activeMessage.id

            // Clear any stale error response from a previous failed attempt
            if (activeMessage.response && activeMessage.response.includes('[AI Error]')) {
                setResponse(activeMessage.id, '')
            }

            setLoading(true)

            const fetchResponse = async (retryCount = 0) => {
                console.log(`[Backend] Connecting to /api/chat... (Attempt ${retryCount + 1})`)

                try {
                    const res = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            model: "meta-llama/Llama-3.2-3B-Instruct",
                            messages: [
                                { role: "system", content: "You are an ancient sage. Respond in 1-2 short, poetic, wise sentences." },
                                { role: "user", content: activeMessage.text }
                            ],
                            max_tokens: 100,
                            temperature: 0.7
                        })
                    })

                    if (!res.ok) {
                        const err = await res.text()
                        // If 500 or 429, throw to trigger retry. 
                        throw new Error(`Server Error: ${res.status} - ${err} `)
                    }

                    const data = await res.json()

                    // Parse OpenAI-compatible response
                    const text = data.choices?.[0]?.message?.content

                    if (!text) throw new Error("Empty response from AI")

                    setResponse(activeMessage.id, text.trim())
                    processingRef.current = null // Reset on success

                } catch (error) {
                    console.error(`AI Error (Attempt ${retryCount + 1}):`, error)

                    if (retryCount < 2) {
                        // Retry after short delay - DON'T show error yet
                        setTimeout(() => fetchResponse(retryCount + 1), 1000)
                        return // Exit early, don't execute finally block
                    }

                    // All retries exhausted - silently fail
                    // (Don't show error message since retries usually succeed)
                    console.error('All retry attempts failed. Giving up silently.')
                    processingRef.current = null // Reset on failure
                    setLoading(false) // Stop loading on final failure
                }
            }

            fetchResponse()
        }
    }, [messages, setResponse, setLoading])
}
