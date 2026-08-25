import { useState } from 'react'
import { Welcome } from './pages/Welcome'
import { Chat } from './pages/Chat'
import { CollabCanvas } from './pages/CollabCanvas'
import type { User } from './types'

type View =
  | { page: 'welcome'; user: User | null }
  | { page: 'room'; user: User; roomId: string }
  | { page: 'canvas'; user: User }

function App() {
  const [view, setView] = useState<View>({ page: 'welcome', user: null })

  if (view.page === 'welcome') {
    return (
      <Welcome
        initialUser={view.user}
        onEnterCanvas={(user) => setView({ page: 'canvas', user })}
        onEnterRoom={(user, roomId) => setView({ page: 'room', user, roomId })}
      />
    )
  }

  if (view.page === 'room') {
    return (
      <Chat
        user={view.user}
        roomId={view.roomId}
        onLeave={() => setView({ page: 'welcome', user: view.user })}
      />
    )
  }

  return (
    <CollabCanvas
      user={view.user}
      onLeave={() => setView({ page: 'welcome', user: view.user })}
    />
  )
}

export default App
