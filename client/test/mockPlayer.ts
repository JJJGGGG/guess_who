// Replaces hooks/usePlayer in component tests: jest.mock(<path to usePlayer>,
// () => require('<this file>')). Tests change `playerState` directly.
export const playerState = {
    status: 'ready' as 'loading' | 'anonymous' | 'ready',
    player: { id: 'me', name: 'Me' } as { id: string, name: string } | undefined,
    graceSeconds: 30,
    login: jest.fn(),
    logout: jest.fn(),
}

export function resetPlayer() {
    Object.assign(playerState, { status: 'ready', player: { id: 'me', name: 'Me' }, graceSeconds: 30 })
    playerState.login.mockReset()
    playerState.logout.mockReset()
}

export default function usePlayer() {
    return playerState
}
