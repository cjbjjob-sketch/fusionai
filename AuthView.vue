<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthCredentialForm from '@/components/AuthCredentialForm.vue'
import { setUserToken, type AuthResult } from '@/api/auth'
import { clearWechatWelcomePending, markWechatWelcomePending } from '@/utils/wechatWelcome'

const router = useRouter()
const route = useRoute()
const mode = ref<'login' | 'register'>(route.query.mode === 'register' ? 'register' : 'login')
async function authenticated(result: AuthResult) {
  if (mode.value === 'register' && !result.user.isInvitedUser) {
    markWechatWelcomePending(result.user.id)
  } else if (result.user.isInvitedUser) {
    clearWechatWelcomePending(result.user.id)
  }
  setUserToken(result.token)
  const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/inspiration'
  await router.replace(redirect)
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-intro">
      <div class="auth-brand"><img src="/brand/fusionai-icon.png" alt="" /><strong>FusionAI <span>融艺AI</span></strong></div>
      <div>
        <p class="eyebrow">AI 电商内容生产与广告增长平台</p>
        <h1>从一个商品，生成一套可投放内容</h1>
        <p class="intro-copy">统一管理商品、品牌、素材、脚本、分镜和生成结果，让团队更快完成跨渠道内容生产。</p>
      </div>
      <ul><li>商品与品牌上下文驱动创作</li><li>图像、视频和广告项目统一协作</li><li>企业空间隔离与任务级积分结算</li></ul>
    </section>

    <section class="auth-panel">
      <div class="auth-box">
        <div class="mode-switch">
          <button :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
          <button :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
        </div>
        <section class="form-surface">
          <div class="form-heading">
            <h2>{{ mode === 'login' ? '欢迎回来' : '创建 FusionAI 团队空间' }}</h2>
            <p>{{ mode === 'login' ? '默认使用密码登录，也可切换短信验证码' : '验证手机号并设置登录密码后创建团队空间' }}</p>
          </div>
          <p v-if="route.query.changed === '1'" class="form-success">密码已修改，请使用新密码登录。</p>
          <AuthCredentialForm :mode="mode" @success="authenticated" />
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-page{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(420px,.95fr);background:#f7f8fb;color:#101828}.auth-intro{padding:64px clamp(40px,7vw,112px);display:flex;flex-direction:column;justify-content:space-between;background:#111827;color:#fff;min-height:100vh}.auth-brand{display:flex;align-items:center;gap:12px;font-size:20px}.auth-brand img{width:42px;height:42px;object-fit:contain}.auth-intro h1{max-width:760px;margin:14px 0 22px;font-size:clamp(40px,5vw,68px);line-height:1.08;letter-spacing:0}.eyebrow{color:#a5b4fc;font-size:13px;font-weight:800}.intro-copy{max-width:680px;color:#cbd5e1;font-size:18px;line-height:1.7}.auth-intro ul{display:flex;gap:24px;flex-wrap:wrap;padding:0;margin:0;list-style:none;color:#cbd5e1;font-size:13px}.auth-panel{display:grid;place-items:center;padding:40px}.auth-box{width:min(440px,100%)}.mode-switch{display:flex;margin-bottom:18px;padding:4px;border-radius:8px;background:#e9ecf2}.mode-switch button{flex:1;padding:10px;border:0;border-radius:6px;background:transparent;color:#667085;font-weight:800;cursor:pointer}.mode-switch button.active{background:#fff;color:#111827;box-shadow:0 1px 3px rgba(16,24,40,.1)}.form-surface{padding:32px;border:1px solid #e4e7ec;border-radius:8px;background:#fff;box-shadow:0 12px 32px rgba(16,24,40,.08)}.form-heading h2{margin:0;font-size:26px}.form-heading p{margin:8px 0 22px;color:#667085}.form-success,.form-error{padding:10px;border-radius:6px;font-size:13px}.form-success{color:#067647;background:#ecfdf3}.form-error{color:#b42318;background:#fef3f2}@media(max-width:900px){.auth-page{grid-template-columns:1fr}.auth-intro{min-height:340px;padding:36px}.auth-intro ul{display:none}.auth-panel{padding:28px 20px}}@media(max-width:480px){.form-surface{padding:22px}}
.auth-brand strong{display:grid;gap:1px}.auth-brand strong span{color:#cbd5e1;font-size:11px;font-weight:600}
</style>
