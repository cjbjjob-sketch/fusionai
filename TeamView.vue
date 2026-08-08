<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { teamApi, type AddTeamMemberInput, type MemberStatus, type TeamMember, type TeamOverview, type TeamRole } from '@/api/team'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const data = ref<TeamOverview | null>(null)
const loading = ref(true)
const activeTab = ref<'members' | 'usage'>('members')
const keyword = ref('')
const roleFilter = ref('全部角色')
const statusFilter = ref('全部状态')
const addOpen = ref(false)
const detailId = ref('')
const submitting = ref(false)
const showAddPassword = ref(false)
const showResetPassword = ref(false)
const resetPassword = ref('')
const addBudget = ref('')
const editBudget = ref('')

const addForm = reactive({
  name: '',
  phone: '',
  password: '',
  role: '创作者' as Exclude<TeamRole, '团队所有者'>,
  budgetAlertPercent: 80,
  teamCreditAccess: true,
})

const editForm = reactive({
  role: '创作者' as TeamRole,
  budgetAlertPercent: 80,
  teamCreditAccess: true,
})

const roleOptions = computed<TeamRole[]>(() => data.value?.permissions.operatorRole === '团队所有者'
  ? ['团队管理员', '创作者', '查看者']
  : ['创作者', '查看者'])

const filteredMembers = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return (data.value?.members || []).filter(member => {
    const matchesKeyword = !query || member.name.toLowerCase().includes(query) || member.phone.includes(query)
    const matchesRole = roleFilter.value === '全部角色' || member.role === roleFilter.value
    const matchesStatus = statusFilter.value === '全部状态' || member.status === statusFilter.value
    return matchesKeyword && matchesRole && matchesStatus
  })
})

const usageMembers = computed(() => [...(data.value?.members || [])].sort((a, b) =>
  (b.monthUsedCredits + b.monthReservedCredits) - (a.monthUsedCredits + a.monthReservedCredits)))

const selectedMember = computed(() => data.value?.members.find(member => member.id === detailId.value) || null)

function errorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message
  return Array.isArray(message) ? message[0] : message || fallback
}

async function load() {
  loading.value = true
  try {
    data.value = await teamApi.overview()
  } catch (error: any) {
    store.showToast(errorMessage(error, '团队信息加载失败'), 'error')
  } finally {
    loading.value = false
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value || 0)
}

function formatDate(value: string | null) {
  if (!value) return '尚未登录'
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || 'F'
}

function budgetLabel(member: TeamMember) {
  if (member.monthlyCreditLimit === null) return '不限额'
  return `${formatNumber(member.monthUsedCredits + member.monthReservedCredits)} / ${formatNumber(member.monthlyCreditLimit)}`
}

function resetAddForm() {
  Object.assign(addForm, { name: '', phone: '', password: '', role: '创作者', budgetAlertPercent: 80, teamCreditAccess: true })
  addBudget.value = ''
  showAddPassword.value = false
}

function openAdd() {
  resetAddForm()
  addOpen.value = true
}

function onAddRoleChange() {
  addForm.teamCreditAccess = addForm.role !== '查看者'
}

async function addMember() {
  if (!addForm.name.trim() || !addForm.phone.trim() || addForm.password.length < 8) {
    store.showToast('请完整填写姓名、手机号和至少 8 位登录密码', 'error')
    return
  }
  submitting.value = true
  const payload: AddTeamMemberInput = {
    ...addForm,
    name: addForm.name.trim(),
    phone: addForm.phone.trim(),
    monthlyCreditLimit: addBudget.value === '' ? null : Number(addBudget.value),
    teamCreditAccess: addForm.role !== '查看者' && addForm.teamCreditAccess,
  }
  try {
    await teamApi.addMember(payload)
    addOpen.value = false
    await load()
    store.showToast('成员账号已创建')
  } catch (error: any) {
    store.showToast(errorMessage(error, '添加成员失败'), 'error')
  } finally {
    submitting.value = false
  }
}

function openDetail(member: TeamMember) {
  detailId.value = member.id
  editForm.role = member.role
  editForm.budgetAlertPercent = member.budgetAlertPercent
  editForm.teamCreditAccess = member.teamCreditAccess
  editBudget.value = member.monthlyCreditLimit === null ? '' : String(member.monthlyCreditLimit)
  resetPassword.value = ''
  showResetPassword.value = false
}

async function saveMember() {
  const member = selectedMember.value
  if (!member) return
  submitting.value = true
  try {
    if (member.role !== editForm.role) await teamApi.changeRole(member.id, editForm.role)
    await teamApi.updateBudget(member.id, {
      monthlyCreditLimit: editBudget.value === '' ? null : Number(editBudget.value),
      budgetAlertPercent: Number(editForm.budgetAlertPercent),
      teamCreditAccess: editForm.role !== '查看者' && editForm.teamCreditAccess,
    })
    await load()
    detailId.value = ''
    store.showToast('成员设置已保存')
  } catch (error: any) {
    store.showToast(errorMessage(error, '保存成员设置失败'), 'error')
  } finally {
    submitting.value = false
  }
}

async function toggleStatus(member: TeamMember) {
  const status: MemberStatus = member.status === '正常' ? '暂停' : '正常'
  const action = status === '暂停' ? '暂停' : '恢复'
  if (!window.confirm(`确认${action}成员“${member.name}”？`)) return
  submitting.value = true
  try {
    await teamApi.updateStatus(member.id, status)
    await load()
    detailId.value = ''
    store.showToast(`成员已${action}`)
  } catch (error: any) {
    store.showToast(errorMessage(error, `${action}成员失败`), 'error')
  } finally {
    submitting.value = false
  }
}

async function submitResetPassword() {
  const member = selectedMember.value
  if (!member || resetPassword.value.length < 8) {
    store.showToast('新密码至少需要 8 位', 'error')
    return
  }
  submitting.value = true
  try {
    await teamApi.resetPassword(member.id, resetPassword.value)
    resetPassword.value = ''
    store.showToast('登录密码已重置')
  } catch (error: any) {
    store.showToast(errorMessage(error, '重置密码失败'), 'error')
  } finally {
    submitting.value = false
  }
}

async function removeMember(member: TeamMember) {
  if (!window.confirm(`确认将“${member.name}”移出团队？其团队资产会保留，账号将转为个人空间。`)) return
  submitting.value = true
  try {
    await teamApi.removeMember(member.id)
    await load()
    detailId.value = ''
    store.showToast('成员已移出团队')
  } catch (error: any) {
    store.showToast(errorMessage(error, '移出成员失败'), 'error')
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="team-page">
    <div v-if="loading" class="state-block">
      <span class="spinner"></span><span>正在加载团队空间</span>
    </div>

    <template v-else-if="data">
      <header class="page-header">
        <div>
          <div class="title-line">
            <h1>{{ data.tenant.name }}</h1>
            <span class="plan-badge">{{ data.plan }}</span>
          </div>
          <p>团队与成员</p>
        </div>
        <button v-if="data.permissions.canManageMembers" class="primary-button add-member-button" type="button" aria-label="添加成员" title="添加成员" @click="openAdd">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span>添加成员</span>
        </button>
      </header>

      <section class="metric-grid" aria-label="团队概览">
        <article class="metric-item">
          <span>创作席位</span>
          <strong>{{ data.seats.usedSeats }}<small>/ {{ data.seats.seatLimit }}</small></strong>
          <div class="meter"><i :style="{ width: `${Math.min(100, data.seats.usedSeats / data.seats.seatLimit * 100)}%` }"></i></div>
        </article>
        <article class="metric-item">
          <span>团队可用积分</span>
          <strong>{{ formatNumber(data.wallet.available) }}</strong>
          <small>预占 {{ formatNumber(data.wallet.reserved) }}</small>
        </article>
        <article class="metric-item">
          <span>本月已消耗</span>
          <strong>{{ formatNumber(data.wallet.monthUsedCredits) }}</strong>
          <small>待结算 {{ formatNumber(data.wallet.monthReservedCredits) }}</small>
        </article>
        <article class="metric-item">
          <span>活跃成员</span>
          <strong>{{ data.members.filter(item => item.status === '正常').length }}</strong>
          <small>共 {{ data.members.length }} 名成员</small>
        </article>
      </section>

      <nav class="view-tabs" aria-label="团队视图">
        <button :class="{ active: activeTab === 'members' }" @click="activeTab = 'members'">成员管理</button>
        <button :class="{ active: activeTab === 'usage' }" @click="activeTab = 'usage'">用量与预算</button>
      </nav>

      <section v-if="activeTab === 'members'" class="content-section">
        <div class="toolbar">
          <label class="search-box">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            <input v-model="keyword" type="search" placeholder="搜索姓名或手机号" />
          </label>
          <select v-model="roleFilter" aria-label="角色筛选">
            <option>全部角色</option><option>团队所有者</option><option>团队管理员</option><option>创作者</option><option>查看者</option>
          </select>
          <select v-model="statusFilter" aria-label="状态筛选">
            <option>全部状态</option><option>正常</option><option>暂停</option>
          </select>
          <span class="result-count">{{ filteredMembers.length }} 名成员</span>
        </div>

        <div class="member-table">
          <div class="table-head"><span>成员</span><span>角色</span><span>本月用量 / 预算</span><span>状态</span><span>最近登录</span><span></span></div>
          <button v-for="member in filteredMembers" :key="member.id" class="member-row" type="button" @click="member.manageable && openDetail(member)">
            <span class="member-cell">
              <i class="avatar">{{ initials(member.name) }}</i>
              <span><b>{{ member.name }}</b><small>{{ member.phone || '未设置手机号' }}</small></span>
            </span>
            <span><em class="role-tag" :data-role="member.role">{{ member.role }}</em></span>
            <span class="budget-cell">
              <span>{{ budgetLabel(member) }}</span>
              <i v-if="member.monthlyCreditLimit !== null" class="usage-meter"><b :class="member.budgetStatus" :style="{ width: `${Math.min(100, member.budgetPercent || 0)}%` }"></b></i>
            </span>
            <span><em class="status-tag" :class="member.status === '正常' ? 'online' : 'paused'">{{ member.status }}</em></span>
            <span class="date-cell">{{ formatDate(member.lastActiveAt) }}</span>
            <span class="action-cell">
              <svg v-if="member.manageable" viewBox="0 0 24 24" aria-label="管理成员"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
            </span>
          </button>
          <div v-if="!filteredMembers.length" class="empty-state">没有符合条件的成员</div>
        </div>
      </section>

      <section v-else class="content-section usage-section">
        <div class="usage-header">
          <div><h2>成员用量</h2><p>本月成功任务与进行中任务预占</p></div>
          <span>团队共享积分池</span>
        </div>
        <div class="usage-table">
          <div class="usage-row usage-head"><span>成员</span><span>成功消耗</span><span>待结算</span><span>任务数</span><span>月预算</span></div>
          <button v-for="member in usageMembers" :key="member.id" type="button" class="usage-row" @click="member.manageable && openDetail(member)">
            <span class="member-cell"><i class="avatar compact">{{ initials(member.name) }}</i><b>{{ member.name }}</b></span>
            <strong>{{ formatNumber(member.monthUsedCredits) }}</strong>
            <span>{{ formatNumber(member.monthReservedCredits) }}</span>
            <span>{{ member.monthTaskCount }}</span>
            <span class="budget-state" :class="member.budgetStatus">{{ budgetLabel(member) }}</span>
          </button>
        </div>
      </section>
    </template>

    <Teleport to="body">
      <div v-if="addOpen" class="modal-layer" @mousedown.self="addOpen = false">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
          <header><div><h2 id="add-member-title">添加成员</h2><p>创建后可直接使用手机号和密码登录</p></div><button class="close-button" title="关闭" @click="addOpen = false">×</button></header>
          <div class="dialog-body">
            <div class="form-grid two-columns">
              <label><span>成员姓名</span><input v-model.trim="addForm.name" maxlength="50" placeholder="输入姓名" /></label>
              <label><span>登录手机号</span><input v-model.trim="addForm.phone" maxlength="11" inputmode="numeric" placeholder="中国大陆手机号" /></label>
            </div>
            <label class="field"><span>登录密码</span><span class="password-field"><input v-model="addForm.password" :type="showAddPassword ? 'text' : 'password'" maxlength="72" placeholder="8 至 72 位密码" /><button type="button" @click="showAddPassword = !showAddPassword">{{ showAddPassword ? '隐藏' : '显示' }}</button></span></label>
            <div class="form-grid two-columns">
              <label><span>团队角色</span><select v-model="addForm.role" @change="onAddRoleChange"><option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option></select></label>
              <label><span>月积分预算</span><input v-model="addBudget" type="number" min="0" step="1" placeholder="留空为不限额" /></label>
            </div>
            <div class="form-grid two-columns">
              <label><span>预警阈值</span><select v-model.number="addForm.budgetAlertPercent"><option :value="50">50%</option><option :value="70">70%</option><option :value="80">80%</option><option :value="90">90%</option><option :value="100">100%</option></select></label>
              <label class="toggle-field"><span><b>使用团队积分</b><small>{{ addForm.role === '查看者' ? '查看者不可使用' : '允许提交创作任务' }}</small></span><input v-model="addForm.teamCreditAccess" type="checkbox" :disabled="addForm.role === '查看者'" /></label>
            </div>
            <div class="seat-note"><span>创作席位</span><strong>{{ data?.seats.usedSeats }} / {{ data?.seats.seatLimit }}</strong><em>{{ addForm.role === '查看者' ? '本角色不占席位' : '本角色占用 1 个席位' }}</em></div>
          </div>
          <footer><button class="secondary-button" @click="addOpen = false">取消</button><button class="primary-button" :disabled="submitting" @click="addMember">{{ submitting ? '正在创建' : '创建成员' }}</button></footer>
        </section>
      </div>

      <div v-if="selectedMember" class="drawer-layer" @mousedown.self="detailId = ''">
        <aside class="member-drawer" role="dialog" aria-modal="true" aria-labelledby="member-detail-title">
          <header class="drawer-header"><div class="member-cell"><i class="avatar large">{{ initials(selectedMember.name) }}</i><span><h2 id="member-detail-title">{{ selectedMember.name }}</h2><p>{{ selectedMember.phone }}</p></span></div><button class="close-button" title="关闭" @click="detailId = ''">×</button></header>
          <div class="drawer-body">
            <section class="drawer-section">
              <h3>成员权限</h3>
              <div class="form-grid two-columns">
                <label><span>团队角色</span><select v-model="editForm.role"><option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option></select></label>
                <label><span>成员状态</span><input :value="selectedMember.status" disabled /></label>
              </div>
              <label class="toggle-field full"><span><b>使用团队积分</b><small>关闭后不能提交任何扣费任务</small></span><input v-model="editForm.teamCreditAccess" type="checkbox" :disabled="editForm.role === '查看者'" /></label>
            </section>
            <section class="drawer-section">
              <div class="section-line"><h3>本月预算</h3><span>{{ budgetLabel(selectedMember) }}</span></div>
              <div class="usage-overview"><strong>{{ formatNumber(selectedMember.monthUsedCredits) }}</strong><span>已消耗</span><strong>{{ formatNumber(selectedMember.monthReservedCredits) }}</strong><span>待结算</span></div>
              <div class="form-grid two-columns">
                <label><span>月积分预算</span><input v-model="editBudget" type="number" min="0" step="1" placeholder="留空为不限额" /></label>
                <label><span>预警阈值</span><select v-model.number="editForm.budgetAlertPercent"><option :value="50">50%</option><option :value="70">70%</option><option :value="80">80%</option><option :value="90">90%</option><option :value="100">100%</option></select></label>
              </div>
            </section>
            <section class="drawer-section">
              <h3>重置登录密码</h3>
              <span class="password-field"><input v-model="resetPassword" :type="showResetPassword ? 'text' : 'password'" maxlength="72" placeholder="输入新的 8 至 72 位密码" /><button type="button" @click="showResetPassword = !showResetPassword">{{ showResetPassword ? '隐藏' : '显示' }}</button></span>
              <button class="text-button" :disabled="submitting || resetPassword.length < 8" @click="submitResetPassword">确认重置</button>
            </section>
            <section class="drawer-section danger-section">
              <button class="warning-button" :disabled="submitting" @click="toggleStatus(selectedMember)">{{ selectedMember.status === '正常' ? '暂停成员' : '恢复成员' }}</button>
              <button class="danger-button" :disabled="submitting" @click="removeMember(selectedMember)">移出团队</button>
            </section>
          </div>
          <footer class="drawer-footer"><button class="secondary-button" @click="detailId = ''">取消</button><button class="primary-button" :disabled="submitting" @click="saveMember">{{ submitting ? '正在保存' : '保存设置' }}</button></footer>
        </aside>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.team-page{width:min(1240px,100%);margin:0 auto;padding:4px 0 36px;color:#172033}.page-header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:22px}.page-header h1{margin:0;font-size:25px;line-height:1.3;letter-spacing:0}.page-header p{margin:5px 0 0;color:#7a8497;font-size:13px}.title-line{display:flex;align-items:center;gap:10px}.plan-badge{padding:3px 8px;border:1px solid #cad5ff;border-radius:5px;color:#3448b8;background:#f3f6ff;font-size:11px;font-weight:700}.primary-button,.secondary-button{height:38px;padding:0 16px;border-radius:6px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}.primary-button{border:1px solid #2f46c7;background:#3851d6;color:#fff}.primary-button:hover{background:#2f45bf}.primary-button:disabled{opacity:.5;cursor:not-allowed}.primary-button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}.secondary-button{border:1px solid #d8dde7;background:#fff;color:#3d4759}.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid #e1e5ec;border-radius:8px;background:#fff;margin-bottom:22px;overflow:hidden}.metric-item{min-height:112px;padding:20px 22px;border-right:1px solid #edf0f4;display:flex;flex-direction:column;justify-content:center}.metric-item:last-child{border-right:0}.metric-item>span{font-size:12px;color:#7d8798}.metric-item strong{font-size:27px;line-height:1.3;margin-top:8px}.metric-item strong small{font-size:14px;color:#8d96a6;margin-left:4px}.metric-item>small{margin-top:4px;color:#8d96a6;font-size:12px}.meter,.usage-meter{height:4px;background:#e9edf3;border-radius:2px;overflow:hidden}.meter{margin-top:12px}.meter i{display:block;height:100%;background:#00a67d}.view-tabs{display:flex;gap:24px;border-bottom:1px solid #dfe4ec;margin-bottom:0}.view-tabs button{border:0;background:transparent;padding:0 2px 13px;color:#6f798b;font-size:14px;font-weight:600;cursor:pointer;position:relative}.view-tabs button.active{color:#2339ad}.view-tabs button.active:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:#3851d6}.content-section{background:#fff;border:1px solid #e1e5ec;border-top:0;border-radius:0 0 8px 8px;overflow:hidden}.toolbar{min-height:68px;display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #edf0f4}.search-box{height:38px;width:min(360px,42%);border:1px solid #d8dde7;border-radius:6px;display:flex;align-items:center;padding:0 11px;gap:8px}.search-box:focus-within{border-color:#6c7de0;box-shadow:0 0 0 3px #eef1ff}.search-box svg{width:17px;height:17px;fill:none;stroke:#818b9c;stroke-width:1.8}.search-box input{border:0;outline:0;width:100%;font-size:13px;background:transparent}.toolbar select,.dialog select,.dialog input,.member-drawer select,.member-drawer input{height:38px;border:1px solid #d8dde7;border-radius:6px;padding:0 10px;background:#fff;color:#303a4c;outline:0}.toolbar select:focus,.dialog select:focus,.dialog input:focus,.member-drawer select:focus,.member-drawer input:focus{border-color:#6c7de0;box-shadow:0 0 0 3px #eef1ff}.result-count{margin-left:auto;color:#8a94a5;font-size:12px}.table-head,.member-row{display:grid;grid-template-columns:minmax(220px,1.5fr) 135px minmax(180px,1.1fr) 90px 130px 36px;align-items:center;gap:14px;padding:0 18px}.table-head{height:42px;background:#f8f9fb;color:#7d8798;font-size:12px;border-bottom:1px solid #e8ebf0}.member-row{width:100%;min-height:70px;border:0;border-bottom:1px solid #eef1f4;background:#fff;text-align:left;color:#303a4c;cursor:default}.member-row[style],.member-row{font:inherit}.member-row:hover{background:#fafbfe}.member-row:has(.action-cell svg){cursor:pointer}.member-cell{display:flex;align-items:center;gap:10px;min-width:0}.member-cell>span{display:flex;flex-direction:column;min-width:0}.member-cell b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.member-cell small{font-size:11px;color:#8b95a5;margin-top:3px}.avatar{width:34px;height:34px;flex:0 0 34px;border-radius:50%;display:grid;place-items:center;background:#e9f5f1;color:#08795e;font-size:13px;font-style:normal;font-weight:800}.avatar.compact{width:28px;height:28px;flex-basis:28px;font-size:11px}.avatar.large{width:42px;height:42px;flex-basis:42px}.role-tag,.status-tag{font-style:normal;font-size:11px;border-radius:5px;padding:4px 7px;white-space:nowrap}.role-tag{background:#f0f2f6;color:#536074}.role-tag[data-role="团队所有者"]{background:#fff1dd;color:#9b5b00}.role-tag[data-role="团队管理员"]{background:#edf0ff;color:#3b4ab4}.role-tag[data-role="查看者"]{background:#f1f2f4;color:#687385}.status-tag.online{background:#e9f7f1;color:#08795e}.status-tag.paused{background:#f2f3f5;color:#737d8d}.budget-cell{display:flex;flex-direction:column;gap:7px;font-size:12px}.usage-meter{width:min(140px,100%)}.usage-meter b{display:block;height:100%;background:#3a83d0}.usage-meter b.warning{background:#e99a16}.usage-meter b.exhausted{background:#d14a4a}.date-cell{font-size:12px;color:#778294}.action-cell{display:flex;justify-content:flex-end}.action-cell svg{width:20px;height:20px;fill:#7e899b}.empty-state,.state-block{min-height:220px;display:flex;align-items:center;justify-content:center;color:#8a94a5;font-size:13px}.state-block{gap:10px}.spinner{width:18px;height:18px;border:2px solid #dce1ea;border-top-color:#3851d6;border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.usage-header{height:68px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #edf0f4}.usage-header h2{font-size:15px;margin:0}.usage-header p{font-size:11px;color:#8a94a5;margin:4px 0 0}.usage-header>span{font-size:11px;color:#08795e;background:#eaf7f3;padding:5px 8px;border-radius:5px}.usage-row{width:100%;display:grid;grid-template-columns:minmax(220px,1.5fr) repeat(4,minmax(100px,1fr));align-items:center;gap:16px;min-height:61px;padding:0 20px;border:0;border-bottom:1px solid #edf0f4;background:#fff;text-align:left;color:#465164;font:inherit}.usage-row:not(.usage-head):hover{background:#fafbfe}.usage-head{min-height:40px;background:#f8f9fb;color:#7d8798;font-size:12px}.usage-row strong{font-size:13px;color:#263247}.budget-state{font-size:12px}.budget-state.warning{color:#b36e00}.budget-state.exhausted{color:#bb3030}.modal-layer,.drawer-layer{position:fixed;inset:0;background:rgba(19,27,43,.46);z-index:1200;display:flex}.modal-layer{align-items:center;justify-content:center;padding:20px}.dialog{width:min(620px,100%);max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:8px;box-shadow:0 24px 64px rgba(20,30,50,.22)}.dialog>header,.dialog>footer{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #e8ebf0}.dialog>header h2,.drawer-header h2{margin:0;font-size:18px}.dialog>header p,.drawer-header p{margin:4px 0 0;color:#818b9c;font-size:12px}.dialog>footer{border-top:1px solid #e8ebf0;border-bottom:0;justify-content:flex-end;gap:9px}.close-button{border:0;background:transparent;color:#667085;width:32px;height:32px;font-size:25px;line-height:1;cursor:pointer}.dialog-body{padding:20px 22px;display:grid;gap:17px}.form-grid{display:grid;gap:14px}.two-columns{grid-template-columns:1fr 1fr}.dialog label,.member-drawer label{display:flex;flex-direction:column;gap:7px;color:#566173;font-size:12px}.field{display:flex}.password-field{display:flex;position:relative}.password-field input{width:100%;padding-right:54px}.password-field button{position:absolute;right:4px;top:4px;height:30px;border:0;background:transparent;color:#4356c2;font-size:11px;cursor:pointer}.toggle-field{height:61px;padding:0 11px;border:1px solid #e0e4eb;border-radius:6px;display:flex!important;flex-direction:row!important;align-items:center;justify-content:space-between}.toggle-field>span{display:flex;flex-direction:column;gap:3px}.toggle-field b{font-size:12px;color:#364154}.toggle-field small{font-size:10px;color:#8a94a5}.toggle-field input{appearance:none;width:36px!important;height:20px!important;padding:0!important;border:0!important;border-radius:10px!important;background:#cbd2dd!important;position:relative;box-shadow:none!important;cursor:pointer}.toggle-field input:after{content:"";position:absolute;width:16px;height:16px;left:2px;top:2px;border-radius:50%;background:#fff;transition:.18s}.toggle-field input:checked{background:#2d9b7a!important}.toggle-field input:checked:after{transform:translateX(16px)}.toggle-field input:disabled{opacity:.5}.seat-note{height:42px;padding:0 12px;display:flex;align-items:center;gap:10px;background:#f7f8fa;border-radius:6px;font-size:12px}.seat-note strong{color:#263247}.seat-note em{margin-left:auto;font-style:normal;color:#7b8596}.drawer-layer{justify-content:flex-end}.member-drawer{height:100%;width:min(480px,100%);background:#fff;box-shadow:-18px 0 50px rgba(20,30,50,.18);display:flex;flex-direction:column}.drawer-header{padding:20px 22px;border-bottom:1px solid #e8ebf0;display:flex;align-items:center;justify-content:space-between}.drawer-body{padding:0 22px;overflow:auto;flex:1}.drawer-section{padding:20px 0;border-bottom:1px solid #e8ebf0;display:grid;gap:14px}.drawer-section h3{font-size:13px;margin:0}.section-line{display:flex;justify-content:space-between;align-items:center}.section-line span{font-size:11px;color:#768194}.toggle-field.full{width:100%;box-sizing:border-box}.usage-overview{display:grid;grid-template-columns:auto 1fr auto 1fr;align-items:baseline;gap:7px;background:#f7f9fb;padding:13px;border-radius:6px}.usage-overview strong{font-size:18px}.usage-overview span{font-size:10px;color:#8590a1}.text-button{justify-self:end;border:0;background:transparent;color:#354bc0;font-size:12px;cursor:pointer}.text-button:disabled{opacity:.4}.danger-section{grid-template-columns:1fr 1fr}.warning-button,.danger-button{height:37px;border-radius:6px;background:#fff;font-weight:600;cursor:pointer}.warning-button{border:1px solid #d9b469;color:#966000}.danger-button{border:1px solid #e1a4a4;color:#b52d2d}.drawer-footer{padding:14px 22px;border-top:1px solid #e8ebf0;display:flex;justify-content:flex-end;gap:9px}
@media(max-width:980px){.metric-grid{grid-template-columns:1fr 1fr}.metric-item:nth-child(2){border-right:0}.metric-item:nth-child(-n+2){border-bottom:1px solid #edf0f4}.table-head,.member-row{grid-template-columns:minmax(190px,1.4fr) 120px minmax(150px,1fr) 80px 34px}.table-head span:nth-child(5),.member-row>.date-cell{display:none}}
@media(max-width:680px){.team-page{padding:0 0 24px}.page-header{align-items:flex-start}.page-header>div,.title-line{min-width:0}.page-header h1{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.add-member-button{width:38px;padding:0;flex:0 0 38px}.add-member-button span{display:none}.metric-grid{grid-template-columns:1fr 1fr}.metric-item{padding:16px;min-height:95px}.metric-item strong{font-size:22px}.toolbar{flex-wrap:wrap}.search-box{width:100%}.result-count{margin-left:0}.table-head{display:none}.member-row{grid-template-columns:minmax(0,1fr) auto 28px;gap:8px;padding:10px 13px}.member-row>span:nth-child(2),.member-row>.budget-cell,.member-row>.date-cell{display:none}.two-columns{grid-template-columns:1fr}.usage-row{grid-template-columns:minmax(150px,1.3fr) 1fr 1fr}.usage-row>span:nth-child(3),.usage-row>span:nth-child(4){display:none}.dialog-body{padding:18px}.modal-layer{padding:10px}.danger-section{grid-template-columns:1fr}}
</style>
