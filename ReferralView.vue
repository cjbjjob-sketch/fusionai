<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import { referralApi, type ReferralDashboard, type ReferralStatus } from '@/api/referral'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const loading = ref(true)
const dashboard = ref<ReferralDashboard | null>(null)
const activeTab = ref<'invite' | 'partner'>('invite')
const qrCode = ref('')
const applying = ref(false)
const settling = ref(false)
const currentPage = ref(1)
const partnerForm = ref({ displayName: '', contact: '' })

const inviteUrl = computed(() => dashboard.value
  ? `${window.location.origin}/r/${dashboard.value.code}?source=user_share`
  : '')

const statusText: Record<ReferralStatus, string> = {
  registered: '已注册',
  activated: '已完成创作',
  paid: '已付费',
  invalid: '无效',
}

const rewardEventText: Record<string, string> = {
  registration: '受邀注册',
  activation: '首次有效创作',
  first_payment: '首次有效付费',
}

const rewardStatusText: Record<string, string> = {
  pending: '待生效',
  issued: '已到账',
  cancelled: '已取消',
  reversed: '已冲正',
  expired: '已过期',
}

async function load() {
  loading.value = true
  try {
    dashboard.value = await referralApi.dashboard(currentPage.value)
    if (inviteUrl.value) qrCode.value = await QRCode.toDataURL(inviteUrl.value, { width: 220, margin: 1 })
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '邀请数据加载失败', 'error')
  } finally {
    loading.value = false
  }
}

async function copy(value: string, message: string) {
  try {
    await navigator.clipboard.writeText(value)
    store.showToast(message)
  } catch {
    store.showToast('复制失败，请手动选择复制', 'error')
  }
}

async function goPage(page: number) {
  if (!dashboard.value) return
  const pages = Math.max(1, Math.ceil(dashboard.value.total / dashboard.value.pageSize))
  currentPage.value = Math.min(pages, Math.max(1, page))
  await load()
}

async function applyPartner() {
  if (!partnerForm.value.contact.trim()) return store.showToast('请填写联系方式', 'error')
  applying.value = true
  try {
    await referralApi.applyPartner(partnerForm.value)
    store.showToast('申请已提交，运营人员审核后会为你开通推广链接')
    await load()
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '申请提交失败', 'error')
  } finally {
    applying.value = false
  }
}

async function requestSettlement() {
  settling.value = true
  try {
    await referralApi.requestSettlement()
    store.showToast('结算申请已提交')
    await load()
  } catch (error: any) {
    store.showToast(error?.response?.data?.message || '结算申请失败', 'error')
  } finally {
    settling.value = false
  }
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-'
}

onMounted(load)
</script>

<template>
  <div class="referral-view">
    <header class="page-heading">
      <div><p>GROWTH PROGRAM</p><h2>邀请好友，一起把创作变简单</h2><span>奖励按有效行为发放，拒绝无意义拉新。邀请积分 {{ dashboard?.rules.rewardExpiryDays || 90 }} 天有效，不影响充值积分。</span></div>
      <div class="tab-switch">
        <button :class="{ active: activeTab === 'invite' }" @click="activeTab = 'invite'">邀请有礼</button>
        <button :class="{ active: activeTab === 'partner' }" @click="activeTab = 'partner'">推广伙伴</button>
      </div>
    </header>

    <div v-if="loading" class="loading">加载邀请数据...</div>

    <template v-else-if="dashboard && activeTab === 'invite'">
      <section class="share-band">
        <div class="share-copy">
          <span class="section-label">你的专属邀请</span>
          <h3>分享邀请码，邀请好友一起创作</h3>
          <p>好友通过您的邀请码注册，可获得 {{ dashboard.rules.registerCredits }} 积分奖励。您的好友若完成首笔实付满 ¥{{ dashboard.rules.paymentMinAmount }} 的订单，您将额外获赠 {{ dashboard.rules.paymentInviterCredits }} 积分。</p>
          <div class="share-actions">
            <button class="primary" @click="copy(inviteUrl, '邀请链接已复制')">复制邀请链接</button>
            <button @click="copy(dashboard.code, '邀请码已复制')">复制邀请码</button>
          </div>
          <small>本月已获得 {{ dashboard.monthly.rewards }} / {{ dashboard.rules.monthlyCreditCap }} 积分，已完成 {{ dashboard.monthly.paidInvites }} / {{ dashboard.rules.monthlyPaidCap }} 位有效付费邀请</small>
        </div>
        <div class="qr-panel">
          <img :src="qrCode" alt="邀请二维码" />
          <strong>{{ dashboard.code }}</strong>
          <span>微信扫码或长按识别</span>
        </div>
      </section>

      <section class="stats-grid">
        <article><span>累计邀请</span><strong>{{ dashboard.stats.total }}</strong><small>已完成手机号注册</small></article>
        <article><span>有效创作</span><strong>{{ dashboard.stats.activated + dashboard.stats.paid }}</strong><small>首次任务实扣达标</small></article>
        <article><span>有效付费</span><strong>{{ dashboard.stats.paid }}</strong><small>实付达到活动门槛</small></article>
        <article><span>累计到账</span><strong>{{ dashboard.stats.issuedCredits }}</strong><small>{{ dashboard.stats.pendingCredits }} 积分待生效</small></article>
      </section>

      <section class="progress-section">
        <div class="section-head"><div><h3>好友进度</h3><p>从注册、首次创作到首次付费，每一步都可追踪。</p></div></div>
        <div class="data-table">
          <table>
            <thead><tr><th>好友</th><th>当前进度</th><th>注册时间</th><th>首次创作</th><th>首次付费</th></tr></thead>
            <tbody>
              <tr v-for="item in dashboard.list" :key="item.id">
                <td><strong>{{ item.name }}</strong><small>{{ item.phone }}</small></td>
                <td><span class="status" :class="item.status">{{ statusText[item.status] }}</span><small v-if="item.invalidReason">{{ item.invalidReason }}</small></td>
                <td>{{ formatDate(item.registeredAt) }}</td>
                <td>{{ formatDate(item.activatedAt) }}</td>
                <td>{{ formatDate(item.firstPaidAt) }}</td>
              </tr>
              <tr v-if="!dashboard.list.length"><td colspan="5" class="empty">分享你的专属链接，第一位好友会出现在这里</td></tr>
            </tbody>
          </table>
        </div>
        <div v-if="dashboard.total > dashboard.pageSize" class="list-pagination">
          <button :disabled="dashboard.page <= 1" @click="goPage(dashboard.page - 1)">上一页</button>
          <span>第 {{ dashboard.page }} / {{ Math.ceil(dashboard.total / dashboard.pageSize) }} 页</span>
          <button :disabled="dashboard.page >= Math.ceil(dashboard.total / dashboard.pageSize)" @click="goPage(dashboard.page + 1)">下一页</button>
        </div>
      </section>

      <section class="progress-section">
        <div class="section-head"><div><h3>奖励明细</h3><p>付费奖励经过退款观察期后自动到账，退款或异常邀请会标记原因。</p></div></div>
        <div class="data-table">
          <table>
            <thead><tr><th>奖励事件</th><th>积分</th><th>状态</th><th>创建时间</th><th>有效期/说明</th></tr></thead>
            <tbody>
              <tr v-for="item in dashboard.rewards" :key="item.id">
                <td>{{ rewardEventText[item.eventType] || item.eventType }}</td>
                <td><strong>+{{ item.amount }}</strong></td>
                <td><span class="reward-status" :class="item.status">{{ rewardStatusText[item.status] || item.status }}</span></td>
                <td>{{ formatDate(item.createdAt) }}</td>
                <td>{{ item.expiresAt ? `${formatDate(item.expiresAt)} 到期` : item.details?.reason || '待达成结算条件' }}</td>
              </tr>
              <tr v-if="!dashboard.rewards.length"><td colspan="5" class="empty">暂无奖励记录</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-else-if="dashboard && activeTab === 'partner'">
      <section v-if="!dashboard.partner || ['rejected', 'disabled'].includes(dashboard.partner.status)" class="partner-intro">
        <div>
          <span class="section-label">PROMOTION PARTNER</span>
          <h3>适合内容创作者、服务商与行业机构</h3>
          <p>审核通过后使用专属推广链接，首个有效实付订单按 {{ (dashboard.rules.partnerCommissionRate * 100).toFixed(0) }}% 计算佣金。订单经过 {{ dashboard.rules.partnerHoldDays }} 天观察期后进入可结算余额。</p>
          <ul><li>真实支付订单才计佣</li><li>退款与异常订单自动撤销</li><li>满 {{ dashboard.rules.partnerMinSettlementAmount }} 元可申请人工结算</li></ul>
        </div>
        <form @submit.prevent="applyPartner">
          <label>推广名称<input v-model="partnerForm.displayName" placeholder="个人昵称、机构或团队名称" /></label>
          <label>联系方式<input v-model="partnerForm.contact" required placeholder="手机号、微信或邮箱" /></label>
          <button :disabled="applying">{{ applying ? '提交中...' : dashboard.partner?.status === 'rejected' ? '重新申请' : '申请成为推广伙伴' }}</button>
          <small v-if="dashboard.partner?.reviewNote">上次审核意见：{{ dashboard.partner.reviewNote }}</small>
        </form>
      </section>

      <section v-else-if="dashboard.partner.status === 'pending'" class="review-state">
        <span>申请审核中</span><h3>运营人员正在确认你的推广信息</h3><p>审核通过后，当前邀请码会自动升级为推广伙伴链接，无需重新分享。</p>
      </section>

      <template v-else>
        <section class="partner-summary">
          <div><span>待生效佣金</span><strong>¥{{ dashboard.partner.summary.pending.toFixed(2) }}</strong></div>
          <div><span>可结算佣金</span><strong>¥{{ dashboard.partner.summary.available.toFixed(2) }}</strong></div>
          <div><span>结算处理中</span><strong>¥{{ dashboard.partner.summary.settlementPending.toFixed(2) }}</strong></div>
          <div><span>累计已结算</span><strong>¥{{ dashboard.partner.summary.settled.toFixed(2) }}</strong></div>
          <button :disabled="settling" @click="requestSettlement">{{ settling ? '提交中...' : '申请结算' }}</button>
        </section>
        <section class="progress-section">
          <div class="section-head"><div><h3>佣金订单</h3><p>佣金按订单实付金额计算，不包含赠送积分和未支付优惠金额。</p></div></div>
          <div class="data-table"><table><thead><tr><th>订单号</th><th>订单金额</th><th>佣金比例</th><th>佣金</th><th>状态</th><th>生效时间</th></tr></thead><tbody>
            <tr v-for="item in dashboard.partner.commissions" :key="item.id"><td>{{ item.orderNo }}</td><td>¥{{ Number(item.orderAmount).toFixed(2) }}</td><td>{{ (Number(item.commissionRate) * 100).toFixed(0) }}%</td><td><strong>¥{{ Number(item.commissionAmount).toFixed(2) }}</strong></td><td>{{ item.status }}</td><td>{{ formatDate(item.releaseAt) }}</td></tr>
            <tr v-if="!dashboard.partner.commissions.length"><td colspan="6" class="empty">暂无佣金订单</td></tr>
          </tbody></table></div>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.referral-view{max-width:1380px;margin:0 auto}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:20px}.page-heading p,.section-label{margin:0;color:#5146e5;font-size:10px;font-weight:900;letter-spacing:.08em}.page-heading h2{margin:6px 0;color:#172033;font-size:25px}.page-heading span{color:#667085;font-size:12px}.tab-switch{display:flex;padding:3px;border-radius:7px;background:#eaecf0}.tab-switch button{height:36px;border:0;border-radius:5px;padding:0 16px;background:transparent;color:#667085;font-weight:800;cursor:pointer}.tab-switch button.active{background:#fff;color:#5146e5;box-shadow:0 1px 3px rgba(16,24,40,.12)}.loading{min-height:360px;display:grid;place-items:center;color:#98a2b3}.share-band{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:34px;align-items:center;border:1px solid #ddd9ff;border-radius:8px;background:#f8f7ff;padding:30px}.share-copy h3{margin:8px 0 12px;color:#25205d;font-size:27px;line-height:1.35}.share-copy p{max-width:800px;margin:0;color:#667085;font-size:13px;line-height:1.75}.share-actions{display:flex;gap:8px;margin:20px 0 12px}.share-actions button{height:40px;border:1px solid #d0d5dd;border-radius:6px;padding:0 16px;background:#fff;color:#344054;font-weight:800;cursor:pointer}.share-actions button.primary{border-color:#5146e5;background:#5146e5;color:#fff}.share-copy small{color:#7f789f}.qr-panel{display:flex;flex-direction:column;align-items:center;padding-left:30px;border-left:1px solid #dedbf9}.qr-panel img{width:150px;height:150px;border-radius:5px}.qr-panel strong{margin-top:9px;color:#25205d;font-size:15px;letter-spacing:.08em}.qr-panel span{margin-top:3px;color:#98a2b3;font-size:10px}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.stats-grid article{min-height:106px;border:1px solid #e4e7ec;border-radius:7px;background:#fff;padding:18px}.stats-grid span,.stats-grid strong,.stats-grid small{display:block}.stats-grid span{color:#667085;font-size:11px}.stats-grid strong{margin-top:7px;color:#172033;font-size:25px}.stats-grid small{margin-top:5px;color:#98a2b3;font-size:10px}.progress-section{margin-top:20px}.section-head{display:flex;align-items:end;justify-content:space-between;margin-bottom:10px}.section-head h3{margin:0;color:#344054;font-size:16px}.section-head p{margin:4px 0 0;color:#98a2b3;font-size:11px}.data-table{overflow:auto;border:1px solid #e4e7ec;border-radius:7px;background:#fff}.data-table table{width:100%;border-collapse:collapse;font-size:12px}.data-table th{padding:11px 14px;background:#f9fafb;color:#667085;text-align:left;white-space:nowrap}.data-table td{padding:13px 14px;border-top:1px solid #f2f4f7;color:#475467}.data-table td strong,.data-table td small{display:block}.data-table td small{margin-top:3px;color:#98a2b3;font-size:10px}.status,.reward-status{display:inline-flex!important;width:max-content;border-radius:5px;padding:4px 7px;font-size:10px!important;font-weight:800}.status.registered,.reward-status.pending{background:#fffaeb;color:#b54708}.status.activated{background:#eef4ff;color:#3538cd}.status.paid,.reward-status.issued{background:#ecfdf3;color:#027a48}.status.invalid,.reward-status.cancelled,.reward-status.reversed{background:#fef3f2;color:#b42318}.empty{text-align:center!important;padding:40px!important;color:#98a2b3!important}.list-pagination{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:12px}.list-pagination button{border:1px solid #d0d5dd;border-radius:6px;background:#fff;padding:7px 11px;color:#344054;font-size:11px;font-weight:700;cursor:pointer}.list-pagination button:disabled{opacity:.45;cursor:not-allowed}.list-pagination span{color:#667085;font-size:11px}.partner-intro{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:50px;border:1px solid #e4e7ec;border-radius:8px;background:#fff;padding:34px}.partner-intro h3{margin:9px 0 12px;color:#172033;font-size:25px}.partner-intro p{max-width:680px;color:#667085;line-height:1.7}.partner-intro ul{display:flex;gap:18px;flex-wrap:wrap;padding:0;list-style:none;color:#344054;font-size:12px;font-weight:700}.partner-intro form{display:grid;gap:14px;padding-left:34px;border-left:1px solid #eaecf0}.partner-intro label{display:grid;gap:6px;color:#475467;font-size:12px;font-weight:800}.partner-intro input{height:42px;border:1px solid #d0d5dd;border-radius:6px;padding:0 11px;outline:0}.partner-intro input:focus{border-color:#5146e5}.partner-intro form button,.partner-summary button{height:42px;border:0;border-radius:6px;background:#5146e5;color:#fff;font-weight:800;cursor:pointer}.partner-intro form small{color:#b54708}.review-state{min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #e4e7ec;border-radius:8px;background:#fff;text-align:center}.review-state span{color:#5146e5;font-size:11px;font-weight:900}.review-state h3{margin:8px 0;color:#172033}.review-state p{margin:0;color:#667085}.partner-summary{display:grid;grid-template-columns:repeat(4,1fr) auto;gap:12px;align-items:stretch}.partner-summary>div{border:1px solid #e4e7ec;border-radius:7px;background:#fff;padding:18px}.partner-summary span,.partner-summary strong{display:block}.partner-summary span{color:#667085;font-size:11px}.partner-summary strong{margin-top:7px;color:#172033;font-size:23px}.partner-summary button{align-self:center;padding:0 18px}@media(max-width:900px){.share-band,.partner-intro{grid-template-columns:1fr}.qr-panel,.partner-intro form{padding:20px 0 0;border-left:0;border-top:1px solid #dedbf9}.stats-grid,.partner-summary{grid-template-columns:repeat(2,1fr)}.page-heading{align-items:flex-start;flex-direction:column}}@media(max-width:600px){.share-band{padding:22px}.stats-grid{grid-template-columns:1fr 1fr}.partner-summary{grid-template-columns:1fr}.page-heading h2{font-size:21px}}
</style>
