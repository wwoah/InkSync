import { useState } from 'react'
import { Welcome } from './pages/Welcome'
import { Chat } from './pages/Chat'
import { CollabCanvas, LIVE_CANVAS_ID } from './pages/CollabCanvas'
import { ThinkInk } from './pages/ThinkInk'
import { loadProfile } from './lib/profile'
import type { User } from './types'

type View =
  | { page: 'welcome'; user: User | null }
  | { page: 'room'; user: User; roomId: string }
  | { page: 'canvas'; user: User; canvasId: string }
  | { page: 'game'; user: User; code: string }

function App() {
  // A returning player lands on the destination step with their face intact.
  const [view, setView] = useState<View>(() => ({ page: 'welcome', user: loadProfile() }))

  if (view.page === 'welcome') {
    return (
      <Welcome
        initialUser={view.user}
        onEnterCanvas={(user, canvasId = LIVE_CANVAS_ID) =>
          setView({ page: 'canvas', user, canvasId })
        }
        onEnterRoom={(user, roomId) => setView({ page: 'room', user, roomId })}
        onEnterGame={(user, code) => setView({ page: 'game', user, code })}
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

  if (view.page === 'game') {
    return (
      <ThinkInk
        key={view.code}
        user={view.user}
        code={view.code}
        onLeave={() => setView({ page: 'welcome', user: view.user })}
      />
    )
  }

  return (
    <CollabCanvas
      key={view.canvasId}
      user={view.user}
      canvasId={view.canvasId}
      onLeave={() => setView({ page: 'welcome', user: view.user })}
    />
  )
}

export default App
