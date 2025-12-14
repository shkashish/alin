import { useEffect } from 'react'
import { Scene } from './components/Scene'
import { UI } from './components/UI'
import { useStore } from './hooks/useStore'

function App() {
  const initialize = useStore(state => state.initialize)

  useEffect(() => {
    // Clear Firebase IndexedDB cache on app load to prevent stale data
    if (typeof indexedDB !== 'undefined') {
      const dbRequest = indexedDB.databases()
      dbRequest.then((dbs) => {
        dbs.forEach(db => {
          if (db.name && db.name.includes('firebase')) {
            console.log('[App] Clearing Firebase cache:', db.name)
            indexedDB.deleteDatabase(db.name)
          }
        })
      }).catch(err => console.log('[App] Could not clear cache:', err))
    }
  }, [])

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
