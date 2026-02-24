import { describe, it, expect, beforeEach } from 'vitest'
import { loadLocalMetaMap, saveLocalMetaMap } from '../src/storage'

describe('storage local meta', () => {
  beforeEach(() => localStorage.clear())

  it('loads empty map initially', () => {
    expect(loadLocalMetaMap()).toEqual({})
  })

  it('saves and loads local category metadata', () => {
    const payload = {
      'work-1': {
        category: '物理',
      },
    }
    saveLocalMetaMap(payload)
    expect(loadLocalMetaMap()).toEqual(payload)
  })
})
