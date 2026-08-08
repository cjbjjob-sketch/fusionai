<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'

type DocumentType = 'terms' | 'privacy'
interface LegalSection { title: string; paragraphs: string[]; items?: string[] }

const props = defineProps<{ document: DocumentType }>()
const operator = '杭州具身人工智能科技有限公司'
const brand = 'FusionAI（融艺AI）'
const version = '2026-07-15'

const terms: LegalSection[] = [
  { title: '一、协议范围与接受', paragraphs: [`本协议是你与${operator}之间关于使用${brand}网站、应用及相关服务的约定。你完成注册、登录或实际使用服务，即表示你已阅读、理解并同意本协议及《FusionAI 隐私政策》。`, '如你代表企业或其他组织使用服务，你确认已获得该组织的有效授权，并确保组织成员遵守本协议。'] },
  { title: '二、账号与团队空间', paragraphs: ['你应使用真实、有效的手机号注册并妥善保管账号、密码和验证码。账号下发生的操作原则上视为账号持有人的行为。发现账号被盗用或存在异常时，应及时修改密码并通过平台客服联系我们。'], items: ['不得买卖、出租、出借账号或绕过账号权限控制。', '团队管理员可邀请成员、分配权限并管理团队资产；管理员应确保其操作已获得组织授权。', '因用户主动共享、保管不善或违规授权造成的损失，由用户依法承担相应责任。'] },
  { title: '三、AI 创作与平台服务', paragraphs: ['平台提供图像、视频、广告创意、电商工具、素材与品牌资产管理等功能。生成结果受模型能力、输入内容、参数、供应商状态及网络环境影响，平台不保证每次生成结果完全符合预期。', '你应当对提示词、上传素材、参考图、商品和品牌资料拥有合法权利，并在发布或商业使用生成内容前自行核验事实、知识产权、肖像、商标、广告合规及平台规则。'] },
  { title: '四、积分、套餐与费用', paragraphs: ['平台使用统一算力积分衡量生成服务消耗，并通过套餐提供积分及功能权益。提交任务前会展示预计消耗，最终以实际执行参数和结算记录为准。'], items: ['任务提交时可预占积分，成功后按实际消耗结算；因系统或供应商原因失败的任务按规则释放或返还积分。', '套餐积分按订阅周期发放且不结转；充值积分有效期、价格及赠送规则以购买页面展示为准。', '套餐、价格、模型成本和权益可能随经营情况调整；对已购买且仍在有效期内的权益，按适用法律和购买时规则处理。', '除法律另有规定或平台明确承诺外，已消耗的积分和已履行的数字化服务不支持退款。'] },
  { title: '五、用户内容与知识产权', paragraphs: ['你保留对合法上传内容依法享有的权利。为提供生成、存储、展示、下载、协作和故障排查服务，你授予平台在服务必要范围内处理相关内容的许可。', '平台的软件、界面、品牌标识、运营内容及技术成果归平台或相应权利人所有。未经许可，不得复制、反向工程、抓取或用于训练竞争性模型。'] },
  { title: '六、禁止行为', paragraphs: ['你不得利用平台从事违法违规、侵害他人权益或危害平台安全的活动。'], items: ['生成或传播违法、欺诈、仇恨、色情、暴力、侵权或误导性内容。', '未经授权处理个人敏感信息、他人肖像、商业秘密或受保护作品。', '干扰服务运行、批量注册、绕过计费或权限限制、实施攻击或恶意自动化访问。', '冒充他人、伪造来源，或将生成内容用于应当由专业人士判断的高风险决策。'] },
  { title: '七、服务变更、中断与终止', paragraphs: ['平台可能因维护、升级、供应商调整、不可抗力或安全风险暂停部分服务，并将在合理范围内提供提示。对严重违规、危害安全或长期欠费的账号，平台可依法采取限制功能、暂停或终止服务等措施。', '你可停止使用服务。账号注销、团队资产迁移及数据删除按照平台当时提供的功能和法律要求处理。'] },
  { title: '八、责任边界', paragraphs: ['平台将采取合理措施保障服务稳定与数据安全，但AI生成具有概率性，第三方模型和网络服务也可能发生延迟或中断。在法律允许范围内，平台不对用户未经核验直接使用生成内容造成的损失承担责任。', '本条不排除因平台故意或重大过失、依法不得排除的消费者权益及其他法定责任。'] },
  { title: '九、协议更新与争议解决', paragraphs: ['平台可能根据业务、技术或法律变化更新协议，并以页面提示等合理方式告知。重大变更将在生效前给予合理提示。', `本协议适用中华人民共和国法律。发生争议时，双方应先友好协商；协商不成的，可依法向${operator}住所地有管辖权的人民法院提起诉讼。`] },
  { title: '十、联系我们', paragraphs: [`如对本协议、账号或服务有疑问，可通过${brand}站内客服或平台公布的联系方式联系我们。运营主体：${operator}。`] },
]

const privacy: LegalSection[] = [
  { title: '一、适用范围与个人信息处理者', paragraphs: [`本政策说明${operator}作为个人信息处理者，在运营${brand}过程中如何收集、使用、存储、共享和保护你的个人信息，以及你如何行使相关权利。`] },
  { title: '二、我们收集的信息', paragraphs: ['我们遵循合法、正当、必要和诚信原则，仅收集实现服务所需的信息。'], items: ['账号信息：手机号、短信验证码校验结果、密码加密值、姓名、企业或团队名称。', '创作与资产信息：提示词、参数、上传的图片、视频、音频、商品资料、品牌资料及生成结果。', '交易与用量信息：套餐、积分余额、预占和结算记录、订单及支付状态。平台不直接保存完整银行卡信息。', '设备与日志信息：IP 地址、浏览器和设备类型、访问时间、操作日志、错误和安全事件。', '你主动提交的客服沟通、反馈及其他必要信息。'] },
  { title: '三、我们如何使用信息', paragraphs: ['我们会将信息用于下列目的，并在目的变化时依法另行告知或取得同意。'], items: ['创建账号、验证身份、登录和保障账号安全。', '执行AI生成任务、保存资产、支持团队协作和提供下载。', '计算积分、处理订阅与订单、展示用量和消费明细。', '排查故障、防范欺诈与攻击、改进产品性能和交互体验。', '履行法律法规、监管要求及处理争议所需的义务。'] },
  { title: '四、委托处理与第三方服务', paragraphs: ['为完成短信验证、文件存储、支付、AI生成和基础设施运维，我们可能委托具备相应能力的服务商处理必要信息。例如，短信验证码通过阿里云短信发送，上传和生成的文件可存储于云对象存储，生成任务会向所选模型供应商传输完成任务所需的提示词、参数和参考素材。', '我们会通过合同、安全措施和最小必要原则约束服务商，不允许其将信息用于约定目的之外的用途。若第三方以独立个人信息处理者身份提供服务，其处理活动还适用该第三方的规则。'] },
  { title: '五、信息存储与保留', paragraphs: ['原则上，我们在中华人民共和国境内存储运营过程中收集的个人信息。如发生跨境提供，我们将依法履行告知、取得单独同意或其他法定义务。', '我们仅在实现目的所必需的期限内保留信息。账号信息通常保留至账号注销后法定或争议处理期限届满；资产按套餐保留期限、用户删除操作及备份清理周期处理；交易和日志信息按法律及安全审计要求保留。'] },
  { title: '六、安全保护', paragraphs: ['我们采取访问控制、传输加密、密码哈希、权限隔离、日志审计、备份和安全监测等措施保护信息。互联网服务不存在绝对安全；发生可能影响你权益的安全事件时，我们将依法采取补救措施并履行通知义务。'] },
  { title: '七、你的权利', paragraphs: ['在适用法律范围内，你有权查阅、复制、更正、补充、删除个人信息，撤回同意，注销账号，并要求解释个人信息处理规则。你可通过账号设置或站内客服提交请求。', '为保护账号和他人权益，我们可能先核验身份。撤回同意不影响撤回前基于同意已经进行的处理；部分必要信息被删除或授权被撤回后，相应功能可能无法继续提供。'] },
  { title: '八、未成年人保护', paragraphs: ['平台主要面向具备完全民事行为能力的企业和创作者。未满十四周岁的未成年人不得自行注册或使用服务；其他未成年人应在监护人指导和同意下使用。若发现未经监护人同意收集了儿童个人信息，我们将依法尽快处理。'] },
  { title: '九、本地存储与类似技术', paragraphs: ['我们使用浏览器本地存储或类似技术保存登录状态、界面偏好和必要的安全标识。这些技术用于保障基础功能和改善体验，你可通过浏览器设置进行管理，但清除后可能需要重新登录。'] },
  { title: '十、政策更新与联系我们', paragraphs: ['我们可能根据业务、技术或法律变化更新本政策。重大变更会通过页面提示等方式告知，并在依法需要时重新取得同意。', `如对隐私保护或个人信息权利有疑问，可通过${brand}站内客服或平台公布的联系方式联系我们。个人信息处理者：${operator}。`] },
]

const isTerms = computed(() => props.document === 'terms')
const title = computed(() => isTerms.value ? 'FusionAI 服务协议' : 'FusionAI 隐私政策')
const subtitle = computed(() => isTerms.value ? '使用产品与服务前，请仔细阅读并充分理解本协议。' : '我们重视你的信息安全与个人信息权益。')
const sections = computed(() => isTerms.value ? terms : privacy)

function updateTitle() { document.title = `${title.value} - FusionAI（融艺AI）` }
onMounted(() => { updateTitle(); window.scrollTo({ top: 0 }) })
watch(() => props.document, () => { updateTitle(); window.scrollTo({ top: 0 }) })
</script>

<template>
  <main class="legal-page">
    <header class="legal-header">
      <RouterLink class="brand" to="/login" aria-label="返回登录注册页"><img src="/brand/fusionai-logo.png" alt="FusionAI 融艺AI" /></RouterLink>
      <nav aria-label="法律文件">
        <RouterLink to="/terms" :class="{ active: isTerms }">服务协议</RouterLink>
        <RouterLink to="/privacy" :class="{ active: !isTerms }">隐私政策</RouterLink>
      </nav>
      <RouterLink class="back-link" to="/login">返回登录注册</RouterLink>
    </header>

    <section class="legal-hero">
      <div><p class="brand-label">FusionAI（融艺AI）</p><h1>{{ title }}</h1><p>{{ subtitle }}</p></div>
      <dl>
        <div><dt>更新日期</dt><dd>{{ version }}</dd></div>
        <div><dt>生效日期</dt><dd>{{ version }}</dd></div>
        <div><dt>运营主体</dt><dd>{{ operator }}</dd></div>
      </dl>
    </section>

    <div class="legal-layout">
      <aside><strong>目录</strong><a v-for="(section, index) in sections" :key="section.title" :href="`#section-${index}`">{{ section.title }}</a></aside>
      <article>
        <section v-for="(section, index) in sections" :id="`section-${index}`" :key="section.title">
          <h2>{{ section.title }}</h2>
          <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
          <ul v-if="section.items"><li v-for="item in section.items" :key="item">{{ item }}</li></ul>
        </section>
      </article>
    </div>

    <footer><span>© 2026 FusionAI（融艺AI）</span><span>{{ operator }}</span></footer>
  </main>
</template>

<style scoped>
.legal-page{min-height:100vh;background:#f7f8fa;color:#1d2939}.legal-header{position:sticky;top:0;z-index:10;height:68px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 clamp(22px,5vw,72px);border-bottom:1px solid #e4e7ec;background:rgba(255,255,255,.96);backdrop-filter:blur(12px)}.brand{width:142px;height:42px;display:flex;align-items:center}.brand img{display:block;max-width:100%;max-height:38px;object-fit:contain}.legal-header nav{display:flex;align-items:center;gap:6px;padding:4px;background:#f2f4f7;border-radius:7px}.legal-header nav a{padding:7px 12px;border-radius:5px;color:#667085;font-size:13px;font-weight:700;text-decoration:none}.legal-header nav a.active{background:#fff;color:#5146e5;box-shadow:0 1px 3px rgba(16,24,40,.1)}.back-link{justify-self:end;color:#475467;font-size:13px;font-weight:700;text-decoration:none}.back-link:hover{color:#5146e5}.legal-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,480px);gap:72px;padding:72px clamp(24px,8vw,140px) 64px;background:#111827;color:#fff}.brand-label{margin:0 0 12px;color:#a5b4fc;font-size:13px;font-weight:800}.legal-hero h1{margin:0;font-size:clamp(38px,5vw,64px);line-height:1.08;letter-spacing:0}.legal-hero>div>p:last-child{margin:20px 0 0;color:#cbd5e1;font-size:17px}.legal-hero dl{align-self:end;margin:0;padding-left:28px;border-left:1px solid #344054}.legal-hero dl div{display:grid;grid-template-columns:74px 1fr;gap:18px;padding:7px 0}.legal-hero dt{color:#98a2b3;font-size:12px}.legal-hero dd{margin:0;color:#f2f4f7;font-size:13px;line-height:1.5}.legal-layout{display:grid;grid-template-columns:230px minmax(0,820px);justify-content:center;gap:72px;padding:64px 28px 96px}.legal-layout aside{position:sticky;top:100px;align-self:start;display:grid;gap:5px}.legal-layout aside strong{margin-bottom:8px;color:#101828;font-size:13px}.legal-layout aside a{padding:6px 0;color:#667085;font-size:12px;line-height:1.35;text-decoration:none}.legal-layout aside a:hover{color:#5146e5}.legal-layout article{min-width:0}.legal-layout article section{scroll-margin-top:100px;padding:0 0 40px;margin-bottom:40px;border-bottom:1px solid #e4e7ec}.legal-layout article section:last-child{margin:0;border:0}.legal-layout h2{margin:0 0 18px;color:#101828;font-size:22px}.legal-layout p,.legal-layout li{color:#475467;font-size:15px;line-height:1.9}.legal-layout p{margin:0 0 12px}.legal-layout ul{display:grid;gap:8px;margin:14px 0 0;padding-left:22px}.legal-page footer{display:flex;justify-content:space-between;gap:20px;padding:26px clamp(24px,8vw,140px);border-top:1px solid #e4e7ec;background:#fff;color:#98a2b3;font-size:12px}@media(max-width:860px){.legal-header{grid-template-columns:1fr auto}.legal-header nav{display:none}.legal-hero{grid-template-columns:1fr;gap:36px;padding-top:52px}.legal-hero dl{padding-left:0;padding-top:24px;border-left:0;border-top:1px solid #344054}.legal-layout{grid-template-columns:1fr;padding-top:44px}.legal-layout aside{display:none}}@media(max-width:520px){.legal-header{height:60px;padding:0 18px}.brand{width:115px}.back-link{font-size:12px}.legal-hero{padding:42px 20px}.legal-hero h1{font-size:36px}.legal-layout{padding:38px 20px 64px}.legal-layout h2{font-size:19px}.legal-layout p,.legal-layout li{font-size:14px}.legal-page footer{flex-direction:column;padding:22px 20px}}
</style>
