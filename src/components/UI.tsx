import { useState, useEffect } from 'react'
import { useStore } from '../hooks/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import { useAI } from '../hooks/useAI'

export function UI() {
    useAI() // Initialize AI listener
    const [input, setInput] = useState('')
    const messages = useStore(state => state.messages)
    const addMessage = useStore(state => state.addMessage)
    const startPlanting = useStore(state => state.startPlanting)
    const isPlanting = useStore(state => state.isPlanting)
    // Clean unused variables for lint
    // const isTyping = useStore(state => state.isTyping)

    // Find the latest active message (not yet planted)
    const activeMessage = messages.find(m => !m.planted)

    // Trigger planting flow when response arrives
    useEffect(() => {
        if (activeMessage?.response && !isPlanting) {
            // Delay planting so user can read the text
            const timer = setTimeout(() => {
                startPlanting(activeMessage.id)
            }, 8000) // 8 seconds to read
            return () => clearTimeout(timer)
        }
    }, [activeMessage, isPlanting, startPlanting])

    const handleSend = () => {
        if (!input.trim() || activeMessage) return
        addMessage(input)
        setInput('')
        // Trigger AI mock for now (will be replaced by real API hook later)
    }

    return (
        <div
            className="absolute inset-0 pointer-events-none z-50 flex flex-col justify-end pb-8 px-4"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 50 }}
        >
            {/* Active Conversation Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                <AnimatePresence>
                    {activeMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
                            className="max-w-md w-full space-y-4"
                        >
                            {/* User Message */}
                            <div className="flex justify-end">
                                <div className="bg-blue-500/90 text-white px-4 py-2 rounded-2xl rounded-tr-none shadow-lg max-w-[80%]">
                                    <p>{activeMessage.text}</p>
                                </div>
                            </div>

                            {/* AI Response or Loading */}
                            <AnimatePresence mode="wait">
                                {activeMessage.response && !activeMessage.response.includes('[AI Error]') ? (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex justify-start"
                                    >
                                        <div className="bg-white/90 text-slate-800 px-6 py-4 rounded-2xl rounded-tl-none shadow-lg max-w-[90%] border border-white/40">
                                            <p className="italic font-serif text-lg leading-relaxed">
                                                {activeMessage.response}
                                            </p>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex justify-start text-white/50 text-sm pl-2"
                                    >
                                        <span className="animate-pulse">Consulting the ancient wisdom...</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Input Field */}
            <div className="w-full max-w-xl mx-auto pointer-events-auto">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="relative group"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={activeMessage ? "Reflecting..." : "Plant a thought..."}
                        disabled={!!activeMessage}
                        className="w-full bg-black/50 border border-white/10 rounded-full px-6 py-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all shadow-2xl disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || !!activeMessage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors disabled:opacity-0"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white">
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    )
}
