import { useEffect } from 'react'
import { Scene } from './components/Scene'
import { UI } from './components/UI'
import { useStore } from './hooks/useStore'

function App() {
  const initialize = useStore(state => state.initialize)

  useEffect(() => {
    const unsubscribe = initialize()
    return () => unsubscribe()
  }, [initialize])

  return (
    <div className="w-full h-full relative font-sans" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Scene />
      <UI />
    </div>
  )
}


export default App
