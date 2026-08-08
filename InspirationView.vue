<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { inspirationApi, type InspirationItem } from '@/api/inspiration'

const router = useRouter()
const items = ref<InspirationItem[]>([])
const loading = ref(false)
const activeType = ref<'image' | 'video'>('image')
const activeCategory = ref('')
const keyword = ref('')
const promoIndex = ref(0)
const detailItem = ref<InspirationItem | null>(null)
const favoriteIds = ref<string[]>(loadFavorites())
const hoveredVideoId = ref<string | null>(null)
const refreshedMediaIds = new Set<string>()

type Promo = {
  id: string
  eyebrow: string
  title: string
  desc: string
  image: string
  linkUrl?: string
  type?: 'image' | 'video'
  category?: string
}
const promos = ref<Promo[]>([])
const visiblePromos = computed(() => {
  const count = Math.min(3, promos.value.length)
  return Array.from({ length: count }, (_, offset) => promos.value[(promoIndex.value + offset) % promos.value.length])
})

const fallbackCategories = {
  image: ['商品主图', '商品场景图', '模特图', '活动海报', '信息流广告', '跨境素材'],
  video: ['种草视频', '口播带货', '品牌大片', '商品视频', '创意视频'],
}
const categoryOptions = ref<{ image: string[]; video: string[] }>({
  image: [...fallbackCategories.image],
  video: [...fallbackCategories.video],
})
const categories = computed(() => categoryOptions.value[activeType.value])
const searchTags = ['护肤', '鞋服', '数码', '家居', '食品']

let keywordTimer: ReturnType<typeof setTimeout> | null = null
let promoTimer: ReturnType<typeof setInterval> | null = null

function loadFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem('fusionai_inspiration_favorites') || '[]') } catch { return [] }
}

async function loadData() {
  loading.value = true
  try {
    items.value = await inspirationApi.list({
      type: activeType.value,
      category: activeCategory.value || undefined,
      keyword: keyword.value.trim() || undefined,
    })
  } catch (e) {
    console.error('加载灵感数据失败', e)
    items.value = []
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const result = await inspirationApi.categories()
    categoryOptions.value = {
      image: result.image?.length ? result.image : [...fallbackCategories.image],
      video: result.video?.length ? result.video : [...fallbackCategories.video],
    }
    if (activeCategory.value && !categoryOptions.value[activeType.value].includes(activeCategory.value)) {
      activeCategory.value = ''
    }
  } catch (error) {
    console.error('加载灵感类目失败', error)
  }
}

watch([activeType, activeCategory], loadData)
watch(keyword, () => {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(loadData, 300)
})

function switchType(type: 'image' | 'video') {
  activeType.value = type
  activeCategory.value = ''
}

function shiftPromo(dir: number) {
  if (!promos.value.length) return
  promoIndex.value = (promoIndex.value + dir + promos.value.length) % promos.value.length
}

function applyPromo(promo: Promo) {
  if (promo.linkUrl) {
    if (/^https?:\/\//i.test(promo.linkUrl)) window.open(promo.linkUrl, '_blank', 'noopener,noreferrer')
    else router.push(promo.linkUrl.startsWith('/') ? promo.linkUrl : `/${promo.linkUrl}`)
    return
  }
  if (!promo.type || !promo.category) return
  activeType.value = promo.type
  activeCategory.value = promo.category
  keyword.value = ''
}

async function loadPromos() {
  try {
    const banners = await inspirationApi.banners()
    if (banners.length) {
      promos.value = banners.map(item => ({
        id: item.id,
        eyebrow: '官方推荐',
        title: item.title,
        desc: '点击查看详情',
        image: item.imageUrl,
        linkUrl: item.linkUrl,
      }))
      promoIndex.value = 0
      return
    }
  } catch (error) {
    console.error('加载 Banner 失败', error)
  }

  try {
    const featured = await inspirationApi.featured()
    const selected = [
      featured.find(item => item.category === '商品场景图'),
      featured.find(item => item.type === 'video'),
      featured.find(item => item.category === '商品主图'),
    ].filter((item, index, array): item is InspirationItem => Boolean(item?.thumbnailUrl) && array.findIndex(candidate => candidate?.id === item?.id) === index)
    promos.value = selected.map(item => ({
      id: item.id,
      eyebrow: item.category,
      title: item.title,
      desc: `${item.product} · ${item.model}`,
      image: item.posterUrl || item.thumbnailUrl!,
      type: item.type,
      category: item.category,
    }))
  } catch {
    promos.value = []
  }
}

async function openDetail(item: InspirationItem) {
  detailItem.value = item
  try { detailItem.value = await inspirationApi.detail(item.id) } catch { /* Keep the card data as a usable fallback. */ }
}
function mediaUrl(item: InspirationItem) { return item.previewUrl || item.thumbnailUrl || '' }
function hasPlayableVideo(item: InspirationItem) { return item.type === 'video' && Boolean(mediaUrl(item)) }
function startHoverPreview(item: InspirationItem) {
  if (!hasPlayableVideo(item) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  hoveredVideoId.value = item.id
}
function stopHoverPreview(item: InspirationItem) {
  if (hoveredVideoId.value === item.id) hoveredVideoId.value = null
}
function refreshMediaOnce(item: InspirationItem) {
  if (refreshedMediaIds.has(item.id)) return
  refreshedMediaIds.add(item.id)
  void loadData()
}

function toggleFavorite(item: InspirationItem) {
  favoriteIds.value = favoriteIds.value.includes(item.id)
    ? favoriteIds.value.filter(id => id !== item.id)
    : [...favoriteIds.value, item.id]
  localStorage.setItem('fusionai_inspiration_favorites', JSON.stringify(favoriteIds.value))
}

function reuseInspiration(item: InspirationItem) {
  const ratio = item.ratio
    || item.prompt.match(/(?:^|\s)(21:9|16:9|9:16|4:3|3:4|3:2|2:3|4:5|5:4|1:1)(?:\s|$|，|。)/)?.[1]
    || (/(?:竖版|竖屏)/.test(item.prompt) ? '9:16' : /(?:横版|横屏)/.test(item.prompt) ? '16:9' : undefined)
  const seconds = item.seconds || Number(item.prompt.match(/(\d+)\s*秒/)?.[1] || 0) || undefined
  const quality = item.quality || item.prompt.match(/(?:^|\s)(512|1K|2K|4K|720P|1080P)(?:\s|$|，|。)/i)?.[1]?.toUpperCase()
  sessionStorage.setItem('fusionai_inspiration_draft', JSON.stringify({
    prompt: item.prompt,
    title: item.title,
    type: item.type,
    category: item.category,
    sourceId: item.id,
    model: item.model,
    modelId: item.modelId,
    generationType: item.generationType,
    ratio,
    seconds,
    quality,
  }))
  detailItem.value = null
  router.push(item.type === 'image' ? '/image' : '/video')
}

function viewSimilar() {
  if (!detailItem.value) return
  keyword.value = ''
  activeType.value = detailItem.value.type
  activeCategory.value = detailItem.value.category
  detailItem.value = null
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape') detailItem.value = null
}

onMounted(() => {
  loadCategories()
  loadData()
  loadPromos()
  window.addEventListener('keydown', handleEscape)
  promoTimer = setInterval(() => shiftPromo(1), 6500)
})

onUnmounted(() => {
  if (keywordTimer) clearTimeout(keywordTimer)
  if (promoTimer) clearInterval(promoTimer)
  window.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div class="inspiration-page">
    <section class="discovery-band" aria-label="灵感搜索与推荐">
      <div class="search-column">
        <div class="search-heading">
          <span>发现可直接复用的创作灵感</span>
          <small>搜索标题、行业、商品或提示词</small>
        </div>
        <label class="hero-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input v-model="keyword" type="search" placeholder="例如：运动鞋场景图、护肤品主图、家居短片" />
          <button v-if="keyword" type="button" title="清空搜索" @click="keyword = ''">×</button>
        </label>
        <div class="search-tags" aria-label="推荐搜索">
          <span>推荐</span>
          <button v-for="tag in searchTags" :key="tag" @click="keyword = keyword === tag ? '' : tag" :class="{ active: keyword === tag }">{{ tag }}</button>
        </div>
      </div>

      <div class="promo-strip" aria-label="推荐主题">
        <button class="promo-arrow left" type="button" title="上一组推荐" @click="shiftPromo(-1)">
          <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button v-for="(promo, index) in visiblePromos" :key="promo.id" type="button" class="promo" :class="{ 'promo-third': index === 2 }" @click="applyPromo(promo)">
          <img :src="promo.image" alt="" />
          <span class="promo-shade"></span>
          <span class="promo-copy">
            <small>{{ promo.eyebrow }}</small>
            <strong>{{ promo.title }}</strong>
            <em>{{ promo.desc }}</em>
          </span>
        </button>
        <button class="promo-arrow right" type="button" title="下一组推荐" @click="shiftPromo(1)">
          <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </section>

    <section class="content-toolbar" aria-label="灵感筛选">
      <div class="type-tabs">
        <button :class="{ active: activeType === 'image' }" @click="switchType('image')">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          图片
        </button>
        <button :class="{ active: activeType === 'video' }" @click="switchType('video')">
          <svg viewBox="0 0 24 24"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          视频
        </button>
      </div>
      <div class="category-row">
        <button @click="activeCategory = ''" :class="{ active: !activeCategory }">全部</button>
        <button v-for="cat in categories" :key="cat" @click="activeCategory = cat" :class="{ active: activeCategory === cat }">{{ cat }}</button>
      </div>
      <span class="result-count">{{ loading ? '正在更新' : `共 ${items.length} 个灵感` }}</span>
    </section>

    <div v-if="loading" class="inspiration-grid" aria-label="正在加载">
      <div v-for="i in 6" :key="i" class="inspiration-card skeleton-card"><div class="skeleton-media"></div><i></i><b></b></div>
    </div>
    <div v-else-if="items.length === 0" class="empty-results">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <h2>暂时没有匹配的灵感</h2>
      <p>换一个关键词，或清空筛选查看全部内容。</p>
      <button @click="keyword = ''; activeCategory = ''">查看全部</button>
    </div>
    <div v-else class="inspiration-grid">
      <article v-for="item in items" :key="item.id" class="inspiration-card" tabindex="0" @click="openDetail(item)" @keydown.enter="openDetail(item)" @mouseenter="startHoverPreview(item)" @mouseleave="stopHoverPreview(item)">
        <div class="visual">
          <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" :alt="item.title" loading="lazy" @error="refreshMediaOnce(item)" />
          <div v-else class="media-fallback"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 16l4-4 3 3 4-5 5 6"/></svg></div>
          <video v-if="hasPlayableVideo(item) && hoveredVideoId === item.id" class="hover-preview" :src="mediaUrl(item) || undefined" :poster="item.thumbnailUrl || undefined" autoplay muted loop playsinline preload="metadata" @error="refreshMediaOnce(item)"></video>
          <span class="media-type">{{ item.type === 'video' ? '视频' : '图片' }}</span>
          <button type="button" class="favorite" :class="{ active: favoriteIds.includes(item.id) }" :title="favoriteIds.includes(item.id) ? '取消收藏' : '收藏'" @click.stop="toggleFavorite(item)">
            <svg viewBox="0 0 24 24"><path d="M12 20.5S4 16 4 9.5A4.5 4.5 0 0112 7a4.5 4.5 0 018 2.5c0 6.5-8 11-8 11z"/></svg>
          </button>
          <span class="reuse-hint">查看详情</span>
        </div>
        <div class="card-body">
          <div class="card-meta"><span>{{ item.category }}</span><small>{{ item.model }}</small></div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.prompt }}</p>
          <div class="card-footer"><span>{{ item.product }}</span><strong>{{ item.cost }} 积分</strong></div>
        </div>
      </article>
    </div>

    <Teleport to="body">
      <div v-if="detailItem" class="detail-backdrop" @click.self="detailItem = null">
        <section class="detail-dialog" role="dialog" aria-modal="true" :aria-label="detailItem.title">
          <button class="dialog-close" type="button" title="关闭" @click="detailItem = null">
            <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
          <div class="detail-media">
            <video v-if="hasPlayableVideo(detailItem)" :src="mediaUrl(detailItem) || undefined" :poster="detailItem.posterUrl || undefined" controls autoplay muted loop playsinline></video>
            <img v-else-if="detailItem.thumbnailUrl" :src="detailItem.thumbnailUrl" :alt="detailItem.title" />
          </div>
          <div class="detail-content">
            <div class="detail-eyebrow"><span>{{ detailItem.category }}</span><small>{{ detailItem.type === 'video' ? '视频灵感' : '图片灵感' }}</small></div>
            <h2>{{ detailItem.title }}</h2>
            <p class="detail-prompt">{{ detailItem.prompt }}</p>
            <dl class="detail-grid">
              <div><dt>推荐模型</dt><dd>{{ detailItem.model }}</dd></div>
              <div><dt>预计消耗</dt><dd>{{ detailItem.cost }} 积分</dd></div>
              <div><dt>适用商品</dt><dd>{{ detailItem.product }}</dd></div>
              <div><dt>内容类型</dt><dd>{{ detailItem.category }}</dd></div>
            </dl>
            <div v-if="detailItem.sourceName" class="source-note">
              <span>内容说明</span>
              <strong>{{ detailItem.sourceName }}</strong>
              <small>{{ detailItem.copyrightNote }}</small>
            </div>
            <div class="detail-actions">
              <button class="primary-action" @click="reuseInspiration(detailItem)">
                一键复用
                <svg viewBox="0 0 24 24"><path d="M5 12h14m-5-5l5 5-5 5"/></svg>
              </button>
              <button @click="viewSimilar">查看相似</button>
              <button class="icon-action" :class="{ active: favoriteIds.includes(detailItem.id) }" :title="favoriteIds.includes(detailItem.id) ? '取消收藏' : '收藏'" @click="toggleFavorite(detailItem)">
                <svg viewBox="0 0 24 24"><path d="M12 20.5S4 16 4 9.5A4.5 4.5 0 0112 7a4.5 4.5 0 018 2.5c0 6.5-8 11-8 11z"/></svg>
              </button>
            </div>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.inspiration-page{display:grid;gap:20px;color:#172033}.discovery-band{display:grid;grid-template-columns:minmax(340px,.78fr) minmax(560px,1.22fr);gap:24px;align-items:center;padding:22px 0 24px;border-bottom:1px solid #e7eaf0}.search-column{min-width:0}.search-heading{display:grid;gap:4px;margin-bottom:14px}.search-heading span{font-size:22px;font-weight:800}.search-heading small{font-size:13px;color:#7c879b}.hero-search{height:54px;border:1px solid #d8dde7;border-radius:8px;background:#fff;display:flex;align-items:center;gap:11px;padding:0 14px;box-shadow:0 3px 12px rgba(19,33,68,.05)}.hero-search:focus-within{border-color:#5b4eff;box-shadow:0 0 0 3px rgba(91,78,255,.1)}.hero-search svg{width:21px;height:21px;fill:none;stroke:#667085;stroke-width:1.8}.hero-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;font-size:15px;color:#172033}.hero-search button{width:26px;height:26px;border:0;border-radius:50%;background:#eef1f5;color:#667085;cursor:pointer}.search-tags{display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap}.search-tags span{font-size:12px;color:#98a2b3}.search-tags button,.category-row button{border:0;background:transparent;padding:6px 9px;border-radius:6px;color:#667085;font-size:13px;font-weight:700;cursor:pointer}.search-tags button:hover,.search-tags button.active,.category-row button:hover{background:#f1f3f8;color:#2f2a8f}.promo-strip{position:relative;display:grid;grid-template-columns:1.1fr 1.1fr .8fr;gap:10px;min-width:0}.promo{height:158px;position:relative;overflow:hidden;border:0;border-radius:8px;padding:0;text-align:left;cursor:pointer;background:#e8ebf1;isolation:isolate}.promo img{width:100%;height:100%;object-fit:cover;transition:transform .28s ease}.promo-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,15,31,.04) 20%,rgba(8,15,31,.84) 100%)}.promo-copy{position:absolute;inset:auto 15px 14px;display:grid;gap:3px;color:#fff}.promo-copy small{font-size:11px;font-weight:800;opacity:.78}.promo-copy strong{font-size:16px;line-height:1.25}.promo-copy em{font-size:10px;font-style:normal;opacity:.78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.promo:hover img,.promo.focus img{transform:scale(1.045)}.promo.focus{box-shadow:0 0 0 2px #5b4eff}.promo-arrow{position:absolute;top:50%;z-index:3;width:32px;height:32px;transform:translateY(-50%);display:grid;place-items:center;border:1px solid #e0e4ec;border-radius:50%;background:rgba(255,255,255,.94);box-shadow:0 4px 14px rgba(15,23,42,.12);cursor:pointer}.promo-arrow svg{width:17px;height:17px;fill:none;stroke:#344054;stroke-width:2}.promo-arrow.left{left:-14px}.promo-arrow.right{right:-14px}.content-toolbar{min-height:48px;display:flex;align-items:center;gap:18px;border-bottom:1px solid #edf0f4}.type-tabs{display:flex;gap:4px}.type-tabs button{height:36px;border:0;border-radius:6px;background:transparent;padding:0 12px;display:flex;align-items:center;gap:7px;color:#667085;font-weight:800;cursor:pointer}.type-tabs button.active{background:#25233f;color:#fff}.type-tabs svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8}.category-row{display:flex;gap:2px;flex:1;flex-wrap:wrap}.category-row button.active{background:#eef0ff;color:#4338ca}.result-count{font-size:12px;color:#98a2b3;white-space:nowrap}.inspiration-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.inspiration-card{min-width:0;border:1px solid #e5e8ee;border-radius:8px;background:#fff;overflow:hidden;cursor:pointer;transition:border-color .18s,box-shadow .18s,transform .18s}.inspiration-card:hover,.inspiration-card:focus-visible{border-color:#aaa7ff;box-shadow:0 12px 28px rgba(29,36,63,.09);transform:translateY(-2px);outline:0}.visual{height:188px;position:relative;overflow:hidden;background:#eef1f5}.visual>img,.visual>video{width:100%;height:100%;display:block;object-fit:cover;transition:transform .28s ease}.inspiration-card:hover .visual>img,.inspiration-card:hover .visual>video{transform:scale(1.035)}.media-type{position:absolute;left:10px;top:10px;padding:4px 7px;border-radius:5px;background:rgba(16,24,40,.7);color:#fff;font-size:11px;font-weight:800;backdrop-filter:blur(6px)}.favorite{position:absolute;right:10px;top:10px;width:30px;height:30px;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(255,255,255,.9);color:#5e6675;cursor:pointer;box-shadow:0 3px 10px rgba(15,23,42,.12)}.favorite svg,.icon-action svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8}.favorite.active,.icon-action.active{color:#e54868}.favorite.active svg,.icon-action.active svg{fill:currentColor}.reuse-hint{position:absolute;right:10px;bottom:10px;padding:6px 9px;border-radius:5px;background:rgba(255,255,255,.92);color:#25233f;font-size:11px;font-weight:800;opacity:0;transform:translateY(4px);transition:.18s}.inspiration-card:hover .reuse-hint{opacity:1;transform:none}.card-body{padding:13px}.card-meta{display:flex;align-items:center;gap:8px;color:#6f63e9;font-size:11px;font-weight:800}.card-meta small{min-width:0;color:#98a2b3;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card-body h3{margin:8px 0 6px;font-size:15px;line-height:1.35}.card-body p{height:42px;margin:0;color:#7c879b;font-size:12px;line-height:1.65;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.card-footer{margin-top:11px;padding-top:10px;border-top:1px solid #f0f2f5;display:flex;justify-content:space-between;gap:8px;font-size:11px}.card-footer span{color:#667085}.card-footer strong{color:#344054}.media-fallback{width:100%;height:100%;display:grid;place-items:center}.media-fallback svg{width:38px;height:38px;fill:none;stroke:#b7bfcc;stroke-width:1.5}.skeleton-card{height:300px;pointer-events:none;padding:12px}.skeleton-media{height:176px;border-radius:6px;background:#edf0f4;animation:pulse 1.4s ease-in-out infinite}.skeleton-card i,.skeleton-card b{display:block;height:12px;margin-top:14px;border-radius:4px;background:#edf0f4;animation:pulse 1.4s ease-in-out infinite}.skeleton-card b{width:68%}.empty-results{min-height:360px;display:grid;place-items:center;align-content:center;text-align:center;color:#7c879b}.empty-results svg{width:40px;height:40px;fill:none;stroke:#b0b8c6;stroke-width:1.5}.empty-results h2{margin:14px 0 4px;font-size:18px;color:#344054}.empty-results p{margin:0 0 16px;font-size:13px}.empty-results button{border:1px solid #d8dde7;border-radius:7px;background:#fff;padding:8px 14px;font-weight:800;color:#475467;cursor:pointer}.detail-backdrop{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:28px;background:rgba(12,18,30,.68);backdrop-filter:blur(5px)}.detail-dialog{position:relative;width:min(1040px,94vw);max-height:90vh;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(360px,.8fr);overflow:hidden;border-radius:10px;background:#fff;box-shadow:0 28px 80px rgba(0,0,0,.32)}.dialog-close{position:absolute;right:14px;top:14px;z-index:3;width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.28);border-radius:50%;background:rgba(15,23,42,.58);color:#fff;cursor:pointer}.dialog-close svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2}.detail-media{min-height:570px;background:#171923;display:grid;place-items:center;overflow:hidden}.detail-media img,.detail-media video{width:100%;height:100%;max-height:90vh;object-fit:contain}.detail-content{padding:38px 34px 30px;overflow-y:auto}.detail-eyebrow{display:flex;gap:8px;align-items:center}.detail-eyebrow span,.detail-eyebrow small{padding:5px 8px;border-radius:5px;background:#eef0ff;color:#4f46e5;font-size:11px;font-weight:800}.detail-eyebrow small{background:#f1f3f6;color:#667085}.detail-content h2{margin:14px 0 12px;font-size:25px;line-height:1.25}.detail-prompt{margin:0;color:#5f6b7d;font-size:14px;line-height:1.8}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;margin:22px 0;background:#e9ecf1;border:1px solid #e9ecf1;border-radius:7px;overflow:hidden}.detail-grid div{padding:12px;background:#fff}.detail-grid dt{font-size:11px;color:#98a2b3}.detail-grid dd{margin:5px 0 0;font-size:13px;font-weight:800}.source-note{display:grid;gap:5px;padding:12px;border-left:3px solid #8b83ff;background:#f7f7fb}.source-note span{font-size:11px;color:#98a2b3}.source-note strong{font-size:12px;color:#475467}.source-note small{font-size:11px;line-height:1.55;color:#7c879b}.detail-actions{display:flex;gap:8px;margin-top:24px}.detail-actions button{height:42px;border:1px solid #d8dde7;border-radius:7px;background:#fff;padding:0 14px;color:#475467;font-weight:800;cursor:pointer}.detail-actions .primary-action{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;border-color:#5b4eff;background:#5b4eff;color:#fff}.primary-action svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2}.detail-actions .icon-action{width:42px;padding:0;display:grid;place-items:center}@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}@media(max-width:1180px){.discovery-band{grid-template-columns:1fr}.inspiration-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:820px){.promo-strip{grid-template-columns:1fr 1fr}.promo:last-of-type{display:none}.content-toolbar{align-items:flex-start;flex-wrap:wrap}.category-row{order:3;width:100%;flex-basis:100%}.result-count{margin-left:auto}.inspiration-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.detail-dialog{grid-template-columns:1fr;overflow-y:auto}.detail-media{min-height:300px;max-height:46vh}.detail-content{overflow:visible}}@media(max-width:560px){.inspiration-grid{grid-template-columns:1fr}.promo-strip{grid-template-columns:1fr}.promo:not(.focus){display:none}.detail-backdrop{padding:10px}.detail-content{padding:26px 20px}.detail-grid{grid-template-columns:1fr}.detail-actions{flex-wrap:wrap}.visual{height:220px}}
</style>

<style scoped>
.inspiration-page{container-type:inline-size}
.visual>video.hover-preview{position:absolute;inset:0;z-index:1}
.media-type,.favorite{z-index:2}
.promo-arrow.left{left:8px}
.promo-arrow.right{right:8px}
.detail-dialog{height:min(720px,90vh);max-height:none;min-height:0}
.detail-content{min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
.detail-actions{position:sticky;bottom:-30px;z-index:2;padding:14px 0 30px;background:#fff;border-top:1px solid #eef0f4}

@container (max-width:1100px){
  .discovery-band{grid-template-columns:320px minmax(0,1fr);gap:18px}
  .promo-strip{grid-template-columns:repeat(2,minmax(0,1fr));padding:0}
  .promo-third{display:none}
  .promo-copy em{display:none}
  .inspiration-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
  .visual{height:205px}
}

@container (max-width:780px){
  .discovery-band{grid-template-columns:1fr;gap:16px;padding-top:14px}
  .search-heading{margin-bottom:10px}
  .promo-strip{grid-template-columns:repeat(2,minmax(0,1fr))}
  .content-toolbar{align-items:flex-start;flex-wrap:wrap;padding-bottom:10px}
  .category-row{order:3;flex-basis:100%}
  .result-count{margin-left:auto}
  .inspiration-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}

@container (max-width:500px){
  .promo-strip{grid-template-columns:1fr}
  .promo:not(.focus){display:none}
  .promo-third.focus{display:block}
  .inspiration-grid{grid-template-columns:1fr}
}
</style>
