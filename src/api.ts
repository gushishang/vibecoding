import { gzip } from 'pako'

export type AuthResult = {
  token: string
  authCode: string
  userId: string
  nickname: string
}

export type CloudWork = {
  id: string
  contentId: string
  category: 'Discussion'
  subject: string
  description: string
  rawSummary: Record<string, any>
  image: number
}

export type ApiDebugInfo = {
  url: string
  requestBody: unknown
  responseStatus?: number
  responseBody?: unknown
}

export class ApiRequestError extends Error {
  debug: ApiDebugInfo

  constructor(message: string, debug: ApiDebugInfo) {
    super(message)
    this.name = 'ApiRequestError'
    this.debug = debug
  }
}

const BASE_URL = '/plapi'

const device = {
  Identifier: '7db01528cf13e2199e141c402d79190e',
  Language: 'Chinese',
}

export function buildCoverUrl(summaryId: string, index = 0) {
  return `/plimg/experiments/images/${summaryId.slice(0, 4)}/${summaryId.slice(4, 6)}/${summaryId.slice(6, 8)}/${summaryId.slice(8)}/${index}.jpg`
}

async function postJson<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let json: unknown = text
  try {
    json = JSON.parse(text)
  } catch {
    // noop
  }

  if (!res.ok) {
    throw new ApiRequestError(`请求失败: HTTP ${res.status}`, {
      url,
      requestBody: body,
      responseStatus: res.status,
      responseBody: json,
    })
  }

  return json as T
}

function assertStatusOk(path: string, requestBody: unknown, data: any, message: string) {
  if (data.Status !== 200) {
    throw new ApiRequestError(`${message}: ${data.Message}`, {
      url: `${BASE_URL}${path}`,
      requestBody,
      responseStatus: 200,
      responseBody: data,
    })
  }
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const body = {
    Login: email,
    Password: password,
    Version: 2411,
    Device: device,
  }

  const data = await postJson<any>('/Users/Authenticate', body)
  assertStatusOk('/Users/Authenticate', body, data, '登录失败')

  return {
    token: data.Token,
    authCode: data.AuthCode,
    userId: data.Data.User.ID,
    nickname: data.Data.User.Nickname,
  }
}

async function getSummary(auth: AuthResult, summaryId: string) {
  const body = {
    ContentID: summaryId,
    Category: 'Discussion',
  }

  const data = await postJson<any>('/Contents/GetSummary', body, {
    'x-API-Token': auth.token,
    'x-API-AuthCode': auth.authCode,
  })
  assertStatusOk('/Contents/GetSummary', body, data, '读取作品摘要失败')
  return data.Data
}

async function getExperiment(auth: AuthResult, contentId: string) {
  const body = {
    ContentID: contentId,
  }
  const data = await postJson<any>('/Contents/GetExperiment', body, {
    'x-API-Token': auth.token,
    'x-API-AuthCode': auth.authCode,
  })
  assertStatusOk('/Contents/GetExperiment', body, data, '读取作品内容失败')
  return data.Data
}

export async function fetchCloudWorks(auth: AuthResult): Promise<CloudWork[]> {
  const body = {
    Query: {
      Category: 'Discussion',
      Languages: [],
      ExcludeLanguages: [],
      Tags: null,
      ExcludeTags: null,
      ModelTags: null,
      ModelID: null,
      ParentID: null,
      UserID: auth.userId,
      Special: null,
      From: null,
      Skip: 0,
      Take: 30,
      Days: 0,
      Sort: 0,
      ShowAnnouncement: false,
    },
  }

  const data = await postJson<any>('/Contents/QueryExperiments', body, {
    'x-API-Token': auth.token,
    'x-API-AuthCode': auth.authCode,
  })
  assertStatusOk('/Contents/QueryExperiments', body, data, '获取作品列表失败')

  const rawList: any[] = data.Data?.['$values'] ?? []
  const detailed = await Promise.all(
    rawList.map(async (item) => {
      const summary = await getSummary(auth, item.ID)
      return {
        id: summary.ID,
        contentId: summary.ContentID,
        category: 'Discussion' as const,
        subject: summary.Subject,
        description: Array.isArray(summary.Description) ? summary.Description.join('\n') : '',
        rawSummary: summary,
        image: Number(summary.Image ?? 0),
      }
    }),
  )

  return detailed
}

function submitHeaders(auth: AuthResult, version: number) {
  return {
    'x-API-Token': auth.token,
    'x-API-AuthCode': auth.authCode,
    'x-API-Version': String(version || 2411),
    'Accept-Encoding': 'gzip',
    'Content-Type': 'gzipped/json',
  }
}

async function submitExperiment(auth: AuthResult, submitData: Record<string, any>) {
  const gz = gzip(JSON.stringify(submitData))
  const res = await fetch(`${BASE_URL}/Contents/SubmitExperiment`, {
    method: 'POST',
    headers: submitHeaders(auth, Number(submitData?.Summary?.Version ?? 2411)),
    body: gz,
  })

  const text = await res.text()
  let json: any = text
  try {
    json = JSON.parse(text)
  } catch {
    // noop
  }

  if (!res.ok) {
    throw new ApiRequestError(`更新作品失败: HTTP ${res.status}`, {
      url: `${BASE_URL}/Contents/SubmitExperiment`,
      requestBody: submitData,
      responseStatus: res.status,
      responseBody: json,
    })
  }

  assertStatusOk('/Contents/SubmitExperiment', submitData, json, '更新作品失败')
  return json
}

export async function updateCloudWork(auth: AuthResult, work: CloudWork, markdown: string, subject: string) {
  const experimentData = await getExperiment(auth, work.contentId)

  const summary = {
    ...work.rawSummary,
    Subject: subject,
    Description: markdown.split('\n'),
    Language: 'Chinese',
  }

  const workspace = {
    ...experimentData,
    Summary: null,
  }

  const submitData = {
    Summary: summary,
    Workspace: workspace,
  }

  const data = await submitExperiment(auth, submitData)
  return { data, requestBody: submitData }
}

export async function changeCover(auth: AuthResult, work: CloudWork, file: File, markdown: string, subject: string) {
  const experimentData = await getExperiment(auth, work.contentId)

  const summary = {
    ...work.rawSummary,
    Subject: subject,
    Description: markdown.split('\n'),
    Language: 'Chinese',
  }

  const workspace = {
    ...experimentData,
    Summary: null,
  }

  const requestPhaseData = {
    Summary: summary,
    Workspace: workspace,
    Request: {
      FileSize: file.size,
      Extension: '.jpg',
    },
  }

  const firstSubmit = await submitExperiment(auth, requestPhaseData)
  const token = firstSubmit?.Data?.Token
  if (!token?.Policy || !token?.Authorization) {
    throw new ApiRequestError('更换封面失败: 未获取到上传凭据', {
      url: `${BASE_URL}/Contents/SubmitExperiment`,
      requestBody: requestPhaseData,
      responseStatus: 200,
      responseBody: firstSubmit,
    })
  }

  const nextImageCount = Number(summary.Image ?? 0) + 1
  const secondSummary = { ...summary, Image: nextImageCount }
  const secondSubmitData = {
    Summary: secondSummary,
    Workspace: workspace,
  }
  const secondSubmit = await submitExperiment(auth, secondSubmitData)

  const form = new FormData()
  form.append('policy', token.Policy)
  form.append('authorization', token.Authorization)
  form.append('file', file, 'cover.jpg')

  const uploadRes = await fetch('/upyun', {
    method: 'POST',
    body: form,
  })
  const uploadText = await uploadRes.text()
  let uploadJson: any = uploadText
  try {
    uploadJson = JSON.parse(uploadText)
  } catch {
    // noop
  }

  if (!uploadRes.ok || uploadJson?.code !== 200) {
    throw new ApiRequestError('更换封面失败: 上传图片失败', {
      url: '/upyun',
      requestBody: '[binary file omitted]',
      responseStatus: uploadRes.status,
      responseBody: uploadJson,
    })
  }

  return {
    requestBody: {
      first: requestPhaseData,
      second: secondSubmitData,
    },
    data: {
      firstSubmit,
      secondSubmit,
      upload: uploadJson,
    },
    newImageCount: nextImageCount,
  }
}
