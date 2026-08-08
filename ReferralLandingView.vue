<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { referralApi } from '@/api/referral'
import { captureReferral } from '@/utils/referralAttribution'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const invitation = ref<Awaited<ReturnType<typeof referralApi.publicCode>> | null>(null)

onMounted(async () => {
  const code = String(route.params.code || '').trim().toUpperCase()
  try {
    invitation.value = await referralApi.publicCode(code)
    captureReferral(
      code,
      String(route.query.source || 'share'),
      String(route.query.campaign || ''),
      invitation.value.clickWindowDays,
    )
  } catch (reason: any) {
    error.value = reason?.response?.data?.message || '邀请链接无效或已过期'
  } finally {
    loading.value = false
  }
})

function register() {
  router.push({ path: '/login', query: { mode: 'register' } })
}
</script>

<template>
  <main class="referral-landing">
    <nav>
      <a href="/" class="brand"><img src="/brand/fusionai-icon.png" alt="" /><strong>FusionAI <span>融艺AI</span></strong></a>
      <a href="/login">已有账号，直接登录</a>
    </nav>
    <section class="landing-content">
      <div v-if="loading" class="state">正在确认邀请信息...</div>
      <div v-else-if="error" class="state error">
        <strong>这条邀请暂时无法使用</strong>
        <p>{{ error }}</p>
        <a href="/">返回 FusionAI 首页</a>
      </div>
      <template v-else-if="invitation">
        <p class="eyebrow">{{ invitation.inviterName }} 邀请你加入 FusionAI</p>
        <h1>让一个商品，长出一套可投放内容</h1>
        <p class="lead">完成手机号注册即可额外获得 <b>{{ invitation.registerCredits }} 积分</b>，用于图像、视频、电商工具和广告创作。</p>
        <div class="benefits">
          <span>70+ AI 模型聚合</span>
          <span>最高 4K 分辨率</span>
          <span>统一积分结算</span>
        </div>
        <button type="button" @click="register">接受邀请并免费注册</button>
        <small>邀请码 {{ invitation.code }} 已自动保存，{{ invitation.clickWindowDays }} 天内完成注册有效</small>
      </template>
    </section>
  </main>
</template>

<style scoped>
.referral-landing{min-height:100vh;padding:0 clamp(24px,7vw,108px);color:#fff;background:linear-gradient(rgba(10,15,32,.76),rgba(10,15,32,.88)),url('/og.png') center/cover no-repeat #101828}.referral-landing nav{height:76px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.14)}nav>a{color:#d0d5dd;text-decoration:none;font-size:13px;font-weight:700}.brand{display:flex;align-items:center;gap:10px}.brand img{width:38px;height:38px}.brand strong{display:grid;color:#fff;font-size:16px}.brand span{color:#a5b4fc;font-size:10px}.landing-content{min-height:calc(100vh - 76px);max-width:820px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:60px 0 110px}.eyebrow{margin:0 0 16px;color:#b9b4ff;font-size:13px;font-weight:900}.landing-content h1{max-width:760px;margin:0;font-size:clamp(42px,6vw,76px);line-height:1.08;letter-spacing:0}.lead{max-width:660px;margin:24px 0 0;color:#d0d5dd;font-size:18px;line-height:1.75}.lead b{color:#fff}.benefits{display:flex;flex-wrap:wrap;gap:12px;margin:28px 0}.benefits span{padding:7px 10px;border:1px solid rgba(255,255,255,.18);border-radius:6px;background:rgba(255,255,255,.08);color:#e4e7ec;font-size:12px;font-weight:700}.landing-content button{height:50px;border:0;border-radius:7px;padding:0 24px;background:#6c5ce7;color:#fff;font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 12px 28px rgba(91,78,255,.34)}.landing-content small{margin-top:14px;color:#98a2b3}.state{margin:auto 0;color:#d0d5dd}.state strong{font-size:28px;color:#fff}.state p{margin:10px 0 20px}.state a{color:#c4bfff}@media(max-width:640px){.referral-landing{padding:0 22px}.referral-landing nav>a:last-child{display:none}.landing-content{padding-bottom:60px}.landing-content h1{font-size:42px}.lead{font-size:16px}}
</style>
