<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import QRCode from 'qrcode'
import { billingApi, type Plan, type RechargePack, type PaymentResult } from '@/api/billing'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const route = useRoute()
const isGuest = computed(() => !store.authenticated)
const isTeamMember = computed(() => store.authenticated && store.user.teamShared === true)
const plans = ref<Plan[]>([])
const packs = ref<RechargePack[]>([])
const billingTab = ref<'plans' | 'credits'>(route.query.tab === 'credits' ? 'credits' : 'plans')
const billingCycle = ref<'monthly' | 'yearly'>('monthly')

// 支付弹窗状态
const showPayModal = ref(false)
const selectedPack = ref<RechargePack | null>(null)
const selectedRechargePack = ref<RechargePack | null>(null)
const payResult = ref<PaymentResult | null>(null)
const paying = ref(false)
const payType = ref<'credits' | 'plan'>('credits')
const selectedPlanName = ref('')
const qrCodeUrl = ref('')
let paymentPolling: ReturnType<typeof setInterval> | null = null

const wallet = computed(() => store.user.wallet)
const priceLabel = (plan: Plan) => billingCycle.value === 'yearly'
  ? (plan.annualPrice ?? Math.round(plan.price * 12 * (100 - (plan.annualDiscountPercent ?? 20)) / 100))
  : plan.price
const cycleLabel = computed(() => billingCycle.value === 'yearly' ? '/年' : '/月')
const rechargeDiscount = computed(() => store.user.entitlements?.rechargeDiscountPercent ?? 0)
const rechargePayable = computed(() => {
  if (!selectedPack.value || payType.value !== 'credits') return selectedPack.value?.money ?? 0
  return Number((selectedPack.value.money * (100 - rechargeDiscount.value) / 100).toFixed(2))
})
const payableForPack = (pack: RechargePack) => Number((pack.money * (100 - rechargeDiscount.value) / 100).toFixed(2))
const selectedRechargePayable = computed(() => selectedRechargePack.value ? payableForPack(selectedRechargePack.value) : 0)

async function loadData() {
  plans.value = await billingApi.plans()
  packs.value = await billingApi.rechargePacks()
  if (!selectedRechargePack.value && packs.value.length) {
    selectedRechargePack.value = packs.value.find(pack => pack.money === 100) || packs.value[0]
  }
  if (store.authenticated) {
    await store.fetchUsage()
  }
}

function selectRechargePack(pack: RechargePack) { selectedRechargePack.value = pack }
function beginRecharge() { if (selectedRechargePack.value) openPayModal(selectedRechargePack.value) }

function openPayModal(pack: RechargePack | Plan) {
  if (!store.requestLogin('购买套餐或充值积分', () => openPayModal(pack))) return
  if (isTeamMember.value) {
    store.showToast('团队套餐与积分由团队所有者统一管理', 'info')
    return
  }
  if ('money' in pack) {
    // RechargePack
    selectedPack.value = pack
    payType.value = 'credits'
  } else {
    // Plan
    selectedPack.value = { money: priceLabel(pack), principalCredits: pack.credits, bonusCredits: 0, credits: pack.credits, bonus: '' }
    payType.value = 'plan'
    selectedPlanName.value = pack.name
  }
  payResult.value = null
  qrCodeUrl.value = ''
  showPayModal.value = true
}

function stopPaymentPolling() {
  if (paymentPolling) clearInterval(paymentPolling)
  paymentPolling = null
}

function closePayModal() {
  stopPaymentPolling()
  showPayModal.value = false
}

async function checkPaymentStatus(showPendingMessage = true) {
  const orderNo = payResult.value?.orderNo
  if (!orderNo) return
  try {
    const order = await billingApi.order(orderNo)
    if (order.status === 'paid') {
      stopPaymentPolling()
      await store.fetchUsage()
      store.showToast('支付成功，权益已到账')
      showPayModal.value = false
    } else if (['closed', 'refunded'].includes(order.status)) {
      stopPaymentPolling()
      store.showToast('订单已关闭', 'error')
    } else if (showPendingMessage) {
      store.showToast('暂未收到支付结果，请完成支付后再刷新', 'info')
    }
  } catch (e: any) {
    if (showPendingMessage) store.showToast(e?.response?.data?.message || '支付状态查询失败', 'error')
  }
}

function startPaymentPolling() {
  stopPaymentPolling()
  paymentPolling = setInterval(() => checkPaymentStatus(false), 3000)
}

async function startPayment(method: 'alipay' | 'wechat') {
  if (!selectedPack.value) return
  paying.value = true
  try {
    const result = await billingApi.createPurchase({
      money: selectedPack.value.money,
      credits: selectedPack.value.credits,
      method,
      purchaseType: payType.value === 'plan' ? 'subscription' : 'recharge',
      planName: payType.value === 'plan' ? selectedPlanName.value : undefined,
      billingCycle: payType.value === 'plan' ? billingCycle.value : undefined,
    })
    payResult.value = result
    if (result.codeUrl) qrCodeUrl.value = await QRCode.toDataURL(result.codeUrl, { width: 240, margin: 1 })
    if (result.payUrl) window.open(result.payUrl, '_blank')
    startPaymentPolling()
  } catch (e: any) {
    store.showToast(e?.response?.data?.message || '支付订单创建失败', 'error')
  } finally { paying.value = false }
}

onMounted(loadData)
watch(() => store.authenticated, authenticated => { if (authenticated) void loadData() })
watch(() => route.query.tab, tab => { if (tab === 'credits' || tab === 'plans') billingTab.value = tab })
onUnmounted(stopPaymentPolling)
</script>

<template>
  <div class="space-y-5">
    <!-- Hero -->
    <div class="rounded-xl border border-gray-200 bg-white p-6">
      <div class="flex items-start justify-between flex-wrap gap-4 mb-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-800">{{ isGuest ? '选择适合你的创作方案' : `当前 ${store.user.plan} 套餐` }}</h2>
          <p v-if="!isGuest" class="text-sm text-gray-500 mt-1">
            {{ store.user.credits.toLocaleString() }} 积分余额
            <span v-if="store.user.planExpiresAt"> · 有效期至 {{ new Date(store.user.planExpiresAt).toLocaleDateString('zh-CN') }}</span>
          </p>
          <p v-else class="text-sm text-gray-500 mt-1">一种积分覆盖图像、视频、电商工具和广告创作，套餐负责发放积分并解锁专业权益。</p>
        </div>
        <div class="flex gap-2">
          <button v-for="t in (['plans', 'credits'] as const)" :key="t" @click="billingTab = t"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="billingTab === t ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'">
            {{ t === 'plans' ? '订阅套餐' : '积分充值' }}
          </button>
        </div>
      </div>
      <div v-if="!isGuest" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="rounded-lg border border-gray-100 bg-gray-50 p-4"><span class="text-xs text-gray-500">可用总积分</span><strong class="block mt-1 text-xl text-gray-900">{{ (wallet?.available ?? store.user.availableCredits ?? store.user.credits).toLocaleString() }}</strong><small v-if="wallet?.reserved" class="text-amber-600">{{ wallet.reserved }} 预占中</small></div>
        <div class="rounded-lg border border-gray-100 bg-gray-50 p-4"><span class="text-xs text-gray-500">套餐积分</span><strong class="block mt-1 text-xl text-gray-900">{{ (wallet?.subscription.available ?? 0).toLocaleString() }}</strong><small class="text-gray-400">周期结束不结转</small></div>
        <div class="rounded-lg border border-gray-100 bg-gray-50 p-4"><span class="text-xs text-gray-500">活动赠送积分</span><strong class="block mt-1 text-xl text-gray-900">{{ (wallet?.activity.available ?? 0).toLocaleString() }}</strong><small class="text-gray-400">按活动有效期使用</small></div>
        <div class="rounded-lg border border-gray-100 bg-gray-50 p-4"><span class="text-xs text-gray-500">充值积分</span><strong class="block mt-1 text-xl text-gray-900">{{ (wallet?.recharge.available ?? 0).toLocaleString() }}</strong><small class="text-gray-400">购买后有效期一年</small></div>
      </div>
    </div>

    <RouterLink v-if="!isGuest" to="/referral" class="referral-callout">
      <span class="referral-callout-icon">邀</span>
      <span>
        <strong>邀请好友一起创作</strong>
        <small>好友注册、首次有效创作和首次付费均可获得奖励积分</small>
      </span>
      <b>查看邀请奖励</b>
    </RouterLink>

    <!-- 套餐 Tab -->
    <template v-if="billingTab === 'plans'">
      <div class="flex gap-0 rounded-full border border-gray-200 overflow-hidden w-fit">
        <button @click="billingCycle = 'monthly'" class="px-5 py-2.5 text-sm font-medium" :class="billingCycle === 'monthly' ? 'bg-brand text-white' : 'bg-white text-gray-500'">月付</button>
        <button @click="billingCycle = 'yearly'" class="px-5 py-2.5 text-sm font-medium" :class="billingCycle === 'yearly' ? 'bg-brand text-white' : 'bg-white text-gray-500'">年付 <span class="text-xs opacity-90">按套餐优惠</span></button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="plan in plans" :key="plan.name" class="rounded-xl border bg-white p-5 relative flex flex-col" :class="!isGuest && plan.name === store.user.plan ? 'border-brand border-2' : 'border-gray-200'">
          <span v-if="!isGuest && plan.name === store.user.plan" class="absolute -top-px right-4 bg-brand text-white text-xs font-bold px-3 py-0.5 rounded-b-lg">当前</span>
          <h3 class="text-xl font-semibold text-gray-800">{{ plan.name }}</h3>
          <span class="text-xs text-gray-400">{{ plan.users }}</span>
          <div class="mt-2 mb-3"><span class="text-3xl font-bold text-gray-800">¥{{ priceLabel(plan) }}</span><span class="text-sm text-gray-400">{{ cycleLabel }}</span></div>
          <div v-if="billingCycle === 'yearly' && plan.price > 0" class="inline-block text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full mb-3">年付省 ¥{{ plan.price * 12 - priceLabel(plan) }}</div>
          <div v-else class="mb-3"></div>
          <div class="grid grid-cols-2 gap-2 mb-3 p-3 rounded-lg bg-gray-50 border border-gray-100 text-xs">
            <div><span class="text-gray-400">{{ plan.name === 'Free' ? '体验积分' : '月度积分' }}</span><br><strong class="text-gray-700">{{ plan.credits.toLocaleString() }}</strong></div>
            <div><span class="text-gray-400">参考产量</span><br><strong class="text-gray-700">约 {{ plan.estimatedStandardImages ?? Math.floor(plan.credits / (plan.standardImageCredits || 50)) }} 张标准图</strong></div>
            <div><span class="text-gray-400">速度</span><br><strong class="text-gray-700">{{ plan.speed }}</strong></div>
            <div><span class="text-gray-400">充值优惠</span><br><strong class="text-gray-700">{{ plan.rechargeDiscountPercent ? `${plan.rechargeDiscountPercent}%` : '无' }}</strong></div>
          </div>
          <div class="flex flex-wrap gap-1.5 mb-3">
            <span v-for="perk in (plan.perks.length ? plan.perks : ['仅基础能力'])" :key="perk" class="text-xs font-medium px-2.5 py-1 rounded-full" :class="plan.perks.length ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-400'">{{ perk }}</span>
          </div>
          <ul class="text-xs text-gray-600 space-y-1.5 mb-4 flex-1">
            <li v-for="f in plan.features" :key="f" class="pl-4 relative"><span class="absolute left-0 text-brand">✓</span>{{ f }}</li>
          </ul>
          <button @click="openPayModal(plan)" :disabled="isTeamMember || (!isGuest && plan.name === store.user.plan) || plan.price === 0" class="w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50" :class="isTeamMember || (!isGuest && plan.name === store.user.plan) || plan.price === 0 ? 'bg-gray-100 text-gray-400' : 'bg-brand text-white hover:bg-brand-dark'">{{ isTeamMember ? '由团队所有者管理' : !isGuest && plan.name === store.user.plan ? '当前套餐' : plan.price === 0 ? '基础套餐' : isGuest ? '登录并选择' : '购买套餐' }}</button>
        </div>
      </div>
    </template>

    <!-- 积分充值 Tab -->
    <template v-else>
      <section class="recharge-shell">
        <div class="recharge-main">
          <div class="recharge-heading">
            <div><span>积分充值</span><h2>为下一次创作补充算力</h2></div>
            <p>1 元兑换 10 本金积分。积分可用于图像、视频、电商工具和广告项目，系统按任务实际配置统一结算。</p>
          </div>

          <div class="pack-grid">
            <button v-for="pack in packs" :key="pack.money" type="button" class="pack-option"
              :class="{ selected: selectedRechargePack?.money === pack.money }" @click="selectRechargePack(pack)">
              <span v-if="pack.money === 100" class="pack-recommended">推荐</span>
              <span v-else-if="pack.bonus" class="pack-bonus">{{ pack.bonus }}</span>
              <strong>¥{{ pack.money }}</strong>
              <b>{{ pack.credits.toLocaleString() }} 积分</b>
              <small>{{ pack.principalCredits.toLocaleString() }} 本金<span v-if="pack.bonusCredits"> + {{ pack.bonusCredits.toLocaleString() }} 赠送</span></small>
            </button>
          </div>

          <div class="recharge-rules">
            <div><svg viewBox="0 0 24 24"><path d="M5 5h14v14H5zM8 9h8M8 13h5"/></svg><span><b>本金积分</b><small>充值到账后一年内有效</small></span></div>
            <div><svg viewBox="0 0 24 24"><path d="M12 3l2.2 5.5L20 9l-4.4 3.7L17 19l-5-3-5 3 1.4-6.3L4 9l5.8-.5L12 3z"/></svg><span><b>赠送积分</b><small>活动赠送部分 90 天有效</small></span></div>
            <div><svg viewBox="0 0 24 24"><path d="M4 7h16v10H4zM8 12h8"/></svg><span><b>统一使用</b><small>自动优先消耗临近到期积分</small></span></div>
          </div>
        </div>

        <aside class="recharge-summary">
          <span class="summary-label">本次充值</span>
          <template v-if="selectedRechargePack">
            <div class="summary-credits"><strong>{{ selectedRechargePack.credits.toLocaleString() }}</strong><span>积分</span></div>
            <dl>
              <div><dt>本金积分</dt><dd>{{ selectedRechargePack.principalCredits.toLocaleString() }}</dd></div>
              <div><dt>活动赠送</dt><dd :class="{ positive: selectedRechargePack.bonusCredits > 0 }">+{{ selectedRechargePack.bonusCredits.toLocaleString() }}</dd></div>
              <div v-if="rechargeDiscount > 0"><dt>{{ store.user.plan }} 会员折扣</dt><dd class="positive">-{{ rechargeDiscount }}%</dd></div>
            </dl>
            <div class="summary-total"><span>应付金额<small v-if="rechargeDiscount > 0">原价 ¥{{ selectedRechargePack.money }}</small></span><strong>¥{{ selectedRechargePayable }}</strong></div>
            <button class="recharge-submit" type="button" :disabled="isTeamMember" @click="beginRecharge">{{ isTeamMember ? '由团队所有者充值' : '确认充值' }}</button>
            <p>支付完成后积分将自动到账，可在积分明细中查看记录。</p>
          </template>
        </aside>
      </section>
    </template>

    <!-- 支付弹窗 -->
    <Teleport to="body">
      <div v-if="showPayModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" @click.self="closePayModal">
        <div class="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
          <h3 class="text-lg font-semibold text-gray-800 mb-1">{{ payType === 'plan' ? '订阅套餐' : '积分充值' }}</h3>
          <p v-if="selectedPack" class="text-sm text-gray-500 mb-5">
            <template v-if="payType === 'plan'">
              订阅 {{ selectedPlanName }} 套餐 · ¥{{ selectedPack.money }}，每月发放 {{ selectedPack.credits.toLocaleString() }} 积分
              <span v-if="billingCycle === 'yearly'">（年付按月发放）</span>
            </template>
            <template v-else>
              <span v-if="rechargeDiscount > 0"><s>¥{{ selectedPack.money }}</s> 会员价 ¥{{ rechargePayable }} · </span>
              <span v-else>¥{{ selectedPack.money }} · </span>
              {{ selectedPack.principalCredits.toLocaleString() }} 本金积分
              <span v-if="selectedPack.bonusCredits"> + {{ selectedPack.bonusCredits.toLocaleString() }} 赠送积分</span>
            </template>
          </p>

          <!-- 支付方式选择 -->
          <div v-if="!payResult" class="space-y-3">
            <button @click="startPayment('alipay')" :disabled="paying"
              class="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-blue-100 hover:border-blue-400 transition-colors text-left">
              <div class="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">支</div>
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-800">支付宝</div>
                <div class="text-xs text-gray-400">跳转支付宝完成支付</div>
              </div>
            </button>
            <button @click="startPayment('wechat')" :disabled="paying"
              class="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-green-100 hover:border-green-400 transition-colors text-left">
              <div class="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center text-white font-bold text-sm">微</div>
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-800">微信支付</div>
                <div class="text-xs text-gray-400">扫码完成支付</div>
              </div>
            </button>
          </div>

          <!-- 微信二维码 -->
          <div v-else-if="payResult.codeUrl" class="text-center py-4">
            <img :src="qrCodeUrl" alt="微信支付二维码" class="w-48 h-48 mx-auto rounded-lg border border-gray-100" />
            <p class="text-sm text-gray-600 mt-3">请用微信扫码支付</p>
            <p class="text-xs text-gray-400 mt-1">订单号：{{ payResult.orderNo }}</p>
            <button @click="checkPaymentStatus(true)" :disabled="paying"
              class="mt-4 px-6 py-2 rounded-lg text-sm bg-brand text-white hover:bg-brand-dark">
              刷新支付状态
            </button>
          </div>

          <!-- 支付宝已跳转 -->
          <div v-else-if="payResult.payUrl" class="text-center py-4">
            <div class="w-12 h-12 mx-auto rounded-full bg-blue-50 flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg>
            </div>
            <p class="text-sm text-gray-600">已在新窗口打开支付宝</p>
            <p class="text-xs text-gray-400 mt-1">订单号：{{ payResult.orderNo }}</p>
            <button @click="checkPaymentStatus(true)" :disabled="paying"
              class="mt-4 px-6 py-2 rounded-lg text-sm bg-brand text-white hover:bg-brand-dark">
              刷新支付状态
            </button>
          </div>

          <button @click="closePayModal" class="mt-4 w-full py-2 text-sm text-gray-400 hover:text-gray-600">取消</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.referral-callout{min-height:72px;display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:14px;border:1px solid #ddd9ff;border-radius:8px;background:#f8f7ff;padding:13px 17px;color:inherit;text-decoration:none}.referral-callout-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:7px;background:#5146e5;color:#fff;font-size:15px;font-weight:900}.referral-callout strong,.referral-callout small{display:block}.referral-callout strong{color:#25205d;font-size:13px}.referral-callout small{margin-top:3px;color:#7f789f;font-size:10px}.referral-callout>b{color:#5146e5;font-size:12px}.referral-callout:hover{border-color:#9f98ef}
.recharge-shell{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:20px;align-items:stretch}
.recharge-main{min-width:0;border:1px solid #e2e5eb;border-radius:8px;background:#fff;padding:26px}
.recharge-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:32px}.recharge-heading>div>span{color:#5146e5;font-size:11px;font-weight:900;letter-spacing:.08em}.recharge-heading h2{margin:5px 0 0;color:#172033;font-size:22px;line-height:1.25}.recharge-heading p{max-width:500px;margin:0;color:#667085;font-size:12px;line-height:1.65}
.pack-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:24px}.pack-option{position:relative;min-height:126px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;overflow:hidden;border:1px solid #dfe3ea;border-radius:7px;background:#fff;padding:17px;text-align:left;cursor:pointer;transition:border-color .18s,box-shadow .18s,transform .18s}.pack-option:hover{border-color:#9a94ee;transform:translateY(-1px)}.pack-option.selected{border:2px solid #5146e5;padding:16px;box-shadow:0 0 0 3px rgba(81,70,229,.09)}.pack-option strong{color:#172033;font-size:23px;line-height:1}.pack-option b{margin-top:10px;color:#344054;font-size:13px}.pack-option small{margin-top:4px;color:#98a2b3;font-size:10px}.pack-option small span{color:#079455}.pack-recommended,.pack-bonus{position:absolute;top:0;right:0;border-radius:0 0 0 6px;padding:4px 8px;color:#fff;font-size:9px;font-weight:800}.pack-recommended{background:#5146e5}.pack-bonus{background:#079455}
.recharge-rules{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:20px;padding-top:18px;border-top:1px solid #edf0f4}.recharge-rules>div{display:flex;align-items:center;gap:9px}.recharge-rules svg{width:24px;height:24px;flex:none;fill:none;stroke:#7068e8;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.recharge-rules span,.recharge-rules b,.recharge-rules small{display:block}.recharge-rules b{color:#344054;font-size:11px}.recharge-rules small{margin-top:2px;color:#98a2b3;font-size:9px}
.recharge-summary{display:flex;flex-direction:column;border:1px solid #dedbf9;border-radius:8px;background:#f8f7ff;padding:24px}.summary-label{color:#667085;font-size:11px;font-weight:700}.summary-credits{display:flex;align-items:baseline;gap:6px;margin-top:12px}.summary-credits strong{color:#28206e;font-size:34px;line-height:1}.summary-credits span{color:#7068e8;font-size:12px;font-weight:700}.recharge-summary dl{display:grid;gap:10px;margin:24px 0 0;padding:16px 0;border-top:1px solid #dedbf9;border-bottom:1px solid #dedbf9}.recharge-summary dl div{display:flex;justify-content:space-between;gap:16px}.recharge-summary dt{color:#667085;font-size:11px}.recharge-summary dd{margin:0;color:#344054;font-size:11px;font-weight:800}.recharge-summary dd.positive{color:#039855}.summary-total{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:18px}.summary-total>span{color:#344054;font-size:12px;font-weight:800}.summary-total small{display:block;margin-top:4px;color:#98a2b3;font-size:9px;font-weight:500;text-decoration:line-through}.summary-total>strong{color:#172033;font-size:25px}.recharge-submit{height:44px;margin-top:18px;border:0;border-radius:6px;background:#5146e5;color:#fff;font-size:13px;font-weight:800;cursor:pointer;transition:background .18s}.recharge-submit:hover{background:#4037c9}.recharge-summary>p{margin:10px 0 0;color:#98a2b3;font-size:9px;line-height:1.5;text-align:center}
.recharge-submit:disabled{background:#c8cbd4;cursor:not-allowed}
@media(max-width:1050px){.recharge-shell{grid-template-columns:1fr}.recharge-summary{display:grid;grid-template-columns:1fr 1fr;column-gap:24px}.recharge-summary dl{grid-column:1}.summary-total{grid-column:2;grid-row:1/3;align-self:center}.recharge-submit{grid-column:2}.recharge-summary>p{grid-column:2}.summary-label,.summary-credits{grid-column:1}}
@media(max-width:720px){.referral-callout{grid-template-columns:42px minmax(0,1fr)}.referral-callout>b{grid-column:2}.recharge-main{padding:18px}.recharge-heading{display:block}.recharge-heading p{margin-top:10px}.pack-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.recharge-rules{grid-template-columns:1fr}.recharge-summary{display:flex}.recharge-summary dl,.summary-total,.recharge-submit,.recharge-summary>p{grid-column:auto;grid-row:auto}}
</style>
