import { describe, it, expect, vi } from 'vitest'
import { ApiRequestError, login } from '../src/api'

describe('api', () => {
  it('throws ApiRequestError when login status is not 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Status: 500, Message: 'x' }),
      })),
    )

    await expect(login('a', 'b')).rejects.toBeInstanceOf(ApiRequestError)
  })

  it('returns auth shape on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            Status: 200,
            Token: 't',
            AuthCode: 'a',
            Data: { User: { ID: 'u1', Nickname: 'nick' } },
          }),
      })),
    )

    await expect(login('a', 'b')).resolves.toEqual({ token: 't', authCode: 'a', userId: 'u1', nickname: 'nick' })
  })
})
