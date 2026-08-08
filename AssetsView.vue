<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { assetApi, type AssetItem, type AssetStats } from '@/api/asset'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const assets = ref<AssetItem[]>([])
const stats = ref<AssetStats | null>(null)
const loading = ref(false)
const filterType = ref<string>('')
const keyword = ref('')
const previewItem = ref<AssetItem | null>(null)
const selectedIds = ref<Set<string>>(new Set())
const selectMode = ref(false)
const hoveredVideoId = ref<string | null>(null)
const refreshedMediaIds = new Set<string>()

const filteredAssets = computed(() => {
  let result = assets.value
  if (filterType.value) {
    result = result.filter(a => a.type === filterType.value)
  }
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase()
    result = result.filter(a => a.title.toLowerCase().includes(kw) || a.source.toLowerCase().includes(kw))
  }
  return result
})

async function loadData() {
  loading.value = true
  try {
    const [list, s] = await Promise.all([assetApi.list(), assetApi.stats()])
    assets.value = list
    stats.value = s
  } catch (e) {
    console.error('加载资产失败', e)
  } finally {
    loading.value = false
  }
}

function formatSize(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / 1024 / 1024).toFixed(1) + 'MB'
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function openPreview(item: AssetItem) {
  previewItem.value = item
}

function startVideoPreview(item: AssetItem) {
  if (selectMode.value || item.type !== 'video' || item.status !== 'completed' || !item.fileUrl) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  hoveredVideoId.value = item.id
}

function stopVideoPreview(item: AssetItem) {
  if (hoveredVideoId.value === item.id) hoveredVideoId.value = null
}

function refreshMediaOnce(item: AssetItem) {
  if (refreshedMediaIds.has(item.id)) return
  refreshedMediaIds.add(item.id)
  void loadData()
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) selectedIds.value.clear()
}

function selectAll() {
  if (selectedIds.value.size === filteredAssets.value.length) {
    selectedIds.value.clear()
  } else {
    filteredAssets.value.forEach(a => selectedIds.value.add(a.id))
  }
}

async function deleteItem(id: string) {
  try {
    await assetApi.remove(id)
    store.showToast('资产已删除')
    await loadData()
  } catch (e: any) {
    store.showToast(e?.response?.data?.message || '删除失败', 'error')
  }
}

async function batchDelete() {
  if (selectedIds.value.size === 0) return
  try {
    await assetApi.batchRemove([...selectedIds.value])
    store.showToast(`已删除 ${selectedIds.value.size} 项资产`)
    selectedIds.value.clear()
    selectMode.value = false
    await loadData()
  } catch (e: any) {
    store.showToast(e?.response?.data?.message || '批量删除失败', 'error')
  }
}

function downloadFile(item: AssetItem) {
  const downloadUrl = item.downloadUrl || item.fileUrl
  if (!downloadUrl) {
    store.showToast('该资产暂无可下载的文件', 'info')
    return
  }
  if (downloadUrl.startsWith('data:')) {
    // data: URI 下载
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = item.title || 'download'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } else {
    // URL 下载
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = item.title || 'download'
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

onMounted(loadData)
</script>

<template>
  <div class="assets-view">
    <p class="page-desc">查看和管理所有 AI 生成的图像和视频资产，支持筛选、预览和批量删除。</p>

    <!-- 统计卡片 -->
    <div class="stats-grid" v-if="stats">
      <div class="stat-card">
        <span>资产总数</span>
        <strong>{{ stats.total }}</strong>
        <small>全部 AI 生成资产</small>
      </div>
      <div class="stat-card">
        <span>图像资产</span>
        <strong>{{ stats.imageCount }}</strong>
        <small>商品图 / 海报 / 场景图</small>
      </div>
      <div class="stat-card">
        <span>视频资产</span>
        <strong>{{ stats.videoCount }}</strong>
        <small>广告视频 / 种草视频</small>
      </div>
      <div class="stat-card">
        <span>累计消耗</span>
        <strong>{{ stats.totalCost.toLocaleString() }}</strong>
        <small>积分</small>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button :class="{ active: !filterType }" @click="filterType = ''">全部</button>
        <button :class="{ active: filterType === 'image' }" @click="filterType = 'image'">图像</button>
        <button :class="{ active: filterType === 'video' }" @click="filterType = 'video'">视频</button>
      </div>
      <div class="filter-right">
        <input v-model="keyword" type="text" placeholder="搜索标题或来源..." class="search-input" />
        <button class="btn" :class="{ active: selectMode }" @click="toggleSelectMode">
          {{ selectMode ? '取消选择' : '批量操作' }}
        </button>
        <button v-if="selectMode && selectedIds.size > 0" class="btn danger" @click="batchDelete">
          删除选中 ({{ selectedIds.size }})
        </button>
      </div>
    </div>

    <!-- 资产网格 -->
    <div v-if="loading" class="empty-state">加载中...</div>
    <div v-else-if="filteredAssets.length === 0" class="empty-state">
      <span>暂无资产</span>
      <p>前往图像创作或视频创作生成资产</p>
    </div>
    <div v-else class="asset-grid">
      <!-- 选择模式下的全选 -->
      <div v-if="selectMode" class="select-all-bar">
        <button class="btn" @click="selectAll">
          {{ selectedIds.size === filteredAssets.length ? '取消全选' : '全选' }}
        </button>
        <span>已选择 {{ selectedIds.size }} / {{ filteredAssets.length }}</span>
      </div>

      <div v-for="item in filteredAssets" :key="item.id" class="asset-card"
        :class="{ selected: selectedIds.has(item.id), selectable: selectMode }"
        @click="selectMode ? toggleSelect(item.id) : openPreview(item)"
        @mouseenter="startVideoPreview(item)" @mouseleave="stopVideoPreview(item)">

        <!-- 勾选框 -->
        <div v-if="selectMode" class="check-box" :class="{ checked: selectedIds.has(item.id) }">
          <svg v-if="selectedIds.has(item.id)" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
        </div>

        <!-- 缩略图区域 -->
        <div class="thumb-area">
          <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" :alt="item.title" loading="lazy" @error="refreshMediaOnce(item)" />
          <template v-else>
            <div class="placeholder-thumb">
              <span>{{ item.type === 'image' ? '🖼' : '🎬' }}</span>
            </div>
          </template>
          <video v-if="item.type === 'video' && hoveredVideoId === item.id && item.fileUrl" class="asset-hover-video" :src="item.previewUrl || item.fileUrl" :poster="item.thumbnailUrl || undefined" autoplay muted loop playsinline preload="metadata" @error="refreshMediaOnce(item)"></video>
          <div v-if="item.type === 'video' && hoveredVideoId !== item.id" class="video-thumb">
            <span class="play-icon">▶</span>
            <span class="video-label">视频</span>
          </div>

          <!-- 状态标签 -->
          <span v-if="item.status === 'pending' || item.status === 'processing'" class="status-badge pending">生成中</span>
          <span v-else-if="item.status === 'failed'" class="status-badge failed">生成失败</span>
          <span v-else class="status-badge done">已完成</span>
        </div>

        <!-- 信息区域 -->
        <div class="card-info">
          <strong class="card-title">{{ item.title }}</strong>
          <div class="card-meta">
            <span class="meta-type" :class="item.type">{{ item.type === 'image' ? '图像' : '视频' }}</span>
            <span class="meta-cost">{{ item.cost }} 积分</span>
          </div>
          <div class="card-footer">
            <span class="meta-date">{{ formatDate(item.createdAt) }}</span>
            <div class="card-actions" v-if="!selectMode">
              <button class="icon-btn" @click.stop="downloadFile(item)" title="下载">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              </button>
              <button class="icon-btn danger" @click.stop="deleteItem(item.id)" title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <Teleport to="body">
      <div v-if="previewItem" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" @click.self="previewItem = null">
        <div class="preview-modal">
          <button class="close-btn" @click="previewItem = null">✕</button>
          <div class="preview-content">
            <template v-if="previewItem.fileUrl">
              <img v-if="previewItem.type === 'image'" :src="previewItem.fileUrl" :alt="previewItem.title" />
              <div v-else class="video-preview">
                <video v-if="previewItem.fileUrl" :src="previewItem.previewUrl || previewItem.fileUrl" :poster="previewItem.thumbnailUrl || undefined" controls playsinline></video>
              </div>
            </template>
            <div v-else class="no-preview">
              <span>{{ previewItem.type === 'image' ? '🖼' : '🎬' }}</span>
              <p>该资产暂无预览</p>
            </div>
          </div>
          <div class="preview-info">
            <h3>{{ previewItem.title }}</h3>
            <dl>
              <div><dt>类型</dt><dd>{{ previewItem.type === 'image' ? '图像' : '视频' }}</dd></div>
              <div><dt>来源</dt><dd>{{ previewItem.source }}</dd></div>
              <div><dt>消耗</dt><dd>{{ previewItem.cost }} 积分</dd></div>
              <div><dt>状态</dt><dd>{{ previewItem.status === 'failed' ? '生成失败' : previewItem.status === 'pending' || previewItem.status === 'processing' ? '生成中' : '已完成' }}</dd></div>
              <div><dt>创建时间</dt><dd>{{ formatDate(previewItem.createdAt) }}</dd></div>
            </dl>
            <div v-if="previewItem.prompt" class="preview-prompt">
              <strong>提示词</strong>
              <p>{{ previewItem.prompt }}</p>
            </div>
            <div class="preview-actions">
              <button class="btn primary" @click="downloadFile(previewItem); previewItem = null">下载</button>
              <button class="btn danger" @click="deleteItem(previewItem.id); previewItem = null">删除</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.page-desc{color:#98a2b3;font-size:14px;margin:0 0 16px;line-height:1.6}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.stat-card{border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#fff}
.stat-card span{color:#98a2b3;font-size:12px;font-weight:700}
.stat-card strong{display:block;font-size:32px;margin:4px 0;color:#1f2937}
.stat-card small{color:#98a2b3;font-size:12px}
.filter-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px;flex-wrap:wrap}
.filter-tabs{display:flex;gap:4px;background:#f3f4f6;border-radius:999px;padding:4px}
.filter-tabs button{border:none;background:transparent;padding:8px 16px;border-radius:999px;font-weight:700;font-size:13px;color:#6b7280;cursor:pointer;transition:all .15s}
.filter-tabs button.active{background:#5b4eff;color:#fff}
.filter-right{display:flex;gap:8px;align-items:center}
.search-input{border:1px solid #e5e7eb;border-radius:999px;padding:8px 14px;font-size:13px;outline:0;width:240px;background:#fff}
.search-input:focus{border-color:#5b4eff}
.empty-state{display:grid;place-items:center;min-height:300px;border:1px dashed #e5e7eb;border-radius:16px;background:#fbfcfe}
.empty-state span{font-size:16px;font-weight:700;color:#6b7280}
.empty-state p{color:#9ca3af;font-size:13px;margin-top:4px}
.asset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.select-all-bar{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:8px 0}
.select-all-bar span{color:#6b7280;font-size:13px;font-weight:600}
.asset-card{border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#fff;cursor:pointer;transition:all .15s;position:relative}
.asset-card:hover{border-color:#aaa5ff;box-shadow:0 4px 12px rgba(91,78,255,.08)}
.asset-card.selected{border-color:#5b4eff;background:#f4f3ff}
.asset-card.selectable{padding-top:0}
.check-box{position:absolute;top:8px;left:8px;width:24px;height:24px;border-radius:8px;border:2px solid #fff;background:rgba(0,0,0,.3);z-index:5;display:grid;place-items:center;transition:all .15s}
.check-box.checked{background:#5b4eff;border-color:#5b4eff}
.check-box svg{width:16px;height:16px}
.thumb-area{position:relative;width:100%;aspect-ratio:1;overflow:hidden;background:#f9fafb}
.thumb-area img{width:100%;height:100%;object-fit:contain}
.asset-hover-video{position:absolute;inset:0;z-index:2;width:100%;height:100%;object-fit:cover;background:#111827}
.video-thumb{position:absolute;inset:0;z-index:1;width:100%;height:100%;display:grid;place-items:center;background:rgba(17,24,39,.16)}
.play-icon{font-size:32px;color:rgba(255,255,255,.8)}
.video-label{position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.5);color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}
.placeholder-thumb{width:100%;height:100%;display:grid;place-items:center;background:#f3f4f6}
.placeholder-thumb span{font-size:40px;opacity:.4}
.status-badge{position:absolute;z-index:3;top:8px;right:8px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700}
.status-badge.done{background:#dcfce7;color:#15803d}
.status-badge.pending{background:#fef3c7;color:#d97706}
.status-badge.failed{background:#fee2e2;color:#b42318}
.card-info{padding:12px}
.card-title{display:block;font-size:13px;font-weight:700;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-meta{display:flex;justify-content:space-between;align-items:center;margin:6px 0}
.meta-type{padding:1px 8px;border-radius:999px;font-size:10px;font-weight:700}
.meta-type.image{background:#dbeafe;color:#1e40af}
.meta-type.video{background:#fce7f3;color:#9d174d}
.meta-cost{font-size:11px;color:#6b7280;font-weight:600}
.card-footer{display:flex;justify-content:space-between;align-items:center}
.meta-date{font-size:11px;color:#9ca3af}
.card-actions{display:flex;gap:4px}
.icon-btn{width:28px;height:28px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;display:grid;place-items:center;cursor:pointer;color:#6b7280;transition:all .15s}
.icon-btn:hover{border-color:#5b4eff;color:#5b4eff}
.icon-btn.danger:hover{border-color:#ef4444;color:#ef4444}
.icon-btn svg{width:14px;height:14px}
.preview-modal{background:#fff;border-radius:20px;max-width:900px;width:90vw;max-height:90vh;display:grid;grid-template-columns:1fr 320px;overflow:hidden;position:relative}
.close-btn{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:none;background:rgba(0,0,0,.1);color:#6b7280;font-size:16px;cursor:pointer;z-index:10}
.close-btn:hover{background:rgba(0,0,0,.2)}
.preview-content{background:#1f2937;display:grid;place-items:center;overflow:hidden;min-height:400px}
.preview-content img{max-width:100%;max-height:70vh;object-fit:contain}
.video-preview video{max-width:100%;max-height:70vh}
.no-preview{display:grid;place-items:center;color:#9ca3af}
.no-preview span{font-size:64px;opacity:.3}
.no-preview p{margin-top:8px;font-size:14px}
.preview-info{padding:24px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}
.preview-info h3{font-size:18px;font-weight:800;color:#1f2937;margin:0}
.preview-info dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0}
.preview-info dl div{border:1px solid #e5e7eb;border-radius:10px;padding:8px;background:#fbfcfe}
.preview-info dt{color:#98a2b3;font-size:11px;font-weight:700}
.preview-info dd{margin:3px 0 0;font-weight:700;font-size:13px}
.preview-prompt{border:1px solid #e5e7eb;border-radius:10px;padding:10px;background:#fbfcfe}
.preview-prompt strong{display:block;font-size:11px;color:#98a2b3;margin-bottom:4px}
.preview-prompt p{margin:0;font-size:12px;color:#475467;line-height:1.5}
.preview-actions{display:flex;gap:8px;margin-top:auto}
.btn{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:8px 14px;font-weight:700;cursor:pointer;color:#475467;font-size:13px;transition:all .15s}
.btn:hover{border-color:#5b4eff;color:#5b4eff}
.btn.active{background:#5b4eff;color:#fff;border-color:#5b4eff}
.btn.primary{background:#5b4eff;color:#fff;border-color:#5b4eff}
.btn.primary:hover{background:#4a3de0}
.btn.danger{color:#ef4444;border-color:#fecaca}
.btn.danger:hover{background:#fef2f2}
@media(max-width:768px){
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .filter-bar{flex-direction:column;align-items:stretch}
  .search-input{width:100%}
  .preview-modal{grid-template-columns:1fr;grid-template-rows:auto auto}
}
</style>
