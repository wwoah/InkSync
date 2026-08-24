import { useState } from 'react'
import { Welcome } from './pages/Welcome'
import { Home } from './pages/Home'
import { Chat } from './pages/Chat'
import { CollabCanvas } from './pages/CollabCanvas'
import type { User } from './types'

type View =
  | { page: 'welcome' }
  | { page: 'home'; user: User }
  | { page: 'room'; user: User; roomId: string }
  | { page: 'canvas'; user: User }

function App() {
  const [view, setView] = useState<View>({ page: 'welcome' })

  if (view.page === 'welcome') {
    return <Welcome onJoin={(user) => setView({ page: 'home', user })} />
  }

  if (view.page === 'home') {
    return (
      <Home
        user={view.user}
        onJoinRoom={(roomId) => setView({ page: 'room', user: view.user, roomId })}
        onJoinCanvas={() => setView({ page: 'canvas', user: view.user })}
      />
    )
  }

  if (view.page === 'room') {
    return (
      <Chat
        user={view.user}
        roomId={view.roomId}
        onLeave={() => setView({ page: 'home', user: view.user })}
      />
    )
  }

  return (
    <CollabCanvas
      user={view.user}
      onLeave={() => setView({ page: 'home', user: view.user })}
    />
  )
}

export default App
