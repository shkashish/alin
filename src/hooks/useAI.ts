
import { useEffect } from 'react'
import { useStore } from './useStore'

export function useAI() {
    const messages = useStore(state => state.messages)
    const setResponse = useStore(state => state.setResponse)
    const setLoading = useStore(state => state.setLoading)

    useEffect(() => {
        const activeMessage = messages.find(m => !m.response && !m.planted)

        if (activeMessage) {
            setLoading(true)
            const fetchResponse = async () => {
                console.log("[Backend] Connecting to /api/chat...")

                try {
                    const res = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            inputs: `You are an ancient sage.Respond in 1 - 2 short, poetic, wise sentences to: "${activeMessage.text}"`,
                            parameters: {
                                max_new_tokens: 100,
                                temperature: 0.7,
                                return_full_text: false
                            }
                        })
                    })

                    if (!res.ok) {
                        const err = await res.text()
                        throw new Error(`Server Error: ${res.status} - ${err} `)
                    }

                    const data = await res.json()
                    // HF Inference API returns array of { generated_text }
                    // Or sometimes just { generated_text } depending on endpoint version
                    // Our proxy forwards it raw
                    const text = Array.isArray(data) ? data[0]?.generated_text : data.generated_text

                    if (!text) throw new Error("Empty response from AI")

                    setResponse(activeMessage.id, text.trim())

                } catch (error) {
                    console.error("AI Error:", error)
                    const errMsg = error instanceof Error ? error.message : "Unknown"
                    setResponse(activeMessage.id, `[AI Error] The wind is silent. (${errMsg})`)
                } finally {
                    setLoading(false)
                }
            }

            fetchResponse()
        }
    }, [messages, setResponse, setLoading])
}
