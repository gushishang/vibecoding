<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NForm,
  NFormItem,
  NIcon,
  NImage,
  NInput,
  NLayout,
  NLayoutContent,
  NLayoutSider,
  NList,
  NListItem,
  NModal,
  NScrollbar,
  NSelect,
  NSpin,
  NTag,
  NThing,
  useMessage,
} from 'naive-ui'
import { CameraOutline } from '@vicons/ionicons5'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { ApiRequestError, buildCoverUrl, changeCover, fetchCloudWorks, login, type AuthResult, type CloudWork, updateCloudWork } from './api'
import { loadLocalMetaMap, saveLocalMetaMap, type LocalWorkMeta } from './storage'

const CRED_KEY = 'plweb-credential'
const auth = ref<AuthResult | null>(null)
const works = ref<CloudWork[]>([])
const selectedId = ref('')
const loading = ref(false)
const saving = ref(false)
const coverUploading = ref(false)
const showLogin = ref(false)
const email = ref('')
const password = ref('')
const debugLog = ref('')
const debugExpandedNames = ref<string[]>([])
const searchKeyword = ref('')
const categoryFilter = ref('all')
const message = useMessage()

const coverInputRef = ref<HTMLInputElement | null>(null)
const localMetaMap = ref<Record<string, LocalWorkMeta>>({})

const selectedWork = computed(() => works.value.find((x) => x.id === selectedId.value) ?? null)
const editSubject = ref('')
const editMarkdown = ref('')
const localCategory = ref('默认分类')

const categoryOptions = computed(() => {
  const set = new Set<string>()
  Object.values(localMetaMap.value).forEach((meta) => {
    if (meta.category?.trim()) set.add(meta.category.trim())
  })
  return [{ label: '全部分类', value: 'all' }, ...[...set].map((x) => ({ label: x, value: x }))]
})

const filteredWorks = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return works.value.filter((w) => {
    const passCategory = categoryFilter.value === 'all' || (localMetaMap.value[w.id]?.category || '默认分类') === categoryFilter.value
    const passKeyword = !keyword || w.subject.toLowerCase().includes(keyword)
    return passCategory && passKeyword
  })
})

const editorHeight = computed(() => (debugExpandedNames.value.includes('debug') ? '52vh' : '72vh'))

function getTags(work: CloudWork) {
  const tags = work.rawSummary?.Tags
  return Array.isArray(tags) ? tags : []
}

function getCover(work: CloudWork) {
  return buildCoverUrl(work.id, Math.max(0, (work.image || 1) - 1))
}

function persistLocalMeta(workId: string) {
  localMetaMap.value[workId] = {
    category: localCategory.value,
  }
  saveLocalMetaMap(localMetaMap.value)
}

function setEditorByWork(work: CloudWork | null) {
  if (!work) return
  editSubject.value = work.subject
  editMarkdown.value = work.description
  const meta = localMetaMap.value[work.id] || {}
  localCategory.value = meta.category || '默认分类'
}

function onSelect(id: string) {
  selectedId.value = id
  setEditorByWork(selectedWork.value)
}

function loadCredentialFromLocal() {
  const raw = localStorage.getItem(CRED_KEY)
  if (!raw) return
  try {
    const data = JSON.parse(raw)
    email.value = data.email ?? ''
    password.value = data.password ?? ''
  } catch {
    // ignore
  }
}

async function doLogin() {
  try {
    loading.value = true
    const logged = await login(email.value, password.value)
    auth.value = logged
    localStorage.setItem(CRED_KEY, JSON.stringify({ email: email.value, password: password.value }))
    showLogin.value = false
    message.success(`登录成功：${logged.nickname}`)
    await loadCloudWorks()
  } catch (e) {
    if (e instanceof ApiRequestError) {
      debugLog.value = JSON.stringify(e.debug, null, 2)
    }
    message.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function loadCloudWorks() {
  if (!auth.value) return
  try {
    loading.value = true
    const list = await fetchCloudWorks(auth.value)
    works.value = list
    if (list.length) onSelect(list[0].id)
    message.success(`已加载 ${list.length} 篇云端作品`)
  } catch (e) {
    message.error((e as Error).message)
    if (e instanceof ApiRequestError) debugLog.value = JSON.stringify(e.debug, null, 2)
  } finally {
    loading.value = false
  }
}

async function saveCurrentWork() {
  if (!auth.value || !selectedWork.value) return
  try {
    saving.value = true
    persistLocalMeta(selectedWork.value.id)
    const result = await updateCloudWork(auth.value, selectedWork.value, editMarkdown.value, editSubject.value)

    selectedWork.value.subject = editSubject.value
    selectedWork.value.description = editMarkdown.value
    selectedWork.value.rawSummary = result.requestBody.Summary

    debugLog.value = JSON.stringify({ action: 'SubmitExperiment', requestBody: result.requestBody, response: result.data }, null, 2)
    message.success('作品更新成功 ✅')
  } catch (e) {
    message.error((e as Error).message)
    if (e instanceof ApiRequestError) debugLog.value = JSON.stringify(e.debug, null, 2)
  } finally {
    saving.value = false
  }
}

function triggerCoverPicker() {
  coverInputRef.value?.click()
}

async function onCoverSelected(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file || !auth.value || !selectedWork.value) return
  try {
    coverUploading.value = true
    persistLocalMeta(selectedWork.value.id)
    const result = await changeCover(auth.value, selectedWork.value, file, editMarkdown.value, editSubject.value)
    selectedWork.value.image = result.newImageCount
    selectedWork.value.rawSummary = result.requestBody.second.Summary
    debugLog.value = JSON.stringify({ action: 'ChangeCover', requestBody: result.requestBody, response: result.data }, null, 2)
    message.success('封面更新成功 ✅')
  } catch (e) {
    message.error((e as Error).message)
    if (e instanceof ApiRequestError) debugLog.value = JSON.stringify(e.debug, null, 2)
  } finally {
    coverUploading.value = false
    ;(ev.target as HTMLInputElement).value = ''
  }
}

onMounted(async () => {
  localMetaMap.value = loadLocalMetaMap()
  loadCredentialFromLocal()
  if (email.value && password.value) await doLogin()
  else showLogin.value = true
})
</script>

<template>
  <n-layout has-sider class="app-shell">
    <n-layout-sider bordered width="360" content-style="padding: 12px">
      <n-thing title="PLWeb 云端作品" />

      <div class="mt-12">
        <n-input v-model:value="searchKeyword" placeholder="搜索标题关键字" clearable />
      </div>
      <div class="mt-8">
        <n-select v-model:value="categoryFilter" :options="categoryOptions" />
      </div>
      <div class="mt-8">
        <n-button block @click="showLogin = true">登录切换账号</n-button>
      </div>
      <div class="mt-8">
        <n-button block type="primary" :loading="loading" @click="loadCloudWorks">刷新云端作品</n-button>
      </div>

      <n-scrollbar style="max-height: calc(100vh - 290px); margin-top: 12px">
        <n-list bordered>
          <n-list-item
            v-for="work in filteredWorks"
            :key="work.id"
            class="work-item"
            :class="{ active: selectedId === work.id }"
            @click="onSelect(work.id)"
          >
            <n-image width="54" height="54" class="thumb" :src="getCover(work)" object-fit="cover" fallback-src="" />
            <div class="item-content">
              <div class="title">{{ work.subject }}</div>
              <div class="tag-line">
                <n-tag size="tiny" type="warning">{{ localMetaMap[work.id]?.category || '默认分类' }}</n-tag>
                <n-tag v-for="tag in getTags(work)" :key="tag" size="tiny">{{ tag }}</n-tag>
              </div>
            </div>
          </n-list-item>
        </n-list>
      </n-scrollbar>
    </n-layout-sider>

    <n-layout-content content-style="padding: 12px">
      <n-spin :show="loading || saving || coverUploading">
        <n-card v-if="selectedWork" title="现代 Markdown 编辑器（云端）" size="small">
          <n-form inline>
            <n-form-item label="云端标题">
              <n-input v-model:value="editSubject" style="width: 420px" />
            </n-form-item>
            <n-form-item label="分类(本地)">
              <n-input v-model:value="localCategory" style="width: 180px" @blur="persistLocalMeta(selectedWork.id)" />
            </n-form-item>
            <n-form-item>
              <n-button type="success" :loading="saving" @click="saveCurrentWork">更新到云端作品</n-button>
            </n-form-item>
            <n-form-item>
              <n-button circle quaternary :loading="coverUploading" @click="triggerCoverPicker">
                <template #icon>
                  <n-icon><camera-outline /></n-icon>
                </template>
              </n-button>
              <input ref="coverInputRef" class="hidden-input" type="file" accept="image/*" @change="onCoverSelected" />
            </n-form-item>
          </n-form>

          <md-editor v-model="editMarkdown" language="zh-CN" :preview="true" :style="{ height: editorHeight }" :toolbars-exclude="['github']" />
        </n-card>

        <n-collapse v-model:expanded-names="debugExpandedNames" class="mt-12">
          <n-collapse-item title="调试日志（含请求体/响应，可折叠）" name="debug">
            <pre class="debug">{{ debugLog }}</pre>
          </n-collapse-item>
        </n-collapse>
      </n-spin>
    </n-layout-content>
  </n-layout>

  <n-modal v-model:show="showLogin" preset="card" title="登录 Physics-Lab" style="width: 460px">
    <n-form>
      <n-form-item label="邮箱">
        <n-input v-model:value="email" placeholder="邮箱" />
      </n-form-item>
      <n-form-item label="密码">
        <n-input v-model:value="password" type="password" show-password-on="click" placeholder="密码" />
      </n-form-item>
      <n-form-item>
        <n-button type="primary" :loading="loading" block @click="doLogin">登录并加载作品</n-button>
      </n-form-item>
    </n-form>
  </n-modal>
</template>
