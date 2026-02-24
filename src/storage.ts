export type LocalWorkMeta = {
  category?: string
}

const META_KEY = 'plweb-local-meta'

export function loadLocalMetaMap(): Record<string, LocalWorkMeta> {
  const raw = localStorage.getItem(META_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function saveLocalMetaMap(map: Record<string, LocalWorkMeta>) {
  localStorage.setItem(META_KEY, JSON.stringify(map))
}
