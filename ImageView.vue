<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue'
import { creationApi, taskKey, type ModelOption } from '@/api/creation'
import { useAppStore } from '@/stores/app'
import http from '@/api/index'
import { materialApi } from '@/api/material'
import { productApi, type Product } from '@/api/product'
import { assetApi } from '@/api/asset'
import { useRoute, useRouter } from 'vue-router'
import { friendlyCreationError } from '@/utils/creation-error'
import { roundBillableCredits } from '@/utils/credits'
import MaskEditorModal from '@/components/MaskEditorModal.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const models = ref<ModelOption[]>([])
const modelsLoading = ref(false)
const modelsError = ref('')
const selectedModelId = ref('auto-image')
const resolution = ref('1K')
const quality = ref('medium')
const inputFidelity = ref('low')
const ratio = ref('1:1')
const prompt = ref('')
const generating = ref(false)
const outputCount = ref(1)
const activeBatchId = ref<string | null>(null)
const activeBatch = ref<any>(null)
const compareIds = ref<string[]>([])
const showCompareModal = ref(false)
const pendingIdempotencyKey = ref('')
const history = ref<any[]>([])
const historyCollapsed = ref(true)
const historyKeyword = ref('')
const historyLoading = ref(false)
const historySearchFailed = ref(false)
const activeHistoryId = ref<string | null>(null)
const gallery = ref<any[]>([])
const showEstimate = ref(false)
const estimating = ref(false)
const serverEstimatedCost = ref<number | null>(null)
const serverEstimateBreakdown = ref<{ baseCredits: number; referenceCount: number; referenceCredits: number; modelMultiplier: number; maskedEdit?: boolean; maskedEditProvider?: string; maskedEditMultiplier?: number; maskedEditMarkupCredits?: number } | null>(null)
const showTemplateModal = ref(false)
const showAiPromptModal = ref(false)
const aiPromptMode = ref<'generate' | 'optimize'>('generate')
const aiPromptInput = ref('')
const aiPromptResult = ref('')
const aiPromptLoading = ref(false)
const zoomAsset = ref<any>(null)
interface ReferenceImageItem {
  key: string
  url: string
  name: string
  materialId?: string
}
const referenceImages = ref<ReferenceImageItem[]>([])
const editingReferenceSourceId = ref<string | null>(null)
const localEditMask = ref<{
  sourceKey: string
  base64: string
  preview: string
  region: { x: number; y: number; width: number; height: number; label: string }
} | null>(null)
const localEditSource = ref<ReferenceImageItem | null>(null)
const showMaterialPicker = ref(false)
const materialList = ref<any[]>([])
const materialLoading = ref(false)
const promptTextarea = ref<HTMLTextAreaElement | null>(null)
const composerCollapsed = ref(false)
const uploadingReference = ref(false)
const resultStage = ref<HTMLElement | null>(null)
const inspirationDraftTitle = ref('')
const productContext = ref<Product | null>(null)
const productCoverMaterial = ref<any>(null)
const supportedReferenceMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg'])
const supportedReferenceExtensions = new Set(['png', 'jpg', 'jpeg'])

function referenceExtension(value: string) {
  const path = String(value || '').split(/[?#]/, 1)[0]
  return path.split('.').pop()?.toLowerCase() || ''
}

function isSupportedReferenceFile(file: File) {
  const mimeType = String(file.type || '').toLowerCase()
  const extension = referenceExtension(file.name)
  return supportedReferenceMimeTypes.has(mimeType) && supportedReferenceExtensions.has(extension)
}

function isSupportedReferenceMaterial(item: any) {
  const mimeType = String(item?.mimeType || '').toLowerCase()
  const source = String(item?.fileKey || item?.fileUrl || item?.thumbnailUrl || '')
  const extension = referenceExtension(source)
  if (mimeType && !supportedReferenceMimeTypes.has(mimeType)) return false
  if (extension && !supportedReferenceExtensions.has(extension)) return false
  return supportedReferenceMimeTypes.has(mimeType) || supportedReferenceExtensions.has(extension)
}

const supportedMaterialList = computed(() => materialList.value.filter(isSupportedReferenceMaterial))

const promptStarters = [
  { label: '商品主图', text: '商品主体居中，背景干净，突出材质与核心卖点，高级商业摄影，适合电商平台主图' },
  { label: '场景展示', text: '将商品放入目标消费者的真实使用场景，自然光，空间层次清晰，高级生活方式广告质感' },
  { label: '信息流广告', text: '以强视觉冲击突出商品卖点，构图简洁，色彩有记忆点，预留文案空间，适合信息流投放' },
]

const fallbackImageModels: ModelOption[] = [
  { id: 'auto-image', group: '智能推荐', name: '平台智能推荐', vendor: 'FusionAI', badge: '默认', multiplier: 1, cost: '按任务 5-30 积分', speed: '自动', bestFor: '', actualModel: 'gpt-image-2', parameterMode: 'gpt-flexible', aspectRatios: ['1:1','9:16','16:9','2:3','3:2','3:4','4:3','4:5','5:4'], resolutions: ['1K','2K','4K'], qualities: ['auto','low','medium','high'], defaultRatio: '1:1', defaultResolution: '1K', defaultQuality: 'medium', supportsReferenceImage: true },
  { id: 'openai-gpt-image-2', group: 'OpenAI', name: 'GPT Image 2', vendor: 'OpenAI', badge: '新一代', multiplier: 1, cost: '按参数动态估算', speed: '中', bestFor: '高质量图像生成、参考图编辑、电商视觉与营销画面。', actualModel: 'gpt-image-2', parameterMode: 'gpt-flexible', aspectRatios: ['1:1','9:16','16:9','2:3','3:2','3:4','4:3','4:5','5:4'], resolutions: ['1K','2K','4K'], qualities: ['auto','low','medium','high'], defaultRatio: '1:1', defaultResolution: '1K', defaultQuality: 'medium', supportsReferenceImage: true, supportsInputFidelity: true, inputFidelities: ['low','high'], defaultInputFidelity: 'low' },
  { id: 'nano-banana-2', group: 'Google', name: 'Nano Banana 2', vendor: 'Google', badge: '高速 4K', multiplier: 1, cost: '约 15-40 积分', speed: '快', bestFor: '', actualModel: 'gemini-3.1-flash-image-preview', parameterMode: 'gemini-semantic', aspectRatios: ['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'], resolutions: ['512','1K','2K','4K'], qualities: ['auto'], defaultRatio: '1:1', defaultResolution: '1K', defaultQuality: 'auto', supportsReferenceImage: true },
  { id: 'nano-banana', group: 'Google', name: 'Nano Banana Pro', vendor: 'Google', badge: '强编辑', multiplier: 1.35, cost: '约 35-60 积分', speed: '中', bestFor: '', actualModel: 'gemini-3-pro-image-preview', parameterMode: 'gemini-semantic', aspectRatios: ['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'], resolutions: ['1K','2K','4K'], qualities: ['auto'], defaultRatio: '1:1', defaultResolution: '1K', defaultQuality: 'auto', supportsReferenceImage: true },
  { id: 'gemini-flash-image', group: 'Google', name: 'Nano Banana', vendor: 'Google', badge: '快速', multiplier: .9, cost: '约 10 积分', speed: '快', bestFor: '', actualModel: 'gemini-2.5-flash-image', parameterMode: 'gemini-semantic', aspectRatios: ['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'], resolutions: ['1K'], qualities: ['auto'], defaultRatio: '1:1', defaultResolution: '1K', defaultQuality: 'auto', supportsReferenceImage: true },
  { id: 'openai-gpt-image', group: 'OpenAI', name: 'GPT Image 1.5', vendor: 'OpenAI', badge: '文字准确', multiplier: 1.5, cost: '约 15-45 积分', speed: '中', bestFor: '', parameterMode: 'gpt-fixed', aspectRatios: ['1:1','2:3','3:2'], resolutions: ['standard'], resolutionLabels: { standard: '标准' }, qualities: ['auto','low','medium','high'], qualityLabels: { auto: '自动', low: '低', medium: '中', high: '高' }, defaultRatio: '1:1', defaultResolution: 'standard', defaultQuality: 'medium', supportsReferenceImage: true, supportsInputFidelity: true, inputFidelities: ['low','high'], defaultInputFidelity: 'low' },
]

const fallbackGptSizes: Record<string, Record<string, string>> = {
  '1:1': { '1K': '1024×1024', '2K': '2048×2048', '4K': '2880×2880', standard: '1024×1024' },
  '9:16': { '1K': '720×1280', '2K': '1152×2048', '4K': '2160×3840' },
  '16:9': { '1K': '1280×720', '2K': '2048×1152', '4K': '3840×2160' },
  '2:3': { '1K': '832×1248', '2K': '1344×2016', '4K': '2336×3504', standard: '1024×1536' },
  '3:2': { '1K': '1248×832', '2K': '2016×1344', '4K': '3504×2336', standard: '1536×1024' },
  '3:4': { '1K': '864×1152', '2K': '1488×1984', '4K': '2448×3264' },
  '4:3': { '1K': '1152×864', '2K': '1984×1488', '4K': '3264×2448' },
  '4:5': { '1K': '896×1120', '2K': '1600×2000', '4K': '2560×3200' },
  '5:4': { '1K': '1120×896', '2K': '2000×1600', '4K': '3200×2560' },
}

interface PromptTemplate { id: string; name: string; scene: string; text: string; builtIn?: boolean }
const defaultTemplates: PromptTemplate[] = [
  { id: 'builtin-product-main', name: '商品白底主图', scene: '商品主图', builtIn: true, text: '商品主体完整居中，纯白无缝背景，轻柔自然投影，轮廓边缘干净，比例和结构准确，材质、纹理与工艺细节清晰，专业电商棚拍，真实商业摄影，无多余道具、文字和水印。' },
  { id: 'builtin-lifestyle', name: '生活方式场景图', scene: '场景图', builtIn: true, text: '将商品自然融入目标消费者的真实使用场景，主体清晰且使用关系合理，柔和自然光，空间层次明确，色彩协调，保留适量文案留白，高级生活方式广告与电商详情页质感。' },
  { id: 'builtin-model', name: '模特穿搭展示', scene: '模特图', builtIn: true, text: '成年模特自然穿着或使用商品，人物姿态舒展，完整呈现商品版型、材质和上身效果，背景简洁，柔和棚拍光，肤色自然，手部与服装结构准确，时尚电商画报质感。' },
  { id: 'builtin-poster', name: '活动促销海报', scene: '活动海报', builtIn: true, text: '围绕商品设计高吸引力促销海报主视觉，主体突出，层级清晰，色彩具有活动氛围，顶部和侧边预留标题、价格与行动按钮排版区域，适合电商大促，不生成错误文字、品牌标识或水印。' },
  { id: 'builtin-feed-image', name: '信息流图片广告', scene: '广告图', builtIn: true, text: '用强视觉焦点突出商品核心卖点，主体在首屏快速可识别，对比鲜明但不过度饱和，构图简洁，预留短标题与行动文案空间，适合社交媒体信息流图片广告投放。' },
  { id: 'builtin-detail', name: '商品细节特写', scene: '细节图', builtIn: true, text: '以近景和微距视角展示商品关键结构、材质纹理与工艺细节，焦点准确，背景克制，光线突出质感与层次，画面真实可信，适合电商详情页卖点说明。' },
  { id: 'builtin-social', name: '社交媒体种草图', scene: '种草图', builtIn: true, text: '商品出现在自然、有生活气息的分享场景中，构图轻松，光线明亮柔和，搭配少量相关道具，呈现真实体验感和审美氛围，适合社交媒体种草内容，避免过度商业化。' },
]
const defaultTemplateIds = new Set(defaultTemplates.map(template => template.id))
const legacyDefaultIds = new Set(['pt1', 'pt2', 'pt3'])
function loadTemplates(): PromptTemplate[] {
  try {
    const stored = JSON.parse(localStorage.getItem('fusionai_templates') || '[]')
    const custom = Array.isArray(stored)
      ? stored.filter((template: PromptTemplate) =>
          template
          && !template.builtIn
          && !defaultTemplateIds.has(template.id)
          && !legacyDefaultIds.has(template.id)
          && template.name !== '信息流短视频')
      : []
    return [...defaultTemplates, ...custom]
  } catch {
    return [...defaultTemplates]
  }
}
function saveTemplates() {
  localStorage.setItem('fusionai_templates', JSON.stringify(promptTemplates.value.filter(template => !template.builtIn)))
}
const promptTemplates = ref<PromptTemplate[]>(loadTemplates())
const newTemplate = ref({ name: '', scene: '', text: '' })
const showAddForm = ref(false)
function addTemplate() {
  if (!store.requestLogin('保存提示词模板', addTemplate)) return
  if (!newTemplate.value.name.trim() || !newTemplate.value.text.trim()) return
  promptTemplates.value.push({ id: 'pt' + Date.now(), name: newTemplate.value.name.trim(), scene: newTemplate.value.scene.trim() || '自定义', text: newTemplate.value.text.trim() })
  saveTemplates(); newTemplate.value = { name: '', scene: '', text: '' }; showAddForm.value = false
}
function deleteTemplate(id: string) {
  const template = promptTemplates.value.find(item => item.id === id)
  if (!template || template.builtIn) return
  promptTemplates.value = promptTemplates.value.filter(item => item.id !== id)
  saveTemplates()
}

function openAiPromptAssistant() {
  if (!store.requestLogin('使用 AI 提示词助手', openAiPromptAssistant)) return
  aiPromptMode.value = prompt.value.trim() ? 'optimize' : 'generate'
  aiPromptInput.value = prompt.value.trim()
  aiPromptResult.value = ''
  showAiPromptModal.value = true
}

function switchAiPromptMode(mode: 'generate' | 'optimize') {
  aiPromptMode.value = mode
  aiPromptResult.value = ''
  if (mode === 'optimize' && !aiPromptInput.value.trim()) aiPromptInput.value = prompt.value.trim()
}

async function runAiPromptAssistant() {
  if (aiPromptInput.value.trim().length < 2) {
    store.showToast(aiPromptMode.value === 'optimize' ? '请先输入需要优化的提示词' : '请先描述想生成的画面', 'error')
    return
  }
  aiPromptLoading.value = true
  try {
    const result = await creationApi.assistImagePrompt({
      mode: aiPromptMode.value,
      input: aiPromptInput.value.trim(),
      context: {
        modelName: selectedModel.value?.name,
        ratio: ratio.value,
        resolution: resolutionLabel(resolution.value),
        productName: productContext.value?.name,
        hasReferenceImage: hasReferenceImages.value,
      },
    })
    aiPromptResult.value = result.prompt
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || 'AI提示词生成失败，请稍后重试', 'error')
  } finally {
    aiPromptLoading.value = false
  }
}

function applyAiPrompt() {
  if (!aiPromptResult.value.trim()) return
  prompt.value = aiPromptResult.value.trim()
  showAiPromptModal.value = false
  store.showToast(aiPromptMode.value === 'optimize' ? '已应用优化后的提示词' : '已应用 AI 生成的提示词')
  nextTick(() => promptTextarea.value?.focus())
}

const selectedModel = computed(() => models.value.find(m => m.id === selectedModelId.value))
const maxReferenceImages = computed(() => {
  if (!selectedModel.value?.supportsReferenceImage) return 0
  const providerModel = String(selectedModel.value.actualModel || selectedModel.value.id || '').toLowerCase()
  const fallback = providerModel.includes('gemini-2.5-flash-image')
    ? 3
    : /gpt-image|gemini-3|nano-banana/i.test(providerModel) ? 4 : 1
  return Math.min(4, Math.max(1, Number(selectedModel.value.maxReferenceImages || fallback)))
})
const referenceCount = computed(() => referenceImages.value.length)
const hasReferenceImages = computed(() => referenceCount.value > 0)
const modelGroups = computed(() => [...new Set(models.value.map(model => model.group))])
const availableRatios = computed(() => selectedModel.value?.aspectRatios || ['1:1'])
// Model capabilities stay stable before and after login. Plan entitlements are
// validated when the user submits the task instead of hiding model options.
const availableResolutions = computed(() => selectedModel.value?.resolutions || ['1K'])
const availableQualities = computed(() => selectedModel.value?.qualities || ['auto'])
const availableOutputCounts = computed(() => {
  const configured = (selectedModel.value?.outputCounts || [1, 2, 4]).map(Number)
  const maximum = Math.max(1, Math.min(4, Number(selectedModel.value?.maxOutputs || 4)))
  const values = configured.filter(value => [1, 2, 4].includes(value) && value <= maximum)
  return values.length ? [...new Set(values)] : [1]
})
const resolutionLabel = (value: string) => selectedModel.value?.resolutionLabels?.[value] || value
const qualityLabels: Record<string, string> = { auto: '自动', low: '低', medium: '中', high: '高' }
const qualityLabel = (value: string) => qualityLabels[value] || selectedModel.value?.qualityLabels?.[value] || value
const parameterMode = computed(() => selectedModel.value?.parameterMode || 'generic')
const isGptFlexible = computed(() => parameterMode.value === 'gpt-flexible')
const physicalSize = computed(() => {
  const raw = selectedModel.value?.physicalSizes?.[ratio.value]?.[resolution.value]
  return raw?.replace('x', '×') || (parameterMode.value.startsWith('gpt-') ? fallbackGptSizes[ratio.value]?.[resolution.value] : '') || ''
})
const fixedResolutionText = computed(() => {
  if (parameterMode.value === 'gpt-fixed') return physicalSize.value
  if (availableResolutions.value.length === 1) return `固定 ${resolutionLabel(availableResolutions.value[0])}`
  return ''
})
const estimatedCost = computed(() => serverEstimatedCost.value ?? (() => {
  const model = selectedModel.value
  const base = model?.billing?.baseByResolution?.[resolution.value] ?? 100
  const qualityMultiplier = model?.billing?.qualityMultiplier?.[quality.value] ?? 1
  const modelMultiplier = Number(model?.multiplier || 1)
  const baseCredits = roundBillableCredits(base * qualityMultiplier * modelMultiplier)
  const referenceCredits = Math.ceil(Number(model?.billing?.referenceImageCredits ?? 3) * referenceCount.value * modelMultiplier)
  return (baseCredits + referenceCredits) * outputCount.value
})())
const availableCredits = computed(() => store.user.availableCredits ?? store.user.credits)
const activeHistoryItem = computed(() => history.value.find(h => h.id === activeHistoryId.value))
const compareItems = computed(() => compareIds.value.map(id => gallery.value.find(item => item.id === id)).filter(Boolean))
const promptLength = computed(() => prompt.value.trim().length)
const promptPlaceholder = computed(() => editingReferenceSourceId.value
  ? '对参考图片要做局部修改的地方做出说明'
  : '描述主体、场景、构图、光线和风格；也可直接粘贴图片')
const isGuest = computed(() => !store.authenticated)
const composerSummary = computed(() => [
  selectedModel.value?.name || '图像创作',
  ratio.value,
  resolutionLabel(resolution.value),
  availableQualities.value.length > 1 ? qualityLabel(quality.value) : '',
  `${outputCount.value}张`,
].filter(Boolean).join(' · '))

function applyRequestedModel() {
  const requested = typeof route.query.model === 'string' ? route.query.model.trim() : ''
  if (!requested) return
  const requestedLower = requested.toLowerCase()
  const match = models.value.find(model => model.id === requested)
    || models.value.find(model => String(model.actualModel || '').toLowerCase() === requestedLower)
    || (requestedLower.includes('gpt-image-2')
      ? models.value.find(model => String(model.actualModel || '').toLowerCase().startsWith('gpt-image-2'))
      : undefined)
  if (match) selectedModelId.value = match.id
}

async function loadModels() {
  modelsLoading.value = true
  modelsError.value = ''
  try {
    let data
    try {
      data = store.authenticated ? await creationApi.models() : await creationApi.publicModels()
    } catch {
      data = await creationApi.publicModels()
    }
    if (!Array.isArray(data.image) || data.image.length === 0) throw new Error('模型列表为空')
    models.value = data.image
    localStorage.setItem('fusionai_image_models', JSON.stringify(data.image))
  } catch {
    let cached: ModelOption[] = []
    try { cached = JSON.parse(localStorage.getItem('fusionai_image_models') || '[]') } catch {}
    models.value = cached.length ? cached : fallbackImageModels
    modelsError.value = '模型服务连接失败，当前展示可用默认项'
  } finally {
    modelsLoading.value = false
    if (!models.value.some(model => model.id === selectedModelId.value)) selectedModelId.value = 'auto-image'
    applyRequestedModel()
  }
}
let historyRequestId = 0
async function loadHistory() {
  if (!store.authenticated) return
  const requestId = ++historyRequestId
  historyLoading.value = true
  historySearchFailed.value = false
  try {
    const result = await creationApi.history('image', historyKeyword.value)
    if (requestId === historyRequestId) history.value = result
  } catch {
    if (requestId === historyRequestId) {
      history.value = []
      historySearchFailed.value = true
    }
  } finally {
    if (requestId === historyRequestId) historyLoading.value = false
  }
}

watch(historyKeyword, (_value, _previous, onCleanup) => {
  if (!store.authenticated) return
  const timer = window.setTimeout(() => void loadHistory(), 250)
  onCleanup(() => window.clearTimeout(timer))
})

watch([selectedModelId, resolution, quality, ratio, referenceCount, outputCount], () => {
  if (!showEstimate.value) {
    serverEstimatedCost.value = null
    serverEstimateBreakdown.value = null
  }
})

watch(() => referenceImages.value.map(item => item.key).join('|'), () => {
  if (localEditMask.value && !referenceImages.value.some(item => item.key === localEditMask.value?.sourceKey)) {
    localEditMask.value = null
  }
})

function referenceKey(url: string, materialId?: string) {
  return materialId ? `material:${materialId}` : `url:${url}`
}

function addReference(item: { url?: string | null; name?: string; materialId?: string }) {
  const url = String(item.url || '')
  if (!url || (!url.startsWith('data:image') && !url.startsWith('http'))) return false
  const key = referenceKey(url, item.materialId)
  if (referenceImages.value.some(reference => reference.key === key)) return true
  if (referenceCount.value >= maxReferenceImages.value) {
    store.showToast(`当前模型最多支持 ${maxReferenceImages.value} 张参考图`, 'error')
    return false
  }
  referenceImages.value.push({
    key,
    url,
    name: item.name || `参考图 ${referenceCount.value + 1}`,
    materialId: item.materialId,
  })
  return true
}

async function uploadReferenceFiles(files: File[]) {
  const images = files.filter(isSupportedReferenceFile)
  if (!images.length) {
    store.showToast('参考图仅支持 PNG、JPG、JPEG 格式', 'error')
    return
  }
  if (images.length < files.length) {
    store.showToast(`已忽略 ${files.length - images.length} 个不支持的文件，仅支持 PNG、JPG、JPEG`, 'info')
  }
  if (!store.requestLogin('上传参考图片', () => void uploadReferenceFiles(images))) return
  const slots = Math.max(0, maxReferenceImages.value - referenceCount.value)
  if (!slots) {
    store.showToast(`当前模型最多支持 ${maxReferenceImages.value} 张参考图`, 'error')
    return
  }
  const selected = images.slice(0, slots)
  if (images.length > slots) store.showToast(`本次仅添加前 ${slots} 张，当前模型最多支持 ${maxReferenceImages.value} 张`, 'info')
  uploadingReference.value = true
  let uploaded = 0
  try {
    for (const file of selected) {
      try {
        const material = await materialApi.uploadFile(file, {})
        if (addReference({
          url: material.fileUrl,
          name: material.title || file.name,
          materialId: material.id,
        })) uploaded += 1
      } catch (error: any) {
        store.showToast(error?.response?.data?.message || `${file.name} 上传失败`, 'error')
      }
    }
    if (uploaded) store.showToast(`${uploaded} 张参考图已上传到素材库`)
  } finally {
    uploadingReference.value = false
  }
}

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (files.length) await uploadReferenceFiles(files)
}

function onComposerPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items || [])
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter(Boolean) as File[]
  if (!files.length) return
  event.preventDefault()
  composerCollapsed.value = false
  void uploadReferenceFiles(files)
}

let lastSyncedModelId = ''
watch([selectedModel, () => store.user.entitlements], ([model]) => {
  if (!model) return
  const modelChanged = model.id !== lastSyncedModelId
  if (modelChanged || !availableRatios.value.includes(ratio.value)) {
    ratio.value = model.defaultRatio || availableRatios.value[0]
    if (!modelChanged) store.showToast('已切换为该模型支持的画面比例')
  }
  if (modelChanged || !availableResolutions.value.includes(resolution.value)) {
    resolution.value = (availableResolutions.value.includes(model.defaultResolution || '') ? model.defaultResolution : availableResolutions.value[0]) || '1K'
  }
  if (modelChanged || !availableQualities.value.includes(quality.value)) {
    quality.value = model.defaultQuality || availableQualities.value[0] || (parameterMode.value.startsWith('gpt-') ? 'medium' : 'auto')
  }
  if (!availableOutputCounts.value.includes(outputCount.value)) outputCount.value = availableOutputCounts.value[0] || 1
  lastSyncedModelId = model.id
  inputFidelity.value = model.inputFidelities?.includes(inputFidelity.value) ? inputFidelity.value : model.defaultInputFidelity || 'low'
  if (!model.supportsReferenceImage && hasReferenceImages.value) {
    clearReferences()
    store.showToast('该模型暂不支持参考图，已移除参考素材')
  } else if (referenceCount.value > maxReferenceImages.value) {
    referenceImages.value = referenceImages.value.slice(0, maxReferenceImages.value)
    store.showToast(`该模型最多支持 ${maxReferenceImages.value} 张参考图，已保留前 ${maxReferenceImages.value} 张`)
  }
})

watch(() => store.authenticated, authenticated => {
  if (!authenticated) return
  void Promise.allSettled([loadHistory(), store.fetchUsage(), loadProductContext()])
})

async function openMaterialPicker() {
  if (!store.requestLogin('从素材库选择参考图片', () => void openMaterialPicker())) return
  showMaterialPicker.value = true
  materialLoading.value = true
  try {
    const res = await http.get('/material', { params: { type: 'image' } }) as any[]
    materialList.value = res || []
  } catch (e) {
    console.error('加载素材列表失败', e)
    store.showToast('素材库加载失败', 'error')
  } finally {
    materialLoading.value = false
  }
}

function selectMaterial(item: any) {
  if (!isSupportedReferenceMaterial(item)) {
    store.showToast('参考图仅支持 PNG、JPG、JPEG 格式', 'error')
    return
  }
  const url = item.fileUrl || item.fileKey || item.thumbnailUrl
  if (!url || (!url.startsWith('data:image') && !url.startsWith('http'))) {
    store.showToast('该素材无法作为参考图', 'error')
    return
  }
  const key = referenceKey(url, item.id)
  const existing = referenceImages.value.find(reference => reference.key === key)
  if (existing) {
    referenceImages.value = referenceImages.value.filter(reference => reference.key !== key)
    if (!referenceImages.value.length) editingReferenceSourceId.value = null
    return
  }
  addReference({ url, name: item.title, materialId: item.id })
}

function removeReference(key: string) {
  referenceImages.value = referenceImages.value.filter(reference => reference.key !== key)
  if (localEditMask.value?.sourceKey === key) localEditMask.value = null
  if (!referenceImages.value.length) editingReferenceSourceId.value = null
}

function clearReferences() {
  referenceImages.value = []
  editingReferenceSourceId.value = null
  localEditMask.value = null
  localEditSource.value = null
}

async function startGenerate() {
  if (generating.value || estimating.value || showEstimate.value) return
  if (!prompt.value.trim()) {
    composerCollapsed.value = false
    store.showToast('请输入提示词', 'error')
    nextTick(() => promptTextarea.value?.focus())
    return
  }
  if (!store.requestLogin('生成这张图片', startGenerate)) return
  estimating.value = true
  try {
    const estimate = await creationApi.estimateImage({
      modelId: selectedModelId.value,
      resolution: resolution.value,
      quality: quality.value,
      ratio: ratio.value,
      referenceCount: referenceCount.value,
      outputCount: outputCount.value,
      maskedEdit: Boolean(localEditMask.value),
    })
    serverEstimatedCost.value = estimate.credits
    serverEstimateBreakdown.value = estimate.breakdown || null
    pendingIdempotencyKey.value = taskKey('image')
    showEstimate.value = true
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '暂时无法计算本次费用', 'error')
  } finally {
    estimating.value = false
  }
}

async function confirmGenerate() {
  if (generating.value) return
  generating.value = true
  const idempotencyKey = pendingIdempotencyKey.value || taskKey('image')
  showEstimate.value = false
  await nextTick()
  scrollGalleryToStart()
  const submitted = {
    prompt: prompt.value.trim(), modelId: selectedModelId.value, modelName: selectedModel.value?.name,
    resolution: resolution.value, quality: quality.value, inputFidelity: inputFidelity.value, ratio: ratio.value,
    outputCount: outputCount.value,
    productId: productContext.value?.id || (typeof route.query.productId === 'string' ? route.query.productId : undefined),
    brandId: typeof route.query.brandId === 'string' ? route.query.brandId : undefined,
    referenceImages: referenceImages.value.map(item => ({ ...item })),
    maskImage: localEditMask.value?.base64,
  }
  try {
    const res = await creationApi.generateImage({
      prompt: submitted.prompt,
      modelId: submitted.modelId,
      resolution: submitted.resolution,
      quality: submitted.quality,
      inputFidelity: submitted.referenceImages.length ? submitted.inputFidelity : undefined,
      ratio: submitted.ratio,
      outputCount: submitted.outputCount,
      productId: submitted.productId,
      brandId: submitted.brandId,
      referenceImages: submitted.referenceImages.filter(item => !item.materialId).map(item => item.url),
      referenceMaterialIds: submitted.referenceImages.map(item => item.materialId).filter(Boolean) as string[],
      maskImage: submitted.maskImage,
      idempotencyKey,
    })
    await store.fetchUsage()
    await loadHistory()
    const resultAssets = (res.assets?.length ? res.assets : [res.asset]).filter(Boolean).map((asset: any) => ({
      ...asset,
      urls: asset.fileUrl ? [asset.fileUrl] : res.urls || [],
      prompt: submitted.prompt,
      cost: res.perOutputCost || asset.cost || Math.ceil(res.cost / submitted.outputCount),
      model: submitted.modelName,
      resolution: submitted.resolution,
      quality: submitted.quality,
      modelId: submitted.modelId,
      ratio: submitted.ratio,
      productId: submitted.productId,
    }))
    gallery.value = resultAssets
    compareIds.value = []
    activeBatchId.value = res.batchId || null
    activeBatch.value = res.batchId ? { id: res.batchId, status: res.status, outputCount: submitted.outputCount, succeededCount: 0, failedCount: 0 } : null
    activeHistoryId.value = res.batchId || res.asset.id
    if (res.status === 'queued') {
      store.showToast(submitted.outputCount > 1 ? `${submitted.outputCount} 张图片已进入生成队列，将按套餐并发规则依次完成` : '任务已进入生成队列，完成后将自动展示')
      void pollGeneratedImage(res.batchId || res.asset.id, Boolean(res.batchId))
    } else {
      store.showToast(`图像已生成，消耗 ${res.cost} 积分`)
    }
    if (res.warning) store.showToast(res.warning, 'info')
    saveLastParams()
    resetComposerAfterSubmit()
    composerCollapsed.value = true
    await nextTick()
    scrollGalleryToStart()
  } catch (e: any) {
    store.showToast(friendlyCreationError(e, 'image'), 'error')
  } finally {
    generating.value = false
    pendingIdempotencyKey.value = ''
  }
}

function closeEstimate() {
  if (generating.value) return
  showEstimate.value = false
  pendingIdempotencyKey.value = ''
  serverEstimateBreakdown.value = null
}

async function pollGeneratedImage(targetId: string, isBatch = false) {
  for (let i = 0; i < 120; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000))
    try {
      const detail = await creationApi.historyDetail(targetId) as any
      if (isBatch && Array.isArray(detail.outputs)) {
        activeBatch.value = detail
        gallery.value = detail.outputs.map((item: any) => ({ ...item, urls: item.fileUrl ? [item.fileUrl] : [], prompt: detail.prompt, modelId: detail.modelId }))
      } else {
        const index = gallery.value.findIndex(item => item.id === targetId)
        if (index >= 0) gallery.value[index] = { ...gallery.value[index], ...detail, urls: detail.fileUrl ? [detail.fileUrl] : [] }
      }
      if (detail.status === 'completed' || detail.status === 'succeeded') {
        await loadHistory(); await store.fetchUsage(); store.showToast(isBatch ? `${detail.succeededCount || detail.outputCount} 张图片生成完成` : '图像生成完成')
        return
      }
      if (['failed', 'partial_failed'].includes(detail.status)) {
        await loadHistory(); await store.fetchUsage()
        store.showToast(detail.status === 'partial_failed' ? `${detail.succeededCount} 张成功，${detail.failedCount} 张失败；失败图片积分已退回` : `图像生成失败：${failureMessage(detail)}`, 'error')
        return
      }
    } catch { /* ignore transient polling errors */ }
  }
}

async function retryFailedBatch() {
  if (!activeBatchId.value || generating.value) return
  generating.value = true
  const retryCount = Number(activeBatch.value?.failedCount || 0)
  try {
    const detail = await creationApi.retryImageBatch(activeBatchId.value)
    activeBatch.value = detail
    gallery.value = (detail.outputs || []).map((item: any) => ({ ...item, urls: item.fileUrl ? [item.fileUrl] : [], prompt: detail.prompt, modelId: detail.modelId }))
    store.showToast(`已重新提交 ${retryCount || gallery.value.filter(isProcessing).length || 1} 张失败图片`)
    void pollGeneratedImage(activeBatchId.value, true)
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '失败图片重试提交失败', 'error')
  } finally {
    generating.value = false
  }
}

async function downloadActiveBatch() {
  if (!activeBatchId.value) return
  try {
    const result = await creationApi.downloadImageBatch(activeBatchId.value)
    const anchor = document.createElement('a')
    anchor.href = result.url
    anchor.download = result.fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    store.showToast(`正在下载 ${result.imageCount} 张图片`)
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '批量下载失败', 'error')
  }
}

async function viewHistory(item: any) {
  activeHistoryId.value = item.id
  try {
    const detail = await creationApi.historyDetail(item.id)
    if (Array.isArray((detail as any).outputs)) {
      activeBatchId.value = (detail as any).batchId
      activeBatch.value = detail
      gallery.value = (detail as any).outputs.map((output: any) => ({ ...output, urls: output.fileUrl ? [output.fileUrl] : [], prompt: (detail as any).prompt, modelId: (detail as any).modelId }))
      compareIds.value = []
    } else {
      activeBatchId.value = null
      activeBatch.value = null
      const img = { ...detail, urls: detail.fileUrl ? [detail.fileUrl] : [], prompt: detail.prompt || detail.source }
      if (!gallery.value.find(g => g.id === img.id)) gallery.value.unshift(img)
    }
    await nextTick()
    scrollGalleryToStart()
  } catch { store.showToast('加载失败', 'error') }
}

function newTask() {
  activeHistoryId.value = null
  activeBatchId.value = null
  activeBatch.value = null
  compareIds.value = []
  showCompareModal.value = false
  gallery.value = []
  prompt.value = ''
  editingReferenceSourceId.value = null
  inspirationDraftTitle.value = ''
  clearReferences()
  clearProductContext()
  composerCollapsed.value = false
  nextTick(() => promptTextarea.value?.focus())
}

function productPrompt(product: Product) {
  return [
    `为「${product.name}」生成一张高品质电商商品图`,
    product.selling ? `核心卖点：${product.selling}` : '',
    product.audience ? `目标人群：${product.audience}` : '',
    '保留商品真实外观与材质，主体清晰，构图适合商业投放',
  ].filter(Boolean).join('。')
}

function applyProductContext() {
  if (!productContext.value) return
  if (!prompt.value.trim()) prompt.value = productPrompt(productContext.value)
  if (productCoverMaterial.value) selectMaterial(productCoverMaterial.value)
}

async function loadProductContext() {
  const productId = typeof route.query.productId === 'string' ? route.query.productId : ''
  if (!productId) return
  try {
    productContext.value = await productApi.detail(productId)
    productCoverMaterial.value = await productApi.ensureCoverMaterial(productId)
    applyProductContext()
    store.showToast(`已带入商品「${productContext.value.name}」`)
  } catch {
    store.showToast('关联商品加载失败，仍可手动创作', 'error')
  }
}

function clearProductContext() {
  const materialId = productCoverMaterial.value?.id
  productContext.value = null
  productCoverMaterial.value = null
  if (materialId) referenceImages.value = referenceImages.value.filter(reference => reference.materialId !== materialId)
  const query = { ...route.query }
  delete query.productId
  delete query.source
  router.replace({ query })
}

function resetComposerAfterSubmit() {
  prompt.value = ''
  editingReferenceSourceId.value = null
  inspirationDraftTitle.value = ''
  clearReferences()
  clearProductContext()
}

function applyPromptStarter(text: string) {
  prompt.value = text
  nextTick(() => promptTextarea.value?.focus())
}

function handlePromptKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.repeat) return
  event.preventDefault()
  void startGenerate()
}

function formatHistoryTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function historyPrompt(item: any) {
  return String(item?.prompt || item?.title || '未命名图像任务').trim()
}

function historyParams(item: any) {
  let meta = item?.meta || {}
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta) } catch { meta = {} }
  }
  const modelId = meta.modelId || item?.modelId
  const model = models.value.find(candidate => candidate.id === modelId)
  const modelName = model?.name || modelId || '智能推荐'
  const taskQuality = meta.quality || item?.quality
  return [
    modelName,
    meta.ratio || item?.ratio,
    meta.resolution || item?.resolution,
    model?.qualities && model.qualities.length > 1 ? (qualityLabels[taskQuality] || taskQuality) : undefined,
    Number(meta.outputCount || item?.outputCount || 1) > 1 ? `${meta.outputCount || item.outputCount}张` : undefined,
  ].filter(Boolean).join(' · ')
}

function loadInspirationDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem('fusionai_inspiration_draft') || '')
    if (draft?.type !== 'image' || !draft?.prompt) return
    prompt.value = draft.prompt
    inspirationDraftTitle.value = draft.title || '灵感广场'
    sessionStorage.removeItem('fusionai_inspiration_draft')
    store.showToast('已载入灵感提示词，可继续编辑')
    nextTick(() => promptTextarea.value?.focus())
  } catch {}
}

async function deleteHistory(id: string) {
  if (!confirm('删除后生成结果和对应文件将无法恢复，确定继续吗？')) return
  try {
    await creationApi.deleteAsset(id)
    history.value = history.value.filter(h => h.id !== id)
    if (activeBatchId.value === id) {
      activeBatchId.value = null
      activeBatch.value = null
      activeHistoryId.value = null
      gallery.value = []
    } else {
      gallery.value = gallery.value.filter(g => g.id !== id)
    }
    store.showToast('已删除')
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '删除失败', 'error')
  }
}

async function removeGalleryItem(id: string) {
  if (!confirm('删除后生成结果和对应文件将无法恢复，确定继续吗？')) return
  try {
    await creationApi.deleteAsset(id)
    gallery.value = gallery.value.filter(g => g.id !== id)
    await loadHistory()
    store.showToast('已删除')
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '删除失败', 'error')
  }
}

/** 获取可显示的图片 URL（data:image 或 http） */
function getImageUrl(item: any): string | undefined {
  const url = item?.urls?.[0] || item?.fileUrl || item?.fileKey
  if (url && (url.startsWith('data:image') || url.startsWith('http'))) return url
  return undefined
}

function scrollGalleryToStart() {
  resultStage.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function isProcessing(item: any) {
  return ['pending', 'queued', 'processing'].includes(item?.status)
}

function isFailed(item: any) {
  return item?.status === 'failed'
}

function failureMessage(item: any) {
  const meta = typeof item?.meta === 'string' ? (() => { try { return JSON.parse(item.meta) } catch { return {} } })() : item?.meta
  return friendlyCreationError(meta?.error, 'image', true)
}

function zoomImage(item: any) {
  const url = getImageUrl(item)
  if (url) {
    zoomAsset.value = item
  }
}

function closeImagePreview() {
  zoomAsset.value = null
}

function handleImagePreviewKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && zoomAsset.value) closeImagePreview()
}

function copyPrompt(item: any) {
  const text = item?.prompt || prompt.value
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => store.showToast('提示词已复制'))
  } else {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); document.body.removeChild(ta); store.showToast('提示词已复制')
  }
}

function toggleCompare(item: any) {
  if (!getImageUrl(item)) return
  if (compareIds.value.includes(item.id)) {
    compareIds.value = compareIds.value.filter(id => id !== item.id)
    return
  }
  compareIds.value = [...compareIds.value.slice(-1), item.id]
}

async function toggleFavorite(item: any) {
  const tags = Array.isArray(item.tags) ? [...item.tags] : []
  const favorite = tags.includes('favorite')
  const next = favorite ? tags.filter((tag: string) => tag !== 'favorite') : [...tags, 'favorite']
  try {
    await assetApi.update(item.id, { tags: next })
    item.tags = next
    store.showToast(favorite ? '已取消收藏' : '已收藏到内容资产')
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '收藏操作失败', 'error')
  }
}

async function editPrompt(item: any) {
  composerCollapsed.value = false
  activeHistoryId.value = item?.id || null
  prompt.value = ''
  editingReferenceSourceId.value = null
  localEditMask.value = null
  localEditSource.value = null
  // 优先从 meta 字段恢复参数，兼容直接字段（刚生成的 gallery item）
  let meta = item?.meta || {}
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta) } catch { meta = {} }
  }
  const modelId = meta.modelId || item?.modelId
  const resolutionVal = meta.resolution || item?.resolution || (['1K','2K','4K','512','standard'].includes(meta.quality) ? meta.quality : undefined)
  const qualityVal = ['auto','low','medium','high'].includes(meta.quality || item?.quality) ? (meta.quality || item?.quality) : undefined
  const ratioVal = meta.ratio || item?.ratio
  if (modelId && models.value.find(m => m.id === modelId)) {
    selectedModelId.value = modelId
    await nextTick()
  }
  if (resolutionVal) resolution.value = resolutionVal
  if (qualityVal) quality.value = qualityVal
  if (meta.inputFidelity) inputFidelity.value = meta.inputFidelity
  if (ratioVal) ratio.value = ratioVal
  // 将上次生成的图片作为参考图
  const lastUrl = item?.urls?.[0] || item?.fileUrl || item?.fileKey
  if (lastUrl && (lastUrl.startsWith('data:image') || lastUrl.startsWith('http'))) {
    referenceImages.value = [{
      key: referenceKey(lastUrl),
      url: lastUrl,
      name: item?.model || '上次生成图片',
    }]
    editingReferenceSourceId.value = item?.id || referenceKey(lastUrl)
  }
  if (item?.productId) {
    try {
      productContext.value = await productApi.detail(item.productId)
      productCoverMaterial.value = null
      const query = { ...route.query, productId: item.productId, source: 'history-edit' }
      await router.replace({ query })
    } catch { productContext.value = null }
  } else if (productContext.value) {
    clearProductContext()
  }
  store.showToast('已带入参考图和参数，请说明需要局部修改的位置和效果')
  nextTick(() => promptTextarea.value?.focus())
}

function openLocalEditMarker() {
  const source = referenceImages.value[0]
  if (!source || !editingReferenceSourceId.value) {
    store.showToast('请先从生成结果选择“编辑图片”', 'error')
    return
  }
  localEditSource.value = source
}

async function markAndEdit(item: any) {
  await editPrompt(item)
  openLocalEditMarker()
}

function applyLocalEditMarker(payload: {
  base64: string
  preview: string
  region: { x: number; y: number; width: number; height: number; label: string }
}) {
  const source = localEditSource.value || referenceImages.value[0]
  if (!source) return
  localEditMask.value = { sourceKey: source.key, base64: payload.base64, preview: payload.preview, region: payload.region }
  localEditSource.value = null
  inputFidelity.value = 'high'
  prompt.value = '局部修改要求：【请填写具体修改要求】'
  composerCollapsed.value = false
  store.showToast('已生成局部修改模板，请补充具体修改内容')
  nextTick(() => promptTextarea.value?.focus())
}

function clearLocalEditMarker() {
  localEditMask.value = null
}

function downloadImage(item: any) {
  if (!store.requestLogin('下载生成图片', () => downloadImage(item))) return
  const url = item?.downloadUrl || item?.urls?.[0] || item?.fileUrl || item?.fileKey
  if (!url) { store.showToast('无图片可下载', 'error'); return }
  if (url.startsWith('data:image')) {
    const a = document.createElement('a')
    a.href = url
    a.download = `fusionai-${item.id?.slice(0, 8) || Date.now()}.png`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    store.showToast('图片已下载')
  } else {
    window.open(url, '_blank')
  }
}

// 保存上次选择的模型参数
function saveLastParams() {
  localStorage.setItem('fusionai_last_image_params', JSON.stringify({
    modelId: selectedModelId.value, resolution: resolution.value, quality: quality.value, inputFidelity: inputFidelity.value, ratio: ratio.value, outputCount: outputCount.value,
  }))
}
function loadLastParams() {
  try {
    const saved = JSON.parse(localStorage.getItem('fusionai_last_image_params') || '')
    if (saved?.modelId) selectedModelId.value = saved.modelId
    if (saved?.resolution) resolution.value = saved.resolution
    else if (['1K','2K','4K','512','standard'].includes(saved?.quality)) resolution.value = saved.quality
    if (['auto','low','medium','high'].includes(saved?.quality)) quality.value = saved.quality
    if (saved?.inputFidelity) inputFidelity.value = saved.inputFidelity
    if (saved?.ratio) ratio.value = saved.ratio
    if ([1, 2, 4].includes(Number(saved?.outputCount))) outputCount.value = Number(saved.outputCount)
  } catch {}
}

onMounted(() => {
  window.addEventListener('keydown', handleImagePreviewKeydown)
  loadLastParams()
  loadInspirationDraft()
  const initialLoads: Promise<unknown>[] = [loadModels()]
  if (store.authenticated) initialLoads.push(loadHistory(), store.fetchUsage())
  Promise.allSettled(initialLoads)
  if (store.authenticated) void loadProductContext()
  const materialId = typeof route.query.materialId === 'string' ? route.query.materialId : ''
  if (store.authenticated && materialId && route.query.materialType === 'image') {
    materialApi.detail(materialId).then(selectMaterial).catch(() => store.showToast('指定素材加载失败', 'error'))
  }
})

onBeforeUnmount(() => window.removeEventListener('keydown', handleImagePreviewKeydown))
</script>

<template>
  <section class="studio" :class="{ 'history-collapsed': historyCollapsed }">
    <aside class="history">
      <div class="history-top">
        <button class="new-task" type="button" title="新建创作" aria-label="新建创作" @click="newTask">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          <span>新建创作</span>
        </button>
        <button class="history-toggle" :title="historyCollapsed ? '展开历史记录' : '收起历史记录'" @click="historyCollapsed = !historyCollapsed">
          <svg viewBox="0 0 24 24"><path :d="historyCollapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'"/></svg>
        </button>
      </div>
      <div v-if="historyCollapsed" class="collapsed-status-dots" aria-label="最近历史任务状态">
        <span v-if="historyLoading" class="status-dot loading" title="正在加载历史任务"></span>
        <span v-for="h in history.slice(0, 8)" v-else :key="h.id" class="status-dot" :class="h.status" :title="historyPrompt(h)"></span>
      </div>
      <div class="history-heading"><h3>历史任务</h3><span>{{ historyLoading ? '…' : history.length }}</span></div>
      <label v-if="!isGuest" class="history-search" aria-label="搜索图像历史任务">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
        <input v-model="historyKeyword" type="search" maxlength="100" placeholder="搜索提示词或模型" @keydown.esc="historyKeyword = ''" />
        <button v-if="historyKeyword" type="button" title="清空搜索" aria-label="清空搜索" @click="historyKeyword = ''">×</button>
      </label>
      <div class="history-list">
        <button v-if="isGuest" class="guest-history" @click="store.requestLogin('查看图像创作历史')"><strong>登录后查看历史任务</strong><span>生成结果会自动保存到内容资产库</span></button>
        <div v-else-if="historyLoading" class="history-feedback"><span class="history-spinner"></span><p>正在搜索...</p></div>
        <div v-else-if="historySearchFailed" class="history-feedback"><p>历史记录加载失败</p><button type="button" @click="loadHistory">重新加载</button></div>
        <div v-else-if="!history.length" class="history-feedback"><p>{{ historyKeyword.trim() ? '未找到相关任务' : '暂无历史任务' }}</p><button v-if="historyKeyword" type="button" @click="historyKeyword = ''">清空搜索</button></div>
        <template v-else>
          <div v-for="h in history" :key="h.id" class="history-row" :class="{ active: h.id === activeHistoryId }">
            <button class="history-main" @click="viewHistory(h)">
              <span class="status-dot" :class="h.status"></span>
              <span class="history-copy">
                <strong :title="historyPrompt(h)">{{ historyPrompt(h) }}</strong>
                <span class="history-subline"><small :title="historyParams(h)">{{ historyParams(h) }}</small><time>{{ formatHistoryTime(h.createdAt) }}</time></span>
              </span>
            </button>
            <button class="delete-history" title="删除任务" @click.stop="deleteHistory(h.id)">
              <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0l1 13h8l1-13M10 11v5m4-5v5"/></svg>
            </button>
          </div>
        </template>
      </div>
    </aside>

    <main class="studio-main">
      <div class="result-stage" ref="resultStage">
        <div class="stage-toolbar">
          <div><strong>{{ gallery.length ? '生成结果' : '图像工作区' }}</strong><span v-if="activeBatch">{{ activeBatch.succeededCount || 0 }}/{{ activeBatch.outputCount }} 已完成</span><span v-else-if="gallery.length">{{ gallery.length }} 个结果</span></div>
          <div class="batch-toolbar-actions">
            <button v-if="activeBatchId && activeBatch?.succeededCount" title="打包下载成功图片" @click="downloadActiveBatch"><svg viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg></button>
            <button v-if="activeBatchId && activeBatch?.failedCount" class="retry-batch" title="仅重试失败图片" @click="retryFailedBatch"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 10-2 5.3M20 4v7h-7"/></svg><span>重试失败项</span></button>
            <button v-if="gallery.length" title="创建新任务" @click="newTask"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
          </div>
        </div>

        <div v-if="!generating && !gallery.length" class="empty-state">
          <div class="empty-icon"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 16l4-4 3 3 4-5 5 6"/><path d="M17 3v4M15 5h4"/></svg></div>
          <h2>{{ inspirationDraftTitle ? `来自「${inspirationDraftTitle}」` : '开始新的图像创作' }}</h2>
          <p>{{ inspirationDraftTitle ? '提示词已经载入，可直接调整参数或继续补充描述。' : '选择一个常用场景，快速建立提示词草稿。' }}</p>
          <div v-if="!inspirationDraftTitle" class="prompt-starters">
            <button v-for="starter in promptStarters" :key="starter.label" @click="applyPromptStarter(starter.text)">
              <strong>{{ starter.label }}</strong><span>使用模板</span>
            </button>
          </div>
          <button v-if="!inspirationDraftTitle" class="browse-inspiration" @click="$router.push('/inspiration')">浏览灵感广场</button>
        </div>

        <div v-if="gallery.length || generating" class="gallery-grid" :class="{ 'batch-grid': activeBatchId }">
          <article v-if="generating" class="gallery-card skeleton-card" aria-live="polite">
            <div class="skeleton-img"><span></span><div class="generation-state"><i></i><strong>正在提交生成任务</strong><small>保持在此页面即可，输入区仍可继续查看</small></div></div>
            <div class="gallery-info"><div class="skeleton-line"></div><div class="skeleton-line short"></div><div class="skeleton-bar"><div class="loadbar"></div></div><p class="skeleton-text">{{ selectedModel?.name }} · {{ resolutionLabel(resolution) }} · {{ ratio }}</p></div>
          </article>
          <article v-for="item in gallery" :key="item.id" class="gallery-card" :class="{ active: item.id === activeHistoryId }">
            <button class="gallery-visual" :class="{ processing: isProcessing(item), failed: isFailed(item), 'has-image': Boolean(getImageUrl(item)) }" :title="getImageUrl(item) ? '放大查看' : ''" :disabled="!getImageUrl(item)" @click="zoomImage(item)">
              <img v-if="getImageUrl(item)" :src="getImageUrl(item)" loading="lazy" />
              <span v-else-if="isProcessing(item)" class="gallery-placeholder processing-placeholder"><i></i><strong>正在生成</strong><small>任务已进入队列，完成后自动展示</small></span>
              <span v-else class="gallery-placeholder failed-placeholder"><svg viewBox="0 0 24 24"><path d="M12 8v5m0 3h.01M10 3h4l8 15H2L10 3z"/></svg><strong>生成失败</strong><small>{{ failureMessage(item) }}</small></span>
              <em v-if="getImageUrl(item)">点击预览</em>
            </button>
            <div class="gallery-info">
              <h3>{{ item.prompt || item.title }}</h3>
              <div class="gallery-meta">
                <span>{{ item.model || item.source }}</span>
                <span v-if="item.ratio || item.meta?.ratio">{{ item.ratio || item.meta?.ratio }}</span>
                <span v-if="item.resolution || item.meta?.resolution">{{ resolutionLabel(item.resolution || item.meta?.resolution) }}</span>
                <span v-if="item.meta?.actualWidth && item.meta?.actualHeight">{{ item.meta.actualWidth }}×{{ item.meta.actualHeight }}</span>
                <span v-else-if="item.meta?.requestedSize">{{ item.meta.requestedSize.replace('x', '×') }}</span>
                <span v-if="['auto','low','medium','high'].includes(item.quality || item.meta?.quality) && (models.find(m => m.id === (item.modelId || item.meta?.modelId))?.qualities?.length || 0) > 1">{{ qualityLabels[item.quality || item.meta?.quality] }}</span>
                <span>{{ item.cost || 0 }} 积分</span>
              </div>
              <div class="gallery-actions">
                <button title="复制提示词" @click="copyPrompt(item)"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3"/></svg></button>
                <button title="编辑图片" @click="editPrompt(item)"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/></svg></button>
                <button v-if="getImageUrl(item)" title="局部标记并编辑" @click="markAndEdit(item)"><svg viewBox="0 0 24 24"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="3"/></svg></button>
                <button title="下载" @click="downloadImage(item)"><svg viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg></button>
                <button v-if="getImageUrl(item)" :class="{ selected: item.tags?.includes('favorite') }" :title="item.tags?.includes('favorite') ? '取消收藏' : '收藏'" @click="toggleFavorite(item)"><svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3z"/></svg></button>
                <button v-if="activeBatchId && getImageUrl(item)" :class="{ selected: compareIds.includes(item.id) }" :title="compareIds.includes(item.id) ? '移出对比' : '加入对比'" @click="toggleCompare(item)"><svg viewBox="0 0 24 24"><path d="M8 4H4v16h4M16 4h4v16h-4M12 3v18"/></svg></button>
                <button v-if="!activeBatchId" class="danger" title="删除" @click="removeGalleryItem(item.id)"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0l1 13h8l1-13"/></svg></button>
                <button v-if="!activeBatchId && !isProcessing(item)" class="regenerate" @click="prompt = item.prompt || ''; startGenerate()"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 10-2 5.3M20 4v7h-7"/></svg>{{ isFailed(item) ? '重新生成' : '再次生成' }}</button>
              </div>
            </div>
          </article>
        </div>
        <div v-if="activeBatchId && compareIds.length" class="compare-tray"><span>已选 {{ compareIds.length }}/2 张</span><button :disabled="compareIds.length !== 2" @click="showCompareModal = true">对比查看</button><button class="text-action" @click="compareIds = []">清空</button></div>
      </div>

      <div class="generator-panel" :class="{ 'has-reference': hasReferenceImages, collapsed: composerCollapsed }" @paste="onComposerPaste">
        <div class="image-composer-head">
          <button v-if="composerCollapsed" class="image-composer-copy" type="button" @click="composerCollapsed = false">
            <strong>{{ composerSummary }}</strong><span>{{ prompt || '点击展开继续创作' }}</span>
          </button>
          <div v-else><span>图像创作</span><strong>{{ selectedModel?.name || '正在加载模型' }}</strong></div>
          <button class="image-composer-toggle" type="button" :title="composerCollapsed ? '展开创作台' : '收起创作台'" :aria-expanded="!composerCollapsed" @click="composerCollapsed = !composerCollapsed">
            <svg viewBox="0 0 24 24"><path :d="composerCollapsed ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'"/></svg>
          </button>
        </div>
        <div v-if="!composerCollapsed" class="image-composer-body">
        <div v-if="productContext" class="product-context">
          <img v-if="productContext.coverUrl" :src="productContext.coverUrl" :alt="productContext.name" />
          <span><small>关联商品</small><strong>{{ productContext.name }}</strong></span>
          <em>主图与商品资料已带入本次任务</em>
          <button title="取消关联商品" @click="clearProductContext">×</button>
        </div>
        <div v-if="hasReferenceImages" class="reference-strip">
          <span>参考图 {{ referenceCount }}/{{ maxReferenceImages }}</span>
          <div class="reference-list">
            <div v-for="(item, index) in referenceImages" :key="item.key" class="reference-item" :title="item.name">
              <div class="ref-preview">
                <img :src="item.url" :alt="item.name" class="ref-thumb" />
                <em>{{ index === 0 ? '主' : index + 1 }}</em>
                <button class="ref-remove" type="button" :title="`移除${item.name}`" @click="removeReference(item.key)">×</button>
              </div>
              <small>{{ item.name }}</small>
            </div>
          </div>
          <button v-if="referenceCount < maxReferenceImages" class="reference-add" type="button" title="继续添加参考图" @click="openMaterialPicker">+</button>
          <button v-if="editingReferenceSourceId" class="local-edit-marker" type="button" :class="{ active: localEditMask }" :title="localEditMask ? '重新标记局部修改区域' : '标记局部修改区域'" @click="openLocalEditMarker">
            <svg viewBox="0 0 24 24"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="3"/></svg>
            <span>{{ localEditMask ? '重新标记' : '标记局部' }}</span>
          </button>
          <button class="reference-clear" type="button" title="清空参考图" @click="clearReferences">清空</button>
        </div>
        <div v-if="localEditMask" class="local-edit-summary">
          <span><i></i>{{ localEditMask.region.label }}已标记</span>
          <strong>提示词已按局部编辑模板回填</strong>
          <button type="button" title="清除局部标记" @click="clearLocalEditMarker">×</button>
        </div>
        <div v-if="inspirationDraftTitle" class="draft-source"><span>灵感来源</span><strong>{{ inspirationDraftTitle }}</strong><button title="清除来源标记" @click="inspirationDraftTitle = ''">×</button></div>
        <div class="prompt-shell">
          <textarea ref="promptTextarea" v-model="prompt" maxlength="2000" :placeholder="promptPlaceholder" rows="3" @keydown="handlePromptKeydown"></textarea>
          <span class="prompt-count">{{ promptLength }}/2000</span>
        </div>
        <div class="composer-toolbar">
          <div class="source-actions">
            <button title="从素材库选择参考图" @click="openMaterialPicker"><svg viewBox="0 0 24 24"><path d="M3 6h7l2 2h9v10H3z"/></svg><span>素材库</span></button>
            <label title="从本地上传参考图，可多选，仅支持 PNG、JPG、JPEG" @click.capture="isGuest && ($event.preventDefault(), store.requestLogin('上传参考图片'))"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L8 8m4-4l4 4M4 18v2h16v-2"/></svg><span>本地上传</span><input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" multiple hidden @change="onUpload" /></label>
            <button title="选择提示词模板" @click="showTemplateModal = true"><svg viewBox="0 0 24 24"><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/></svg><span>模板</span></button>
            <button title="使用 AI 生成或优化提示词" @click="openAiPromptAssistant"><svg viewBox="0 0 24 24"><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/></svg><span>AI 提示词</span></button>
            <span v-if="uploadingReference" class="image-upload-status">正在上传图片…</span>
          </div>
          <div class="parameter-controls">
            <label class="select-control model-select-control" title="选择模型"><select v-model="selectedModelId" aria-label="选择模型" :disabled="modelsLoading"><option v-if="modelsLoading && !models.length" value="auto-image">正在加载模型...</option><optgroup v-for="g in modelGroups" :key="g" :label="g"><option v-for="m in models.filter(m => m.group === g)" :key="m.id" :value="m.id">{{ m.name }}</option></optgroup></select></label>
            <button v-if="modelsError" class="model-retry" type="button" title="重新加载模型" @click="loadModels"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 10-2 5.3M20 4v7h-7"/></svg></button>
            <label class="select-control compact" title="选择画面比例"><select v-model="ratio" aria-label="选择画面比例"><option v-for="r in availableRatios" :key="r" :value="r">{{ r }}</option></select></label>
             <label class="select-control clarity-select" title="请选择清晰度"><select v-model="resolution" aria-label="请选择清晰度" :disabled="availableResolutions.length <= 1"><option v-for="r in availableResolutions" :key="r" :value="r">{{ resolutionLabel(r) }}</option></select></label>
             <label v-if="availableQualities.length > 1" class="select-control quality-select" title="选择生成质量"><select v-model="quality" aria-label="选择生成质量"><option v-for="q in availableQualities" :key="q" :value="q">{{ qualityLabel(q) }}</option></select></label>
             <label class="select-control count-select" title="选择输出数量"><select v-model.number="outputCount" aria-label="选择输出数量"><option v-for="count in availableOutputCounts" :key="count" :value="count">{{ count }}张</option></select></label>
             <details v-if="hasReferenceImages && selectedModel?.supportsInputFidelity" class="advanced-control">
               <summary title="高级生成参数"><svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2m4 0h10M14 4v6M10 14v6"/></svg></summary>
               <div class="advanced-menu">
                 <label v-if="hasReferenceImages && selectedModel?.supportsInputFidelity"><span>参考图保真</span><select v-model="inputFidelity"><option value="low">灵活编辑</option><option value="high">高保真</option></select></label>
               </div>
             </details>
          </div>
          <button class="send" @click="startGenerate" :disabled="generating || estimating || uploadingReference || !promptLength"><span>{{ generating ? '生成中' : estimating ? '计算中' : '生成' }}</span><svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5l5 5-5 5"/></svg></button>
        </div>
        </div>
      </div>
    </main>
  </section>

  <MaskEditorModal
    :open="Boolean(localEditSource)"
    :image-url="localEditSource?.url || ''"
    :title="localEditSource?.name"
    mode="edit"
    @close="localEditSource = null"
    @confirm="applyLocalEditMarker"
  />

  <Teleport to="body">
    <div v-if="showCompareModal" class="compare-overlay" @click.self="showCompareModal = false">
      <section class="compare-modal">
        <header><div><h3>图片对比</h3><p>并排检查构图、文字、材质和细节。</p></div><button title="关闭" @click="showCompareModal = false">×</button></header>
        <div class="compare-grid"><figure v-for="(item, index) in compareItems" :key="item.id"><img :src="getImageUrl(item)" /><figcaption><strong>方案 {{ index + 1 }}</strong><span>{{ item.meta?.actualWidth || '' }}<template v-if="item.meta?.actualHeight">×{{ item.meta.actualHeight }}</template></span></figcaption></figure></div>
      </section>
    </div>
  </Teleport>

  <!-- 预估弹窗 -->
  <Teleport to="body">
    <div v-if="showEstimate" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" @click.self="closeEstimate">
      <div class="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <h3 class="text-lg font-bold text-gray-800 mb-4">生成预估</h3>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between"><span class="text-gray-500">生成内容</span><strong>图像 · {{ resolutionLabel(resolution) }} · {{ ratio }}</strong></div>
          <div class="flex justify-between"><span class="text-gray-500">输出数量</span><strong>{{ outputCount }} 张</strong></div>
          <div v-if="physicalSize" class="flex justify-between"><span class="text-gray-500">实际尺寸</span><strong>{{ physicalSize }}</strong></div>
          <div v-if="availableQualities.length > 1" class="flex justify-between"><span class="text-gray-500">质量</span><strong>{{ qualityLabel(quality) }}</strong></div>
          <div v-if="referenceCount" class="flex justify-between"><span class="text-gray-500">参考图</span><strong>{{ referenceCount }} 张</strong></div>
          <div v-if="serverEstimateBreakdown?.referenceCredits" class="flex justify-between"><span class="text-gray-500">参考图输入</span><strong>+{{ serverEstimateBreakdown.referenceCredits }} 积分</strong></div>
          <div v-if="outputCount > 1" class="flex justify-between"><span class="text-gray-500">单张预估</span><strong>{{ Math.ceil(estimatedCost / outputCount) }} 积分</strong></div>
          <div v-if="isGptFlexible && resolution === '4K'" class="experimental-note">4K 为实验性高分辨率，生成时间与费用更高</div>
          <div class="flex justify-between"><span class="text-gray-500">计费方式</span><strong>统一算力积分</strong></div>
          <div class="flex justify-between"><span class="text-gray-500">本次预估</span><strong>{{ estimatedCost }} 积分</strong></div>
          <div class="flex justify-between"><span class="text-gray-500">可用积分</span><strong>{{ availableCredits.toLocaleString() }} 积分</strong></div>
          <div class="flex justify-between"><span class="text-gray-500">失败规则</span><strong class="text-gray-600">自动退回，不扣费</strong></div>
        </div>
        <div v-if="availableCredits < estimatedCost" class="mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm text-center">
          积分不足，当前可用 {{ availableCredits }}，需要 {{ estimatedCost }}
        </div>
        <div class="flex gap-3 mt-5">
          <button v-if="availableCredits < estimatedCost" class="btn primary flex-1" @click="$router.push('/billing')">去充值</button>
          <button v-else class="btn primary flex-1" :disabled="generating" @click="confirmGenerate">{{ generating ? '提交中...' : '确认生成' }}</button>
          <button class="btn flex-1" :disabled="generating" @click="closeEstimate">取消</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 提示词模板弹窗 -->
  <Teleport to="body">
    <div v-if="showTemplateModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" @click.self="showTemplateModal = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl">
        <h3 class="text-lg font-bold text-gray-800 mb-4">提示词模板</h3>
        <div class="space-y-2 max-h-80 overflow-y-auto">
          <div v-for="tpl in promptTemplates" :key="tpl.id" role="button" tabindex="0"
            @click="prompt = tpl.text; showTemplateModal = false; store.showToast('已填入模板')"
            @keydown.enter="prompt = tpl.text; showTemplateModal = false; store.showToast('已填入模板')"
            class="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-brand hover:bg-gray-50 transition-colors relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/30">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium text-gray-800">{{ tpl.name }}</span>
              <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ tpl.scene }}</span>
            </div>
            <p class="text-xs text-gray-500 line-clamp-2 pr-5">{{ tpl.text }}</p>
            <button v-if="!tpl.builtIn" title="删除自定义模板" @click.stop="deleteTemplate(tpl.id)" class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-red-100 text-red-500 text-xs flex items-center justify-center hover:bg-red-200">×</button>
          </div>
        </div>
        <div class="mt-3 pt-3 border-t border-gray-100">
          <button @click="showAddForm = !showAddForm" class="text-sm text-brand hover:text-brand-dark">+ 新增模板</button>
          <div v-if="showAddForm" class="mt-3 space-y-2">
            <input v-model="newTemplate.name" placeholder="模板名称" class="w-full p-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand" />
            <input v-model="newTemplate.scene" placeholder="场景标签(可选)" class="w-full p-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand" />
            <textarea v-model="newTemplate.text" rows="2" placeholder="提示词内容" class="w-full p-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-brand resize-none"></textarea>
            <button @click="addTemplate" class="px-4 py-2 rounded-lg text-sm bg-brand text-white hover:bg-brand-dark">保存模板</button>
          </div>
        </div>
        <button @click="showTemplateModal = false" class="mt-4 w-full py-2 text-sm text-gray-400 hover:text-gray-600">取消</button>
      </div>
    </div>
  </Teleport>

  <!-- AI 提示词助手 -->
  <Teleport to="body">
    <div v-if="showAiPromptModal" class="fixed inset-0 z-[210] flex items-center justify-center bg-black/40 p-4" @click.self="!aiPromptLoading && (showAiPromptModal = false)">
      <section class="ai-prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-prompt-title">
        <header class="ai-prompt-header">
          <div>
            <h3 id="ai-prompt-title">AI 提示词助手</h3>
            <p>把简单想法整理成可直接生成的专业图像提示词。</p>
          </div>
          <button type="button" title="关闭" aria-label="关闭" :disabled="aiPromptLoading" @click="showAiPromptModal = false">×</button>
        </header>

        <div class="ai-prompt-mode" role="tablist" aria-label="AI 提示词处理方式">
          <button type="button" role="tab" :aria-selected="aiPromptMode === 'generate'" :class="{ active: aiPromptMode === 'generate' }" @click="switchAiPromptMode('generate')">智能生成</button>
          <button type="button" role="tab" :aria-selected="aiPromptMode === 'optimize'" :class="{ active: aiPromptMode === 'optimize' }" @click="switchAiPromptMode('optimize')">优化现有</button>
        </div>

        <div class="ai-prompt-context">
          <span>{{ selectedModel?.name || '平台智能推荐' }}</span>
          <span>{{ ratio }}</span>
          <span>{{ resolutionLabel(resolution) }}</span>
          <span v-if="productContext">{{ productContext.name }}</span>
          <span v-if="hasReferenceImages">已带 {{ referenceCount }} 张参考图</span>
        </div>

        <label class="ai-prompt-field">
          <span>{{ aiPromptMode === 'generate' ? '描述你的创作想法' : '需要优化的提示词' }}</span>
          <textarea v-model="aiPromptInput" maxlength="2000" rows="5"
            :placeholder="aiPromptMode === 'generate' ? '例如：为一款银色保温杯制作户外露营场景广告图，清晨薄雾，画面高级' : '输入或粘贴已有提示词，AI 将保留原意并补全视觉细节'"></textarea>
          <small>{{ aiPromptInput.length }}/2000</small>
        </label>

        <div v-if="aiPromptResult" class="ai-prompt-result">
          <div><strong>生成结果</strong><span>可编辑后再应用</span></div>
          <textarea v-model="aiPromptResult" maxlength="2000" rows="6"></textarea>
        </div>

        <footer class="ai-prompt-actions">
          <button type="button" class="secondary" :disabled="aiPromptLoading" @click="showAiPromptModal = false">取消</button>
          <button type="button" class="secondary ai-run" :disabled="aiPromptLoading || aiPromptInput.trim().length < 2" @click="runAiPromptAssistant">
            {{ aiPromptLoading ? 'AI 处理中...' : aiPromptResult ? '重新生成' : aiPromptMode === 'generate' ? '生成提示词' : '开始优化' }}
          </button>
          <button v-if="aiPromptResult" type="button" class="primary" :disabled="aiPromptLoading" @click="applyAiPrompt">应用到输入框</button>
        </footer>
      </section>
    </div>
  </Teleport>

  <!-- 素材选择器 -->
  <Teleport to="body">
    <div v-if="showMaterialPicker" class="material-picker-overlay" role="dialog" aria-modal="true" aria-label="选择参考素材" @click.self="showMaterialPicker = false">
      <section class="material-picker-shell">
        <header class="material-picker-header">
          <div class="material-picker-title">
            <h3>选择参考素材</h3>
            <p>已选 {{ referenceCount }}/{{ maxReferenceImages }} 张，第一张作为主参考图</p>
          </div>
          <div class="material-picker-actions">
            <button class="material-picker-done" type="button" @click="showMaterialPicker = false">完成</button>
            <button type="button" class="material-picker-close" aria-label="关闭素材选择器" title="关闭" @click="showMaterialPicker = false">✕</button>
          </div>
        </header>
        <div v-if="materialLoading" class="material-picker-feedback">
          <i class="material-picker-spinner"></i>
          <span>正在加载图片素材...</span>
        </div>
        <div v-else-if="supportedMaterialList.length" class="material-picker-grid">
          <button v-for="m in supportedMaterialList" :key="m.id" @click="selectMaterial(m)"
            type="button" class="material-picker-card"
            :class="{ selected: referenceImages.some(item => item.materialId === m.id) }">
            <div class="material-picker-thumb">
              <img v-if="m.fileUrl || m.fileKey?.startsWith('data:image') || m.fileKey?.startsWith('http') || m.thumbnailUrl?.startsWith('http')"
                :src="m.fileUrl || m.fileKey || m.thumbnailUrl" :alt="m.title || '图片素材'" loading="lazy" />
              <span v-else class="material-picker-placeholder">🖼</span>
              <i v-if="referenceImages.some(item => item.materialId === m.id)" class="material-selected-mark">✓</i>
            </div>
            <div class="material-picker-meta">
              <strong :title="m.title">{{ m.title || '未命名素材' }}</strong>
              <span>{{ m.category || '未分类' }}</span>
            </div>
          </button>
        </div>
        <div v-else class="material-picker-feedback material-picker-empty">
          <span class="material-picker-empty-icon">🖼</span>
          <strong>暂无可用的参考图</strong>
          <p>参考图仅支持 PNG、JPG、JPEG 格式</p>
        </div>
      </section>
    </div>
  </Teleport>

  <!-- 图片放大查看 -->
  <Teleport to="body">
    <div v-if="zoomAsset" class="image-preview-overlay" role="dialog" aria-modal="true" aria-label="图像预览" @click.self="closeImagePreview">
      <div class="image-preview-shell">
        <img :src="getImageUrl(zoomAsset) || ''" :alt="zoomAsset.prompt || zoomAsset.title || '生成图像'" />
        <div class="image-preview-meta">
          <p class="text-white text-sm font-medium mb-1">{{ zoomAsset.prompt || zoomAsset.title }}</p>
          <div class="flex items-center gap-3 text-white/70 text-xs">
            <span>{{ zoomAsset.model || zoomAsset.source }}</span>
            <span v-if="zoomAsset.resolution || zoomAsset.meta?.resolution">{{ resolutionLabel(zoomAsset.resolution || zoomAsset.meta?.resolution) }}</span>
            <span>{{ zoomAsset.cost || 0 }} 积分</span>
          </div>
        </div>
        <div class="image-preview-tools">
          <button type="button" title="下载图像" aria-label="下载图像" @click="downloadImage(zoomAsset)">
            <svg viewBox="0 0 24 24"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 19h16"/></svg>
          </button>
          <span></span>
          <button type="button" title="关闭预览" aria-label="关闭预览" @click="closeImagePreview">
            <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.history-search{height:34px;display:grid;grid-template-columns:16px minmax(0,1fr) 22px;align-items:center;gap:6px;margin:0 2px 8px;padding:0 7px;border:1px solid #d9dde5;border-radius:7px;background:#fff;color:#98a2b3}.history-search:focus-within{border-color:#8f88ff;box-shadow:0 0 0 3px rgba(91,78,255,.08)}.history-search svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}.history-search input{min-width:0;width:100%;height:30px;padding:0;border:0;background:transparent;color:#344054;font-size:11px;outline:0}.history-search input::-webkit-search-cancel-button{display:none}.history-search button{width:22px;height:22px;display:grid;place-items:center;border:0;border-radius:5px;background:transparent;color:#98a2b3;font-size:17px;line-height:1;cursor:pointer}.history-search button:hover{background:#f2f4f7;color:#475467}.history-feedback{min-height:92px;display:grid;place-content:center;justify-items:center;gap:7px;padding:12px;color:#98a2b3;text-align:center}.history-feedback p{margin:0;font-size:11px}.history-feedback button{border:0;background:transparent;color:#5b4eff;font-size:11px;font-weight:700;cursor:pointer}.history-spinner{width:18px;height:18px;border:2px solid #e4e7ec;border-top-color:#5b4eff;border-radius:50%;animation:history-spin .7s linear infinite}.history-collapsed .history-search{display:none}.history-search+.history-list{max-height:calc(100% - 134px)}@keyframes history-spin{to{transform:rotate(360deg)}}
.image-preview-overlay{position:fixed;inset:0;z-index:300;display:grid;place-items:center;padding:24px;background:rgba(7,10,17,.86);overflow:auto}.image-preview-shell{position:relative;max-width:min(92vw,1440px);max-height:92vh;overflow:hidden;border-radius:9px;background:#141821;box-shadow:0 28px 90px rgba(0,0,0,.55)}.image-preview-shell>img{display:block;max-width:92vw;max-height:92vh;width:auto;height:auto;object-fit:contain}.image-preview-meta{position:absolute;right:0;bottom:0;left:0;padding:46px 18px 16px;background:linear-gradient(transparent,rgba(8,11,18,.82));pointer-events:none}.image-preview-tools{position:absolute;top:12px;right:12px;display:flex;align-items:center;padding:4px;border:1px solid rgba(255,255,255,.28);border-radius:8px;background:rgba(15,18,25,.88);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.3);backdrop-filter:blur(10px)}.image-preview-tools button{width:38px;height:38px;display:grid;place-items:center;border:0;border-radius:6px;background:transparent;color:#fff;cursor:pointer}.image-preview-tools button:hover{background:rgba(255,255,255,.16)}.image-preview-tools button:focus-visible{outline:2px solid #a9a4ff;outline-offset:1px}.image-preview-tools svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.image-preview-tools>span{width:1px;height:22px;background:rgba(255,255,255,.2)}@media(max-width:640px){.image-preview-overlay{padding:8px}.image-preview-shell,.image-preview-shell>img{max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px)}.image-preview-tools{top:8px;right:8px}.image-preview-tools button{width:40px;height:40px}.image-preview-meta{padding:42px 12px 12px}}
</style>

<style scoped>
.gallery-visual img{width:100%;height:auto!important;display:block;object-fit:contain!important}
.gallery-visual.has-image{height:auto!important;min-height:0}
.gallery-visual:hover img{transform:none!important}
.local-edit-marker{height:34px;display:flex;align-items:center;gap:5px;flex:0 0 auto;border:1px solid #d9d5ff;border-radius:6px;background:#f7f6ff;padding:0 9px;color:#5147d8;font-size:10px;font-weight:850;cursor:pointer}
.local-edit-marker:hover,.local-edit-marker.active{border-color:#7168ec;background:#eeecff}
.local-edit-marker svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.local-edit-summary{display:grid;grid-template-columns:auto minmax(0,1fr) 24px;align-items:center;gap:9px;margin:-1px 0 8px;padding:7px 9px;border:1px solid #ddd9ff;border-radius:6px;background:#f8f7ff;color:#5147d8;font-size:10px}
.local-edit-summary span{display:flex;align-items:center;gap:5px;font-weight:850;white-space:nowrap}
.local-edit-summary i{width:7px;height:7px;border-radius:50%;background:#7168ec;box-shadow:0 0 0 3px rgba(113,104,236,.12)}
.local-edit-summary strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#716b9e;font-weight:650}
.local-edit-summary button{width:24px;height:24px;border:0;border-radius:5px;background:transparent;color:#8b85b5;font-size:17px;cursor:pointer}
.local-edit-summary button:hover{background:#ebe8ff;color:#5147d8}
@media(max-width:760px){.local-edit-marker span,.local-edit-summary strong{display:none}.local-edit-summary{grid-template-columns:1fr 24px}}
</style>

<style scoped>
.reference-strip{align-items:flex-start}
.reference-strip>span{min-width:78px;padding-top:14px;white-space:nowrap}
.reference-list{min-width:0;display:flex;gap:8px;overflow-x:auto;padding:1px 2px 4px}
.reference-item{width:54px;flex:0 0 54px;display:grid;gap:3px}
.reference-item .ref-preview{width:48px;height:48px}
.reference-item small{width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#667085;font-size:9px;text-align:center}
.ref-preview em{position:absolute;left:2px;bottom:2px;min-width:16px;height:16px;padding:0 4px;border-radius:4px;background:rgba(17,24,39,.72);color:#fff;font-size:9px;font-style:normal;line-height:16px;text-align:center}
.reference-add{width:42px;height:42px;flex:0 0 42px;border:1px dashed #b7b2ff;border-radius:6px;background:#faf9ff;color:#5b4eff;font-size:20px;cursor:pointer}
.reference-add:hover{border-color:#756cf3;background:#f3f1ff}
.reference-clear{margin-left:auto;align-self:center;border:0;background:transparent;color:#98a2b3;font-size:10px;cursor:pointer}
.reference-clear:hover{color:#d92d20}
.material-picker-overlay{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.48);backdrop-filter:blur(3px)}
.material-picker-shell{width:min(760px,calc(100vw - 40px));height:min(680px,calc(100dvh - 40px));min-height:420px;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid #e4e7ec;border-radius:10px;background:#fff;box-shadow:0 28px 80px rgba(15,23,42,.24)}
.material-picker-header{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 20px;border-bottom:1px solid #eaecf0;background:#fff}
.material-picker-title{min-width:0}.material-picker-title h3{margin:0;color:#101828;font-size:17px;font-weight:850;line-height:1.35}.material-picker-title p{margin:4px 0 0;color:#667085;font-size:11px;line-height:1.4}
.material-picker-actions{display:flex;align-items:center;gap:8px;flex:none}
.material-picker-done{height:34px;padding:0 15px;border:0;border-radius:6px;background:#5b4eff;color:#fff;font-size:12px;font-weight:800;cursor:pointer}
.material-picker-done:hover{background:#4938e8}
.material-picker-close{width:34px;height:34px;display:grid;place-items:center;border:1px solid #e4e7ec;border-radius:6px;background:#fff;color:#667085;font-size:17px;line-height:1;cursor:pointer}.material-picker-close:hover{border-color:#d0d5dd;background:#f9fafb;color:#101828}
.material-picker-grid{min-height:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));grid-auto-rows:max-content;align-content:start;gap:12px;padding:16px 18px 22px;overflow-x:hidden;overflow-y:auto;background:#f8fafc}
.material-picker-card{position:relative;min-width:0;display:grid;grid-template-rows:auto 58px;padding:0;overflow:hidden;border:1px solid #e4e7ec;border-radius:8px;background:#fff;color:inherit;text-align:left;cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease}
.material-picker-card:hover{border-color:#a9a4ff;box-shadow:0 8px 20px rgba(15,23,42,.08);transform:translateY(-1px)}
.material-picker-card.selected{border-color:#5b4eff;box-shadow:0 0 0 2px rgba(91,78,255,.14)}
.material-picker-thumb{position:relative;width:100%;aspect-ratio:4/3;display:grid;place-items:center;overflow:hidden;background:#eef1f6}
.material-picker-thumb img{display:block;width:100%;height:100%;min-width:100%;min-height:100%;object-fit:cover;transition:transform .18s ease}.material-picker-card:hover .material-picker-thumb img{transform:scale(1.025)}
.material-picker-placeholder{color:#98a2b3;font-size:28px}
.material-picker-meta{min-width:0;display:grid;align-content:center;gap:3px;padding:9px 11px;background:#fff}.material-picker-meta strong{display:block;overflow:hidden;color:#344054;font-size:12px;font-weight:750;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}.material-picker-meta span{overflow:hidden;color:#98a2b3;font-size:10px;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}
.material-picker-feedback{min-height:0;display:grid;place-content:center;justify-items:center;gap:10px;padding:32px;color:#667085;background:#f8fafc;text-align:center}.material-picker-feedback span{font-size:12px}.material-picker-spinner{width:24px;height:24px;border:2px solid #e4e7ec;border-top-color:#5b4eff;border-radius:50%;animation:material-picker-spin .7s linear infinite}.material-picker-empty-icon{font-size:32px}.material-picker-empty strong{color:#344054;font-size:14px}.material-picker-empty p{margin:0;color:#98a2b3;font-size:11px}@keyframes material-picker-spin{to{transform:rotate(360deg)}}
.material-selected-mark{position:absolute;right:8px;top:8px;width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:#5b4eff;color:#fff;font-size:12px;font-style:normal;box-shadow:0 2px 8px rgba(31,38,135,.25)}
@media(max-width:760px){
  .reference-strip{flex-wrap:wrap}
  .reference-strip>span{width:100%;padding-top:0}
  .reference-list{max-width:calc(100% - 90px)}
  .material-picker-overlay{padding:8px}
  .material-picker-shell{width:calc(100vw - 16px);height:calc(100dvh - 16px);min-height:0;border-radius:8px}
  .material-picker-header{min-height:68px;padding:12px 14px}
  .material-picker-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:12px}
  .material-picker-card{grid-template-rows:auto 54px}
}
</style>

<style scoped>
/* 统一图像 / 视频创作历史栏的折叠态与新建入口 */
.new-task{height:38px;display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid #d9dde5;border-radius:7px;background:#fff;color:#2e3442;padding:0 12px;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.03)}
.new-task:hover{border-color:#8e87ff;color:#4f46e5}
.new-task svg,.history-toggle svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.history-toggle{width:100%;height:38px;border:1px solid #d9dde5;border-radius:7px;background:#fff;color:#667085}
.history-collapsed .history-top{display:grid!important;grid-template-columns:1fr;gap:8px}
.history-collapsed .new-task{width:36px;display:flex!important;padding:0}
.history-collapsed .new-task span{display:none}
.history-collapsed .history-toggle{width:36px}
.collapsed-status-dots{display:flex;flex-direction:column;align-items:center;gap:9px;margin-top:20px}
.collapsed-status-dots .status-dot{display:block;width:8px;height:8px;flex:none;box-shadow:0 0 0 3px rgba(152,162,179,.1)}
.collapsed-status-dots .status-dot.completed{box-shadow:0 0 0 3px rgba(34,160,107,.1)}
.collapsed-status-dots .status-dot.failed{box-shadow:0 0 0 3px rgba(229,72,77,.1)}
.collapsed-status-dots .status-dot.processing,.collapsed-status-dots .status-dot.queued,.collapsed-status-dots .status-dot.pending{box-shadow:0 0 0 3px rgba(229,154,25,.12)}
.collapsed-status-dots .status-dot.loading{background:#8f88ff;animation:collapsed-status-pulse 1s ease-in-out infinite alternate}
@keyframes collapsed-status-pulse{to{opacity:.35;transform:scale(.8)}}
</style>

<style scoped>
@media(max-width:760px){.history-search+.history-list{max-height:none}}
</style>

<style scoped>
.batch-toolbar-actions{display:flex!important;align-items:center;gap:6px}.batch-toolbar-actions .retry-batch{width:auto;padding:0 9px;gap:5px;color:#5147d8;border-color:#c8c4ff}.batch-toolbar-actions .retry-batch span{padding:0;background:transparent;color:inherit;font-size:10px;font-weight:800}.gallery-grid.batch-grid{columns:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;gap:14px;padding-bottom:8px}.gallery-grid.batch-grid .gallery-card{min-width:0;margin:0}.gallery-grid.batch-grid .gallery-placeholder{height:220px}.status-dot.partial_failed{background:#e59a19}.status-dot.succeeded{background:#22a06b}.count-select select{width:42px}.send{min-width:124px}.batch-grid .gallery-actions{min-height:41px}.gallery-actions button.selected{border-color:#8f88ff;background:#f0efff;color:#5147d8}.compare-tray{position:sticky;bottom:12px;z-index:5;width:max-content;max-width:100%;display:flex;align-items:center;gap:8px;margin:6px auto 0;padding:7px 9px;border:1px solid #d8d5ff;border-radius:8px;background:rgba(255,255,255,.95);box-shadow:0 10px 28px rgba(31,38,135,.16);backdrop-filter:blur(8px)}.compare-tray span{color:#667085;font-size:11px}.compare-tray button{height:30px;border:0;border-radius:6px;background:#5b4eff;padding:0 11px;color:#fff;font-size:11px;font-weight:800;cursor:pointer}.compare-tray button:disabled{background:#d0d5dd;cursor:not-allowed}.compare-tray .text-action{background:transparent;color:#667085}.compare-overlay{position:fixed;inset:0;z-index:320;display:grid;place-items:center;padding:20px;background:rgba(8,11,18,.82)}.compare-modal{width:min(1120px,calc(100vw - 40px));max-height:calc(100dvh - 40px);display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border-radius:9px;background:#fff;box-shadow:0 28px 90px rgba(0,0,0,.45)}.compare-modal header{display:flex;align-items:center;justify-content:space-between;padding:14px 17px;border-bottom:1px solid #eaecf0}.compare-modal h3,.compare-modal p{margin:0}.compare-modal h3{font-size:15px}.compare-modal p{margin-top:3px;color:#98a2b3;font-size:10px}.compare-modal header>button{width:34px;height:34px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;color:#475467;font-size:20px;cursor:pointer}.compare-grid{min-height:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;overflow:auto;background:#e4e7ec}.compare-grid figure{min-width:0;margin:0;display:grid;grid-template-rows:minmax(0,1fr) auto;background:#f8f9fb}.compare-grid img{width:100%;height:100%;max-height:calc(100dvh - 150px);display:block;object-fit:contain}.compare-grid figcaption{display:flex;justify-content:space-between;padding:10px 13px;background:#fff;color:#667085;font-size:11px}.compare-grid figcaption strong{color:#344054}
@media(max-width:820px){.gallery-grid.batch-grid{grid-template-columns:1fr}.batch-toolbar-actions .retry-batch span{display:none}.batch-toolbar-actions .retry-batch{width:30px;padding:0}.send{min-width:104px}.count-select select{width:40px}}
</style>

<style scoped>
.studio{display:grid;grid-template-columns:300px minmax(0,1fr);min-height:calc(100vh - 108px);background:#fff;border:1px solid #e5e7eb;border-radius:22px;overflow:hidden;transition:grid-template-columns .18s ease}
.studio.history-collapsed{grid-template-columns:66px minmax(0,1fr)}
.history{background:#f8fafc;border-right:1px solid #e5e7eb;padding:24px 18px}
.history-top{display:grid;grid-template-columns:1fr 38px;gap:10px}
.history-toggle{border:1px solid #e5e7eb;background:#fff;border-radius:10px;font-size:20px;cursor:pointer}
.history h3{font-size:13px;color:#98a2b3;margin:20px 0 10px}
.history-row{display:grid;grid-template-columns:1fr 28px;align-items:center;border-radius:12px;margin:6px 0}
.history-row.active{background:#effdf3;outline:1px solid #9df2a1}
.history-row button{border:0;background:transparent;text-align:left;padding:11px;color:#475467;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.delete-history{opacity:0;text-align:center!important;color:#98a2b3!important}.history-row:hover .delete-history{opacity:1}
.history-collapsed .history{padding:18px 10px}.history-collapsed .history .btn.primary,.history-collapsed .history h3,.history-collapsed .history-list{display:none}
.studio-main{display:grid;grid-template-rows:minmax(420px,1fr) auto}
.result-stage{padding:36px 44px;overflow-y:auto}
.result-visual{width:360px;max-width:100%;height:240px;margin-bottom:20px;position:relative;overflow:hidden;background:linear-gradient(135deg,#e0f2fe,#eef2ff);border-radius:16px}
.result-visual span{position:absolute;width:78px;height:78px;border-radius:20px;background:rgba(255,255,255,.75);left:28px;bottom:24px}
.result-visual i{position:absolute;width:96px;height:64px;border-radius:999px;background:rgba(47,40,214,.22);right:22px;top:26px}
.result-visual b{position:absolute;width:130px;height:10px;border-radius:999px;background:rgba(255,255,255,.66);left:42px;top:38px;box-shadow:0 20px 0 rgba(255,255,255,.45)}
.result-stage h2{font-size:22px;font-weight:800;margin:0 0 8px}
.result-stage p{max-width:650px;color:#98a2b3;line-height:1.75}
.result-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
.generator-panel{margin:0 28px 26px;border:1.5px solid #86efac;border-radius:24px;box-shadow:0 16px 42px rgba(34,197,94,.12);display:grid;grid-template-columns:168px 1fr;gap:14px;padding:17px;background:#fff}
.source-choice{border:1px solid #e5e7eb;border-radius:16px;background:#fbfcfe;padding:12px;display:grid;gap:8px;align-content:start}
.source-choice strong{font-weight:800}.source-choice small{color:#98a2b3;line-height:1.35}
.source-choice div{display:flex;gap:8px;flex-wrap:wrap}
.source-choice .btn{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:7px 10px;font-weight:900;color:#344054;font-size:13px;cursor:pointer}
.source-choice .btn:first-child{background:#eef2ff;color:#5b4eff;border-color:#d9ddff}
.upload-chip{width:68px;height:68px;border:1px solid #e5e7eb;border-radius:14px;background:#fafafa;display:grid;place-items:center;overflow:hidden}
.ref-preview{position:relative;width:68px;height:68px;border-radius:14px;overflow:hidden;border:1px solid #86efac}
.ref-thumb{width:100%;height:100%;object-fit:cover}
.ref-remove{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(239,68,68,.9);color:#fff;border:0;font-size:11px;cursor:pointer;display:grid;place-items:center;line-height:1}
.generator-panel textarea{border:0;outline:0;resize:none;min-height:78px;font-size:16px;width:100%;background:transparent}
.controls{grid-column:1/-1;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.controls select{border:0;background:#f4f6f9;border-radius:999px;padding:10px 12px;font-weight:800;cursor:pointer;outline:none}
.model-picker{flex:0 1 240px}
.model-picker select{width:100%;max-width:100%;background:#eef2ff!important;color:#5b4eff}
.quality{display:flex;gap:4px;background:#f4f6f9;border-radius:999px;padding:4px}
.quality button{border:0;background:transparent;border-radius:999px;padding:6px 12px;font-weight:800;cursor:pointer}
.quality button.active{background:#111827;color:#fff}
.send{margin-left:auto;width:52px;height:52px;border:0;border-radius:50%;background:#d9fadd;color:#2d7b3a;font-size:24px;font-weight:900;cursor:pointer}
.send:disabled{opacity:.5}
.skeleton-block{text-align:center;padding:20px 0}
.skeleton-visual{width:160px;height:100px;margin:0 auto 12px;border-radius:14px;background:linear-gradient(135deg,#f0f4ff,#e0f2fe);position:relative;overflow:hidden}
.skeleton-visual span{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);animation:shimmer 1.5s infinite}
@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.skeleton-bar{width:200px;height:4px;border-radius:999px;background:#f0f4ff;margin:16px auto 0;overflow:hidden}
.loadbar{height:100%;border-radius:999px;background:#5b4eff;animation:load 1.5s ease-in-out infinite}
@keyframes load{0%{width:0}50%{width:80%}100%{width:100%}}
.empty-state{text-align:center;padding-top:40px}
.empty-visual{width:200px;height:140px;margin:0 auto 20px;border-radius:16px;background:linear-gradient(135deg,#f0f4ff,#eef2ff);position:relative;overflow:hidden}
.empty-visual span{position:absolute;width:78px;height:78px;border-radius:20px;background:rgba(255,255,255,.75);left:28px;bottom:24px}
.empty-visual i{position:absolute;width:96px;height:64px;border-radius:999px;background:rgba(47,40,214,.22);right:22px;top:26px}
.empty-visual b{position:absolute;width:130px;height:10px;border-radius:999px;background:rgba(255,255,255,.66);left:42px;top:38px;box-shadow:0 20px 0 rgba(255,255,255,.45)}
.empty-state h2{font-size:20px;font-weight:800;color:#98a2b3}
.empty-state p{color:#98a2b3;font-size:14px}
.btn{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:10px 18px;font-weight:900;cursor:pointer;color:#475467;font-size:14px}
.btn.primary{background:#5b4eff;color:#fff;border-color:#5b4eff}
.btn:disabled{opacity:.5}
.gallery-grid{columns:2;column-gap:16px}
.gallery-card{break-inside:avoid;margin-bottom:16px;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;background:#fff;transition:all .15s}
.gallery-card:hover{border-color:#5b4eff;box-shadow:0 8px 24px rgba(91,78,255,.08)}
.gallery-card.active{border-color:#9df2a1;box-shadow:0 0 0 2px rgba(157,242,161,.3)}
.gallery-visual{background:linear-gradient(135deg,#e0f2fe,#eef2ff);min-height:120px;display:flex;align-items:center;justify-content:center}
.gallery-visual img{width:100%;height:auto;display:block}
.gallery-placeholder{width:100%;height:150px;position:relative;overflow:hidden}
.gallery-placeholder span{position:absolute;width:78px;height:78px;border-radius:20px;background:rgba(255,255,255,.75);left:28px;bottom:24px}
.gallery-placeholder i{position:absolute;width:96px;height:64px;border-radius:999px;background:rgba(47,40,214,.22);right:22px;top:26px}
.gallery-placeholder b{position:absolute;width:130px;height:10px;border-radius:999px;background:rgba(255,255,255,.66);left:42px;top:38px;box-shadow:0 20px 0 rgba(255,255,255,.45)}
.gallery-info{padding:14px}
.gallery-info h3{font-size:15px;font-weight:800;margin:0 0 6px;color:#1f2937}
.gallery-info p{font-size:13px;color:#98a2b3;line-height:1.5;margin:0 0 8px;max-height:60px;overflow:hidden}
.gallery-meta{display:flex;gap:8px;align-items:center;font-size:12px;color:#98a2b3;margin-bottom:10px;flex-wrap:wrap}
.gallery-meta .tag{background:#eef2ff;color:#5b4eff;padding:2px 8px;border-radius:999px;font-weight:700}
.gallery-actions{display:flex;gap:6px;flex-wrap:wrap}
.btn-sm{border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:5px 10px;font-weight:700;cursor:pointer;color:#475467;font-size:12px;transition:all .15s}
.btn-sm:hover{border-color:#5b4eff;color:#5b4eff}
.btn-sm.primary{background:#5b4eff;color:#fff;border-color:#5b4eff}
.btn-sm.primary:hover{background:#4a3de0}
.btn-sm.danger:hover{border-color:#ef4444;color:#ef4444}
.skeleton-card{border:1px dashed #c7d2fe;background:#fafbff}
.skeleton-img{min-height:160px;background:linear-gradient(135deg,#f0f4ff,#e8eeff);position:relative;overflow:hidden}
.shimmer{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(91,78,255,.08),transparent);animation:shimmer 1.5s infinite}
@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.skeleton-line{height:14px;border-radius:6px;background:#e8eeff;margin-bottom:8px;animation:pulse 1.5s ease-in-out infinite}
.skeleton-line.short{width:60%}
@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
.skeleton-bar{width:100%;height:4px;border-radius:999px;background:#e8eeff;margin-top:10px;overflow:hidden}
.loadbar{height:100%;border-radius:999px;background:#5b4eff;animation:load 1.5s ease-in-out infinite}
@keyframes load{0%{width:0}50%{width:80%}100%{width:100%}}
.skeleton-text{font-size:12px;color:#98a2b3;margin-top:8px}
.history-subline{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center}.history-subline small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7c879b;font-size:10px}.history-subline time{color:#a6adba;font-size:9px;white-space:nowrap}
.guest-history{width:100%;display:grid;gap:4px;border:1px dashed #cfd4df;border-radius:7px;background:#fff;padding:12px;text-align:left;cursor:pointer}.guest-history strong{color:#4f46e5;font-size:11px}.guest-history span{color:#98a2b3;font-size:10px;line-height:1.45}
</style>

<style scoped>
.fixed-resolution{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 7px;border-radius:5px;background:#f2f4f7;color:#667085;font-size:10px;font-weight:800}
.experimental-note{padding:8px 10px;border-radius:6px;background:#fff7e6;color:#9a6700;font-size:12px;line-height:1.45}
</style>

<style scoped>
.advanced-control{position:relative;height:34px}
.advanced-control summary{width:34px;height:34px;display:grid;place-items:center;border:1px solid #e1e5eb;border-radius:6px;background:#fff;color:#667085;cursor:pointer;list-style:none}
.advanced-control summary::-webkit-details-marker{display:none}
.advanced-control summary:hover,.advanced-control[open] summary{border-color:#aaa5ff;color:#5147d8;background:#f8f7ff}
.advanced-control summary svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.advanced-menu{position:absolute;right:0;bottom:42px;z-index:20;width:220px;padding:12px;border:1px solid #dfe3ea;border-radius:8px;background:#fff;box-shadow:0 12px 30px rgba(22,31,54,.16);display:grid;gap:10px}
.advanced-menu label{display:grid;grid-template-columns:82px minmax(0,1fr);align-items:center;gap:8px;color:#667085;font-size:11px;font-weight:700}
.advanced-menu select{min-width:0;height:32px;border:1px solid #dfe3ea;border-radius:6px;padding:0 7px;background:#fff;color:#344054;outline:none;font-size:11px;font-weight:800}
@media(max-width:1400px){
  .composer-toolbar{gap:6px}
  .source-actions{flex:0 0 auto}
  .source-actions button,.source-actions label{width:34px;justify-content:center;padding:0}
  .source-actions span,.select-control>span{display:none}
  .model-select-control select{max-width:125px}
}
</style>

<style scoped>
.product-context{display:grid;grid-template-columns:40px auto 1fr 28px;align-items:center;gap:9px;margin-bottom:9px;padding:8px;border:1px solid #dcd9ff;border-radius:7px;background:#f8f7ff}.product-context>img{width:40px;height:40px;border-radius:6px;object-fit:cover;background:#fff}.product-context>span small,.product-context>span strong{display:block}.product-context>span small{font-size:9px;color:#8b85c7}.product-context>span strong{font-size:11px;color:#373076}.product-context>em{font-size:10px;color:#7772a7;font-style:normal}.product-context>button{width:28px;height:28px;border:0;border-radius:5px;background:transparent;color:#8d89aa;cursor:pointer}.product-context>button:hover{background:#eceaff;color:#5146e5}
</style>

<style scoped>
.ai-prompt-dialog{width:min(640px,100%);max-height:min(88vh,760px);overflow-y:auto;border:1px solid #e4e7ec;border-radius:8px;background:#fff;padding:22px;box-shadow:0 28px 80px rgba(15,23,42,.28);color:#182230}
.ai-prompt-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.ai-prompt-header h3{margin:0;font-size:20px;font-weight:900}.ai-prompt-header p{margin:6px 0 0;color:#667085;font-size:12px}.ai-prompt-header>button{width:32px;height:32px;flex:0 0 32px;border:0;border-radius:6px;background:#f2f4f7;color:#667085;font-size:22px;line-height:1;cursor:pointer}.ai-prompt-header>button:hover{background:#e4e7ec;color:#101828}.ai-prompt-header>button:disabled{opacity:.5;cursor:not-allowed}
.ai-prompt-mode{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:20px;padding:4px;border-radius:7px;background:#f0f2f5}.ai-prompt-mode button{height:36px;border:0;border-radius:5px;background:transparent;color:#667085;font-size:12px;font-weight:800;cursor:pointer}.ai-prompt-mode button.active{background:#fff;color:#5146e5;box-shadow:0 1px 4px rgba(16,24,40,.1)}
.ai-prompt-context{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.ai-prompt-context span{padding:4px 7px;border-radius:5px;background:#f4f3ff;color:#5f58b8;font-size:10px;font-weight:700}
.ai-prompt-field{position:relative;display:grid;gap:7px}.ai-prompt-field>span{color:#344054;font-size:12px;font-weight:800}.ai-prompt-field textarea,.ai-prompt-result textarea{width:100%;resize:vertical;border:1px solid #d0d5dd;border-radius:7px;padding:11px 12px;background:#fff;color:#101828;font:inherit;font-size:13px;line-height:1.65;outline:none}.ai-prompt-field textarea:focus,.ai-prompt-result textarea:focus{border-color:#6d63ec;box-shadow:0 0 0 3px rgba(91,78,255,.1)}.ai-prompt-field small{position:absolute;right:9px;bottom:8px;color:#98a2b3;font-size:9px}
.ai-prompt-result{display:grid;gap:7px;margin-top:14px;padding-top:14px;border-top:1px solid #eaecf0}.ai-prompt-result>div{display:flex;align-items:center;justify-content:space-between}.ai-prompt-result strong{font-size:12px}.ai-prompt-result span{color:#98a2b3;font-size:10px}.ai-prompt-result textarea{background:#fbfbff;border-color:#dcd9ff}
.ai-prompt-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ai-prompt-actions button{height:38px;border:1px solid #d0d5dd;border-radius:6px;padding:0 14px;background:#fff;color:#475467;font-size:12px;font-weight:800;cursor:pointer}.ai-prompt-actions button:hover{border-color:#9c96ff;color:#5146e5}.ai-prompt-actions button.primary{border-color:#5146e5;background:#5146e5;color:#fff}.ai-prompt-actions button.ai-run{border-color:#d9d5ff;background:#f5f3ff;color:#5146e5}.ai-prompt-actions button:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:640px){.ai-prompt-dialog{padding:18px}.ai-prompt-actions{display:grid;grid-template-columns:1fr 1fr}.ai-prompt-actions .primary{grid-column:1/-1}.ai-prompt-actions button{padding:0 9px}}
</style>

<style scoped>
/* Workbench sizing: keep the composer visible and make results the only scroll surface. */
.studio {
  height: calc(100dvh - 112px) !important;
  min-height: 0 !important;
}
.studio-main {
  min-height: 0 !important;
  grid-template-rows: minmax(0, 1fr) auto !important;
  overflow: hidden !important;
}
.result-stage {
  min-height: 0 !important;
  overflow-y: scroll !important;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: #b8bec9 transparent;
}
.result-stage::-webkit-scrollbar { width: 8px; }
.result-stage::-webkit-scrollbar-track { background: transparent; }
.result-stage::-webkit-scrollbar-thumb { background: #b8bec9; border: 2px solid transparent; border-radius: 999px; background-clip: padding-box; }
.result-stage::-webkit-scrollbar-thumb:hover { background: #8d96a5; background-clip: padding-box; }
.generator-panel { flex: 0 0 auto; }
.gallery-grid {
  display: block !important;
  columns: 3;
  column-gap: 14px !important;
}
.gallery-grid.batch-grid {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  columns: initial;
  gap: 14px !important;
}
.gallery-card {
  min-width: 0;
  margin: 0 0 14px !important;
  break-inside: avoid;
  display: block !important;
}
.gallery-visual {
  width: 100%;
  min-height: 0 !important;
  display: block !important;
  cursor: zoom-in;
}
.gallery-visual:not(.has-image) { height: 240px !important; display: grid !important; place-items: center; }
.gallery-visual:disabled { cursor: default; }
.gallery-visual img {
  width: 100%;
  height: auto !important;
  max-height: none !important;
  object-fit: contain !important;
  background: #eef1f5;
}
.gallery-info { min-width: 0; }
.gallery-actions { min-height: 31px; }
.gallery-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 22px;
  text-align: center;
}
.gallery-placeholder strong { color: #475467; font-size: 12px; }
.gallery-placeholder small { max-width: 260px; color: #98a2b3; font-size: 10px; line-height: 1.5; }
.processing-placeholder { background: linear-gradient(145deg, #f5f7ff, #eef2ff); }
.processing-placeholder i,
.generation-state i {
  width: 30px;
  height: 30px;
  border: 3px solid #d9d6ff;
  border-top-color: #5b4eff;
  border-radius: 50%;
  animation: image-spin .9s linear infinite;
}
.failed-placeholder { background: #fff8f7; }
.failed-placeholder svg { width: 30px; height: 30px; stroke: #d92d20; fill: none; }
.failed-placeholder strong { color: #b42318; }
.skeleton-card { grid-template-rows: 240px auto; }
.skeleton-img { height: 240px; min-height: 0; display: grid; place-items: center; }
.skeleton-img > span { position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent); animation: shimmer 1.5s infinite; }
.generation-state { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 7px; text-align: center; }
.generation-state strong { color: #475467; font-size: 12px; }
.generation-state small { color: #98a2b3; font-size: 10px; }
@keyframes image-spin { to { transform: rotate(360deg); } }
@media (max-width: 1280px) {
  .gallery-grid { columns: 2; }
}
@media (max-width: 760px) {
  .studio { height: calc(100dvh - 92px) !important; min-height: 0 !important; }
  .gallery-grid { columns: 1; }
  .gallery-grid.batch-grid { grid-template-columns: 1fr; }
  .gallery-visual:not(.has-image), .skeleton-img { height: 220px !important; }
}
</style>

<style scoped>
.generator-panel{display:block;grid-template-columns:none;gap:0}
.quality button{padding:0}
.clarity-select select{width:52px}
.quality-select select{width:42px}
.model-select-control{padding-left:9px}
.clarity-select select:disabled{cursor:default;color:#667085;opacity:1}
.model-retry{width:34px;height:34px;display:grid;place-items:center;border:1px solid #f0b7b9;border-radius:6px;background:#fff7f7;color:#c4323a;cursor:pointer}
.model-retry svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
</style>

<style scoped>
.generator-panel{transition:padding .18s ease,box-shadow .18s ease}
.generator-panel.collapsed{padding:9px 11px;box-shadow:0 7px 18px rgba(22,31,54,.08)}
.image-composer-head{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) 34px;align-items:center;gap:10px;margin-bottom:10px}
.generator-panel.collapsed .image-composer-head{margin-bottom:0}
.image-composer-head>div span,.image-composer-head>div strong{display:block}
.image-composer-head>div span{color:#98a2b3;font-size:10px}
.image-composer-head>div strong{margin-top:2px;color:#344054;font-size:12px}
.image-composer-copy{min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:12px;border:0;background:transparent;padding:0;text-align:left;cursor:pointer}
.image-composer-copy strong{color:#344054;font-size:11px;white-space:nowrap}
.image-composer-copy span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#98a2b3;font-size:11px}
.image-composer-toggle{width:34px;height:34px;display:grid;place-items:center;border:1px solid #e1e5eb;border-radius:6px;background:#fff;color:#667085;cursor:pointer}
.image-composer-toggle:hover{border-color:#aaa5ff;color:#5147d8}
.image-composer-toggle svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.image-composer-body{min-width:0}
.image-upload-status{align-self:center;padding:0 5px;color:#5147d8;font-size:10px;font-weight:700;white-space:nowrap}
@media(max-width:760px){.image-composer-copy{grid-template-columns:1fr}.image-composer-copy span{display:none}.image-composer-head{margin-bottom:8px}}
</style>

<style scoped>
.studio{display:grid;grid-template-columns:272px minmax(0,1fr);height:calc(100vh - 112px);min-height:660px;border:1px solid #e2e6ec;border-radius:9px;background:#fff;overflow:hidden;transition:grid-template-columns .18s ease}.studio.history-collapsed{grid-template-columns:58px minmax(0,1fr)}.history{min-width:0;padding:16px 12px;background:#f7f8fa;border-right:1px solid #e4e7ec;overflow:hidden}.history-top{display:grid;grid-template-columns:1fr 34px;gap:8px}.new-task{height:38px;display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid #d9dde5;border-radius:7px;background:#fff;color:#2e3442;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.03)}.new-task:hover{border-color:#8e87ff;color:#4f46e5}.new-task svg,.history-toggle svg,.stage-toolbar svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.history-toggle{height:38px;display:grid;place-items:center;border:1px solid #d9dde5;border-radius:7px;background:#fff;color:#667085;cursor:pointer}.history-heading{display:flex;align-items:center;justify-content:space-between;margin:20px 8px 8px}.history-heading h3{margin:0;color:#667085;font-size:12px;font-weight:800}.history-heading span{min-width:20px;padding:2px 6px;border-radius:999px;background:#e9ecf1;color:#7c879b;font-size:10px;text-align:center}.history-list{display:grid;gap:3px;overflow-y:auto;max-height:calc(100% - 92px);padding:2px}.history-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 30px;align-items:center;border-radius:7px}.history-row:hover{background:#eef0f4}.history-row.active{background:#ecebff;box-shadow:inset 3px 0 0 #5b4eff}.history-main{min-width:0;display:grid;grid-template-columns:8px minmax(0,1fr);gap:9px;align-items:center;border:0;background:transparent;padding:10px 4px 10px 9px;text-align:left;cursor:pointer}.status-dot{width:7px;height:7px;border-radius:50%;background:#c3c8d2}.status-dot.completed{background:#22a06b}.status-dot.failed{background:#e5484d}.status-dot.processing,.status-dot.queued{background:#e59a19}.history-copy{min-width:0;display:grid;gap:3px}.history-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#3b4352;font-size:12px;font-weight:700}.history-copy small{color:#98a2b3;font-size:10px}.delete-history{width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:6px;background:transparent;color:#98a2b3;cursor:pointer;opacity:0}.history-row:hover .delete-history,.delete-history:focus-visible{opacity:1}.delete-history:hover{background:#fff;color:#d92d20}.delete-history svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.history-collapsed .history{padding:14px 10px}.history-collapsed .history-top{display:block}.history-collapsed .new-task,.history-collapsed .history-heading,.history-collapsed .history-list{display:none}.history-collapsed .history-toggle{width:36px}.studio-main{min-width:0;display:grid;grid-template-rows:minmax(0,1fr) auto;background:#f8f9fb}.result-stage{min-height:0;padding:0 30px 28px;overflow-y:auto}.stage-toolbar{position:sticky;top:0;z-index:4;height:54px;display:flex;align-items:center;justify-content:space-between;background:rgba(248,249,251,.94);backdrop-filter:blur(8px);border-bottom:1px solid #eaecf0}.stage-toolbar>div{display:flex;align-items:center;gap:9px}.stage-toolbar strong{font-size:13px;color:#344054}.stage-toolbar span{padding:3px 7px;border-radius:999px;background:#eceff3;color:#7c879b;font-size:10px}.stage-toolbar button{width:30px;height:30px;display:grid;place-items:center;border:1px solid #d9dde5;border-radius:6px;background:#fff;color:#667085;cursor:pointer}.empty-state{min-height:calc(100% - 54px);display:grid;place-items:center;align-content:center;padding:36px;text-align:center}.empty-icon{width:62px;height:62px;display:grid;place-items:center;border:1px solid #dfe3ea;border-radius:8px;background:#fff;color:#746bf3;box-shadow:0 8px 20px rgba(31,39,65,.06)}.empty-icon svg{width:29px;height:29px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.empty-state h2{margin:18px 0 6px;color:#303744;font-size:20px}.empty-state p{margin:0;color:#7c879b;font-size:13px}.prompt-starters{width:min(620px,100%);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:22px}.prompt-starters button{min-width:0;padding:12px;border:1px solid #dfe3ea;border-radius:7px;background:#fff;text-align:left;cursor:pointer}.prompt-starters button:hover{border-color:#aaa5ff;background:#fbfaff}.prompt-starters strong,.prompt-starters span{display:block}.prompt-starters strong{color:#475467;font-size:12px}.prompt-starters span{margin-top:5px;color:#8a82f5;font-size:10px}.browse-inspiration{margin-top:14px;border:0;background:transparent;color:#5b4eff;font-size:12px;font-weight:800;cursor:pointer}.gallery-grid{columns:2;column-gap:16px;padding-top:18px}.gallery-card{break-inside:avoid;margin:0 0 16px;border:1px solid #e1e5eb;border-radius:8px;background:#fff;overflow:hidden;transition:border-color .16s,box-shadow .16s}.gallery-card:hover{border-color:#aaa7ff;box-shadow:0 10px 24px rgba(30,38,67,.08)}.gallery-card.active{border-color:#8f88ff;box-shadow:0 0 0 2px rgba(91,78,255,.1)}.gallery-visual{position:relative;width:100%;min-height:140px;display:block;overflow:hidden;border:0;background:#eef1f5;padding:0;cursor:zoom-in}.gallery-visual img{width:100%;height:auto;display:block;transition:transform .22s}.gallery-visual:hover img{transform:scale(1.02)}.gallery-visual em{position:absolute;right:9px;bottom:9px;padding:4px 7px;border-radius:5px;background:rgba(15,23,42,.68);color:#fff;font-size:10px;font-style:normal;opacity:0;transition:.16s}.gallery-visual:hover em{opacity:1}.gallery-placeholder{height:180px;display:grid;place-items:center}.gallery-placeholder svg{width:36px;height:36px;fill:none;stroke:#b1bac8;stroke-width:1.5}.gallery-info{padding:12px}.gallery-info h3{margin:0 0 8px;color:#344054;font-size:12px;line-height:1.55;font-weight:700;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.gallery-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap;color:#8a94a5;font-size:10px}.gallery-meta span{padding:3px 6px;border-radius:4px;background:#f2f4f7}.gallery-actions{display:flex;align-items:center;gap:4px;margin-top:11px;padding-top:10px;border-top:1px solid #f0f2f5}.gallery-actions button{width:30px;height:30px;display:grid;place-items:center;border:1px solid #e0e4ea;border-radius:6px;background:#fff;color:#667085;cursor:pointer}.gallery-actions button:hover{border-color:#9c96ff;color:#5046d9}.gallery-actions button.danger:hover{border-color:#f1a7a9;color:#d92d20}.gallery-actions svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.gallery-actions .regenerate{width:auto;margin-left:auto;padding:0 10px;grid-auto-flow:column;gap:5px;border-color:#5b4eff;background:#5b4eff;color:#fff;font-size:11px;font-weight:800}.skeleton-card{pointer-events:none}.skeleton-img{height:210px;position:relative;overflow:hidden;background:#e9edf2}.skeleton-img span{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.68),transparent);animation:shimmer 1.5s infinite}.skeleton-line{height:11px;border-radius:4px;background:#e8ecf2;margin-bottom:7px}.skeleton-line.short{width:62%}.skeleton-bar{height:4px;border-radius:999px;background:#e8ecf2;margin-top:12px;overflow:hidden}.loadbar{height:100%;background:#5b4eff;animation:load 1.5s ease-in-out infinite}.skeleton-text{margin:8px 0 0;color:#98a2b3;font-size:10px}.generator-panel{margin:0 22px 20px;padding:12px;border:1px solid #d8dde5;border-radius:9px;background:#fff;box-shadow:0 12px 30px rgba(22,31,54,.1)}.reference-strip,.draft-source{display:flex;align-items:center;gap:9px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #edf0f4}.reference-strip>span,.draft-source>span{font-size:10px;font-weight:800;color:#98a2b3}.reference-strip small{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#667085;font-size:11px}.ref-preview{position:relative;width:42px;height:42px;border-radius:6px;overflow:hidden;border:1px solid #d8dde5}.ref-thumb{width:100%;height:100%;object-fit:cover}.ref-remove{position:absolute;right:2px;top:2px;width:17px;height:17px;border:0;border-radius:50%;background:rgba(17,24,39,.72);color:#fff;cursor:pointer;line-height:1}.draft-source strong{color:#4f46e5;font-size:11px}.draft-source button{margin-left:auto;border:0;background:transparent;color:#98a2b3;cursor:pointer}.prompt-shell{position:relative}.generator-panel textarea{width:100%;min-height:70px;max-height:160px;padding:4px 4px 20px;border:0;outline:0;resize:vertical;background:transparent;color:#273142;font-size:14px;line-height:1.65}.prompt-count{position:absolute;right:3px;bottom:2px;color:#b0b7c3;font-size:10px}.composer-toolbar{display:flex;align-items:center;gap:10px;padding-top:10px;border-top:1px solid #edf0f4}.source-actions{display:flex;gap:4px}.source-actions button,.source-actions label{height:34px;display:flex;align-items:center;gap:5px;border:1px solid transparent;border-radius:6px;background:#f4f6f8;padding:0 9px;color:#5f6b7d;font-size:11px;font-weight:800;cursor:pointer}.source-actions button:hover,.source-actions label:hover{border-color:#d9d5ff;background:#f6f5ff;color:#5147d8}.source-actions svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.parameter-controls{display:flex;align-items:center;gap:6px;margin-left:auto}.select-control{height:34px;display:flex;align-items:center;gap:5px;border:1px solid #e1e5eb;border-radius:6px;background:#fff;padding:0 7px}.select-control span{color:#98a2b3;font-size:10px}.select-control select{max-width:155px;border:0;outline:0;background:transparent;color:#344054;font-size:11px;font-weight:800;cursor:pointer}.select-control.compact select{width:54px}.quality{height:34px;display:flex;gap:2px;padding:3px;border-radius:6px;background:#f0f2f5}.quality button{min-width:34px;border:0;border-radius:4px;background:transparent;color:#667085;font-size:10px;font-weight:800;cursor:pointer}.quality button.active{background:#fff;color:#332e8a;box-shadow:0 1px 3px rgba(15,23,42,.12)}.send{height:36px;min-width:86px;display:flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:7px;background:#5b4eff;color:#fff;font-size:12px;font-weight:900;cursor:pointer}.send svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}.send:disabled{background:#c8c5ef;cursor:not-allowed}@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}@keyframes load{0%{width:0}50%{width:78%}100%{width:100%}}@media(max-width:1050px){.studio{grid-template-columns:230px minmax(0,1fr)}.composer-toolbar{align-items:flex-end;flex-wrap:wrap}.parameter-controls{order:3;width:100%;margin-left:0}.send{margin-left:auto}.gallery-grid{columns:1}}@media(max-width:760px){.studio{grid-template-columns:58px minmax(0,1fr);height:auto;min-height:calc(100vh - 112px)}.studio .history{padding:14px 10px}.studio .new-task,.studio .history-heading,.studio .history-list{display:none}.studio .history-top{display:block}.studio .history-toggle{width:36px}.result-stage{padding:0 14px 20px}.generator-panel{margin:0 10px 12px}.source-actions span,.select-control>span{display:none}.prompt-starters{grid-template-columns:1fr}.parameter-controls{flex-wrap:wrap}.select-control select{max-width:120px}}
</style>
