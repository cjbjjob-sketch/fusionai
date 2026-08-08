<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { brandApi, type Brand } from '@/api/brand'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const store = useAppStore()
const brands = ref<Brand[]>([])
const activeId = ref('')
const loading = ref(false)
const importing = ref(false)
const logoUploading = ref(false)
const search = ref('')
const showForm = ref(false)
const showImport = ref(false)
const showDelete = ref(false)
const editing = ref(false)
const importUrl = ref('')
const colorText = ref('')
const formData = ref<Partial<Brand>>({})
const logoFileInput = ref<HTMLInputElement | null>(null)

const filteredBrands = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return brands.value.filter(item => !keyword || [item.name, item.tone, item.font].some(value => String(value || '').toLowerCase().includes(keyword)))
})
const activeBrand = computed(() => brands.value.find(item => item.id === activeId.value) || null)
const completeCount = computed(() => brands.value.filter(item => completeness(item) >= 90).length)

function completeness(item: Brand) {
  const fields = [item.name, item.logoUrl, item.tone, item.font, item.colors?.length, item.forbidden, item.endings]
  return Math.round(fields.filter(Boolean).length / fields.length * 100)
}

function visualRuleMessage(item: Brand) {
  if (item.logoUrl && item.colors?.length) return 'Logo 与品牌色已配置，可用于生成任务。'
  if (item.logoUrl) return '请补充品牌色。'
  if (item.colors?.length) return '请补充 Logo。'
  return '请补充 Logo 和品牌色。'
}

async function loadData() {
  loading.value = true
  try {
    brands.value = await brandApi.list()
    if (!brands.value.some(item => item.id === activeId.value)) activeId.value = brands.value[0]?.id || ''
  } catch (error) { store.showToast('品牌规范加载失败', 'error') }
  finally { loading.value = false }
}

function openCreate() {
  editing.value = false
  formData.value = { name: '', tone: '', font: '', forbidden: '', endings: '', colors: [] }
  colorText.value = ''
  showForm.value = true
}

function openEdit() {
  if (!activeBrand.value) return
  editing.value = true
  const brand = activeBrand.value
  formData.value = {
    name: brand.name,
    tone: brand.tone,
    font: brand.font,
    forbidden: brand.forbidden,
    endings: brand.endings,
    colors: [...(brand.colors || [])],
  }
  colorText.value = (activeBrand.value.colors || []).join('、')
  showForm.value = true
}

async function saveForm() {
  if (!formData.value.name?.trim()) return store.showToast('请输入品牌名称', 'error')
  const colors = colorText.value.split(/[、，,;；\s]+/).map(item => item.trim().toUpperCase()).filter(item => /^#[0-9A-F]{6}$/.test(item))
  if (colorText.value.trim() && !colors.length) return store.showToast('品牌色请使用 #RRGGBB 格式', 'error')
  const payload: Partial<Brand> = {
    name: formData.value.name?.trim(),
    tone: formData.value.tone?.trim() || null,
    font: formData.value.font?.trim() || null,
    forbidden: formData.value.forbidden?.trim() || null,
    endings: formData.value.endings?.trim() || null,
    colors,
  }
  try {
    if (editing.value && activeBrand.value) await brandApi.update(activeBrand.value.id, payload)
    else activeId.value = (await brandApi.create(payload)).id
    showForm.value = false
    await loadData()
    store.showToast(editing.value ? '品牌规范已更新' : '品牌已创建')
  } catch (error: any) { store.showToast(error?.response?.data?.message || '品牌保存失败', 'error') }
}

async function importBrand() {
  if (!importUrl.value.trim()) return store.showToast('请输入品牌官网', 'error')
  importing.value = true
  try {
    const brand = await brandApi.importUrl(importUrl.value.trim())
    activeId.value = brand.id
    showImport.value = false
    importUrl.value = ''
    await loadData()
    openEdit()
    store.showToast('已识别品牌信息，请检查后保存')
  } catch (error: any) { store.showToast(error?.response?.data?.message || '品牌网站识别失败', 'error') }
  finally { importing.value = false }
}

async function deleteBrand() {
  if (!activeBrand.value) return
  try {
    await brandApi.remove(activeBrand.value.id)
    showDelete.value = false
    activeId.value = ''
    await loadData()
    store.showToast('品牌已删除')
  } catch (error: any) { store.showToast(error?.response?.data?.message || '删除失败', 'error') }
}

function handleLogoSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !activeBrand.value) return
  if (!file.type.startsWith('image/')) return store.showToast('请选择图片文件', 'error')
  if (file.size > 5 * 1024 * 1024) return store.showToast('Logo 文件不能超过 5MB', 'error')
  const reader = new FileReader()
  reader.onload = async () => {
    logoUploading.value = true
    try {
      const result = await brandApi.uploadLogo(activeBrand.value!.id, String(reader.result))
      const brand = brands.value.find(item => item.id === activeBrand.value!.id)
      if (brand) brand.logoUrl = result.logoUrl
      store.showToast('Logo 已更新')
    } catch (error: any) { store.showToast(error?.response?.data?.message || 'Logo 上传失败', 'error') }
    finally { logoUploading.value = false; input.value = '' }
  }
  reader.readAsDataURL(file)
}

function createWith(path: string) {
  if (!activeBrand.value) return
  router.push({ path, query: { brandId: activeBrand.value.id } })
}

onMounted(loadData)
</script>

<template>
  <div class="brand-workspace">
    <header class="workspace-head"><div><h1>品牌规范</h1><p>让团队生成的商品图、视频和广告始终使用同一套品牌语言。</p></div><div class="head-actions"><button class="button" @click="showImport = true">网站识别</button><button class="button primary" @click="openCreate">新建品牌</button></div></header>
    <div class="summary-strip"><span><strong>{{ brands.length }}</strong> 品牌</span><span><strong>{{ completeCount }}</strong> 规范较完整</span><span><strong>{{ brands.length - completeCount }}</strong> 待完善</span></div>

    <div class="workspace-grid">
      <aside class="library-pane">
        <div class="library-tools"><label class="search-box"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input v-model="search" placeholder="搜索品牌、语气或字体" /></label></div>
        <div class="library-scroll">
          <div v-if="loading" class="empty-state">正在加载品牌...</div>
          <button v-for="item in filteredBrands" :key="item.id" class="library-row" :class="{ active: item.id === activeId }" @click="activeId = item.id">
            <div class="row-logo"><img v-if="item.logoUrl" :src="item.logoUrl" :alt="item.name" /><span v-else>{{ item.name.slice(0, 1) }}</span></div>
            <div class="row-main"><strong>{{ item.name }}</strong><small>{{ item.tone || '待设置品牌语气' }}</small></div>
            <span class="completion" :class="{ good: completeness(item) >= 90 }">{{ completeness(item) }}%</span>
          </button>
          <div v-if="!loading && !filteredBrands.length" class="empty-state">没有符合条件的品牌</div>
        </div>
      </aside>

      <main v-if="activeBrand" class="detail-pane">
        <section class="brand-overview">
          <div class="logo-stage"><img v-if="activeBrand.logoUrl" :src="activeBrand.logoUrl" :alt="activeBrand.name" /><span v-else>{{ activeBrand.name.slice(0, 1) }}</span><input ref="logoFileInput" hidden type="file" accept="image/*" @change="handleLogoSelect" /><button class="button" :disabled="logoUploading" @click="logoFileInput?.click()">{{ logoUploading ? '上传中...' : activeBrand.logoUrl ? '更换 Logo' : '上传 Logo' }}</button><small>PNG、JPG，最大 5MB</small></div>
          <div class="overview-main">
            <div class="title-line"><div><span class="status-dot">品牌规范</span><h2>{{ activeBrand.name }}</h2></div><div class="detail-actions"><button class="icon-button" title="编辑品牌规范" @click="openEdit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button class="icon-button danger" title="删除品牌" @click="showDelete = true"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg></button></div></div>
            <p class="tone">{{ activeBrand.tone || '尚未定义品牌语气。补充后，文案和画面提示词会自动引用。' }}</p>
            <div class="color-system"><div class="section-label">品牌色</div><div class="swatches"><span v-for="color in activeBrand.colors || []" :key="color" :style="{ background: color }" :title="color"><i>{{ color }}</i></span><small v-if="!activeBrand.colors?.length">暂未设置</small></div></div>
            <dl class="facts"><div><dt>品牌字体</dt><dd>{{ activeBrand.font || '-' }}</dd></div><div><dt>默认片尾</dt><dd>{{ activeBrand.endings || '-' }}</dd></div><div class="wide"><dt>禁用表达</dt><dd>{{ activeBrand.forbidden || '暂未设置' }}</dd></div></dl>
          </div>
        </section>

        <section class="creation-band"><div><strong>使用该品牌规范创作</strong><span>新任务会关联该品牌，便于生成结果归档和后续复用。</span></div><div><button class="button primary" @click="createWith('/image')">创作图像</button><button class="button" @click="createWith('/video')">创作视频</button><button class="button" @click="createWith('/creative')">制作广告</button></div></section>

        <section class="governance-grid">
          <article><div class="rule-mark visual"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M8 13a4 4 0 0 0 8 0M9 9h.01M15 9h.01"/></svg></div><div><strong>视觉规范</strong><p>{{ visualRuleMessage(activeBrand) }}</p></div><span :class="{ ready: activeBrand.logoUrl && activeBrand.colors?.length }">{{ activeBrand.logoUrl && activeBrand.colors?.length ? '可用' : '待完善' }}</span></article>
          <article><div class="rule-mark copy"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg></div><div><strong>文案规范</strong><p>{{ activeBrand.tone && activeBrand.forbidden ? '品牌语气和禁用表达已配置。' : '请补充品牌语气和禁用表达。' }}</p></div><span :class="{ ready: activeBrand.tone && activeBrand.forbidden }">{{ activeBrand.tone && activeBrand.forbidden ? '可用' : '待完善' }}</span></article>
          <article><div class="rule-mark video"><svg viewBox="0 0 24 24"><path d="m8 6 10 6-10 6z"/></svg></div><div><strong>视频收口</strong><p>{{ activeBrand.endings ? '默认片尾已配置，可用于广告项目。' : '请补充默认片尾或 CTA。' }}</p></div><span :class="{ ready: activeBrand.endings }">{{ activeBrand.endings ? '可用' : '待完善' }}</span></article>
        </section>

        <section class="quality-section"><div class="section-title"><div><h3>规范完整度</h3><p>完整规范能减少团队重复修改和品牌偏差。</p></div><strong>{{ completeness(activeBrand) }}%</strong></div><div class="progress"><i :style="{ width: completeness(activeBrand) + '%' }"></i></div></section>
      </main>
      <main v-else class="detail-pane empty-detail"><h2>还没有品牌规范</h2><p>新建或从官网识别品牌后，可在所有创作任务中直接引用。</p><button class="button primary" @click="openCreate">新建品牌</button></main>
    </div>

    <Teleport to="body">
      <div v-if="showForm" class="modal-layer" @click.self="showForm = false"><form class="modal" @submit.prevent="saveForm"><div class="modal-head"><div><h3>{{ editing ? '编辑品牌规范' : '新建品牌' }}</h3><p>只填写团队实际执行的规范，避免宽泛描述。</p></div><button type="button" class="close" @click="showForm = false">×</button></div><div class="form-grid"><label>品牌名称<input v-model="formData.name" placeholder="必填" /></label><label>品牌字体<input v-model="formData.font" placeholder="如 Inter / 思源黑体" /></label><label class="wide">品牌语气<input v-model="formData.tone" placeholder="如 克制、可信、专业，不使用网络热词" /></label><label class="wide">品牌色<input v-model="colorText" placeholder="#5146E5、#12B76A" /><small>使用十六进制色值，多个颜色用顿号分隔</small></label><label class="wide">禁用表达<textarea v-model="formData.forbidden" placeholder="绝对化表述、夸大效果、竞品贬损"></textarea></label><label class="wide">默认片尾 / CTA<input v-model="formData.endings" placeholder="如 Logo + 立即了解" /></label></div><div class="modal-actions"><button type="button" class="button" @click="showForm = false">取消</button><button class="button primary">保存规范</button></div></form></div>
      <div v-if="showImport" class="modal-layer" @click.self="showImport = false"><div class="modal small"><div class="modal-head"><div><h3>从品牌官网识别</h3><p>系统将提取 Logo、常用颜色、字体和品牌描述，结果需要人工确认。</p></div><button class="close" @click="showImport = false">×</button></div><label class="single-field">品牌官网<input v-model="importUrl" type="url" placeholder="https://brand.example.com" @keyup.enter="importBrand" /></label><div class="modal-actions"><button class="button" @click="showImport = false">取消</button><button class="button primary" :disabled="importing" @click="importBrand">{{ importing ? '识别中...' : '识别并创建' }}</button></div></div></div>
      <div v-if="showDelete" class="modal-layer" @click.self="showDelete = false"><div class="modal confirm"><div class="warning-icon">!</div><h3>删除“{{ activeBrand?.name }}”？</h3><p>品牌规范将无法再用于新任务，已生成资产不会删除。</p><div class="modal-actions"><button class="button" @click="showDelete = false">取消</button><button class="button destructive" @click="deleteBrand">确认删除</button></div></div></div>
    </Teleport>
  </div>
</template>

<style scoped>
.brand-workspace{display:grid;gap:16px;color:#172033}.workspace-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.workspace-head h1{margin:0;font-size:22px}.workspace-head p{margin:6px 0 0;color:#667085;font-size:13px}.head-actions,.detail-actions,.modal-actions,.creation-band>div:last-child{display:flex;gap:8px;flex-wrap:wrap}.summary-strip{display:flex;gap:28px;padding:12px 16px;border:1px solid #e7eaf0;background:#fff;border-radius:8px;color:#667085;font-size:13px}.summary-strip strong{color:#172033;font-size:17px;margin-right:5px}.workspace-grid{display:grid;grid-template-columns:300px minmax(0,1fr);min-height:620px;border:1px solid #e3e7ee;background:#fff;border-radius:8px;overflow:hidden}.library-pane{border-right:1px solid #e7eaf0}.library-tools{padding:14px;border-bottom:1px solid #e7eaf0}.search-box{display:flex;align-items:center;gap:8px;border:1px solid #dfe3ea;border-radius:6px;padding:0 10px;height:36px}.search-box svg,.icon-button svg,.rule-mark svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8}.search-box input{border:0;outline:0;min-width:0;width:100%;font-size:13px}.library-scroll{padding:8px;max-height:570px;overflow:auto}.library-row{display:flex;align-items:center;gap:10px;width:100%;padding:9px;border:1px solid transparent;border-radius:7px;background:#fff;text-align:left;cursor:pointer}.library-row:hover{background:#f7f8fb}.library-row.active{background:#f0efff;border-color:#c9c4ff}.row-logo{width:44px;height:44px;border:1px solid #e3e7ee;border-radius:6px;background:#fff;display:grid;place-items:center;overflow:hidden;flex:none;font-weight:800;color:#475467}.row-logo img,.logo-stage img{width:100%;height:100%;object-fit:contain}.row-main{min-width:0;flex:1}.row-main strong,.row-main small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row-main strong{font-size:13px}.row-main small{font-size:11px;color:#8a94a6;margin-top:4px}.completion{font-size:11px;color:#9a6700;background:#fff8db;padding:3px 5px;border-radius:4px}.completion.good{color:#067647;background:#ecfdf3}.detail-pane{padding:24px;min-width:0}.brand-overview{display:grid;grid-template-columns:190px minmax(0,1fr);gap:26px}.logo-stage{height:190px;border:1px solid #e3e7ee;border-radius:8px;background:#fafbfc;padding:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;overflow:hidden}.logo-stage img{height:92px}.logo-stage>span{width:88px;height:88px;border-radius:8px;background:#172033;color:#fff;display:grid;place-items:center;font-size:40px;font-weight:800}.logo-stage small{color:#98a2b3;font-size:10px}.title-line{display:flex;justify-content:space-between;gap:16px}.title-line h2{font-size:22px;margin:8px 0}.status-dot{font-size:11px;color:#4f46e5;background:#f0efff;padding:4px 7px;border-radius:4px}.icon-button{width:34px;height:34px;display:grid;place-items:center;border:1px solid #dfe3ea;border-radius:6px;background:#fff;color:#475467;cursor:pointer}.icon-button.danger{color:#d92d20}.tone{color:#475467;line-height:1.6;font-size:13px;margin:0 0 16px}.section-label{font-size:11px;color:#8a94a6;margin-bottom:7px}.swatches{display:flex;gap:8px;min-height:34px;align-items:center}.swatches>span{width:38px;height:30px;border-radius:5px;border:1px solid rgba(0,0,0,.1);position:relative}.swatches i{display:none;position:absolute;top:34px;left:0;background:#172033;color:#fff;padding:4px 6px;border-radius:4px;font-size:10px;font-style:normal;z-index:2}.swatches span:hover i{display:block}.swatches small{color:#98a2b3}.facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0 0}.facts div{padding:10px;border-left:2px solid #d9d6fe;background:#f8f8fb}.facts .wide{grid-column:1/-1}.facts dt{font-size:11px;color:#8a94a6}.facts dd{margin:4px 0 0;font-size:13px;font-weight:700}.creation-band{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:24px -24px 0;padding:18px 24px;border-top:1px solid #e7eaf0;border-bottom:1px solid #e7eaf0;background:#fafbfc}.creation-band strong,.creation-band span{display:block}.creation-band span{font-size:12px;color:#667085;margin-top:4px}.governance-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding-top:20px}.governance-grid article{display:grid;grid-template-columns:34px 1fr auto;gap:10px;padding:13px;border:1px solid #e3e7ee;border-radius:7px}.governance-grid strong{font-size:13px}.governance-grid p{font-size:11px;color:#667085;line-height:1.45;margin:4px 0 0}.governance-grid article>span{font-size:10px;height:max-content;padding:3px 5px;border-radius:4px;background:#fff4ed;color:#b54708}.governance-grid article>span.ready{background:#ecfdf3;color:#067647}.rule-mark{width:34px;height:34px;border-radius:6px;display:grid;place-items:center;background:#eef4ff;color:#3538cd}.rule-mark.copy{background:#ecfdf3;color:#067647}.rule-mark.video{background:#fff4ed;color:#b54708}.quality-section{padding-top:20px}.section-title{display:flex;justify-content:space-between;align-items:center}.section-title h3{font-size:15px;margin:0}.section-title p{font-size:12px;color:#667085;margin:4px 0 0}.section-title>strong{font-size:22px}.progress{height:7px;background:#eceef2;border-radius:4px;overflow:hidden;margin-top:14px}.progress i{display:block;height:100%;background:#5b4eff}.button{border:1px solid #d8dde6;border-radius:6px;background:#fff;padding:8px 12px;color:#344054;font-size:13px;font-weight:700;cursor:pointer}.button:hover{border-color:#8075ff;color:#4f46e5}.button.primary{background:#5146e5;border-color:#5146e5;color:#fff}.button.destructive{background:#d92d20;border-color:#d92d20;color:#fff}.button:disabled{opacity:.5;cursor:not-allowed}.empty-state,.empty-detail{padding:40px;text-align:center;color:#8a94a6}.empty-detail{display:grid;place-items:center;align-content:center}.modal-layer{position:fixed;inset:0;z-index:300;display:grid;place-items:center;background:rgba(15,23,42,.45);padding:20px}.modal{width:min(650px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:8px;padding:22px;box-shadow:0 20px 50px rgba(15,23,42,.2)}.modal.small{width:min(520px,100%)}.modal.confirm{width:min(420px,100%);text-align:center}.modal-head{display:flex;justify-content:space-between;gap:20px}.modal-head h3,.confirm h3{margin:0;font-size:18px}.modal-head p,.confirm p{font-size:13px;color:#667085;line-height:1.5}.close{border:0;background:transparent;font-size:26px;color:#667085;cursor:pointer}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}.form-grid label,.single-field{display:grid;gap:6px;color:#475467;font-size:12px;font-weight:700}.form-grid label small{font-size:10px;color:#98a2b3;font-weight:400}.form-grid .wide{grid-column:1/-1}.form-grid input,.form-grid textarea,.single-field input{border:1px solid #d8dde6;border-radius:6px;padding:10px;font:inherit;outline:0}.form-grid textarea{min-height:84px;resize:vertical}.modal-actions{justify-content:flex-end;margin-top:20px}.warning-icon{margin:0 auto 14px;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#fee4e2;color:#d92d20;font-weight:900;font-size:20px}
@media(max-width:1100px){.workspace-grid{grid-template-columns:270px minmax(0,1fr)}.brand-overview{grid-template-columns:150px 1fr}.logo-stage{height:165px;padding:12px}.governance-grid{grid-template-columns:1fr}.creation-band{align-items:flex-start;flex-direction:column}}
@media(max-width:760px){.workspace-head{flex-direction:column}.summary-strip{overflow:auto}.workspace-grid{grid-template-columns:1fr}.library-pane{border-right:0;border-bottom:1px solid #e7eaf0}.library-scroll{max-height:260px}.brand-overview{grid-template-columns:1fr}.logo-stage{height:190px}.detail-pane{padding:16px}.creation-band{margin:20px -16px 0;padding:16px}.form-grid{grid-template-columns:1fr}.form-grid .wide{grid-column:auto}}
</style>
