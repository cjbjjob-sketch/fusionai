<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue'
import { creationApi, type ModelOption } from '@/api/creation'
import { useAppStore } from '@/stores/app'
import { materialApi, type MaterialItem } from '@/api/material'
import { productApi, type Product } from '@/api/product'
import { useRoute, useRouter } from 'vue-router'
import { friendlyCreationError } from '@/utils/creation-error'
import { roundBillableCredits } from '@/utils/credits'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const models = ref<ModelOption[]>([])
const selectedModelId = ref('auto-video')
const mode = ref('快速')
const quality = ref('2K')
const inputType = ref('文生视频')
const ratio = ref('9:16')
const seconds = ref(5)
const audioSync = ref(true)
const storyboardMode = ref<'smart' | 'custom'>('smart')
const prompt = ref('')
const negativePrompt = ref('')
const composerCollapsed = ref(false)
const promptTextarea = ref<HTMLTextAreaElement | null>(null)
const uploadingReferences = ref(0)
const generating = ref(false)
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
const zoomAsset = ref<any>(null)
const previewVideo = ref<HTMLVideoElement | null>(null)
const previewLoading = ref(false)
const previewError = ref('')
const previewAspectRatio = ref(16 / 9)
const previewVideoStyle = ref<Record<string, string>>({})
let previewResizeObserver: ResizeObserver | null = null
const uploadedImage = ref<string | null>(null)
const uploadedVideos = ref<string[]>([])
const uploadedAudio = ref<string | null>(null)
const referenceVideoPreviews = ref<string[]>([])
const referenceImageMaterialIds = ref<string[]>([])
const referenceImageNames = ref<string[]>([])
const referenceImagePreviews = ref<string[]>([])
const referenceVideoMaterialIds = ref<string[]>([])
const referenceAudioMaterialId = ref<string | null>(null)
const showReferenceModal = ref(false)
const showMaterialPicker = ref(false)
const materialPickerType = ref<'image' | 'video' | 'audio'>('image')
const pickerMaterials = ref<MaterialItem[]>([])
const materialLoading = ref(false)
const hoveredPickerVideoId = ref<string | null>(null)
const shots = ref<any[]>([])
const productContext = ref<Product | null>(null)
const productCoverMaterial = ref<MaterialItem | null>(null)
const showTemplateModal = ref(false)
const showAddTemplateForm = ref(false)
const showAiPromptModal = ref(false)
const aiPromptMode = ref<'generate' | 'optimize'>('generate')
const aiPromptInput = ref('')
const aiPromptResult = ref('')
const aiPromptLoading = ref(false)

const modes = ['快速', '高清', '高一致性', '高表现力']
const generationTypeOrder = ['文生视频', '图生视频', '首尾帧', '参考生成', '编辑视频', '延长视频', '动作控制']
const primaryGenerationTypes = ['文生视频', '图生视频', '首尾帧', '参考生成', '编辑视频']

interface VideoPromptTemplate { id: string; name: string; scene: string; text: string; builtIn?: boolean }
const defaultVideoTemplates: VideoPromptTemplate[] = [
  { id: 'video-product-showcase', name: '商品质感展示', scene: '商品展示', builtIn: true, text: '商品置于简洁高级的商业场景中，从中景缓慢推进至产品细节特写，依次展示整体轮廓、核心结构与材质纹理。光线自然流动，商品外观始终准确稳定，背景克制，画面干净，呈现专业品牌广告质感。' },
  { id: 'video-product-motion', name: '商品自然动效', scene: '图生视频', builtIn: true, text: '保持参考商品的外观、结构、颜色与标识一致，让商品在原场景中自然动起来。镜头平稳环绕并轻微推进，材质高光随视角变化，加入克制的环境动态，避免商品变形、漂移或出现多余部件。' },
  { id: 'video-model-look', name: '模特穿搭展示', scene: '服装模特', builtIn: true, text: '成年模特自然展示服装或配饰，先以全身镜头呈现整体搭配，再切换中近景展示版型、面料和关键细节。人物动作舒展连贯，服装结构稳定，镜头运动平滑，呈现时尚商业短片质感。' },
  { id: 'video-feature-demo', name: '产品功能演示', scene: '功能演示', builtIn: true, text: '在真实使用场景中清晰演示产品的核心操作流程。镜头先建立人物、产品和环境关系，再通过手部近景与产品特写展示关键步骤，动作连续、因果明确，最后回到完整使用效果，整体真实可信。' },
  { id: 'video-brand-story', name: '品牌故事短片', scene: '品牌叙事', builtIn: true, text: '以生活化故事呈现品牌价值，从环境建立镜头开始，跟随人物完成自然、连贯的使用过程，穿插商品细节和情绪特写。节奏由舒缓逐步推进，光线与色彩统一，结尾形成清晰的品牌记忆画面。' },
  { id: 'video-campaign-teaser', name: '活动预热视频', scene: '活动营销', builtIn: true, text: '围绕活动主题制作有节奏感的预热视频，开场用强视觉画面建立关注，中段通过商品、人物与活动元素的快速切换强化核心卖点，结尾预留活动主题和行动信息的视觉区域，画面统一且具有期待感。' },
  { id: 'video-social-review', name: '社交种草视频', scene: '内容种草', builtIn: true, text: '以真实分享视角展示商品体验，人物在自然生活场景中完成开箱、使用和效果展示，镜头轻松但稳定，重点细节用近景呈现，表情与动作自然，整体像高质量用户体验内容，避免过度硬广感。' },
]
const defaultVideoTemplateIds = new Set(defaultVideoTemplates.map(template => template.id))
function loadVideoTemplates(): VideoPromptTemplate[] {
  try {
    const stored = JSON.parse(localStorage.getItem('fusionai_video_templates') || '[]')
    const custom = Array.isArray(stored)
      ? stored.filter((template: VideoPromptTemplate) => template && !template.builtIn && !defaultVideoTemplateIds.has(template.id) && template.name !== '信息流短视频')
      : []
    return [...defaultVideoTemplates, ...custom]
  } catch {
    return [...defaultVideoTemplates]
  }
}
const videoPromptTemplates = ref<VideoPromptTemplate[]>(loadVideoTemplates())
const newVideoTemplate = ref({ name: '', scene: '', text: '' })
function saveVideoTemplates() {
  localStorage.setItem('fusionai_video_templates', JSON.stringify(videoPromptTemplates.value.filter(template => !template.builtIn)))
}
function addVideoTemplate() {
  if (!store.requestLogin('保存视频提示词模板', addVideoTemplate)) return
  const name = newVideoTemplate.value.name.trim()
  const text = newVideoTemplate.value.text.trim()
  if (!name || !text) {
    store.showToast('请填写模板名称和提示词内容', 'error')
    return
  }
  videoPromptTemplates.value.push({ id: `video-template-${Date.now()}`, name, scene: newVideoTemplate.value.scene.trim() || '自定义', text })
  saveVideoTemplates()
  newVideoTemplate.value = { name: '', scene: '', text: '' }
  showAddTemplateForm.value = false
  store.showToast('视频提示词模板已保存')
}
function deleteVideoTemplate(id: string) {
  const template = videoPromptTemplates.value.find(item => item.id === id)
  if (!template || template.builtIn) return
  videoPromptTemplates.value = videoPromptTemplates.value.filter(item => item.id !== id)
  saveVideoTemplates()
}
function applyVideoTemplate(template: VideoPromptTemplate) {
  prompt.value = template.text
  showTemplateModal.value = false
  composerCollapsed.value = false
  store.showToast(`已填入“${template.name}”模板`)
  nextTick(() => promptTextarea.value?.focus())
}

function openAiPromptAssistant() {
  if (!store.requestLogin('使用 AI 提示词助手', openAiPromptAssistant)) return
  aiPromptMode.value = prompt.value.trim() ? 'optimize' : 'generate'
  aiPromptInput.value = prompt.value.trim()
  aiPromptResult.value = ''
  showAiPromptModal.value = true
}
function switchAiPromptMode(nextMode: 'generate' | 'optimize') {
  aiPromptMode.value = nextMode
  aiPromptResult.value = ''
  if (nextMode === 'optimize' && !aiPromptInput.value.trim()) aiPromptInput.value = prompt.value.trim()
}
async function runAiPromptAssistant() {
  if (aiPromptInput.value.trim().length < 2) {
    store.showToast(aiPromptMode.value === 'optimize' ? '请先输入需要优化的提示词' : '请先描述想生成的视频', 'error')
    return
  }
  aiPromptLoading.value = true
  try {
    const result = await creationApi.assistVideoPrompt({
      mode: aiPromptMode.value,
      input: aiPromptInput.value.trim(),
      context: {
        productName: productContext.value?.name,
        hasReferenceImage: referenceImageMaterialIds.value.length > 0,
        hasReferenceVideo: referenceVideoMaterialIds.value.length > 0,
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
  composerCollapsed.value = false
  store.showToast(aiPromptMode.value === 'optimize' ? '已应用优化后的提示词' : '已应用 AI 生成的提示词')
  nextTick(() => promptTextarea.value?.focus())
}

// mode 变化时同步 quality
function onModeChange() {
  const m = mode.value
  if (m === '高清') quality.value = '4K'
  else if (m === '高一致性' || m === '高表现力') quality.value = '2K'
  else quality.value = '1K'
  if (!selectableQualities.value.includes(quality.value)) {
    quality.value = selectableQualities.value[0] || availableQualities.value[0] || '1K'
    mode.value = '快速'
    store.showToast('当前套餐不支持所选清晰度，请升级套餐', 'info')
  }
}
const selectedModel = computed(() => models.value.find(m => m.id === selectedModelId.value))
const allInputTypes = generationTypeOrder
const compatibleModels = computed(() => models.value.filter(model => model.generationTypes?.includes(inputType.value)))
const modelGroups = computed(() => [...new Set(compatibleModels.value.map(model => model.group))])
const hasCompatibleModels = computed(() => compatibleModels.value.length > 0)
const operationRule = computed(() => selectedModel.value?.operationRules?.[inputType.value] || {})
const availableRatios = computed(() => selectedModel.value?.aspectRatios || ['9:16'])
const ratioFollowsSource = computed(() => operationRule.value.ratioMode === 'source')
const ratioDisplayLabel = computed(() => ratioFollowsSource.value ? '跟随首帧' : (ratio.value === 'adaptive' ? '自适应' : ratio.value))
const qualityAllowed = (value: string) => {
  const entitlements = store.user.entitlements
  if (!entitlements) return true
  const normalized = value.toUpperCase()
  if (normalized === '4K') return entitlements.support4k
  if (['2K', 'UHD', 'HIGH'].includes(normalized)) return entitlements.supportUhd
  return true
}
const availableQualities = computed(() => selectedModel.value?.qualities || ['2K'])
const selectableQualities = computed(() => availableQualities.value.filter(qualityAllowed))
const availableDurations = computed(() => selectedModel.value?.durations || [5])
const qualityLabel = computed(() => selectedModel.value?.qualityLabels?.[quality.value] || quality.value)
const qualityOptionLabel = (value: string) => {
  const label = selectedModel.value?.qualityLabels?.[value] || value
  return qualityAllowed(value) ? label : `${label}（套餐未解锁）`
}
const durationLabel = computed(() => seconds.value === -1 ? '智能时长' : `${seconds.value}秒`)
const estimatedCost = computed(() => serverEstimatedCost.value ?? (() => {
  const model = selectedModel.value
  const billing = model?.billing
  const billableSeconds = seconds.value === -1 ? Number(billing?.smartDurationReserveSeconds || 15) : seconds.value
  const resolutionPrice = billing?.basePerSecondByResolution?.[quality.value]
  const qualityMultiplier = resolutionPrice === undefined ? (billing?.qualityMultiplier?.[quality.value] ?? 1) : 1
  const audioMultiplier = audioSync.value ? (billing?.capabilityMultiplier?.audioSync ?? 1.2) : 1
  const storyboardMultiplier = storyboardMode.value === 'custom' ? (billing?.capabilityMultiplier?.storyboard ?? 1.1) : 1
  return roundBillableCredits(billableSeconds * (resolutionPrice ?? billing?.basePerSecond ?? 120) * Number(model?.multiplier || 1) * qualityMultiplier * audioMultiplier * storyboardMultiplier)
})())
const availableCredits = computed(() => store.user.availableCredits ?? store.user.credits)
const customDuration = computed(() => shots.value.reduce((total, shot) => total + Number(shot.seconds || 0), 0))
const activeReferenceCount = computed(() => referenceImageMaterialIds.value.length + referenceVideoMaterialIds.value.length + Number(Boolean(uploadedAudio.value)))
const minReferenceImages = computed(() => Number(operationRule.value.minImages || 0))
const maxReferenceImages = computed(() => Number(operationRule.value.maxImages ?? selectedModel.value?.maxReferenceImages ?? 0))
const needsImageReference = computed(() => minReferenceImages.value > 0)
const needsVideoReference = computed(() => Number(operationRule.value.minVideos || 0) > 0)
const maxReferenceVideos = computed(() => Number(operationRule.value.maxVideos ?? selectedModel.value?.maxReferenceVideos ?? 0))
const allowsVideoReference = computed(() => selectedModel.value?.supportsReferenceVideo !== false && maxReferenceVideos.value > 0)
const allowsAudioReference = computed(() => Boolean(selectedModel.value?.supportsAudioReference && Number(operationRule.value.maxAudios ?? 1) > 0))
const visibleImageSlots = computed(() => {
  if (!maxReferenceImages.value) return 0
  if (inputType.value === '首尾帧') return 2
  return Math.min(maxReferenceImages.value, Math.max(minReferenceImages.value, referenceImageMaterialIds.value.length + 1))
})
const composerSummary = computed(() => [inputType.value, selectedModel.value?.name, ratioDisplayLabel.value, durationLabel.value, qualityLabel.value, activeReferenceCount.value ? `${activeReferenceCount.value}个参考` : ''].filter(Boolean).join(' · '))
const isGuest = computed(() => !store.authenticated)

function preferredModelForType(type: string, preferredId = selectedModelId.value) {
  const supported = models.value.filter(model => model.generationTypes?.includes(type))
  return supported.find(model => model.id === preferredId)
    || supported.find(model => model.id === 'auto-video')
    || supported.find(model => /默认|推荐/.test(model.badge || ''))
    || supported[0]
}

async function loadModels() {
  let d
  try {
    d = store.authenticated ? await creationApi.models() : await creationApi.publicModels()
  } catch {
    d = await creationApi.publicModels()
  }
  models.value = d.video
  const nextModel = preferredModelForType(inputType.value)
  selectedModelId.value = nextModel?.id || ''
}

function refreshModelsOnFocus() {
  void loadModels()
}

function selectInputType(type: string) {
  if (type === inputType.value && selectedModel.value?.generationTypes?.includes(type)) return
  inputType.value = type
  const nextModel = preferredModelForType(type)
  selectedModelId.value = nextModel?.id || ''
  if (type === '文生视频') {
    clearReference('image'); clearReference('video'); clearReference('audio')
  }
  if (type !== '首尾帧' && referenceImageMaterialIds.value.length > maxReferenceImages.value) {
    referenceImageMaterialIds.value = referenceImageMaterialIds.value.slice(0, maxReferenceImages.value)
    referenceImageNames.value = referenceImageNames.value.slice(0, maxReferenceImages.value)
    referenceImagePreviews.value = referenceImagePreviews.value.slice(0, maxReferenceImages.value)
  }
  if (type === '首尾帧') storyboardMode.value = 'smart'
  showReferenceModal.value = false
  composerCollapsed.value = false
  if (!nextModel) store.showToast(`暂未配置支持${type}的可用模型`, 'info')
}

watch([selectedModel, inputType, () => store.user.entitlements], () => {
  const model = selectedModel.value
  if (!model) return
  if (!availableRatios.value.includes(ratio.value)) ratio.value = model.defaultRatio || availableRatios.value[0]
  if (!availableQualities.value.includes(quality.value) || !qualityAllowed(quality.value)) {
    quality.value = (qualityAllowed(model.defaultQuality || '') ? model.defaultQuality : selectableQualities.value[0]) || availableQualities.value[0] || '1K'
  }
  if (!availableDurations.value.includes(seconds.value)) seconds.value = model.defaultDuration || availableDurations.value[0]
  if (!model.supportsAudioSync) audioSync.value = false
  if (!model.supportsStoryboard || store.user.entitlements?.supportStoryboard === false) storyboardMode.value = 'smart'
  if (!model.supportsNegativePrompt) negativePrompt.value = ''
  if (!model.supportsAudioReference) clearReference('audio')
  if (Number(model.operationRules?.[inputType.value]?.maxAudios ?? 1) === 0) clearReference('audio')
  if (!Number(model.operationRules?.[inputType.value]?.maxVideos || 0)) clearReference('video')
  const maxImages = Number(model.operationRules?.[inputType.value]?.maxImages ?? model.maxReferenceImages ?? 0)
  if (referenceImageMaterialIds.value.length > maxImages) {
    referenceImageMaterialIds.value = referenceImageMaterialIds.value.slice(0, maxImages)
    referenceImageNames.value = referenceImageNames.value.slice(0, maxImages)
    referenceImagePreviews.value = referenceImagePreviews.value.slice(0, maxImages)
    store.showToast(`已按 ${model.name} 的能力保留前 ${maxImages} 张参考图`, 'info')
  }
}, { immediate: true })
watch(seconds, value => {
  if (value === -1 && storyboardMode.value === 'custom') storyboardMode.value = 'smart'
})
watch(() => store.authenticated, authenticated => {
  if (!authenticated) return
  void Promise.allSettled([loadHistory(), store.fetchUsage(), loadProductContext()])
})
let historyRequestId = 0
async function loadHistory() {
  if (!store.authenticated) return
  const requestId = ++historyRequestId
  historyLoading.value = true
  historySearchFailed.value = false
  try {
    const result = await creationApi.history('video', historyKeyword.value)
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

async function uploadImageFiles(files: File[]) {
  if (!files.length) return
  if (!store.requestLogin('上传参考图片')) return
  if (inputType.value === '文生视频') selectInputType('图生视频')
  const capacity = Math.max(0, maxReferenceImages.value - referenceImageMaterialIds.value.length)
  const accepted = files.filter(file => file.type.startsWith('image/')).slice(0, capacity)
  if (!accepted.length) {
    store.showToast(capacity <= 0 ? `当前方式最多添加 ${maxReferenceImages.value} 张图片` : '剪贴板中没有可用图片', 'info')
    return
  }
  if (accepted.length < files.filter(file => file.type.startsWith('image/')).length) store.showToast('超出当前模型图片上限，多余图片未上传', 'info')
  uploadingReferences.value += accepted.length
  try {
    for (const file of accepted) {
      const material = await materialApi.uploadFile(file, {})
      referenceImageMaterialIds.value.push(material.id)
      referenceImageNames.value.push(material.title)
      referenceImagePreviews.value.push(material.previewUrl || material.thumbnailUrl || material.fileUrl || '')
    }
    uploadedImage.value = referenceImageNames.value[0] || null
    store.showToast(`已添加 ${accepted.length} 张参考图`)
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '参考图片上传失败', 'error')
  } finally {
    uploadingReferences.value -= accepted.length
  }
}

async function onUploadImage(e: Event) {
  if (!store.authenticated) { (e.target as HTMLInputElement).value = ''; store.requestLogin('上传参考图片'); return }
  const input = e.target as HTMLInputElement
  await uploadImageFiles(Array.from(input.files || []))
  input.value = ''
}

async function onComposerPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'))
  if (!files.length) return
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain')?.trim()
  if (text) prompt.value = prompt.value ? `${prompt.value}\n${text}` : text
  await uploadImageFiles(files)
}

function handlePromptKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.repeat) return
  event.preventDefault()
  void startGenerate()
}
async function onUploadVideo(e: Event) {
  if (!store.authenticated) { (e.target as HTMLInputElement).value = ''; store.requestLogin('上传参考视频'); return }
  const input = e.target as HTMLInputElement
  const available = Math.max(0, maxReferenceVideos.value - referenceVideoMaterialIds.value.length)
  const files = Array.from(input.files || []).slice(0, available)
  if (!files.length) { input.value = ''; return }
  try {
    const materials = await Promise.all(files.map(file => materialApi.uploadFile(file, {})))
    for (const material of materials) {
      if (referenceVideoMaterialIds.value.includes(material.id)) continue
      uploadedVideos.value.push(material.title)
      referenceVideoMaterialIds.value.push(material.id)
      referenceVideoPreviews.value.push(material.thumbnailUrl || material.previewUrl || material.fileUrl || '')
    }
    store.showToast(`已上传 ${materials.length} 个参考视频`)
  } catch (e: any) { store.showToast(e?.response?.data?.message || '参考视频上传失败', 'error') }
  finally { input.value = '' }
}

async function onUploadAudio(e: Event) {
  if (!store.authenticated) { (e.target as HTMLInputElement).value = ''; store.requestLogin('上传参考音频'); return }
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const material = await materialApi.uploadFile(file, {})
    uploadedAudio.value = material.title
    referenceAudioMaterialId.value = material.id
    store.showToast('配乐素材已上传到素材库')
  } catch (e: any) { store.showToast(e?.response?.data?.message || '音频上传失败', 'error') }
}

async function openMaterialPicker(type: 'image' | 'video' | 'audio') {
  if (!store.requestLogin('从素材库选择参考素材', () => void openMaterialPicker(type))) return
  materialPickerType.value = type
  showMaterialPicker.value = true
  materialLoading.value = true
  try { pickerMaterials.value = await materialApi.list({ type }) }
  catch { store.showToast('素材库加载失败', 'error') }
  finally { materialLoading.value = false }
}

function selectReferenceMaterial(item: MaterialItem) {
  if (item.type === 'image') {
    if (inputType.value === '文生视频') selectInputType('图生视频')
    if (referenceImageMaterialIds.value.includes(item.id)) return
    if (referenceImageMaterialIds.value.length >= maxReferenceImages.value) {
      store.showToast(`当前方式最多添加 ${maxReferenceImages.value} 张图片`, 'info')
      return
    }
    referenceImageMaterialIds.value.push(item.id)
    referenceImageNames.value.push(item.title)
    referenceImagePreviews.value.push(item.previewUrl || item.thumbnailUrl || item.fileUrl || '')
    uploadedImage.value = referenceImageNames.value[0] || null
  } else if (item.type === 'video') {
    if (referenceVideoMaterialIds.value.includes(item.id)) return
    if (referenceVideoMaterialIds.value.length >= maxReferenceVideos.value) {
      store.showToast(`当前方式最多添加 ${maxReferenceVideos.value} 个视频`, 'info')
      return
    }
    referenceVideoMaterialIds.value.push(item.id)
    uploadedVideos.value.push(item.title)
    referenceVideoPreviews.value.push(item.thumbnailUrl || item.previewUrl || item.fileUrl || '')
  } else if (item.type === 'audio') {
    referenceAudioMaterialId.value = item.id
    uploadedAudio.value = item.title
  }
  showMaterialPicker.value = false
  store.showToast('参考素材已选择')
}

function addShot() {
  shots.value.push({ id: 'shot' + Date.now(), name: `镜头${shots.value.length + 1}`, seconds: 3, prompt: '' })
}
function deleteShot(id: string) {
  shots.value = shots.value.filter(s => s.id !== id)
}

function clearReference(type: 'image' | 'video' | 'audio') {
  if (type === 'image') { uploadedImage.value = null; referenceImageMaterialIds.value = []; referenceImageNames.value = []; referenceImagePreviews.value = [] }
  if (type === 'video') { uploadedVideos.value = []; referenceVideoMaterialIds.value = []; referenceVideoPreviews.value = [] }
  if (type === 'audio') { uploadedAudio.value = null; referenceAudioMaterialId.value = null }
}

function removeReferenceVideo(index: number) {
  referenceVideoMaterialIds.value.splice(index, 1)
  uploadedVideos.value.splice(index, 1)
  referenceVideoPreviews.value.splice(index, 1)
}

function removeReferenceImage(index: number) {
  referenceImageMaterialIds.value.splice(index, 1)
  referenceImageNames.value.splice(index, 1)
  referenceImagePreviews.value.splice(index, 1)
  uploadedImage.value = referenceImageNames.value[0] || null
}

async function startGenerate() {
  if (generating.value || estimating.value || showEstimate.value) return
  if (!selectedModel.value) { store.showToast(`暂未配置支持${inputType.value}的可用模型`, 'error'); return }
  if (!prompt.value.trim()) { composerCollapsed.value = false; await nextTick(); promptTextarea.value?.focus(); store.showToast('请输入提示词', 'error'); return }
  if (!store.requestLogin('生成这条视频', startGenerate)) return
  if (referenceImageMaterialIds.value.length < minReferenceImages.value) {
    composerCollapsed.value = false
    showReferenceModal.value = true
    store.showToast(`${inputType.value}需要添加 ${minReferenceImages.value} 张图片`, 'error')
    return
  }
  if (needsVideoReference.value && !referenceVideoMaterialIds.value.length) {
    composerCollapsed.value = false
    showReferenceModal.value = true
    store.showToast(`${inputType.value}需要添加一段视频`, 'error')
    return
  }
  if (inputType.value === '参考生成' && !referenceImageMaterialIds.value.length && !referenceVideoMaterialIds.value.length) {
    composerCollapsed.value = false
    showReferenceModal.value = true
    store.showToast('参考生成至少需要一张参考图片或一个参考视频', 'error')
    return
  }
  if (storyboardMode.value === 'custom' && !shots.value.length) {
    store.showToast('请至少添加一个分镜', 'error')
    return
  }
  if (storyboardMode.value === 'custom' && customDuration.value !== seconds.value) {
    store.showToast(`分镜时长合计需为 ${seconds.value} 秒，当前为 ${customDuration.value} 秒`, 'error')
    return
  }
  estimating.value = true
  try {
    const estimate = await creationApi.estimateVideo({ modelId: selectedModelId.value, seconds: seconds.value, quality: quality.value, audioSync: audioSync.value, storyboardCount: storyboardMode.value === 'custom' ? shots.value.length : 0 })
    serverEstimatedCost.value = estimate.credits
    showEstimate.value = true
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '暂时无法计算本次费用', 'error')
  } finally {
    estimating.value = false
  }
}

async function confirmGenerate() {
  showEstimate.value = false
  generating.value = true
  try {
    const res = await creationApi.generateVideo({
      prompt: prompt.value, modelId: selectedModelId.value,
      generationType: inputType.value,
      seconds: seconds.value, ratio: ratio.value, mode: mode.value, quality: quality.value,
      productId: typeof route.query.productId === 'string' ? route.query.productId : undefined,
      brandId: typeof route.query.brandId === 'string' ? route.query.brandId : undefined,
      audioSync: audioSync.value,
      referenceMaterialIds: referenceImageMaterialIds.value.length ? referenceImageMaterialIds.value : undefined,
      referenceVideoMaterialIds: referenceVideoMaterialIds.value.length ? referenceVideoMaterialIds.value : undefined,
      referenceAudioMaterialId: referenceAudioMaterialId.value || undefined,
      storyboard: storyboardMode.value === 'custom' ? shots.value : undefined,
      negativePrompt: negativePrompt.value.trim() || undefined,
    })
    await store.fetchUsage()
    await loadHistory()
    gallery.value.unshift({
      ...res.asset, urls: res.urls || [], prompt: prompt.value, cost: res.cost,
      model: selectedModel.value?.name, modelId: selectedModelId.value,
      mode: mode.value, quality: quality.value, ratio: ratio.value, seconds: seconds.value, taskId: res.taskId,
    })
    activeHistoryId.value = res.asset.id
    store.showToast('视频任务已进入生成队列，完成后将自动展示')
    composerCollapsed.value = true
    void pollGeneratedVideo(res.asset.id)
    await nextTick()
    scrollGalleryToStart()
  } catch (e: any) {
    store.showToast(friendlyCreationError(e, 'video'), 'error')
  } finally { generating.value = false }
}

async function pollGeneratedVideo(assetId: string) {
  for (let i = 0; i < 240; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000))
    try {
      const detail = await creationApi.historyDetail(assetId)
      const index = gallery.value.findIndex(item => item.id === assetId)
      if (index >= 0) gallery.value[index] = { ...gallery.value[index], ...detail, urls: detail.fileUrl ? [detail.fileUrl] : [] }
      if (detail.status === 'completed') {
        await loadHistory(); await store.fetchUsage(); store.showToast('视频生成完成')
        return
      }
      if (detail.status === 'failed') {
        const reason = failureMessage(detail)
        await store.fetchUsage(); store.showToast(`视频生成失败：${reason}`, 'error')
        return
      }
    } catch { /* ignore transient polling errors */ }
  }
}

async function viewHistory(item: any) {
  activeHistoryId.value = item.id
  try {
    const detail = await creationApi.historyDetail(item.id)
    const vid = { ...detail, urls: detail.fileUrl ? [detail.fileUrl] : [], prompt: detail.prompt || detail.source }
    if (!gallery.value.find(g => g.id === vid.id)) gallery.value.unshift(vid)
    await restoreHistoryParams(detail)
    await nextTick()
    scrollGalleryToStart()
  } catch { store.showToast('加载失败', 'error') }
}

function newTask() {
  activeHistoryId.value = null
  gallery.value = []
  prompt.value = ''
  negativePrompt.value = ''
  showTemplateModal.value = false
  showAddTemplateForm.value = false
  showAiPromptModal.value = false
  aiPromptInput.value = ''
  aiPromptResult.value = ''
  composerCollapsed.value = false
  uploadedImage.value = null
  uploadedVideos.value = []
  uploadedAudio.value = null
  referenceVideoPreviews.value = []
  referenceImageMaterialIds.value = []
  referenceImageNames.value = []
  referenceImagePreviews.value = []
  referenceVideoMaterialIds.value = []
  referenceAudioMaterialId.value = null
  selectInputType('文生视频')
  storyboardMode.value = 'smart'
  shots.value = []
  showReferenceModal.value = false
  applyProductContext()
}

function productVideoPrompt(product: Product) {
  return [
    `让「${product.name}」自然动起来，制作一条突出商品质感的短视频`,
    product.selling ? `核心卖点：${product.selling}` : '',
    product.audience ? `目标人群：${product.audience}` : '',
    '镜头从商品整体缓慢推进到细节特写，光影自然，保持商品外观一致',
  ].filter(Boolean).join('。')
}

function applyProductContext() {
  if (!productContext.value) return
  if (!prompt.value.trim()) prompt.value = productVideoPrompt(productContext.value)
  if (preferredModelForType('图生视频')) selectInputType('图生视频')
  if (productCoverMaterial.value) selectReferenceMaterial(productCoverMaterial.value)
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
  if (referenceImageMaterialIds.value.includes(String(materialId))) clearReference('image')
  const query = { ...route.query }
  delete query.productId
  delete query.source
  router.replace({ query })
}

async function deleteHistory(id: string) {
  if (!confirm('确定删除这条视频任务及对应视频资产吗？删除后无法恢复。')) return
  try {
    await creationApi.deleteAsset(id)
    history.value = history.value.filter(h => h.id !== id)
    gallery.value = gallery.value.filter(g => g.id !== id)
    if (activeHistoryId.value === id) activeHistoryId.value = null
    store.showToast('已删除')
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '删除失败', 'error')
  }
}

function parseAssetMeta(item: any) {
  if (!item?.meta) return {}
  if (typeof item.meta !== 'string') return item.meta
  try { return JSON.parse(item.meta) } catch { return {} }
}

function historyPrompt(item: any) {
  return String(item?.prompt || item?.title || '未命名视频任务').trim()
}

function historyParams(item: any) {
  const meta = parseAssetMeta(item)
  const modelId = meta.modelId || item?.modelId
  const modelName = models.value.find(model => model.id === modelId)?.name || modelId || '智能推荐'
  const generationType = meta.generationType || item?.generationType || '视频创作'
  const duration = meta.seconds || item?.seconds
  const durationText = Number(duration) === -1 ? '智能时长' : duration ? `${duration}s` : ''
  return [generationType, meta.ratio || item?.ratio, durationText, modelName, meta.quality || item?.quality].filter(Boolean).join(' · ')
}

function formatHistoryTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function historyFailure(item: any) {
  return item?.status === 'failed' ? failureMessage(item) : ''
}

async function restoreReferenceMaterials(context: any) {
  const imageIds: string[] = Array.from(new Set<string>(
    (Array.isArray(context?.referenceMaterialIds) ? context.referenceMaterialIds : []).map((id: unknown) => String(id)).filter(Boolean),
  ))
  const imageResults = await Promise.allSettled(imageIds.map(id => materialApi.detail(id)))
  const images = imageResults.flatMap(result => result.status === 'fulfilled' && result.value.type === 'image' ? [result.value] : [])
  referenceImageMaterialIds.value = images.map(item => item.id)
  referenceImageNames.value = images.map(item => item.title)
  referenceImagePreviews.value = images.map(item => item.previewUrl || item.thumbnailUrl || item.fileUrl || '')
  uploadedImage.value = referenceImageNames.value[0] || null

  referenceVideoMaterialIds.value = []
  uploadedVideos.value = []
  referenceVideoPreviews.value = []
  const videoIds = Array.from(new Set<string>([
    ...(Array.isArray(context?.referenceVideoMaterialIds) ? context.referenceVideoMaterialIds : []),
    context?.referenceVideoMaterialId,
  ].map((id: unknown) => String(id || '')).filter(Boolean)))
  const videoResults = await Promise.allSettled(videoIds.map(id => materialApi.detail(id)))
  const videos = videoResults.flatMap(result => result.status === 'fulfilled' && result.value.type === 'video' ? [result.value] : [])
  referenceVideoMaterialIds.value = videos.map(item => item.id)
  uploadedVideos.value = videos.map(item => item.title)
  referenceVideoPreviews.value = videos.map(item => item.thumbnailUrl || item.previewUrl || item.fileUrl || '')

  referenceAudioMaterialId.value = null
  uploadedAudio.value = null
  if (context?.referenceAudioMaterialId) {
    try {
      const audio = await materialApi.detail(String(context.referenceAudioMaterialId))
      if (audio.type === 'audio') { referenceAudioMaterialId.value = audio.id; uploadedAudio.value = audio.title }
    } catch { /* handled by the unavailable material notice below */ }
  }

  const missingCount = imageIds.length - images.length
    + (videoIds.length - videos.length)
    + Number(Boolean(context?.referenceAudioMaterialId && !referenceAudioMaterialId.value))
  if (missingCount > 0) store.showToast(`${missingCount} 个原参考素材已删除或不可访问，请重新选择`, 'info')
}

async function restoreHistoryParams(item: any) {
  const meta = parseAssetMeta(item)
  const context = item?.editContext || meta
  if (item?.prompt) prompt.value = item.prompt
  const requestedType = generationTypeOrder.includes(context.generationType) ? context.generationType : inputType.value
  const modelId = context.modelId || meta.modelId || item?.modelId
  inputType.value = requestedType
  selectedModelId.value = preferredModelForType(requestedType, modelId)?.id || ''
  await nextTick()
  if (context.ratio && availableRatios.value.includes(context.ratio)) ratio.value = context.ratio
  if (context.seconds && availableDurations.value.includes(Number(context.seconds))) seconds.value = Number(context.seconds)
  if (context.quality && selectableQualities.value.includes(context.quality)) quality.value = context.quality
  if (context.mode) mode.value = context.mode
  if (typeof context.audioSync === 'boolean' && selectedModel.value?.supportsAudioSync) audioSync.value = context.audioSync
  negativePrompt.value = String(context.negativePrompt || '')
  shots.value = Array.isArray(context.storyboard) ? context.storyboard.map((shot: any, index: number) => ({ ...shot, id: shot.id || `restored-shot-${index}` })) : []
  storyboardMode.value = shots.value.length ? 'custom' : 'smart'
  await restoreReferenceMaterials(context)
}

async function removeGalleryItem(id: string) {
  try { await creationApi.deleteAsset(id) } catch {}
  gallery.value = gallery.value.filter(g => g.id !== id)
  await loadHistory()
  store.showToast('已删除')
}

function scrollGalleryToStart() {
  const stage = document.querySelector('.result-stage')
  if (stage) stage.scrollTo({ top: 0, behavior: 'smooth' })
}

function isPending(item: any) {
  return ['pending', 'queued', 'processing'].includes(item?.status)
}

function isFailed(item: any) {
  return item?.status === 'failed'
}

function failureMessage(item: any) {
  const meta = typeof item?.meta === 'string' ? (() => { try { return JSON.parse(item.meta) } catch { return {} } })() : item?.meta
  return friendlyCreationError(meta?.error, 'video', true)
}

function zoomImage(item: any) {
  const url = item?.urls?.[0] || item?.fileUrl
  if (!url || (!url.startsWith('http') && !url.startsWith('/'))) return
  const ratioText = String(item?.ratio || item?.meta?.requestedRatio || '')
  const [ratioWidth, ratioHeight] = ratioText.split(':').map(Number)
  previewAspectRatio.value = ratioWidth > 0 && ratioHeight > 0 ? ratioWidth / ratioHeight : 16 / 9
  previewLoading.value = true
  previewError.value = ''
  zoomAsset.value = item
}

function fitPreviewVideo(video: HTMLVideoElement) {
  const canvas = video.parentElement
  if (!canvas || !video.videoWidth || !video.videoHeight) return
  const mediaRatio = video.videoWidth / video.videoHeight
  const maxWidth = Math.max(0, canvas.clientWidth - 2)
  const maxHeight = Math.max(0, canvas.clientHeight - 2)
  let width = maxWidth
  let height = width / mediaRatio
  if (height > maxHeight) {
    height = maxHeight
    width = height * mediaRatio
  }
  previewVideoStyle.value = { width: `${Math.floor(width)}px`, height: `${Math.floor(height)}px` }
}

function onPreviewMetadata(event: Event) {
  const video = event.currentTarget as HTMLVideoElement
  if (video.videoWidth > 0 && video.videoHeight > 0) previewAspectRatio.value = video.videoWidth / video.videoHeight
  fitPreviewVideo(video)
  previewResizeObserver?.disconnect()
  if (video.parentElement) {
    previewResizeObserver = new ResizeObserver(() => fitPreviewVideo(video))
    previewResizeObserver.observe(video.parentElement)
  }
  previewLoading.value = false
}

function closePreview() {
  const video = previewVideo.value
  if (video) {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
  zoomAsset.value = null
  previewAspectRatio.value = 16 / 9
  previewVideoStyle.value = {}
  previewResizeObserver?.disconnect()
  previewResizeObserver = null
  previewLoading.value = false
  previewError.value = ''
}

async function refreshVideo(item: any) {
  try {
    const res = await creationApi.refreshVideo(item.id)
    if (res.status === 'completed' && res.fileUrl?.startsWith('http')) {
      const idx = gallery.value.findIndex(g => g.id === item.id)
      if (idx >= 0) {
        gallery.value[idx] = { ...gallery.value[idx], fileUrl: res.fileUrl, urls: [res.fileUrl] }
      }
      store.showToast('视频已生成！')
    } else {
      store.showToast('视频仍在生成中，请稍后再刷新')
    }
  } catch { store.showToast('刷新失败', 'error') }
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

async function editPrompt(item: any) {
  let detail = item
  try {
    if (item?.id) detail = await creationApi.historyDetail(item.id)
  } catch { /* fall back to the card metadata */ }
  await restoreHistoryParams(detail)
  composerCollapsed.value = false
  await nextTick()
  document.querySelector('.video-panel')?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  store.showToast(activeReferenceCount.value ? `已恢复 ${activeReferenceCount.value} 个参考素材，可编辑后重新生成` : '已填入参数，可编辑后重新生成')
}

function downloadImage(item: any) {
  if (!store.requestLogin('下载生成视频', () => downloadImage(item))) return
  const url = item?.downloadUrl || item?.urls?.[0] || item?.fileUrl
  if (!url || (!url.startsWith('http') && !url.startsWith('data:'))) {
    store.showToast('视频尚未生成完成', 'error'); return
  }
  if (url.startsWith('data:')) {
    const a = document.createElement('a')
    a.href = url
    a.download = `fusionai-video-${item.id?.slice(0, 8) || Date.now()}.png`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    store.showToast('已下载')
  } else {
    const a = document.createElement('a')
    a.href = url
    a.download = `fusionai-video-${item.id?.slice(0, 8) || Date.now()}.mp4`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    store.showToast('已开始下载视频')
  }
}

async function loadInspirationDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem('fusionai_inspiration_draft') || '')
    if (draft?.type !== 'video' || !draft?.prompt) return

    prompt.value = String(draft.prompt)
    const requestedType = generationTypeOrder.includes(String(draft.generationType)) ? String(draft.generationType) : '文生视频'
    const requestedModel = String(draft.modelId || draft.model || '').trim().toLocaleLowerCase()
    const matchedModel = requestedModel
      ? models.value.find(model => [model.id, model.name, model.actualModel].some(value => String(value || '').trim().toLocaleLowerCase() === requestedModel))
      : undefined
    inputType.value = requestedType
    selectedModelId.value = preferredModelForType(requestedType, matchedModel?.id)?.id || ''
    if (draft.ratio && availableRatios.value.includes(String(draft.ratio))) ratio.value = String(draft.ratio)
    if (draft.seconds && availableDurations.value.includes(Number(draft.seconds))) seconds.value = Number(draft.seconds)
    if (draft.quality && selectableQualities.value.includes(String(draft.quality))) quality.value = String(draft.quality)

    composerCollapsed.value = false
    sessionStorage.removeItem('fusionai_inspiration_draft')
    store.showToast(`已载入“${draft.title || '视频灵感'}”的提示词和创作参数`)
    await nextTick()
    promptTextarea.value?.focus()
  } catch { /* Ignore malformed or stale drafts. */ }
}

onMounted(async () => {
  window.addEventListener('focus', refreshModelsOnFocus)
  const initialLoads: Promise<unknown>[] = [loadModels()]
  if (store.authenticated) initialLoads.push(loadHistory(), store.fetchUsage())
  await Promise.allSettled(initialLoads)
  await loadInspirationDraft()
  if (store.authenticated) await loadProductContext()
  const materialId = typeof route.query.materialId === 'string' ? route.query.materialId : ''
  if (store.authenticated && materialId && ['image', 'video', 'audio'].includes(String(route.query.materialType))) {
    materialApi.detail(materialId).then(selectReferenceMaterial).catch(() => store.showToast('指定素材加载失败', 'error'))
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshModelsOnFocus)
  previewResizeObserver?.disconnect()
})

</script>

<template>
  <section class="studio" :class="{ 'history-collapsed': historyCollapsed }">
    <!-- 左：history -->
    <aside class="history">
      <div class="history-top">
        <button class="new-task" type="button" title="新建创作" aria-label="新建创作" @click="newTask">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          <span>新建创作</span>
        </button>
        <button class="history-toggle" :title="historyCollapsed ? '展开记录' : '收起记录'" :aria-label="historyCollapsed ? '展开历史记录' : '收起历史记录'" :aria-expanded="!historyCollapsed" @click="historyCollapsed = !historyCollapsed">
          <svg viewBox="0 0 24 24"><path :d="historyCollapsed ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6'"/></svg>
        </button>
      </div>
      <div v-if="historyCollapsed" class="collapsed-status-dots" aria-label="最近历史任务状态">
        <span v-if="historyLoading" class="status-dot loading" title="正在加载历史任务"></span>
        <span v-for="h in history.slice(0, 8)" v-else :key="h.id" class="status-dot" :class="h.status" :title="historyPrompt(h)"></span>
      </div>
      <div class="history-heading"><h3>历史任务</h3><span>{{ historyLoading ? '…' : history.length }}</span></div>
      <label v-if="!isGuest" class="history-search" aria-label="搜索视频历史任务">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>
        <input v-model="historyKeyword" type="search" maxlength="100" placeholder="搜索提示词或模型" @keydown.esc="historyKeyword = ''" />
        <button v-if="historyKeyword" type="button" title="清空搜索" aria-label="清空搜索" @click="historyKeyword = ''">×</button>
      </label>
      <div class="history-list">
        <button v-if="isGuest" class="guest-history" @click="store.requestLogin('查看视频创作历史')"><strong>登录后查看历史任务</strong><span>生成进度和视频资产会保存在账户中</span></button>
        <div v-else-if="historyLoading" class="history-feedback"><span class="history-spinner"></span><p>正在搜索...</p></div>
        <div v-else-if="historySearchFailed" class="history-feedback"><p>历史记录加载失败</p><button type="button" @click="loadHistory">重新加载</button></div>
        <div v-else-if="!history.length" class="history-feedback"><p>{{ historyKeyword.trim() ? '未找到相关任务' : '暂无历史任务' }}</p><button v-if="historyKeyword" type="button" @click="historyKeyword = ''">清空搜索</button></div>
        <template v-else>
          <div v-for="h in history" :key="h.id" class="history-row" :class="{ active: h.id === activeHistoryId }" :title="historyFailure(h)">
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

    <!-- 右：main -->
    <main class="studio-main">
      <!-- result-stage -->
      <div class="result-stage" ref="resultStage">
        <div v-if="!generating && !gallery.length" class="empty-state">
          <div class="empty-visual">
            <span class="empty-frame"><i></i><b></b></span>
            <span class="empty-play"><svg viewBox="0 0 24 24"><path d="M9 7l8 5-8 5z"/></svg></span>
          </div>
          <span class="empty-kicker">VIDEO STUDIO</span>
          <h2>把一个想法，变成完整镜头</h2>
          <p>描述画面与运动方式，按需加入参考素材或分镜。生成结果会自动保存到内容资产库。</p>
          <div class="empty-steps"><span>1 选择模型</span><span>2 描述画面</span><span>3 生成视频</span></div>
        </div>
        <!-- 瀑布流画廊 -->
        <div v-if="gallery.length || generating" class="gallery-grid">
          <div v-for="item in gallery" :key="item.id" class="gallery-card" :class="{ active: item.id === activeHistoryId }">
            <div class="gallery-visual video-visual" :class="{ failed: isFailed(item) }" @click="!isPending(item) && !isFailed(item) && zoomImage(item)" :style="{ cursor: isPending(item) || isFailed(item) ? 'default' : 'pointer' }">
              <video v-if="!isPending(item) && !isFailed(item)"
                :src="item.urls?.[0] || item.fileUrl" class="w-full h-auto block"
                preload="metadata" muted playsinline />
              <template v-else-if="isPending(item)">
                <div class="gallery-placeholder video-ph"><span></span><i></i><b></b><em class="play-icon">▶</em></div>
              </template>
              <div v-else class="video-failed-state"><svg viewBox="0 0 24 24"><path d="M12 8v5m0 3h.01M10 3h4l8 15H2L10 3z"/></svg><strong>视频生成失败</strong><small>{{ failureMessage(item) }}</small></div>
              <span v-if="isPending(item)" class="pending-badge">生成中</span>
              <span v-else-if="isFailed(item)" class="failed-badge">已退款</span>
              <span v-else class="play-badge">点击预览</span>
            </div>
            <div class="gallery-info">
              <h3>{{ item.prompt || item.title }}</h3>
              <div class="gallery-meta">
                <span class="tag">{{ item.model || item.source }}</span>
                <span v-if="item.mode" class="tag">{{ item.mode }}</span>
                <span v-if="item.seconds" class="tag">{{ item.seconds }}s</span>
                <span v-if="item.ratio" class="tag">{{ item.ratio }}</span>
                <span>{{ item.cost || 0 }} 积分</span>
                <span>{{ new Date(item.createdAt).toLocaleTimeString() }}</span>
              </div>
              <div class="gallery-actions">
                <button v-if="isPending(item)" class="btn-sm primary" @click="refreshVideo(item)">刷新状态</button>
                <button class="btn-sm" @click="copyPrompt(item)">复制提示词</button>
                <button class="btn-sm" @click="editPrompt(item)">{{ isFailed(item) ? '修改后重试' : '编辑参数' }}</button>
                <button v-if="!isFailed(item)" class="btn-sm primary" @click="prompt = item.prompt || ''; startGenerate()">再生成</button>
                <button v-if="!isPending(item) && !isFailed(item)" class="btn-sm" @click="downloadImage(item)">下载</button>
                <button class="btn-sm danger" @click="removeGalleryItem(item.id)">删除</button>
              </div>
            </div>
          </div>
          <!-- skeleton 占位卡片 -->
          <div v-if="generating" class="gallery-card skeleton-card">
            <div class="gallery-visual skeleton-img">
              <div class="shimmer"></div>
              <em class="play-icon">▶</em>
            </div>
            <div class="gallery-info">
              <div class="skeleton-line"></div>
              <div class="skeleton-line short"></div>
              <div class="skeleton-bar"><div class="loadbar"></div></div>
              <p class="skeleton-text">{{ selectedModel?.name }} · {{ mode }} · {{ seconds }}s · AI 正在生成...</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 创作台 -->
      <div class="generator-panel video-panel" :class="{ collapsed: composerCollapsed }" @paste="onComposerPaste">
        <div class="composer-head">
          <button v-if="composerCollapsed" class="composer-collapsed-copy" type="button" @click="composerCollapsed = false">
            <strong>{{ composerSummary }}</strong><span>{{ prompt || '点击展开继续创作' }}</span>
          </button>
          <div v-else><span>视频创作</span><strong>{{ inputType }} · {{ selectedModel?.name || '正在加载模型' }}</strong></div>
          <div v-if="!composerCollapsed" class="composer-summary"><span>{{ ratioDisplayLabel }}</span><span>{{ durationLabel }}</span><span>{{ qualityLabel }}</span><span v-if="activeReferenceCount">{{ activeReferenceCount }} 个参考</span></div>
          <button class="composer-toggle" type="button" :title="composerCollapsed ? '展开创作台' : '收起创作台'" :aria-expanded="!composerCollapsed" @click="composerCollapsed = !composerCollapsed">
            <svg viewBox="0 0 24 24"><path :d="composerCollapsed ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'"/></svg>
          </button>
        </div>

        <div v-if="!composerCollapsed" class="composer-body">
          <div class="creation-mode-tabs" role="tablist" aria-label="视频创作方式">
            <button v-for="type in allInputTypes" :key="type" type="button" :class="{ active: inputType === type, secondary: !primaryGenerationTypes.includes(type) }" @click="selectInputType(type)">{{ type }}</button>
          </div>

          <div v-if="productContext" class="product-context">
            <img v-if="productContext.coverUrl" :src="productContext.coverUrl" :alt="productContext.name" />
            <span><small>关联商品</small><strong>{{ productContext.name }}</strong></span>
            <em>商品主图已加入参考，结果将归档到该商品</em>
            <button title="取消关联商品" @click="clearProductContext">×</button>
          </div>

          <div class="primary-controls">
            <label class="select-field model-field"><span>模型</span><select v-model="selectedModelId" :disabled="!hasCompatibleModels"><option v-if="!hasCompatibleModels" value="">暂无支持该方式的模型</option><optgroup v-for="g in modelGroups" :key="g" :label="g"><option v-for="m in compatibleModels.filter(m => m.group === g)" :key="m.id" :value="m.id">{{ m.name }}</option></optgroup></select></label>
            <label class="select-field"><span>清晰度</span><select v-model="quality"><option v-for="q in availableQualities" :key="q" :value="q" :disabled="!qualityAllowed(q)">{{ qualityOptionLabel(q) }}</option></select></label>
            <label class="select-field"><span>比例</span><select v-if="!ratioFollowsSource" v-model="ratio"><option v-for="r in availableRatios" :key="r" :value="r">{{ r === 'adaptive' ? '自适应' : r }}</option></select><select v-else disabled title="普通 Kling 3.0 图生视频的比例由首帧决定"><option>跟随首帧</option></select></label>
            <label class="select-field"><span>时长</span><select v-model="seconds"><option v-for="s in availableDurations" :key="s" :value="s">{{ s === -1 ? '智能' : `${s} 秒` }}</option></select></label>
          </div>

          <div class="prompt-box">
            <div v-if="activeReferenceCount" class="selected-reference-strip">
              <span>参考素材</span>
              <div class="selected-reference-list">
                <button v-for="(name, index) in referenceImageNames" :key="`selected-image-${referenceImageMaterialIds[index]}`" type="button" class="selected-reference-chip" :title="`移除图片：${name}`" @click="removeReferenceImage(index)">
                  <img v-if="referenceImagePreviews[index]" :src="referenceImagePreviews[index]" :alt="name" /><i v-else>图</i><small>{{ name }}</small><em>×</em>
                </button>
                <button v-for="(name, index) in uploadedVideos" :key="`selected-video-${referenceVideoMaterialIds[index]}`" type="button" class="selected-reference-chip" :title="`移除视频：${name}`" @click="removeReferenceVideo(index)">
                  <img v-if="referenceVideoPreviews[index]" :src="referenceVideoPreviews[index]" :alt="name" /><i v-else>▶</i><small>{{ name }}</small><em>×</em>
                </button>
                <button v-if="uploadedAudio" type="button" class="selected-reference-chip audio" :title="`移除音频：${uploadedAudio}`" @click="clearReference('audio')">
                  <i>♪</i><small>{{ uploadedAudio }}</small><em>×</em>
                </button>
              </div>
              <button type="button" class="selected-reference-add" title="管理参考素材" @click="showReferenceModal = true">＋</button>
            </div>
            <textarea ref="promptTextarea" v-model="prompt" maxlength="2000" placeholder="描述主体、场景、动作和镜头语言；也可直接粘贴图片" rows="3" @keydown="handlePromptKeydown"></textarea>
            <div class="prompt-tools">
              <button type="button" title="选择视频提示词模板" @click="showTemplateModal = true">
                <svg viewBox="0 0 24 24"><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/></svg>模板
              </button>
              <button type="button" title="使用 AI 生成或优化视频提示词" @click="openAiPromptAssistant">
                <svg viewBox="0 0 24 24"><path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/></svg>AI 提示词
              </button>
              <button v-if="maxReferenceImages || allowsVideoReference || allowsAudioReference" type="button" :class="{ active: activeReferenceCount }" @click="showReferenceModal = true">
                <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 16l4-4 3 3 4-5 5 6"/></svg>参考素材 <em v-if="activeReferenceCount">{{ activeReferenceCount }}</em>
              </button>
              <button v-if="selectedModel?.supportsStoryboard && inputType !== '首尾帧' && store.user.entitlements?.supportStoryboard !== false" type="button" :class="{ active: storyboardMode === 'custom' }" @click="storyboardMode = storyboardMode === 'custom' ? 'smart' : 'custom'">
                <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>{{ storyboardMode === 'custom' ? '自定义分镜' : '智能分镜' }}
              </button>
              <label v-if="selectedModel?.supportsAudioSync" class="prompt-inline-toggle" title="根据画面生成环境声与动作音效"><input type="checkbox" v-model="audioSync" /><span>生成声音</span></label>
              <label v-if="selectedModel?.supportsNegativePrompt" class="prompt-inline-input" title="输入不希望出现在视频中的内容"><span>反向提示</span><input v-model="negativePrompt" maxlength="1000" placeholder="模糊、畸变、水印" /></label>
              <span v-if="selectedModel?.supportsSubjects" class="prompt-inline-capability" title="参考素材将用于保持人物、商品或道具特征">主体一致</span>
              <span v-if="uploadingReferences" class="uploading-note">正在上传 {{ uploadingReferences }} 张图片…</span>
              <span class="paste-note">支持粘贴图片</span><span class="prompt-count">{{ prompt.length }}/2000</span>
              <button class="generate-button" @click="startGenerate" :disabled="generating || estimating || !prompt.trim() || uploadingReferences > 0 || !hasCompatibleModels"><svg v-if="!generating && !estimating" viewBox="0 0 24 24"><path d="M5 12h14m-5-5l5 5-5 5"/></svg>{{ generating ? '生成中…' : estimating ? '计算中…' : '生成' }}</button>
            </div>
          </div>

          <div v-if="storyboardMode === 'custom'" class="custom-storyboard">
          <div class="section-head-row">
            <div><h2>自定义分镜</h2><p>逐镜头控制画面内容与节奏。镜头总时长 {{ customDuration }} 秒，提交时仍以任务时长 {{ durationLabel }} 为准。</p></div>
            <button class="btn" @click="addShot">＋ 添加镜头</button>
          </div>
          <div class="shot-editor-list">
            <article v-for="(shot, index) in shots" :key="shot.id" class="shot-editor">
              <div class="shot-editor-head">
                <span class="shot-index">{{ index + 1 }}</span><strong>{{ shot.name || `镜头${index + 1}` }}</strong>
                <label class="shot-seconds"><input type="number" min="1" :max="seconds" v-model.number="shot.seconds" /> 秒</label>
                <button class="del-shot" title="删除镜头" @click="deleteShot(shot.id)">×</button>
              </div>
              <textarea v-model="shot.prompt" placeholder="描述这个镜头内你想要的内容" rows="3"></textarea>
            </article>
            <button v-if="!shots.length" class="empty-shot" @click="addShot"><strong>＋ 添加第一个镜头</strong><span>建议从主体出场、产品特写或场景建立开始</span></button>
          </div>
          </div>
        </div>
      </div>
    </main>
  </section>

  <!-- 参考素材选择 -->
  <Teleport to="body">
    <div v-if="showReferenceModal" class="video-modal-overlay" @click.self="showReferenceModal = false">
      <section class="reference-dialog" role="dialog" aria-modal="true" aria-labelledby="reference-dialog-title">
        <header class="video-dialog-header">
          <div><h3 id="reference-dialog-title">参考素材</h3><p>{{ operationRule.note || (needsImageReference || needsVideoReference ? '请补齐标记为必需的素材后再生成。' : '按需添加图片、视频或音频素材。') }}</p></div>
          <button type="button" title="关闭" aria-label="关闭" @click="showReferenceModal = false">×</button>
        </header>
        <div class="reference-dialog-body">
          <div class="section-title"><div><strong>输入素材</strong><span>可从素材库选择，也可从本地上传</span></div><button v-if="activeReferenceCount" @click="clearReference('image'); clearReference('video'); clearReference('audio')">清空</button></div>
          <div class="reference-row dynamic">
            <div v-for="slot in visibleImageSlots" :key="`modal-image-${slot}`" class="ref-card" :class="{ required: slot <= minReferenceImages, selected: referenceImageMaterialIds[slot - 1] }">
              <span class="ref-icon" :class="{ preview: referenceImagePreviews[slot - 1] }"><img v-if="referenceImagePreviews[slot - 1]" :src="referenceImagePreviews[slot - 1]" :alt="referenceImageNames[slot - 1] || '参考图片'" /><svg v-else viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 16l5-5 4 4 3-3 6 6"/></svg></span>
              <div><strong>{{ inputType === '首尾帧' ? (slot === 1 ? '首帧' : '尾帧') : inputType === '图生视频' ? '首帧图片' : `参考图 ${slot}` }} <em v-if="slot <= minReferenceImages">必需</em></strong><small>{{ referenceImageNames[slot - 1] || '选择或上传图片' }}</small></div>
              <button v-if="referenceImageMaterialIds[slot - 1]" class="clear-ref" title="移除图片" @click="removeReferenceImage(slot - 1)">×</button>
              <div v-else class="ref-actions"><button type="button" @click="openMaterialPicker('image')">素材库</button><label>本地上传<input type="file" accept="image/*" multiple hidden @change="onUploadImage" /></label></div>
            </div>
            <div v-for="slot in (allowsVideoReference ? maxReferenceVideos : 0)" :key="`modal-video-${slot}`" class="ref-card" :class="{ required: slot <= Number(operationRule.minVideos || 0), selected: referenceVideoMaterialIds[slot - 1] }">
              <span class="ref-icon" :class="{ preview: referenceVideoPreviews[slot - 1] }"><img v-if="referenceVideoPreviews[slot - 1]" :src="referenceVideoPreviews[slot - 1]" :alt="uploadedVideos[slot - 1] || '参考视频'" /><svg v-else viewBox="0 0 24 24"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 10l4-3v10l-4-3"/></svg></span>
              <div><strong>{{ inputType === '编辑视频' ? '待编辑视频' : inputType === '延长视频' ? '待延长视频' : `参考视频 ${slot}` }} <em v-if="slot <= Number(operationRule.minVideos || 0)">必需</em></strong><small>{{ uploadedVideos[slot - 1] || '选择或上传视频' }}</small></div>
              <button v-if="referenceVideoMaterialIds[slot - 1]" class="clear-ref" title="移除视频" @click="removeReferenceVideo(slot - 1)">×</button>
              <div v-else class="ref-actions"><button type="button" @click="openMaterialPicker('video')">素材库</button><label>本地上传<input type="file" accept="video/*" multiple hidden @change="onUploadVideo" /></label></div>
            </div>
            <div v-if="allowsAudioReference" class="ref-card" :class="{ selected: uploadedAudio }"><span class="ref-icon">♪</span><div><strong>参考音频</strong><small>{{ uploadedAudio || '选择或上传音乐、节奏素材' }}</small></div><button v-if="uploadedAudio" class="clear-ref" title="移除音频" @click="clearReference('audio')">×</button><div v-else class="ref-actions"><button type="button" @click="openMaterialPicker('audio')">素材库</button><label>本地上传<input type="file" accept="audio/*" hidden @change="onUploadAudio" /></label></div></div>
          </div>
        </div>
        <footer class="video-dialog-actions"><button type="button" class="video-primary-action" @click="showReferenceModal = false">完成</button></footer>
      </section>
    </div>
  </Teleport>

  <!-- 视频提示词模板 -->
  <Teleport to="body">
    <div v-if="showTemplateModal" class="video-modal-overlay" @click.self="showTemplateModal = false">
      <section class="video-template-dialog" role="dialog" aria-modal="true" aria-labelledby="video-template-title">
        <header class="video-dialog-header">
          <div><h3 id="video-template-title">提示词模板</h3><p>选择常用视频场景，快速建立可继续编辑的提示词。</p></div>
          <button type="button" title="关闭" aria-label="关闭" @click="showTemplateModal = false">×</button>
        </header>
        <div class="video-template-list">
          <article v-for="template in videoPromptTemplates" :key="template.id" class="video-template-item" role="button" tabindex="0" @click="applyVideoTemplate(template)" @keydown.enter="applyVideoTemplate(template)">
            <span><strong>{{ template.name }}</strong><em>{{ template.scene }}</em></span>
            <p>{{ template.text }}</p>
            <button v-if="!template.builtIn" type="button" class="video-template-delete" title="删除自定义模板" aria-label="删除自定义模板" @click.stop="deleteVideoTemplate(template.id)">×</button>
          </article>
        </div>
        <div class="video-template-create">
          <button type="button" class="video-text-action" @click="showAddTemplateForm = !showAddTemplateForm">{{ showAddTemplateForm ? '收起新增' : '+ 新增模板' }}</button>
          <div v-if="showAddTemplateForm" class="video-template-form">
            <input v-model="newVideoTemplate.name" maxlength="30" placeholder="模板名称" />
            <input v-model="newVideoTemplate.scene" maxlength="20" placeholder="场景标签（可选）" />
            <textarea v-model="newVideoTemplate.text" maxlength="2000" rows="4" placeholder="视频提示词内容"></textarea>
            <button type="button" class="video-primary-action" @click="addVideoTemplate">保存模板</button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>

  <!-- AI 视频提示词助手 -->
  <Teleport to="body">
    <div v-if="showAiPromptModal" class="video-modal-overlay ai-video-overlay" @click.self="!aiPromptLoading && (showAiPromptModal = false)">
      <section class="video-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="video-ai-prompt-title">
        <header class="video-dialog-header">
          <div><h3 id="video-ai-prompt-title">AI 提示词助手</h3><p>把简单想法整理成包含动作、镜头和节奏的专业视频提示词。</p></div>
          <button type="button" title="关闭" aria-label="关闭" :disabled="aiPromptLoading" @click="showAiPromptModal = false">×</button>
        </header>
        <div class="video-ai-mode" role="tablist" aria-label="AI 提示词处理方式">
          <button type="button" role="tab" :aria-selected="aiPromptMode === 'generate'" :class="{ active: aiPromptMode === 'generate' }" @click="switchAiPromptMode('generate')">智能生成</button>
          <button type="button" role="tab" :aria-selected="aiPromptMode === 'optimize'" :class="{ active: aiPromptMode === 'optimize' }" @click="switchAiPromptMode('optimize')">优化现有</button>
        </div>
        <label class="video-ai-field">
          <span>{{ aiPromptMode === 'generate' ? '描述你的视频创意' : '需要优化的提示词' }}</span>
          <textarea v-model="aiPromptInput" maxlength="2000" rows="5"
            :placeholder="aiPromptMode === 'generate' ? '例如：银色保温杯放在清晨露营桌上，镜头从环境缓慢推进到杯身细节' : '输入或粘贴已有提示词，AI 将保留原意并补全动作、镜头与节奏'"></textarea>
          <small>{{ aiPromptInput.length }}/2000</small>
        </label>
        <div v-if="aiPromptResult" class="video-ai-result">
          <div><strong>生成结果</strong><span>可编辑后再应用</span></div>
          <textarea v-model="aiPromptResult" maxlength="2000" rows="6"></textarea>
        </div>
        <footer class="video-dialog-actions">
          <button type="button" :disabled="aiPromptLoading" @click="showAiPromptModal = false">取消</button>
          <button type="button" class="video-ai-run" :disabled="aiPromptLoading || aiPromptInput.trim().length < 2" @click="runAiPromptAssistant">
            {{ aiPromptLoading ? 'AI 处理中...' : aiPromptResult ? '重新生成' : aiPromptMode === 'generate' ? '生成提示词' : '开始优化' }}
          </button>
          <button v-if="aiPromptResult" type="button" class="video-primary-action" :disabled="aiPromptLoading" @click="applyAiPrompt">应用到输入框</button>
        </footer>
      </section>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="showMaterialPicker" class="fixed inset-0 z-[250] flex items-center justify-center bg-black/40" @click.self="showMaterialPicker = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-2xl max-h-[75vh] flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <div><h3 class="text-lg font-bold text-gray-800">选择{{ materialPickerType === 'image' ? '图片' : materialPickerType === 'video' ? '视频' : '音频' }}素材</h3><p class="text-xs text-gray-400 mt-1">从团队素材库选择参考内容</p></div>
          <button class="btn" @click="showMaterialPicker = false">关闭</button>
        </div>
        <div v-if="materialLoading" class="text-center py-12 text-gray-400">加载中...</div>
        <div v-else-if="pickerMaterials.length" class="material-picker-grid">
          <button v-for="item in pickerMaterials" :key="item.id" class="material-picker-item" @mouseenter="item.type === 'video' && (hoveredPickerVideoId = item.id)" @mouseleave="hoveredPickerVideoId = null" @click="selectReferenceMaterial(item)">
            <span class="picker-media">
              <img v-if="item.type === 'image' && (item.thumbnailUrl || item.fileUrl || item.previewUrl)" :src="item.thumbnailUrl || item.fileUrl || item.previewUrl || ''" :alt="item.title" loading="lazy" />
              <img v-else-if="item.type === 'video' && item.thumbnailUrl" :src="item.thumbnailUrl" :alt="`${item.title}视频首帧`" loading="lazy" />
              <video v-if="item.type === 'video' && hoveredPickerVideoId === item.id && (item.previewUrl || item.fileUrl)" :src="item.previewUrl || item.fileUrl || ''" :poster="item.thumbnailUrl || undefined" autoplay muted loop playsinline preload="metadata"></video>
              <span v-if="item.type === 'video'" class="picker-play">▶</span>
              <span v-if="item.type === 'audio' || (item.type === 'video' && !item.thumbnailUrl)" class="material-video-icon">{{ item.type === 'video' ? '▶' : '♪' }}</span>
            </span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.type === 'image' ? '图片' : item.type === 'video' ? '视频' : '音频' }} · {{ Math.max(1, Math.round(item.fileSize / 1024)) }}KB</small>
          </button>
        </div>
        <div v-else class="text-center py-12 text-gray-400">素材库暂无可用内容</div>
      </div>
    </div>
  </Teleport>

  <!-- 预估弹窗 -->
  <Teleport to="body">
    <div v-if="showEstimate" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" @click.self="showEstimate = false">
      <div class="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <h3 class="text-lg font-bold text-gray-800 mb-4">生成预估</h3>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between"><span class="text-gray-500">生成内容</span><strong>视频 · {{ seconds }}s · {{ ratioDisplayLabel }}</strong></div>
          <div class="flex justify-between"><span class="text-gray-500">模型</span><strong>{{ selectedModel?.name }}</strong></div>
          <div class="flex justify-between"><span class="text-gray-500">清晰度</span><strong>{{ qualityLabel }}</strong></div>
          <div v-if="audioSync" class="flex justify-between"><span class="text-gray-500">声音</span><strong>生成声音</strong></div>
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
          <button v-else class="btn primary flex-1" @click="confirmGenerate">确认生成</button>
          <button class="btn flex-1" @click="showEstimate = false">取消</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 视频预览 -->
  <Teleport to="body">
    <div v-if="zoomAsset" class="video-preview-overlay" role="dialog" aria-modal="true" aria-label="视频预览" @click.self="closePreview">
      <div class="video-preview-modal" :class="{ 'is-portrait': previewAspectRatio < 1 }">
        <div class="video-preview-canvas" :style="{ '--preview-aspect-ratio': String(previewAspectRatio) }">
          <button class="video-preview-close" type="button" title="关闭预览" aria-label="关闭预览" @click="closePreview">×</button>
          <video ref="previewVideo" :src="zoomAsset.urls?.[0] || zoomAsset.fileUrl" :style="previewVideoStyle" controls autoplay playsinline preload="metadata"
            @loadedmetadata="onPreviewMetadata" @canplay="previewLoading = false"
            @error="previewLoading = false; previewError = '视频加载失败，请刷新后重试'" />
          <div v-if="previewLoading" class="video-preview-status"><span></span><p>正在加载视频...</p></div>
          <div v-if="previewError" class="video-preview-status error"><p>{{ previewError }}</p><button @click="closePreview">关闭</button></div>
        </div>
        <div class="video-preview-info">
          <div><strong>{{ zoomAsset.prompt || zoomAsset.title }}</strong><p>{{ zoomAsset.model || zoomAsset.source }}<span v-if="zoomAsset.seconds"> · {{ zoomAsset.seconds }}s</span><span> · {{ zoomAsset.cost || 0 }} 积分</span></p></div>
          <div class="video-preview-actions"><button class="btn" @click="downloadImage(zoomAsset)">下载</button><button class="btn primary" @click="closePreview">关闭</button></div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.studio{display:grid;grid-template-columns:256px minmax(0,1fr);height:calc(100vh - 108px);min-height:560px;background:#f7f8fa;border:1px solid #e4e7ec;border-radius:16px;overflow:hidden;transition:grid-template-columns .18s ease}
.studio.history-collapsed{grid-template-columns:58px minmax(0,1fr)}
.history{min-width:0;background:#fff;border-right:1px solid #e4e7ec;padding:18px 14px;overflow:hidden}
.history-top{display:grid;grid-template-columns:1fr 36px;gap:8px}.history-toggle{border:1px solid #e4e7ec;background:#fff;border-radius:8px;display:grid;place-items:center;cursor:pointer}.history-toggle svg{width:17px;fill:none;stroke:#667085;stroke-width:2}.history-collapsed .history-toggle svg{transform:rotate(180deg)}
.history-heading{display:flex;align-items:center;justify-content:space-between;margin:18px 7px 8px}.history-heading h3{margin:0;color:#667085;font-size:12px;font-weight:800}.history-heading>span{min-width:20px;padding:2px 6px;border-radius:999px;background:#e9ecf1;color:#7c879b;font-size:10px;text-align:center}.history-list{display:grid;gap:3px;overflow-y:auto;max-height:calc(100% - 86px);padding:2px}.history-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 30px;align-items:center;border-radius:7px}.history-row:hover{background:#eef0f4}.history-row.active{background:#ecebff;box-shadow:inset 3px 0 0 #5b4eff}.history-main{min-width:0;display:grid;grid-template-columns:8px minmax(0,1fr);gap:9px;align-items:center;border:0;background:transparent;padding:10px 4px 10px 9px;text-align:left;cursor:pointer}.status-dot{width:7px;height:7px;border-radius:50%;background:#c3c8d2}.status-dot.completed{background:#22a06b}.status-dot.failed{background:#e5484d}.status-dot.processing,.status-dot.queued,.status-dot.pending{background:#e59a19}.history-copy{min-width:0;display:grid;gap:3px}.history-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#3b4352;font-size:12px;font-weight:700}.history-subline{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center}.history-subline small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7c879b;font-size:10px}.history-subline time{color:#a6adba;font-size:9px;white-space:nowrap}.delete-history{width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:6px;background:transparent;color:#98a2b3;cursor:pointer;opacity:0}.history-row:hover .delete-history,.delete-history:focus-visible{opacity:1}.delete-history:hover{background:#fff;color:#d92d20}.delete-history svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.history-collapsed .history{padding:14px 10px}.history-collapsed .history-top{display:block}.history-collapsed .history .btn.primary,.history-collapsed .history-heading,.history-collapsed .history-list{display:none}
.guest-history{width:100%;display:grid;gap:4px;border:1px dashed #cfd4df;border-radius:7px;background:#fff;padding:12px;text-align:left;cursor:pointer}.guest-history strong{color:#4f46e5;font-size:11px}.guest-history span{color:#98a2b3;font-size:10px;line-height:1.45}
.studio-main{min-width:0;display:grid;grid-template-rows:minmax(180px,1fr) auto;overflow:hidden}.result-stage{padding:24px 28px;overflow-y:auto;min-height:0}
.gallery-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.gallery-card{min-width:0;border:1px solid #e4e7ec;border-radius:10px;overflow:hidden;background:#fff}.gallery-card.active{border-color:#7c73ff;box-shadow:0 0 0 2px rgba(91,78,255,.12)}.gallery-visual{aspect-ratio:16/9;background:#17191f;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}.gallery-visual video{width:100%;height:100%;object-fit:contain}.gallery-placeholder{width:100%;height:100%;position:relative;background:#20232b}.gallery-placeholder span{position:absolute;width:34%;height:50%;left:15%;bottom:16%;border:1px solid #4c5260}.gallery-placeholder i{position:absolute;width:32%;height:42%;right:12%;top:18%;background:#2c313c}.gallery-placeholder b{position:absolute;width:38%;height:5px;left:31%;top:30%;background:#3b4250}.play-icon{position:absolute;inset:0;margin:auto;width:44px;height:44px;border-radius:50%;background:#fff;display:grid;place-items:center;font-style:normal;color:#101828}.play-badge,.pending-badge{position:absolute;top:10px;right:10px;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:700}.play-badge{background:rgba(16,24,40,.72);color:#fff}.pending-badge{background:#fff7ed;color:#c2410c}.gallery-info{padding:14px}.gallery-info h3{font-size:14px;font-weight:800;margin:0 0 8px;color:#1d2939;line-height:1.5}.gallery-meta{display:flex;gap:6px;align-items:center;font-size:11px;color:#98a2b3;margin-bottom:12px;flex-wrap:wrap}.gallery-meta .tag{background:#f2f4f7;color:#475467;padding:3px 7px;border-radius:5px;font-weight:700}.gallery-actions{display:flex;gap:6px;flex-wrap:wrap}.btn-sm{border:1px solid #e4e7ec;background:#fff;border-radius:6px;padding:6px 9px;font-weight:700;cursor:pointer;color:#475467;font-size:11px}.btn-sm:hover{border-color:#7c73ff;color:#5145cd}.btn-sm.primary{background:#5b4eff;color:#fff;border-color:#5b4eff}.btn-sm.danger:hover{border-color:#ef4444;color:#ef4444}
.empty-state{height:100%;min-height:250px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px}.empty-visual{width:210px;height:118px;border-radius:12px;background:#181b22;position:relative;box-shadow:0 18px 40px rgba(16,24,40,.16)}.empty-frame{position:absolute;inset:14px 16px;border:1px solid #3e4654;border-radius:7px;overflow:hidden}.empty-frame i{position:absolute;width:44%;height:68%;left:7%;bottom:0;background:#262b35;transform:skew(-8deg)}.empty-frame b{position:absolute;width:55%;height:1px;background:#596273;right:5%;top:28%;box-shadow:0 14px 0 #3f4755,0 28px 0 #303743}.empty-play{position:absolute;width:42px;height:42px;border-radius:50%;background:#7cfc6a;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;box-shadow:0 0 0 7px rgba(124,252,106,.12)}.empty-play svg{width:20px;fill:#111827}.empty-kicker{margin-top:18px;font-size:10px;font-weight:900;color:#7c73ff;letter-spacing:1px}.empty-state h2{font-size:20px;color:#1d2939;margin:6px 0}.empty-state p{color:#667085;font-size:13px;line-height:1.7;max-width:530px;margin:0}.empty-steps{display:flex;gap:16px;margin-top:13px;color:#98a2b3;font-size:11px}.empty-steps span+span:before{content:'·';margin-right:16px}.skeleton-card{border-style:dashed}.skeleton-img{min-height:180px}.shimmer{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);animation:shimmer 1.5s infinite}@keyframes shimmer{from{transform:translateX(-100%)}to{transform:translateX(100%)}}.skeleton-line{height:12px;border-radius:4px;background:#edf0f5;margin-bottom:8px}.skeleton-line.short{width:60%}.skeleton-bar{height:4px;background:#edf0f5;margin-top:10px}.loadbar{height:100%;background:#5b4eff;animation:load 1.5s infinite}@keyframes load{from{width:0}to{width:100%}}.skeleton-text{font-size:11px;color:#98a2b3}
.video-panel{margin:0 20px 20px;border:1px solid #d9dee8;border-radius:12px;background:#fff;box-shadow:0 12px 32px rgba(16,24,40,.08);padding:16px;display:grid;gap:12px;max-height:55vh;overflow-y:auto}.composer-head{display:flex;justify-content:space-between;gap:16px;align-items:center}.composer-head>div:first-child span{display:block;font-size:11px;color:#98a2b3}.composer-head strong{font-size:14px;color:#1d2939}.composer-summary{display:flex;gap:6px}.composer-summary span{background:#f2f4f7;border-radius:5px;padding:4px 7px;color:#667085;font-size:11px;font-weight:700}
.primary-controls{display:grid;grid-template-columns:minmax(200px,1.4fr) repeat(3,minmax(110px,.65fr));gap:8px}.select-field{min-width:0;border:1px solid #e4e7ec;border-radius:8px;background:#fff;padding:7px 10px}.select-field>span,.setting-field>span{display:block;color:#98a2b3;font-size:10px;font-weight:700;margin-bottom:2px}.select-field select{width:100%;border:0;background:transparent;outline:0;color:#344054;font-size:12px;font-weight:800;cursor:pointer}.model-field{border-color:#c9c5ff;background:#f8f7ff}.model-field select{color:#5145cd}
.prompt-box{border:1px solid #d0d5dd;border-radius:10px;overflow:hidden;transition:border-color .15s}.prompt-box:focus-within{border-color:#7c73ff;box-shadow:0 0 0 3px rgba(91,78,255,.08)}.prompt-box textarea{border:0;outline:0;resize:none;min-height:70px;font-size:14px;line-height:1.65;width:100%;background:#fff;padding:12px 14px;color:#1d2939}.prompt-tools{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:7px 9px;border-top:1px solid #eaecf0;background:#fafbfc}.prompt-tools button{display:flex;align-items:center;gap:5px;border:0;background:transparent;border-radius:6px;padding:6px 8px;color:#667085;font-size:11px;font-weight:800;cursor:pointer}.prompt-tools button:hover,.prompt-tools button.active{background:#eef2ff;color:#5145cd}.prompt-tools svg{width:15px;fill:none;stroke:currentColor;stroke-width:1.8}.prompt-tools em{font-style:normal;background:#5b4eff;color:#fff;border-radius:9px;min-width:17px;height:17px;display:grid;place-items:center}.prompt-count{margin-left:auto;color:#98a2b3;font-size:10px}.prompt-inline-toggle,.prompt-inline-input,.prompt-inline-capability{height:30px;display:flex;align-items:center;gap:6px;border:1px solid #e1e5eb;border-radius:6px;background:#fff;padding:0 8px;color:#667085;font-size:10px;font-weight:800}.prompt-inline-toggle{cursor:pointer}.prompt-inline-toggle input{margin:0;accent-color:#5b4eff}.prompt-inline-input{min-width:180px}.prompt-inline-input span{flex:0 0 auto}.prompt-inline-input input{width:118px;min-width:0;border:0;outline:0;background:transparent;color:#344054;font-size:10px}.prompt-inline-input:focus-within{border-color:#8f88ff;box-shadow:0 0 0 2px rgba(91,78,255,.07)}.prompt-inline-capability{background:#f8f7ff;color:#5145cd}
.selected-reference-strip{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #eaecf0;background:#fafbfc}.selected-reference-strip>span{flex:0 0 auto;color:#667085;font-size:10px;font-weight:800}.selected-reference-list{min-width:0;display:flex;align-items:center;gap:6px;overflow-x:auto}.selected-reference-chip{height:34px;max-width:180px;display:flex;align-items:center;gap:6px;flex:0 0 auto;border:1px solid #e1e5eb;border-radius:6px;padding:3px 7px 3px 3px;background:#fff;color:#475467;cursor:pointer}.selected-reference-chip:hover{border-color:#fda29b;background:#fff8f7}.selected-reference-chip img,.selected-reference-chip i{width:26px;height:26px;flex:0 0 26px;border-radius:4px;object-fit:cover}.selected-reference-chip i{display:grid;place-items:center;background:#eef2ff;color:#5145cd;font-size:10px;font-style:normal;font-weight:900}.selected-reference-chip small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.selected-reference-chip em{color:#98a2b3;font-size:14px;font-style:normal}.selected-reference-add{width:30px;height:30px;flex:0 0 30px;border:1px dashed #b8b3f8;border-radius:6px;background:#f8f7ff;color:#5145cd;font-size:17px;cursor:pointer}.selected-reference-add:hover{border-style:solid;background:#efedff}
.custom-storyboard{border-top:1px solid #eaecf0;padding-top:12px}.section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.section-title>div{display:flex;align-items:baseline;gap:8px}.section-title strong{font-size:12px;color:#344054}.section-title span{font-size:10px;color:#98a2b3}.section-title>button{border:0;background:transparent;color:#667085;font-size:10px;cursor:pointer}.reference-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.ref-card{min-width:0;min-height:58px;border:1px dashed #d0d5dd;background:#fff;border-radius:8px;padding:8px 9px;display:flex;align-items:center;gap:8px;color:#475467}.ref-card.required{border-color:#f59e0b;background:#fffbeb}.ref-card.selected{border-style:solid;border-color:#86efac;background:#f7fef9}.ref-icon{width:30px;height:30px;border-radius:7px;background:#f2f4f7;display:grid;place-items:center;flex:0 0 auto}.ref-icon svg{width:17px;fill:none;stroke:#667085;stroke-width:1.8}.ref-card>div:nth-child(2){min-width:0;flex:1}.ref-card strong{display:block;font-size:11px}.ref-card strong em{font-style:normal;color:#b54708;font-size:9px}.ref-card small{display:block;color:#98a2b3;font-size:9px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ref-actions{display:flex;gap:4px}.ref-actions button,.ref-actions label{border:1px solid #e4e7ec;background:#fff;border-radius:5px;padding:5px 6px;font-size:9px;font-weight:700;color:#475467;cursor:pointer;white-space:nowrap}.clear-ref{border:0;background:transparent;color:#98a2b3;font-size:18px;cursor:pointer}
.advanced-settings{display:grid;grid-template-columns:160px 170px 210px minmax(260px,1fr);gap:10px;align-items:center}.advanced-empty{grid-column:1/-1;padding:10px;border:1px dashed #d0d5dd;border-radius:7px;background:#fafbfc;color:#98a2b3;font-size:10px;text-align:center}.setting-field{min-width:0}.quality{display:flex;gap:3px;background:#f2f4f7;border-radius:7px;padding:3px}.quality button{flex:1;border:0;background:transparent;border-radius:5px;padding:6px;font-size:10px;font-weight:800;cursor:pointer}.quality button.active{background:#1d2939;color:#fff}.toggle-field{display:flex;align-items:center;justify-content:space-between;border:1px solid #eaecf0;border-radius:7px;padding:8px 10px;background:#fafbfc}.toggle-field strong,.toggle-field small{display:block}.toggle-field strong{font-size:11px}.toggle-field small{font-size:9px;color:#98a2b3}.toggle-field input{accent-color:#5b4eff}.subject-setting{display:flex;align-items:center;gap:8px}.subject-list{display:flex;gap:4px;flex-wrap:wrap}.subject-list button{border:1px solid #e4e7ec;background:#fff;border-radius:6px;padding:5px 7px;display:flex;align-items:center;gap:5px;color:#475467;font-size:10px;font-weight:800;cursor:pointer}.subject-list button.active{border-color:#a7a1ff;background:#eef2ff;color:#5145cd}.subject-list i{width:14px;height:14px;border-radius:4px}.subject-list i.product{background:#60a5fa}.subject-list i.model{background:#f472b6}.subject-list i.scene{background:#34d399}.subject-list i.brand{background:#344054}.subject-list em{font-style:normal}
.prompt-tools .generate-button{height:30px;min-width:76px;border:0;border-radius:6px;padding:0 11px;background:#5b4eff;color:#fff;font-size:11px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}.prompt-tools .generate-button:hover{background:#493bd5;color:#fff}.prompt-tools .generate-button:disabled{background:#d0d5dd;color:#fff;cursor:not-allowed}.prompt-tools .generate-button svg{width:14px;fill:none;stroke:currentColor;stroke-width:2}
.section-head-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}.section-head-row h2{font-size:14px;margin:0}.section-head-row p{margin:3px 0 0;color:#98a2b3;font-size:10px}.shot-editor-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.shot-editor{border:1px solid #e4e7ec;border-radius:8px;background:#fafbfc;padding:10px}.shot-editor-head{display:flex;align-items:center;gap:7px;margin-bottom:7px}.shot-index{width:22px;height:22px;border-radius:5px;background:#1d2939;color:#fff;display:grid;place-items:center;font-size:10px}.shot-editor-head strong{font-size:11px}.shot-seconds{margin-left:auto;border:1px solid #e4e7ec;background:#fff;border-radius:5px;padding:4px 6px;font-size:9px}.shot-seconds input{width:28px;border:0;outline:0;font-size:10px;text-align:right}.del-shot{border:0;background:transparent;color:#98a2b3;font-size:16px;cursor:pointer}.shot-editor textarea{width:100%;min-height:54px;border:1px solid #e4e7ec;border-radius:6px;background:#fff;padding:8px;resize:vertical;outline:0;font-size:11px}.empty-shot{grid-column:1/-1;border:1px dashed #c7cbd3;border-radius:8px;background:#fafbfc;padding:16px;cursor:pointer;color:#475467}.empty-shot strong,.empty-shot span{display:block}.empty-shot span{font-size:10px;color:#98a2b3;margin-top:3px}
.material-picker-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;overflow-y:auto}.material-picker-item{border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:8px;text-align:left;cursor:pointer;min-width:0}.material-picker-item:hover{border-color:#5b4eff}.material-picker-item img,.material-video-icon{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;background:#f3f4f6;display:grid;place-items:center;margin-bottom:8px}.material-picker-item strong,.material-picker-item small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.material-picker-item strong{font-size:12px}.material-picker-item small{font-size:10px;color:#98a2b3;margin-top:3px}.btn{border:1px solid #e4e7ec;background:#fff;border-radius:7px;padding:8px 12px;font-weight:800;cursor:pointer;color:#475467;font-size:11px}.btn.primary{background:#5b4eff;color:#fff;border-color:#5b4eff}.btn.primary span{font-size:15px}.btn:disabled{opacity:.5}
.video-panel{min-width:0;overflow-x:hidden}.video-panel>*{min-width:0;max-width:100%}.primary-controls{width:100%;grid-template-columns:minmax(0,1.4fr) repeat(3,minmax(0,.65fr))}.select-field{overflow:hidden}.select-field select{min-width:0;text-overflow:ellipsis}.advanced-settings{width:100%;grid-template-columns:minmax(0,.8fr) minmax(0,.85fr) minmax(0,1fr) minmax(0,1.4fr)}
@media(max-width:1200px){.studio{grid-template-columns:220px minmax(0,1fr)}.primary-controls{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.reference-row{grid-template-columns:1fr}.advanced-settings{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.gallery-grid{grid-template-columns:1fr}}
@media(max-width:820px){.studio{height:auto;min-height:calc(100vh - 92px);grid-template-columns:1fr}.history{display:block;padding:10px;border-right:0;border-bottom:1px solid #e4e7ec}.history-heading{margin:10px 5px 6px}.history-list{display:flex;gap:6px;max-height:none;overflow-x:auto;padding-bottom:4px}.history-row{flex:0 0 230px}.studio-main{grid-template-rows:minmax(300px,auto) auto}.result-stage{padding:18px}.video-panel{margin:0 10px 12px;max-height:none}.primary-controls,.advanced-settings{grid-template-columns:1fr 1fr}.composer-head{align-items:flex-start}.composer-summary{display:none}.prompt-tools{flex-wrap:wrap}.prompt-count{display:none}.shot-editor-list{grid-template-columns:1fr}}
.video-failed-state{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:22px;background:#211d20;text-align:center}.video-failed-state svg{width:32px;height:32px;fill:none;stroke:#fb7185;stroke-width:1.7}.video-failed-state strong{color:#fff;font-size:13px}.video-failed-state small{max-width:340px;color:#fda4af;font-size:10px;line-height:1.55}.failed-badge{position:absolute;top:10px;right:10px;border-radius:6px;padding:5px 8px;background:#fef2f2;color:#b42318;font-size:11px;font-weight:800}.video-visual.failed{border:1px solid #4c2730}
.video-preview-overlay{position:fixed;inset:0;z-index:300;background:rgba(8,11,18,.88);display:grid;place-items:center;padding:16px;overflow:auto}.video-preview-modal{width:min(1080px,calc(100vw - 32px));height:min(820px,calc(100dvh - 32px));max-height:calc(100dvh - 32px);display:grid;grid-template-rows:minmax(0,1fr) auto;background:#11151d;border:1px solid #303744;border-radius:12px;overflow:hidden;box-shadow:0 28px 80px rgba(0,0,0,.45);transition:width .18s ease}.video-preview-modal.is-portrait{width:min(520px,calc(100vw - 32px))}.video-preview-canvas{position:relative;width:100%;height:100%;min-height:0;overflow:hidden;background:#05070a;display:grid;place-items:center}.video-preview-canvas video{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain}.video-preview-modal.is-portrait .video-preview-canvas video{width:auto;height:auto;max-width:100%;max-height:100%;aspect-ratio:auto;object-fit:contain}.video-preview-close{position:absolute;z-index:3;top:12px;right:12px;width:36px;height:36px;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:rgba(15,18,25,.72);color:#fff;font-size:24px;line-height:1;display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(8px)}.video-preview-close:hover{background:rgba(255,255,255,.18)}.video-preview-info{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 16px;background:#fff}.video-preview-info>div:first-child{min-width:0}.video-preview-info strong{display:block;color:#1d2939;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.video-preview-info p{margin:4px 0 0;color:#98a2b3;font-size:11px}.video-preview-actions{display:flex;gap:8px;flex:0 0 auto}.video-preview-status{position:absolute;inset:0;background:rgba(5,7,10,.82);display:grid;place-content:center;justify-items:center;color:#fff;gap:10px}.video-preview-status span{width:28px;height:28px;border:3px solid #667085;border-top-color:#7cfc6a;border-radius:50%;animation:spin .8s linear infinite}.video-preview-status p{margin:0;font-size:12px}.video-preview-status.error{color:#fecaca}.video-preview-status.error button{border:1px solid #667085;background:#202632;color:#fff;border-radius:6px;padding:7px 14px;cursor:pointer}@media(max-width:640px){.video-preview-overlay{padding:8px}.video-preview-modal,.video-preview-modal.is-portrait{width:calc(100vw - 16px);height:calc(100dvh - 16px);max-height:calc(100dvh - 16px)}.video-preview-info{align-items:flex-start;gap:10px;padding:12px;flex-direction:column}.video-preview-info strong{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.video-preview-actions{width:100%}.video-preview-actions .btn{flex:1}.video-preview-close{top:8px;right:8px}}@keyframes spin{to{transform:rotate(360deg)}}
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
.history-search{height:34px;display:grid;grid-template-columns:16px minmax(0,1fr) 22px;align-items:center;gap:6px;margin:0 2px 8px;padding:0 7px;border:1px solid #d9dde5;border-radius:7px;background:#fff;color:#98a2b3}.history-search:focus-within{border-color:#8f88ff;box-shadow:0 0 0 3px rgba(91,78,255,.08)}.history-search svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}.history-search input{min-width:0;width:100%;height:30px;padding:0;border:0;background:transparent;color:#344054;font-size:11px;outline:0}.history-search input::-webkit-search-cancel-button{display:none}.history-search button{width:22px;height:22px;display:grid;place-items:center;border:0;border-radius:5px;background:transparent;color:#98a2b3;font-size:17px;line-height:1;cursor:pointer}.history-search button:hover{background:#f2f4f7;color:#475467}.history-feedback{min-height:92px;display:grid;place-content:center;justify-items:center;gap:7px;padding:12px;color:#98a2b3;text-align:center}.history-feedback p{margin:0;font-size:11px}.history-feedback button{border:0;background:transparent;color:#5b4eff;font-size:11px;font-weight:700;cursor:pointer}.history-spinner{width:18px;height:18px;border:2px solid #e4e7ec;border-top-color:#5b4eff;border-radius:50%;animation:history-spin .7s linear infinite}.history-collapsed .history-search{display:none}.history-search+.history-list{max-height:calc(100% - 128px)}.history-collapsed .history-toggle svg{transform:none}@keyframes history-spin{to{transform:rotate(360deg)}}@media(max-width:820px){.history-search+.history-list{max-height:none}}
</style>

<style scoped>
.product-context{display:grid;grid-template-columns:40px auto 1fr 28px;align-items:center;gap:9px;padding:8px;border:1px solid #dcd9ff;border-radius:8px;background:#f8f7ff}.product-context>img{width:40px;height:40px;border-radius:6px;object-fit:cover;background:#fff}.product-context>span small,.product-context>span strong{display:block}.product-context>span small{font-size:9px;color:#8b85c7}.product-context>span strong{font-size:11px;color:#373076}.product-context>em{font-size:10px;color:#7772a7;font-style:normal}.product-context>button{width:28px;height:28px;border:0;border-radius:5px;background:transparent;color:#8d89aa;cursor:pointer}.product-context>button:hover{background:#eceaff;color:#5146e5}
</style>

<style scoped>
.video-panel{transition:max-height .2s ease,padding .2s ease,box-shadow .2s ease}
.video-panel.collapsed{max-height:none;overflow:hidden;padding:9px 12px;gap:0;box-shadow:0 7px 18px rgba(16,24,40,.07)}
.video-panel .composer-head{min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto 34px;align-items:center;gap:12px}
.composer-body{min-width:0;display:grid;gap:12px}
.composer-collapsed-copy{min-width:0;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:12px;border:0;background:transparent;padding:0;text-align:left;cursor:pointer}
.composer-collapsed-copy strong{font-size:11px;white-space:nowrap}
.composer-collapsed-copy span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#98a2b3;font-size:11px}
.composer-toggle{grid-column:3;width:34px;height:34px;display:grid;place-items:center;border:1px solid #e1e5eb;border-radius:6px;background:#fff;color:#667085;cursor:pointer}
.composer-toggle:hover{border-color:#aaa5ff;color:#5147d8}
.composer-toggle svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.creation-mode-tabs{display:flex;align-items:center;gap:6px;overflow-x:auto;padding:1px 0 3px;scrollbar-width:thin}
.creation-mode-tabs button{height:34px;flex:0 0 auto;border:1px solid #dfe3ea;border-radius:7px;background:#fff;padding:0 13px;color:#5f6b7d;font-size:11px;font-weight:800;cursor:pointer}
.creation-mode-tabs button:hover{border-color:#a9a3ff;color:#5145cd}
.creation-mode-tabs button.active{border-color:#5b4eff;background:#5b4eff;color:#fff;box-shadow:0 4px 10px rgba(91,78,255,.18)}
.creation-mode-tabs button.secondary{border-style:dashed}
.creation-mode-tabs button.secondary.active{border-style:solid}
.reference-row.dynamic{grid-template-columns:repeat(auto-fit,minmax(235px,1fr))}
.paste-note,.uploading-note{margin-left:2px;color:#98a2b3;font-size:10px;white-space:nowrap}
.uploading-note{color:#5145cd;font-weight:700}
.negative-field{min-width:0;display:grid;grid-template-columns:86px minmax(0,1fr);align-items:center;gap:9px}
.negative-field span{color:#475467;font-size:11px;font-weight:800}
.negative-field input{height:34px;min-width:0;border:1px solid #e1e5eb;border-radius:6px;padding:0 9px;outline:0;color:#344054;font-size:11px}
.negative-field input:focus{border-color:#8f88ff;box-shadow:0 0 0 3px rgba(91,78,255,.07)}
.capability-note{display:flex;align-items:center;gap:8px;padding:9px 10px;border-left:3px solid #8b83ff;background:#f8f7ff;color:#6f6a91;font-size:10px}
.capability-note strong{color:#403985;font-size:11px}
.ref-icon{width:38px;height:38px;overflow:hidden}
.ref-icon.preview{background:#e9edf3}
.ref-icon img{width:100%;height:100%;display:block;object-fit:cover}
.picker-media{position:relative;width:100%;aspect-ratio:4/3;display:grid;place-items:center;margin-bottom:8px;overflow:hidden;border-radius:6px;background:#111827}
.material-picker-item .picker-media>img,.material-picker-item .picker-media>video{position:absolute;inset:0;width:100%;height:100%;margin:0;object-fit:cover;border-radius:0;background:#111827}
.material-picker-item .picker-media>video{z-index:2}
.picker-media .material-video-icon{width:100%;height:100%;margin:0;aspect-ratio:auto;border-radius:0;background:#f3f4f6;color:#667085;font-size:22px}
.picker-play{position:absolute;z-index:3;right:8px;bottom:8px;width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:rgba(17,24,39,.72);color:#fff;font-size:10px;box-shadow:0 2px 7px rgba(0,0,0,.18)}
@media(max-width:820px){.video-panel .composer-head{grid-template-columns:minmax(0,1fr) 34px}.composer-summary{display:none}.composer-toggle{grid-column:2}.composer-collapsed-copy{grid-template-columns:1fr}.composer-collapsed-copy span{display:none}.creation-mode-tabs{margin-right:-8px}.reference-row.dynamic{grid-template-columns:1fr}.paste-note{display:none}}
</style>

<style scoped>
.video-modal-overlay{position:fixed;inset:0;z-index:230;display:grid;place-items:center;padding:16px;background:rgba(16,24,40,.46)}
.video-template-dialog,.video-ai-dialog,.reference-dialog{width:min(640px,100%);max-height:min(88vh,760px);overflow-y:auto;border:1px solid #e4e7ec;border-radius:8px;background:#fff;padding:22px;color:#182230;box-shadow:0 28px 80px rgba(15,23,42,.28)}
.reference-dialog{width:min(780px,100%)}.reference-dialog-body{margin-top:18px}.reference-dialog .reference-row{grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}.reference-dialog .video-dialog-actions{padding-top:14px;border-top:1px solid #eaecf0}.reference-dialog .video-dialog-actions .video-primary-action{min-width:110px}
.video-dialog-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.video-dialog-header h3{margin:0;font-size:20px;font-weight:900}.video-dialog-header p{margin:6px 0 0;color:#667085;font-size:12px;line-height:1.6}.video-dialog-header>button{width:32px;height:32px;flex:0 0 32px;border:0;border-radius:6px;background:#f2f4f7;color:#667085;font-size:22px;line-height:1;cursor:pointer}.video-dialog-header>button:hover{background:#e4e7ec;color:#101828}.video-dialog-header>button:disabled{opacity:.5;cursor:not-allowed}
.video-template-list{display:grid;gap:8px;max-height:390px;margin-top:18px;padding-right:3px;overflow-y:auto}.video-template-item{position:relative;display:grid;gap:7px;border:1px solid #e4e7ec;border-radius:7px;padding:12px 38px 12px 13px;background:#fff;cursor:pointer;outline:0}.video-template-item:hover,.video-template-item:focus-visible{border-color:#948dff;background:#fbfaff;box-shadow:0 0 0 3px rgba(91,78,255,.07)}.video-template-item>span{display:flex;align-items:center;justify-content:space-between;gap:10px}.video-template-item strong{color:#344054;font-size:12px}.video-template-item em{border-radius:5px;padding:3px 6px;background:#f2f4f7;color:#667085;font-size:9px;font-style:normal;font-weight:700}.video-template-item p{display:-webkit-box;margin:0;overflow:hidden;color:#667085;font-size:11px;line-height:1.55;-webkit-box-orient:vertical;-webkit-line-clamp:2}.video-template-delete{position:absolute;top:9px;right:9px;width:24px;height:24px;border:0;border-radius:5px;background:#fef2f2;color:#d92d20;font-size:16px;cursor:pointer}.video-template-create{margin-top:14px;padding-top:13px;border-top:1px solid #eaecf0}.video-text-action{border:0;background:transparent;color:#5146e5;font-size:12px;font-weight:800;cursor:pointer}.video-template-form{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}.video-template-form input,.video-template-form textarea{width:100%;border:1px solid #d0d5dd;border-radius:6px;padding:9px 10px;background:#fff;color:#101828;font:inherit;font-size:12px;outline:0}.video-template-form textarea{grid-column:1/-1;resize:vertical;line-height:1.6}.video-template-form input:focus,.video-template-form textarea:focus{border-color:#6d63ec;box-shadow:0 0 0 3px rgba(91,78,255,.08)}.video-template-form .video-primary-action{grid-column:2;justify-self:end}
.video-ai-mode{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:20px;padding:4px;border-radius:7px;background:#f0f2f5}.video-ai-mode button{height:36px;border:0;border-radius:5px;background:transparent;color:#667085;font-size:12px;font-weight:800;cursor:pointer}.video-ai-mode button.active{background:#fff;color:#5146e5;box-shadow:0 1px 4px rgba(16,24,40,.1)}.video-ai-field{position:relative;display:grid;gap:7px;margin-top:14px}.video-ai-field>span{color:#344054;font-size:12px;font-weight:800}.video-ai-field textarea,.video-ai-result textarea{width:100%;resize:vertical;border:1px solid #d0d5dd;border-radius:7px;padding:11px 12px;background:#fff;color:#101828;font:inherit;font-size:13px;line-height:1.65;outline:0}.video-ai-field textarea:focus,.video-ai-result textarea:focus{border-color:#6d63ec;box-shadow:0 0 0 3px rgba(91,78,255,.1)}.video-ai-field small{position:absolute;right:9px;bottom:8px;color:#98a2b3;font-size:9px}.video-ai-result{display:grid;gap:7px;margin-top:14px;padding-top:14px;border-top:1px solid #eaecf0}.video-ai-result>div{display:flex;align-items:center;justify-content:space-between}.video-ai-result strong{font-size:12px}.video-ai-result span{color:#98a2b3;font-size:10px}.video-ai-result textarea{background:#fbfbff;border-color:#dcd9ff}
.video-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.video-dialog-actions button,.video-primary-action{height:38px;border:1px solid #d0d5dd;border-radius:6px;padding:0 14px;background:#fff;color:#475467;font-size:12px;font-weight:800;cursor:pointer}.video-dialog-actions button:hover{border-color:#9c96ff;color:#5146e5}.video-dialog-actions .video-ai-run{border-color:#d9d5ff;background:#f5f3ff;color:#5146e5}.video-dialog-actions .video-primary-action,.video-template-form .video-primary-action{border-color:#5146e5;background:#5146e5;color:#fff}.video-dialog-actions button:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:640px){.video-template-dialog,.video-ai-dialog,.reference-dialog{padding:18px}.video-template-form{grid-template-columns:1fr}.video-template-form textarea,.video-template-form .video-primary-action{grid-column:1}.video-template-form .video-primary-action{width:100%}.video-dialog-actions{display:grid;grid-template-columns:1fr 1fr}.video-dialog-actions .video-primary-action{grid-column:1/-1}.video-dialog-actions button{padding:0 9px}.selected-reference-strip{align-items:flex-start}.selected-reference-list{flex-wrap:wrap}.selected-reference-chip{max-width:140px}}
</style>
