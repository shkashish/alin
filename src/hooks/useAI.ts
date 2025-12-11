import { useEffect } from 'react'
import { useStore } from './useStore'

const API_KEY = "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"

// Using the OpenAI-compatible endpoint as requested.
const PROXY_URL = "/api/hf/v1/chat/completions"
// Using the explicitly requested supported model.
const MODEL_ID = "meta-llama/Llama-3.2-3B-Instruct"

export function useAI() {
    const messages = useStore(state => state.messages)
    const setResponse = useStore(state => state.setResponse)
    const setLoading = useStore(state => state.setLoading)

    useEffect(() => {
        const activeMessage = messages.find(m => !m.response && !m.planted)

        if (activeMessage) {
            setLoading(true)
            const fetchResponse = async () => {
                try {
                    const res = await fetch(PROXY_URL, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${API_KEY}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            model: MODEL_ID,
                            messages: [
                                {
                                    role: "system",
                                    content: "You are an ancient sage of profound wisdom. Respond to the user’s thought in 1-2 short, poetic sentences – offer gentle, insightful guidance that inspires growth and peace, like a seed of enlightenment. Be concise, empathetic, and timeless."
                                },
                                {
                                    role: "user",
                                    content: activeMessage.text
                                }
                            ],
                            max_tokens: 100,
                            temperature: 0.7,
                            stream: false
                        }),
                    })

                    if (!res.ok) {
                        const errText = await res.text()
                        throw new Error(`API Error: ${res.status} ${res.statusText} - ${errText}`)
                    }

                    const data = await res.json()
                    const text = data.choices?.[0]?.message?.content

                    if (!text) throw new Error("No output from AI")

                    setResponse(activeMessage.id, text.trim())

                } catch (error) {
                    console.error("AI Error:", error)
                    setResponse(activeMessage.id, `Error: The spirits could not connect (${error instanceof Error ? error.message : 'Unknown'}).`)
                } finally {
                    setLoading(false)
                }
            }

            fetchResponse()
        }
    }, [messages, setResponse, setLoading])
}
