<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { opsApi, type OverviewData, type TrendData, type RecentData, type CommerceStat } from '@/api/ops'

const loading = ref(true)
const overview = ref<OverviewData | null>(null)
const trend = ref<TrendData | null>(null)
const recent = ref<RecentData | null>(null)
const commerceStats = ref<CommerceStat[]>([])
const activeTab = ref<'assets' | 'tasks' | 'ledgers'>('assets')

const maxAssetTrend = computed(() => {
  if (!trend.value?.assetTrend.length) return 1
  return Math.max(...trend.value.assetTrend.map(t => t.count), 1)
})
const maxTaskTrend = computed(() => {
  if (!trend.value?.taskTrend.length) return 1
  return Math.max(...trend.value.taskTrend.map(t => t.count), 1)
})

function formatSize(bytes: number) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

function formatDate(d: string) {
  const date = new Date(d)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

function formatShortDate(d: string) {
  const date = new Date(d)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const ledgerTypeMap: Record<string, { label: string; color: string }> = {
  recharge: { label: '充值', color: '#10b981' },
  subscription: { label: '订阅', color: '#3b82f6' },
  generation: { label: '消费', color: '#ef4444' },
  refund: { label: '退款', color: '#f59e0b' },
}

async function loadData() {
  loading.value = true
  try {
    const [ov, tr, rc, cs] = await Promise.all([
      opsApi.overview(),
      opsApi.trend(),
      opsApi.recent(),
      opsApi.commerce(),
    ])
    overview.value = ov
    trend.value = tr
    recent.value = rc
    commerceStats.value = cs
  } catch (e) {
    console.error('加载运营数据失败', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="ops-view">
    <div class="ops-header">
      <h2>运营管理后台</h2>
      <button class="btn-refresh" @click="loadData" :disabled="loading">
        {{ loading ? '加载中...' : '刷新数据' }}
      </button>
    </div>

    <div v-if="loading" class="loading-state">加载中...</div>

    <template v-else>
      <!-- 核心指标卡片 -->
      <div class="kpi-grid" v-if="overview">
        <div class="kpi-card users">
          <div class="kpi-icon">👥</div>
          <div class="kpi-body">
            <span class="kpi-label">总用户数</span>
            <strong class="kpi-value">{{ overview.users.total }}</strong>
            <div class="kpi-sub">
              <span v-for="p in overview.users.planDistribution" :key="p.plan" class="plan-tag">
                {{ p.plan }}: {{ p.count }}
              </span>
            </div>
          </div>
        </div>
        <div class="kpi-card credits">
          <div class="kpi-icon">💎</div>
          <div class="kpi-body">
            <span class="kpi-label">积分余额</span>
            <strong class="kpi-value">{{ overview.users.totalCredits.toLocaleString() }}</strong>
            <small class="kpi-sub">全部用户积分汇总</small>
          </div>
        </div>
        <div class="kpi-card recharge">
          <div class="kpi-icon">💰</div>
          <div class="kpi-body">
            <span class="kpi-label">总充值积分</span>
            <strong class="kpi-value">{{ overview.finance.totalRecharge.toLocaleString() }}</strong>
            <small class="kpi-sub">充值 + 订阅 {{ (overview.finance.totalRecharge + overview.finance.totalSubscription).toLocaleString() }}</small>
          </div>
        </div>
        <div class="kpi-card consumption">
          <div class="kpi-icon">🔥</div>
          <div class="kpi-body">
            <span class="kpi-label">总消费积分</span>
            <strong class="kpi-value">{{ overview.finance.totalConsumption.toLocaleString() }}</strong>
            <small class="kpi-sub">AI 生成消耗</small>
          </div>
        </div>
        <div class="kpi-card assets">
          <div class="kpi-icon">🖼</div>
          <div class="kpi-body">
            <span class="kpi-label">AI 资产</span>
            <strong class="kpi-value">{{ overview.content.totalAssets }}</strong>
            <small class="kpi-sub">图片 {{ overview.content.imageAssets }} · 视频 {{ overview.content.videoAssets }}</small>
          </div>
        </div>
        <div class="kpi-card materials">
          <div class="kpi-icon">📁</div>
          <div class="kpi-body">
            <span class="kpi-label">素材文件</span>
            <strong class="kpi-value">{{ overview.content.totalMaterials }}</strong>
            <small class="kpi-sub">{{ formatSize(overview.content.totalMaterialSize) }} 存储用量</small>
          </div>
        </div>
        <div class="kpi-card tasks">
          <div class="kpi-icon">⚡</div>
          <div class="kpi-body">
            <span class="kpi-label">电商任务</span>
            <strong class="kpi-value">{{ overview.commerce.totalTasks }}</strong>
            <small class="kpi-sub">完成 {{ overview.commerce.completedTasks }} · 失败 {{ overview.commerce.failedTasks }}</small>
          </div>
        </div>
        <div class="kpi-card success-rate">
          <div class="kpi-icon">📈</div>
          <div class="kpi-body">
            <span class="kpi-label">任务成功率</span>
            <strong class="kpi-value">{{ overview.commerce.totalTasks > 0 ? ((overview.commerce.completedTasks / overview.commerce.totalTasks) * 100).toFixed(1) : '0' }}%</strong>
            <small class="kpi-sub">电商工具完成率</small>
          </div>
        </div>
      </div>

      <!-- 趋势图表 -->
      <div class="section-grid" v-if="trend">
        <div class="chart-card">
          <h3>资产生成趋势（7 天）</h3>
          <div class="bar-chart">
            <div v-for="item in trend.assetTrend" :key="item.date" class="bar-col">
              <div class="bar-fill" :style="{ height: (item.count / maxAssetTrend * 100) + '%' }">
                <span class="bar-value" v-if="item.count > 0">{{ item.count }}</span>
              </div>
              <span class="bar-label">{{ formatShortDate(item.date) }}</span>
            </div>
            <div v-if="!trend.assetTrend.length" class="no-data">暂无数据</div>
          </div>
        </div>
        <div class="chart-card">
          <h3>电商任务趋势（7 天）</h3>
          <div class="bar-chart">
            <div v-for="item in trend.taskTrend" :key="item.date" class="bar-col">
              <div class="bar-fill task" :style="{ height: (item.count / maxTaskTrend * 100) + '%' }">
                <span class="bar-value" v-if="item.count > 0">{{ item.count }}</span>
              </div>
              <span class="bar-label">{{ formatShortDate(item.date) }}</span>
            </div>
            <div v-if="!trend.taskTrend.length" class="no-data">暂无数据</div>
          </div>
        </div>
      </div>

      <!-- 电商工具使用统计 -->
      <div class="section-card" v-if="commerceStats.length">
        <h3>电商工具使用统计</h3>
        <div class="commerce-table">
          <div class="ct-header">
            <span>工具名称</span>
            <span>总使用</span>
            <span>成功</span>
            <span>失败</span>
            <span>成功率</span>
          </div>
          <div v-for="t in commerceStats" :key="t.toolId" class="ct-row">
            <span class="ct-name">{{ t.toolName }}</span>
            <span>{{ t.count }}</span>
            <span class="text-green">{{ t.completed }}</span>
            <span class="text-red" v-if="t.failed">{{ t.failed }}</span>
            <span v-else>0</span>
            <span>{{ t.count > 0 ? ((t.completed / t.count) * 100).toFixed(1) : '0' }}%</span>
          </div>
        </div>
      </div>

      <!-- 最近活动 -->
      <div class="section-card">
        <div class="tabs-bar">
          <button :class="{ active: activeTab === 'assets' }" @click="activeTab = 'assets'">最近资产</button>
          <button :class="{ active: activeTab === 'tasks' }" @click="activeTab = 'tasks'">最近任务</button>
          <button :class="{ active: activeTab === 'ledgers' }" @click="activeTab = 'ledgers'">最近账单</button>
        </div>

        <!-- 最近资产 -->
        <div v-if="activeTab === 'assets' && recent" class="activity-list">
          <div v-for="a in recent.recentAssets" :key="a.id" class="activity-row">
            <div class="act-thumb">
              <img v-if="a.thumbnailUrl" :src="a.thumbnailUrl" :alt="a.title" />
              <span v-else>{{ a.type === 'image' ? '🖼' : '🎬' }}</span>
            </div>
            <div class="act-info">
              <strong>{{ a.title }}</strong>
              <small>{{ a.source }} · 消耗 {{ a.cost }} 积分</small>
            </div>
            <span class="act-status" :class="a.status">{{ a.status === 'completed' ? '已完成' : '处理中' }}</span>
            <span class="act-time">{{ formatDate(a.createdAt) }}</span>
          </div>
          <div v-if="!recent.recentAssets.length" class="no-data">暂无记录</div>
        </div>

        <!-- 最近任务 -->
        <div v-if="activeTab === 'tasks' && recent" class="activity-list">
          <div v-for="t in recent.recentTasks" :key="t.id" class="activity-row">
            <div class="act-thumb">
              <span>⚡</span>
            </div>
            <div class="act-info">
              <strong>{{ t.toolName }}</strong>
              <small>消耗 {{ t.cost }} 积分</small>
            </div>
            <span class="act-status" :class="t.status">
              {{ t.status === 'completed' ? '已完成' : t.status === 'failed' ? '失败' : '处理中' }}
            </span>
            <span class="act-time">{{ formatDate(t.createdAt) }}</span>
          </div>
          <div v-if="!recent.recentTasks.length" class="no-data">暂无记录</div>
        </div>

        <!-- 最近账单 -->
        <div v-if="activeTab === 'ledgers' && recent" class="activity-list">
          <div v-for="l in recent.recentLedgers" :key="l.id" class="activity-row">
            <div class="act-thumb">
              <span :style="{ color: ledgerTypeMap[l.type]?.color || '#6b7280' }">
                {{ l.change > 0 ? '+' : '' }}{{ l.change }}
              </span>
            </div>
            <div class="act-info">
              <strong>{{ ledgerTypeMap[l.type]?.label || l.type }}</strong>
              <small>{{ l.note }}</small>
            </div>
            <span class="act-balance">余额 {{ l.balance.toLocaleString() }}</span>
            <span class="act-time">{{ formatDate(l.createdAt) }}</span>
          </div>
          <div v-if="!recent.recentLedgers.length" class="no-data">暂无记录</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ops-view{padding:0}
.ops-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.ops-header h2{font-size:22px;font-weight:800;color:#1f2937;margin:0}
.btn-refresh{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:8px 16px;font-weight:700;cursor:pointer;color:#475467;font-size:13px;transition:all .15s}
.btn-refresh:hover{border-color:#5b4eff;color:#5b4eff}
.btn-refresh:disabled{opacity:.5;cursor:not-allowed}
.loading-state{display:grid;place-items:center;min-height:400px;color:#9ca3af;font-size:14px}

/* KPI Grid */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.kpi-card{border:1px solid #e5e7eb;border-radius:16px;padding:18px;background:#fff;display:flex;gap:14px;align-items:flex-start;transition:all .15s}
.kpi-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.06)}
.kpi-icon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:22px;flex-shrink:0}
.kpi-card.users .kpi-icon{background:#eef2ff}
.kpi-card.credits .kpi-icon{background:#fef3c7}
.kpi-card.recharge .kpi-icon{background:#d1fae5}
.kpi-card.consumption .kpi-icon{background:#fee2e2}
.kpi-card.assets .kpi-icon{background:#e0e7ff}
.kpi-card.materials .kpi-icon{background:#f3e8ff}
.kpi-card.tasks .kpi-icon{background:#fef9c3}
.kpi-card.success-rate .kpi-icon{background:#d1fae5}
.kpi-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.kpi-label{color:#98a2b3;font-size:12px;font-weight:700}
.kpi-value{font-size:28px;font-weight:800;color:#1f2937;line-height:1.2}
.kpi-sub{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.kpi-sub small{font-size:11px;color:#98a2b3}
.plan-tag{font-size:10px;color:#5b4eff;background:#eef2ff;border-radius:999px;padding:1px 8px;font-weight:700}

/* Charts */
.section-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
.chart-card{border:1px solid #e5e7eb;border-radius:16px;padding:20px;background:#fff}
.chart-card h3{font-size:15px;font-weight:800;color:#1f2937;margin:0 0 16px}
.bar-chart{display:flex;gap:8px;align-items:flex-end;height:180px;padding-bottom:24px;position:relative}
.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end}
.bar-fill{width:100%;max-width:40px;border-radius:8px 8px 0 0;background:linear-gradient(180deg,#7c6fff,#5b4eff);min-height:4px;display:flex;align-items:flex-start;justify-content:center;transition:height .3s ease}
.bar-fill.task{background:linear-gradient(180deg,#fbbf24,#f59e0b)}
.bar-value{font-size:11px;font-weight:700;color:#fff;padding:2px 0}
.bar-label{font-size:11px;color:#98a2b3;position:absolute;bottom:0}
.no-data{color:#d1d5db;font-size:13px;text-align:center;align-self:center;width:100%}

/* Commerce Table */
.section-card{border:1px solid #e5e7eb;border-radius:16px;padding:20px;background:#fff;margin-bottom:24px}
.section-card>h3{font-size:15px;font-weight:800;color:#1f2937;margin:0 0 16px}
.commerce-table{display:flex;flex-direction:column;gap:2px}
.ct-header,.ct-row{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;align-items:center;padding:8px 12px;font-size:13px}
.ct-header{background:#f9fafb;border-radius:8px;font-weight:700;color:#98a2b3;font-size:12px}
.ct-row{border-bottom:1px solid #f3f4f6;color:#475467}
.ct-row:hover{background:#fbfcfe}
.ct-name{font-weight:700;color:#1f2937}
.text-green{color:#10b981;font-weight:700}
.text-red{color:#ef4444;font-weight:700}

/* Tabs */
.tabs-bar{display:flex;gap:4px;background:#f3f4f6;border-radius:999px;padding:4px;margin-bottom:16px;width:fit-content}
.tabs-bar button{border:none;background:transparent;padding:8px 16px;border-radius:999px;font-weight:700;font-size:13px;color:#6b7280;cursor:pointer;transition:all .15s}
.tabs-bar button.active{background:#5b4eff;color:#fff}

/* Activity List */
.activity-list{display:flex;flex-direction:column;gap:2px}
.activity-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;transition:background .15s}
.activity-row:hover{background:#fbfcfe}
.act-thumb{width:40px;height:40px;border-radius:10px;overflow:hidden;display:grid;place-items:center;background:#f3f4f6;flex-shrink:0;font-size:18px;font-weight:700}
.act-thumb img{width:100%;height:100%;object-fit:cover}
.act-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.act-info strong{font-size:13px;font-weight:700;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.act-info small{font-size:11px;color:#98a2b3}
.act-status{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}
.act-status.completed{background:#d1fae5;color:#065f46}
.act-status.pending{background:#fef3c7;color:#92400e}
.act-status.failed{background:#fee2e2;color:#991b1b}
.act-balance{font-size:12px;font-weight:700;color:#475467;white-space:nowrap}
.act-time{font-size:11px;color:#9ca3af;white-space:nowrap}

@media(max-width:1024px){
  .kpi-grid{grid-template-columns:repeat(2,1fr)}
  .section-grid{grid-template-columns:1fr}
}
@media(max-width:640px){
  .kpi-grid{grid-template-columns:1fr}
  .ct-header,.ct-row{grid-template-columns:1.5fr 1fr 1fr}
  .ct-header span:nth-child(4),
  .ct-header span:nth-child(5),
  .ct-row span:nth-child(4),
  .ct-row span:nth-child(5){display:none}
}
</style>
