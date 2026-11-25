// A minimal fetch Response for mocked fetch calls.
export function jsonResponse(body: unknown, status = 200) {
    return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response)
}

export const fetchMock = () => global.fetch as jest.Mock
