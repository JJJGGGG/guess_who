import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'

// Shows the current path so tests can assert navigation.
function Location() {
    const { pathname } = useLocation()
    return <div data-testid="location">{pathname}</div>
}

// Renders `element` at `path` (matched against `pattern`), with every other
// route rendering nothing but the location.
export function renderAt(element: ReactElement, path: string, pattern = path) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path={pattern} element={element} />
                <Route path="*" element={null} />
            </Routes>
            <Location />
        </MemoryRouter>
    )
}
