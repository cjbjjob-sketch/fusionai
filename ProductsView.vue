<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { productApi, type Product } from '@/api/product'
import { materialApi, type MaterialItem } from '@/api/material'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const store = useAppStore()
const products = ref<Product[]>([])
const activeId = ref('')
const loading = ref(false)
const importing = ref(false)
const search = ref('')
const statusFilter = ref('全部')
const showForm = ref(false)
const showImport = ref(false)
const showDelete = ref(false)
const editing = ref(false)
const importUrl = ref('')
const platformText = ref('')
const formData = ref<Partial<Product>>({})
const csvInput = ref<HTMLInputElement | null>(null)
const coverFileInput = ref<HTMLInputElement | null>(null)
const coverPreviewUrl = ref('')
const coverMaterialId = ref<string | null>(null)
const coverChanged = ref(false)
const coverUploading = ref(false)
const showMaterialPicker = ref(false)
const materialLoading = ref(false)
const materialSearch = ref('')
const imageMaterials = ref<MaterialItem[]>([])

const filteredProducts = computed(() => products.value.filter(item => {
  const keyword = search.value.trim().toLowerCase()
  const keywordMatched = !keyword || [item.name, item.category, item.sku].some(value => String(value || '').toLowerCase().includes(keyword))
  return keywordMatched && (statusFilter.value === '全部' || item.status === statusFilter.value)
}))
const activeProduct = computed(() => products.value.find(item => item.id === activeId.value) || null)
const completedCount = computed(() => products.value.filter(item => completeness(item) >= 80).length)
const statusOptions = computed(() => ['全部', ...new Set(products.value.map(item => item.status).filter(Boolean))])
const filteredImageMaterials = computed(() => {
  const keyword = materialSearch.value.trim().toLowerCase()
  return imageMaterials.value.filter(item => !keyword || item.title.toLowerCase().includes(keyword))
})

function completeness(item: Product) {
  const fields = [item.name, item.category, item.sku, item.price, item.audience, item.selling, item.coverUrl]
  return Math.round(fields.filter(Boolean).length / fields.length * 100)
}

async function loadData() {
  loading.value = true
  try {
    products.value = await productApi.list()
    if (!products.value.some(item => item.id === activeId.value)) activeId.value = products.value[0]?.id || ''
  } catch (error) { store.showToast('商品库加载失败', 'error') }
  finally { loading.value = false }
}

function openCreate() {
  editing.value = false
  formData.value = { name: '', category: '', sku: '', price: '', audience: '', selling: '', platforms: [], status: '待完善', coverUrl: '' }
  platformText.value = ''
  coverPreviewUrl.value = ''
  coverMaterialId.value = null
  coverChanged.value = false
  showForm.value = true
}

function openEdit() {
  if (!activeProduct.value) return
  editing.value = true
  formData.value = {
    name: activeProduct.value.name,
    category: activeProduct.value.category,
    sku: activeProduct.value.sku,
    price: activeProduct.value.price,
    audience: activeProduct.value.audience,
    selling: activeProduct.value.selling,
    platforms: [...(activeProduct.value.platforms || [])],
    status: activeProduct.value.status,
  }
  platformText.value = (activeProduct.value.platforms || []).join('、')
  coverPreviewUrl.value = activeProduct.value.coverUrl || ''
  coverMaterialId.value = null
  coverChanged.value = false
  showForm.value = true
}

async function openMaterialLibrary() {
  showMaterialPicker.value = true
  materialLoading.value = true
  materialSearch.value = ''
  try { imageMaterials.value = await materialApi.list({ type: 'image' }) }
  catch { store.showToast('素材库加载失败', 'error') }
  finally { materialLoading.value = false }
}

function selectCoverMaterial(item: MaterialItem) {
  coverMaterialId.value = item.id
  coverPreviewUrl.value = item.fileUrl || item.previewUrl || item.thumbnailUrl || ''
  coverChanged.value = true
  showMaterialPicker.value = false
}

async function handleCoverUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    input.value = ''
    return store.showToast('请选择图片文件', 'error')
  }
  coverUploading.value = true
  try {
    const material = await materialApi.uploadFile(file, { folder: '商品素材', category: '商品主图' })
    selectCoverMaterial(material)
    store.showToast('主图已上传，保存商品后完成关联')
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '商品主图上传失败', 'error')
  } finally {
    coverUploading.value = false
    input.value = ''
  }
}

function clearCover() {
  coverPreviewUrl.value = ''
  coverMaterialId.value = null
  coverChanged.value = true
}

async function saveForm() {
  if (!formData.value.name?.trim()) return store.showToast('请输入商品名称', 'error')
  if (!formData.value.category?.trim()) return store.showToast('请输入商品类目', 'error')
  formData.value.platforms = platformText.value.split(/[、，,;；]/).map(item => item.trim()).filter(Boolean)
  try {
    let saved: Product
    if (editing.value && activeProduct.value) saved = await productApi.update(activeProduct.value.id, formData.value)
    else saved = await productApi.create(formData.value)
    activeId.value = saved.id
    if (coverChanged.value) await productApi.setCover(saved.id, coverMaterialId.value)
    showForm.value = false
    await loadData()
    store.showToast(editing.value ? '商品资料已更新' : '商品已创建')
  } catch (error: any) { store.showToast(error?.response?.data?.message || '商品保存失败', 'error') }
}

async function importProduct() {
  if (!importUrl.value.trim()) return store.showToast('请输入商品链接', 'error')
  importing.value = true
  try {
    const product = await productApi.importUrl(importUrl.value.trim())
    activeId.value = product.id
    showImport.value = false
    importUrl.value = ''
    await loadData()
    openEdit()
    store.showToast('已识别商品信息，请检查后保存')
  } catch (error: any) { store.showToast(error?.response?.data?.message || '商品链接识别失败', 'error') }
  finally { importing.value = false }
}

async function importCsvFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importing.value = true
  try {
    const result = await productApi.importCsv(await file.text())
    await loadData()
    store.showToast(`成功导入 ${result.imported} 个商品${result.failed ? `，${result.failed} 行未导入` : ''}`)
  } catch (error: any) { store.showToast(error?.response?.data?.message || 'CSV 导入失败', 'error') }
  finally { importing.value = false; input.value = '' }
}

async function deleteProduct() {
  if (!activeProduct.value) return
  try {
    await productApi.remove(activeProduct.value.id)
    showDelete.value = false
    activeId.value = ''
    await loadData()
    store.showToast('商品已删除')
  } catch (error: any) { store.showToast(error?.response?.data?.message || '删除失败', 'error') }
}

function createWith(path: string) {
  if (!activeProduct.value) return
  router.push({ path, query: { productId: activeProduct.value.id, source: 'product' } })
}

onMounted(loadData)
</script>

<template>
  <div class="asset-workspace">
    <header class="workspace-head">
      <div><h1>商品库</h1><p>集中维护商品事实、卖点和渠道信息，生成内容时直接引用。</p></div>
      <div class="head-actions">
        <input ref="csvInput" hidden type="file" accept=".csv,text/csv" @change="importCsvFile" />
        <button class="button" :disabled="importing" @click="csvInput?.click()">CSV 导入</button>
        <button class="button" @click="showImport = true">链接导入</button>
        <button class="button primary" @click="openCreate">新建商品</button>
      </div>
    </header>

    <div class="summary-strip">
      <span><strong>{{ products.length }}</strong> 全部商品</span>
      <span><strong>{{ completedCount }}</strong> 资料较完整</span>
      <span><strong>{{ products.length - completedCount }}</strong> 待完善</span>
    </div>

    <div class="workspace-grid">
      <aside class="library-pane">
        <div class="library-tools">
          <label class="search-box"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input v-model="search" placeholder="搜索名称、类目或 SKU" /></label>
          <select v-model="statusFilter" aria-label="商品状态"><option v-for="item in statusOptions" :key="item">{{ item }}</option></select>
        </div>
        <div class="library-scroll">
          <div v-if="loading" class="empty-state">正在加载商品...</div>
          <button v-for="item in filteredProducts" :key="item.id" class="library-row" :class="{ active: item.id === activeId }" @click="activeId = item.id">
            <div class="row-cover"><img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.name" /><span v-else>{{ item.name.slice(0, 1) }}</span></div>
            <div class="row-main"><strong>{{ item.name }}</strong><small>{{ item.category || '待分类' }}<template v-if="item.sku"> · {{ item.sku }}</template></small></div>
            <span class="completion" :class="{ good: completeness(item) >= 80 }">{{ completeness(item) }}%</span>
          </button>
          <div v-if="!loading && !filteredProducts.length" class="empty-state">没有符合条件的商品</div>
        </div>
      </aside>

      <main v-if="activeProduct" class="detail-pane">
        <section class="product-overview">
          <div class="product-cover"><img v-if="activeProduct.coverUrl" :src="activeProduct.coverUrl" :alt="activeProduct.name" /><span v-else>{{ activeProduct.name.slice(0, 1) }}</span></div>
          <div class="overview-main">
            <div class="title-line"><div><span class="status-dot">{{ activeProduct.status }}</span><h2>{{ activeProduct.name }}</h2></div><div class="detail-actions"><button class="icon-button" title="编辑商品" @click="openEdit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button class="icon-button danger" title="删除商品" @click="showDelete = true"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg></button></div></div>
            <p class="selling">{{ activeProduct.selling || '尚未填写核心卖点，完善后生成结果会更贴近商品。' }}</p>
            <dl class="facts"><div><dt>类目</dt><dd>{{ activeProduct.category || '-' }}</dd></div><div><dt>SKU</dt><dd>{{ activeProduct.sku || '-' }}</dd></div><div><dt>价格</dt><dd>{{ activeProduct.price || '-' }}</dd></div><div><dt>目标人群</dt><dd>{{ activeProduct.audience || '-' }}</dd></div></dl>
            <div class="channel-list"><span v-for="platform in activeProduct.platforms || []" :key="platform">{{ platform }}</span><small v-if="!activeProduct.platforms?.length">暂未设置投放渠道</small></div>
          </div>
        </section>

        <section class="creation-band">
          <div><strong>用此商品开始创作</strong><span>自动带入主图、卖点和目标人群，生成资产持续关联到当前商品。</span></div>
          <div class="creation-options">
            <button class="creation-option primary" @click="createWith('/image')"><span>图</span><b>商品图</b><small>主图作为参考</small></button>
            <button class="creation-option" @click="createWith('/video')"><span>视</span><b>商品视频</b><small>自动图生视频</small></button>
            <button class="creation-option" @click="createWith('/creative')"><span>广</span><b>广告项目</b><small>预填创意简报</small></button>
            <button class="creation-option" @click="createWith('/commerce')"><span>工</span><b>电商工具</b><small>选择处理场景</small></button>
          </div>
        </section>

        <section class="quality-section">
          <div class="section-title"><div><h3>资料完整度</h3><p>完整资料可提高提示词补全和批量生产的一致性。</p></div><strong>{{ completeness(activeProduct) }}%</strong></div>
          <div class="progress"><i :style="{ width: completeness(activeProduct) + '%' }"></i></div>
          <div class="field-checks"><span :class="{ done: activeProduct.coverUrl }">商品主图</span><span :class="{ done: activeProduct.selling }">核心卖点</span><span :class="{ done: activeProduct.audience }">目标人群</span><span :class="{ done: activeProduct.platforms?.length }">投放渠道</span></div>
        </section>
      </main>
      <main v-else class="detail-pane empty-detail"><h2>还没有商品</h2><p>新建或导入商品后，即可关联图像、视频和广告创作。</p><button class="button primary" @click="openCreate">新建商品</button></main>
    </div>

    <Teleport to="body">
      <div v-if="showForm" class="modal-layer" @click.self="showForm = false"><form class="modal" @submit.prevent="saveForm"><div class="modal-head"><div><h3>{{ editing ? '编辑商品' : '新建商品' }}</h3><p>优先填写可验证的商品事实，避免将广告话术写成商品属性。</p></div><button type="button" class="close" @click="showForm = false">×</button></div><div class="form-grid"><label>商品名称<input v-model="formData.name" placeholder="必填" /></label><label>类目<input v-model="formData.category" placeholder="必填" /></label><label>SKU<input v-model="formData.sku" /></label><label>价格<input v-model="formData.price" placeholder="如 ¥299" /></label><label>目标人群<input v-model="formData.audience" /></label><label>状态<select v-model="formData.status"><option>已完善</option><option>待完善</option><option>待确认</option></select></label><div class="wide cover-field"><span>商品主图</span><div class="cover-editor"><div class="cover-preview"><img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="商品主图预览" /><span v-else>暂无主图</span></div><div class="cover-copy"><strong>{{ coverPreviewUrl ? '主图已就绪' : '添加清晰的商品主体图' }}</strong><p>支持 JPG、PNG、WebP；上传后自动进入素材库，创作时可直接复用。</p><div><input ref="coverFileInput" hidden type="file" accept="image/*" @change="handleCoverUpload" /><button type="button" class="button" :disabled="coverUploading" @click="coverFileInput?.click()">{{ coverUploading ? '上传中...' : '本地上传' }}</button><button type="button" class="button" @click="openMaterialLibrary">从素材库选择</button><button v-if="coverPreviewUrl" type="button" class="text-button danger" @click="clearCover">移除</button></div></div></div></div><label class="wide">投放渠道<input v-model="platformText" placeholder="抖音、小红书、天猫" /></label><label class="wide">核心卖点<textarea v-model="formData.selling" placeholder="材质、功能、场景、差异点"></textarea></label></div><div class="modal-actions"><button type="button" class="button" @click="showForm = false">取消</button><button class="button primary">保存商品</button></div></form></div>
      <div v-if="showMaterialPicker" class="modal-layer picker-layer" @click.self="showMaterialPicker = false"><div class="modal material-picker"><div class="modal-head"><div><h3>从素材库选择商品主图</h3><p>仅展示图片素材，选择后仍需保存商品。</p></div><button class="close" @click="showMaterialPicker = false">×</button></div><label class="picker-search"><span>搜索</span><input v-model="materialSearch" placeholder="搜索素材名称" /></label><div v-if="materialLoading" class="empty-state">正在加载素材...</div><div v-else-if="filteredImageMaterials.length" class="picker-grid"><button v-for="item in filteredImageMaterials" :key="item.id" @click="selectCoverMaterial(item)"><img :src="item.thumbnailUrl || item.fileUrl || item.previewUrl || ''" :alt="item.title" /><strong>{{ item.title }}</strong><small>{{ new Date(item.createdAt).toLocaleDateString('zh-CN') }}</small></button></div><div v-else class="empty-state">没有可用图片素材</div></div></div>
      <div v-if="showImport" class="modal-layer" @click.self="showImport = false"><div class="modal small"><div class="modal-head"><div><h3>从商品链接导入</h3><p>系统识别名称、价格、SKU、描述和主图，导入后需要确认。</p></div><button class="close" @click="showImport = false">×</button></div><label class="single-field">商品链接<input v-model="importUrl" type="url" placeholder="https://..." @keyup.enter="importProduct" /></label><div class="modal-actions"><button class="button" @click="showImport = false">取消</button><button class="button primary" :disabled="importing" @click="importProduct">{{ importing ? '识别中...' : '识别并导入' }}</button></div></div></div>
      <div v-if="showDelete" class="modal-layer" @click.self="showDelete = false"><div class="modal confirm"><div class="warning-icon">!</div><h3>删除“{{ activeProduct?.name }}”？</h3><p>商品资料将被移除，已生成的图像和视频不会删除。</p><div class="modal-actions"><button class="button" @click="showDelete = false">取消</button><button class="button destructive" @click="deleteProduct">确认删除</button></div></div></div>
    </Teleport>
  </div>
</template>

<style scoped>
.asset-workspace{display:grid;gap:16px;color:#172033}.workspace-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.workspace-head h1{margin:0;font-size:22px}.workspace-head p{margin:6px 0 0;color:#667085;font-size:13px}.head-actions,.detail-actions,.modal-actions,.creation-band>div:last-child{display:flex;gap:8px;flex-wrap:wrap}.summary-strip{display:flex;gap:28px;padding:12px 16px;border:1px solid #e7eaf0;background:#fff;border-radius:8px;color:#667085;font-size:13px}.summary-strip strong{color:#172033;font-size:17px;margin-right:5px}.workspace-grid{display:grid;grid-template-columns:320px minmax(0,1fr);min-height:620px;border:1px solid #e3e7ee;background:#fff;border-radius:8px;overflow:hidden}.library-pane{border-right:1px solid #e7eaf0;min-width:0}.library-tools{display:grid;grid-template-columns:1fr 92px;gap:8px;padding:14px;border-bottom:1px solid #e7eaf0}.search-box{display:flex;align-items:center;gap:8px;border:1px solid #dfe3ea;border-radius:6px;padding:0 10px}.search-box svg,.icon-button svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8}.search-box input,.library-tools select{border:0;outline:0;background:transparent;min-width:0;width:100%;font-size:13px}.library-tools select{border:1px solid #dfe3ea;border-radius:6px;padding:8px}.library-scroll{padding:8px;max-height:570px;overflow:auto}.library-row{display:flex;align-items:center;gap:10px;width:100%;padding:9px;border:1px solid transparent;border-radius:7px;background:#fff;text-align:left;cursor:pointer}.library-row:hover{background:#f7f8fb}.library-row.active{background:#f0efff;border-color:#c9c4ff}.row-cover{width:44px;height:44px;border-radius:6px;background:#eef1f5;display:grid;place-items:center;overflow:hidden;flex:none;color:#475467;font-weight:800}.row-cover img,.product-cover img{width:100%;height:100%;object-fit:cover}.row-main{min-width:0;flex:1}.row-main strong,.row-main small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row-main strong{font-size:13px}.row-main small{font-size:11px;color:#8a94a6;margin-top:4px}.completion{font-size:11px;color:#9a6700;background:#fff8db;padding:3px 5px;border-radius:4px}.completion.good{color:#067647;background:#ecfdf3}.detail-pane{padding:24px;min-width:0}.product-overview{display:grid;grid-template-columns:210px minmax(0,1fr);gap:24px}.product-cover{height:210px;background:#f1f3f7;border:1px solid #e3e7ee;border-radius:8px;display:grid;place-items:center;overflow:hidden;color:#8a94a6;font-size:52px;font-weight:800}.title-line{display:flex;justify-content:space-between;gap:16px}.title-line h2{font-size:22px;margin:8px 0}.status-dot{font-size:11px;color:#067647;background:#ecfdf3;padding:4px 7px;border-radius:4px}.icon-button{width:34px;height:34px;display:grid;place-items:center;border:1px solid #dfe3ea;border-radius:6px;background:#fff;color:#475467;cursor:pointer}.icon-button.danger{color:#d92d20}.selling{margin:2px 0 16px;color:#475467;line-height:1.6;font-size:13px}.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0}.facts div{padding:10px;border-left:2px solid #d9d6fe;background:#f8f8fb}.facts dt{font-size:11px;color:#8a94a6}.facts dd{margin:4px 0 0;font-size:13px;font-weight:700;word-break:break-word}.channel-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:14px}.channel-list span{font-size:11px;background:#f2f4f7;padding:5px 8px;border-radius:4px}.channel-list small{color:#98a2b3}.creation-band{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:24px -24px 0;padding:18px 24px;border-top:1px solid #e7eaf0;border-bottom:1px solid #e7eaf0;background:#fafbfc}.creation-band strong,.creation-band span{display:block}.creation-band span{color:#667085;font-size:12px;margin-top:4px}.quality-section{padding-top:20px}.section-title{display:flex;justify-content:space-between;align-items:center}.section-title h3{font-size:15px;margin:0}.section-title p{font-size:12px;color:#667085;margin:4px 0 0}.section-title>strong{font-size:22px}.progress{height:7px;background:#eceef2;border-radius:4px;overflow:hidden;margin:14px 0}.progress i{display:block;height:100%;background:#5b4eff}.field-checks{display:flex;gap:8px;flex-wrap:wrap}.field-checks span{font-size:12px;padding:6px 9px;border-radius:4px;background:#fff4ed;color:#b54708}.field-checks span.done{background:#ecfdf3;color:#067647}.button{border:1px solid #d8dde6;border-radius:6px;background:#fff;padding:8px 12px;color:#344054;font-size:13px;font-weight:700;cursor:pointer}.button:hover{border-color:#8075ff;color:#4f46e5}.button.primary{background:#5146e5;border-color:#5146e5;color:#fff}.button.destructive{background:#d92d20;border-color:#d92d20;color:#fff}.button:disabled{opacity:.5;cursor:not-allowed}.empty-state,.empty-detail{padding:40px;text-align:center;color:#8a94a6}.empty-detail{display:grid;place-items:center;align-content:center}.modal-layer{position:fixed;inset:0;z-index:300;display:grid;place-items:center;background:rgba(15,23,42,.45);padding:20px}.modal{width:min(680px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:8px;padding:22px;box-shadow:0 20px 50px rgba(15,23,42,.2)}.modal.small{width:min(520px,100%)}.modal.confirm{width:min(420px,100%);text-align:center}.modal-head{display:flex;justify-content:space-between;gap:20px}.modal-head h3,.confirm h3{margin:0;font-size:18px}.modal-head p,.confirm p{color:#667085;font-size:13px;line-height:1.5}.close{border:0;background:transparent;font-size:26px;color:#667085;cursor:pointer}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}.form-grid label,.single-field{display:grid;gap:6px;color:#475467;font-size:12px;font-weight:700}.form-grid .wide{grid-column:1/-1}.form-grid input,.form-grid select,.form-grid textarea,.single-field input{border:1px solid #d8dde6;border-radius:6px;padding:10px;font:inherit;outline:0}.form-grid textarea{min-height:84px;resize:vertical}.modal-actions{justify-content:flex-end;margin-top:20px}.warning-icon{margin:0 auto 14px;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#fee4e2;color:#d92d20;font-weight:900;font-size:20px}
.creation-options{display:grid!important;grid-template-columns:repeat(4,minmax(112px,1fr));gap:8px!important}.creation-option{display:grid;grid-template-columns:30px 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;border:1px solid #dfe3ea;border-radius:7px;background:#fff;padding:9px 10px;text-align:left;cursor:pointer}.creation-option>span{grid-row:1/3;width:30px;height:30px;display:grid;border-radius:6px;place-items:center;background:#f2f4f7;color:#475467;font-weight:900;margin:0}.creation-option b{font-size:12px;color:#344054}.creation-option small{font-size:10px;color:#98a2b3;white-space:nowrap}.creation-option:hover,.creation-option.primary{border-color:#8d85ff;background:#f7f6ff}.creation-option.primary>span{background:#5146e5;color:#fff}
.cover-field{display:grid;gap:6px;color:#475467;font-size:12px;font-weight:700}.cover-editor{display:grid;grid-template-columns:112px 1fr;gap:14px;padding:12px;border:1px solid #d8dde6;border-radius:7px;background:#fafbfc}.cover-preview{width:112px;height:96px;border:1px dashed #cfd5df;border-radius:6px;background:#fff;display:grid;place-items:center;overflow:hidden;color:#98a2b3;font-weight:500}.cover-preview img{width:100%;height:100%;object-fit:contain}.cover-copy{min-width:0}.cover-copy strong{font-size:13px;color:#344054}.cover-copy p{margin:5px 0 10px;font-size:11px;line-height:1.5;color:#667085;font-weight:400}.cover-copy>div{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.text-button{border:0;background:transparent;padding:7px;color:#475467;font-weight:700;cursor:pointer}.text-button.danger{color:#d92d20}.picker-layer{z-index:320}.material-picker{width:min(760px,100%)}.picker-search{display:flex;align-items:center;gap:10px;margin:14px 0}.picker-search span{font-size:12px;font-weight:700}.picker-search input{flex:1;border:1px solid #d8dde6;border-radius:6px;padding:9px}.picker-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;max-height:52vh;overflow:auto}.picker-grid button{min-width:0;border:1px solid #e3e7ee;border-radius:7px;background:#fff;padding:7px;text-align:left;cursor:pointer}.picker-grid button:hover{border-color:#756bff}.picker-grid img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:5px;background:#f2f4f7}.picker-grid strong,.picker-grid small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.picker-grid strong{font-size:12px;margin-top:7px}.picker-grid small{font-size:10px;color:#98a2b3;margin-top:3px}
@media(max-width:1100px){.workspace-grid{grid-template-columns:280px minmax(0,1fr)}.facts{grid-template-columns:repeat(2,1fr)}.product-overview{grid-template-columns:160px 1fr}.product-cover{height:160px}.creation-band{align-items:flex-start;flex-direction:column}.creation-options{grid-template-columns:repeat(2,minmax(140px,1fr))}}
@media(max-width:760px){.workspace-head{flex-direction:column}.summary-strip{overflow:auto}.workspace-grid{grid-template-columns:1fr}.library-pane{border-right:0;border-bottom:1px solid #e7eaf0}.library-scroll{max-height:260px}.product-overview{grid-template-columns:1fr}.product-cover{height:220px}.detail-pane{padding:16px}.creation-band{margin:20px -16px 0;padding:16px}.form-grid{grid-template-columns:1fr}.form-grid .wide{grid-column:auto}}
</style>
