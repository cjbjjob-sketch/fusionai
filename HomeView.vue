<script setup lang="ts">
import { RouterLink } from 'vue-router'
import MarketingFooter from '@/components/MarketingFooter.vue'
import MarketingHeader from '@/components/MarketingHeader.vue'

const modelHighlights = [
  { name: 'GPT Image 2', vendor: 'OpenAI', type: '图像', description: '文字渲染、商品细节、参考图编辑与最高 4K 输出。', accent: 'violet', href: '/gpt-image-2' },
  { name: 'Nano Banana 2', vendor: 'Google', type: '图像', description: '多图参考、连续编辑与高效商业图像生产。', accent: 'blue', href: '/image' },
  { name: 'Seedance 2.0', vendor: 'ByteDance', type: '视频', description: '多模态参考、首尾帧、声音与专业视频生成。', accent: 'coral', href: '/video' },
  { name: '可灵 Kling', vendor: 'Kuaishou', type: '视频', description: '高质量图生视频、镜头控制与多种生成方式。', accent: 'dark', href: '/video' },
  { name: 'Google Veo', vendor: 'Google', type: '视频', description: '电影感画面、音画生成与多规格商业视频输出。', accent: 'blue', href: '/video' },
  { name: 'Vidu', vendor: 'ShengShu', type: '视频', description: '快速视频生成、主体一致性与灵活参考控制。', accent: 'green', href: '/video' },
  { name: 'Happyhorse', vendor: 'Global Model', type: '图像', description: '面向商业视觉的灵活图像生成与创意探索。', accent: 'amber', href: '/image' },
  { name: 'Gemini Image', vendor: 'Google', type: '图像', description: '自然语言编辑、多图理解与多尺寸图像生成。', accent: 'blue', href: '/image' },
]

const platformFeatures = [
  {
    number: '01',
    eyebrow: 'CREATE',
    title: '图像与视频创作',
    description: '按生成方式筛选可用模型，统一管理提示词、参考素材、比例、清晰度和任务历史。',
    href: '/image',
    action: '进入创作中心',
  },
  {
    number: '02',
    eyebrow: 'ECOMMERCE',
    title: '电商专用工具',
    description: '把商品精修、换背景、服装上身、万物穿戴和商详套图封装为可直接完成的任务。',
    href: '/commerce',
    action: '查看电商工具',
  },
  {
    number: '03',
    eyebrow: 'AD WORKFLOW',
    title: '广告创意项目',
    description: 'AI 辅助完成创意方向、脚本、分镜与成片，把零散生成组织成一条广告工作流。',
    href: '/creative',
    action: '创建广告项目',
  },
  {
    number: '04',
    eyebrow: 'ASSETS',
    title: '商品、品牌与内容资产',
    description: '让商品信息、品牌规范、参考素材和生成结果持续进入后续任务，保持内容一致并反复复用。',
    href: '/materials',
    action: '管理创作资产',
  },
]

const commerceTools = [
  {
    id: 'detail-page',
    title: 'AI 商详套图',
    description: '从商品信息出发，一次生成首图、卖点图、场景图、模特图和细节图。',
    image: '/home/tool-detail.webp',
    tag: '整套生成',
    featured: true,
  },
  {
    id: 'polish',
    title: '产品精修',
    description: '修复边缘、反光与小瑕疵，保留商品材质和结构。',
    image: '/home/tool-polish.webp',
    tag: '高保真',
  },
  {
    id: 'background',
    title: '商品换背景',
    description: '自动抠取商品，自然融合到营销场景和渠道画幅。',
    image: '/home/tool-background.webp',
    tag: '场景营销',
  },
  {
    id: 'virtual-try-on',
    title: '服装上身',
    description: '单件或多件服装自然上身，保持版型、纹理与人物一致。',
    image: '/home/tool-try-on.webp',
    tag: '服饰电商',
  },
  {
    id: 'universal-wear',
    title: '万物穿戴',
    description: '在参考图指定区域精准替换箱包、配饰和穿戴商品。',
    image: '/home/tool-wear.webp',
    tag: '局部替换',
  },
  {
    id: 'models',
    title: '一组模特生成',
    description: '保持商品与模特一致，快速产出多姿势、多构图展示图。',
    image: '/home/tool-models.webp',
    tag: '批量出图',
  },
  {
    id: 'baby',
    title: 'AI 婴儿换装',
    description: '面向母婴服饰生成自然、明亮、可直接上架的换装图。',
    image: '/home/tool-baby.webp',
    tag: '母婴专用',
  },
  {
    id: 'poster',
    title: '活动海报生成',
    description: '结合商品卖点和品牌规范，生成大促与日常营销海报。',
    image: '/home/tool-poster.webp',
    tag: '营销设计',
  },
]

const faqs = [
  {
    question: 'FusionAI（融艺 AI）适合哪些用户？',
    answer: '适合个人创作者、电商商家、品牌方、设计师、电商运营、代运营团队、广告公司、MCN、短视频团队和出海团队。',
  },
  {
    question: '只上传一张商品图，可以生成哪些内容？',
    answer: '可以继续生成白底主图、商品场景图、模特展示图、详情页套图、种草短视频、产品广告视频和品牌营销物料。',
  },
  {
    question: '电商工具和通用图像创作有什么区别？',
    answer: '电商工具把商品精修、换背景、服装上身、模特组图、活动海报等高频任务封装成清晰流程；图像创作则适合更自由的生成和编辑。',
  },
  {
    question: 'FusionAI 支持哪些 AI 模型？',
    answer: 'FusionAI官网聚合 70+ 国内外主流图像、视频和多模态模型，重点支持 GPT Image 2、Nano Banana 2、Seedance 2.0、可灵 Kling、Google Veo、Vidu、Happyhorse 与 Gemini Image 等系列。',
  },
  {
    question: '生成内容可以商用吗？',
    answer: '正式付费套餐提供可下载的商用授权文件，具体授权范围、期限和条件以平台服务条款及授权文件为准。',
  },
]
</script>

<template>
  <div class="marketing-home">
    <RouterLink
      to="/inspiration"
      class="top-promotion"
      aria-label="低至0.1元，解锁GPT-Image-2的顶级画质，前往灵感广场"
    >
      <span>低至 <strong>0.1元</strong>，解锁 GPT-Image-2 的顶级画质。</span>
      <b>立即体验 <span aria-hidden="true">→</span></b>
    </RouterLink>
    <MarketingHeader />

    <main>
      <section class="hero" aria-labelledby="home-title">
        <img
          class="hero-background"
          src="/home/hero-commerce.webp"
          alt="FusionAI 生成的模特、护肤商品、活动海报与户外商品视觉"
          width="1920"
          height="920"
          fetchpriority="high"
        />
        <div class="hero-shade" aria-hidden="true"></div>
        <div class="hero-content">
          <span class="hero-kicker">FUSIONAI 官网 · AI VISUAL WORKSPACE</span>
          <h1 id="home-title">全球顶级模型，<br />一站式完成商业创作</h1>
          <p>
            FusionAI 聚合 GPT Image 2、Nano Banana 2、Seedance 2.0、可灵、Google Veo、Vidu、
            Happyhorse 等 70+ 图像与视频模型，让创意、电商内容和广告成片在一个工作台完成。
          </p>
          <div class="hero-actions">
            <RouterLink to="/image" class="button button-primary">进入工作台 <span aria-hidden="true">→</span></RouterLink>
            <a href="#model-center" class="button button-quiet">浏览重点模型</a>
          </div>
          <div class="hero-facts" aria-label="平台能力">
            <span><strong>70+</strong> 全球主流模型</span>
            <span><strong>满血版</strong> 不限速不排队</span>
            <span><strong>4K</strong> 最高输出分辨率</span>
          </div>
        </div>
        <div class="hero-caption" aria-hidden="true">
          <span>模特与服饰</span>
          <span>商品场景图</span>
          <span>营销海报</span>
          <span>户外产品视觉</span>
        </div>
      </section>

      <section id="model-center" class="content-section model-section" aria-labelledby="model-title">
        <div class="section-heading split-heading">
          <div>
            <span>70+ GLOBAL MODELS</span>
            <h2 id="model-title">一个工作台，调用全球领先的图像与视频模型</h2>
          </div>
          <div>
            <p>按任务选择适合的模型，而不必在多个平台之间切换。统一中文交互、素材输入、参数设置、生成队列与积分结算。</p>
            <RouterLink to="/image" class="text-link">查看全部可用模型 <span aria-hidden="true">→</span></RouterLink>
          </div>
        </div>

        <div class="model-grid">
          <RouterLink
            v-for="(model, index) in modelHighlights"
            :key="model.name"
            :to="model.href"
            class="model-card"
            :class="[`accent-${model.accent}`, { primary: index < 2 }]"
          >
            <div class="model-card-top">
              <span>{{ model.vendor }}</span>
              <em>{{ model.type }}</em>
            </div>
            <div>
              <h3>{{ model.name }}</h3>
              <p>{{ model.description }}</p>
            </div>
            <strong>使用该模型 <span aria-hidden="true">→</span></strong>
          </RouterLink>
        </div>

        <div class="model-ribbon" aria-label="更多已接入模型">
          <span>Grok Image</span>
          <span>Seedream</span>
          <span>Kling Omni</span>
          <span>Gemini Omni</span>
          <span>OpenAI Image</span>
          <span>Seedance Fast</span>
          <strong>更多模型持续接入</strong>
        </div>
      </section>

      <section id="capabilities" class="platform-section" aria-labelledby="platform-title">
        <div class="platform-intro">
          <span>ONE PLATFORM, COMPLETE WORKFLOW</span>
          <h2 id="platform-title">从创作到交付，四个业务模块彼此协同</h2>
          <p>FusionAI 不只是模型入口。平台把生成能力、业务素材、商品信息和品牌规范连接起来，让每次创作都可保存、可编辑、可追溯、可复用。</p>
        </div>
        <div class="platform-grid">
          <RouterLink
            v-for="feature in platformFeatures"
            :key="feature.number"
            :to="feature.href"
            class="platform-feature"
          >
            <span class="platform-number">{{ feature.number }}</span>
            <div>
              <small>{{ feature.eyebrow }}</small>
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.description }}</p>
              <strong>{{ feature.action }} <span aria-hidden="true">→</span></strong>
            </div>
          </RouterLink>
        </div>
      </section>

      <section id="commerce-tools" class="content-section tool-section" aria-labelledby="tool-title">
        <div class="section-heading split-heading">
          <div>
            <span>ECOMMERCE TOOLS</span>
            <h2 id="tool-title">为电商业务深度封装，不用每次从提示词开始</h2>
          </div>
          <div>
            <p>选择一个明确任务，上传商品或模特素材，系统自动匹配平台智能推荐模型、专业提示词和输出参数，让运营人员也能稳定完成商业内容生产。</p>
            <RouterLink to="/commerce" class="text-link">查看全部电商工具 <span aria-hidden="true">→</span></RouterLink>
          </div>
        </div>

        <div class="tool-grid">
          <RouterLink
            v-for="tool in commerceTools"
            :key="tool.id"
            :to="{ path: '/commerce', query: { tool: tool.id, source: 'homepage' } }"
            class="tool-card"
            :class="{ featured: tool.featured }"
          >
            <div class="tool-media">
              <img :src="tool.image" :alt="`${tool.title}效果参考`" width="720" height="480" loading="lazy" />
              <span>{{ tool.tag }}</span>
            </div>
            <div class="tool-copy">
              <h3>{{ tool.title }}</h3>
              <p>{{ tool.description }}</p>
              <strong>立即使用 <span aria-hidden="true">→</span></strong>
            </div>
          </RouterLink>
        </div>
      </section>

      <section class="showcase-section" aria-labelledby="showcase-title">
        <div class="showcase-copy">
          <span>ONE PRODUCT, MANY OUTCOMES</span>
          <h2 id="showcase-title">同一套商品资产，持续生成不同渠道内容</h2>
          <p>不再把每次生成当作一次性的图片。商品档案、品牌规范和参考素材会成为后续图像、视频、广告与电商任务的共同上下文。</p>
          <ul>
            <li>商品信息和品牌规范持续约束生成结果</li>
            <li>从首图、详情页到短视频保持视觉一致</li>
            <li>结果进入资产库，可继续编辑、下载和复用</li>
          </ul>
          <RouterLink to="/products" class="button button-light">管理商品资产 <span aria-hidden="true">→</span></RouterLink>
        </div>
        <div class="showcase-gallery">
          <figure>
            <img src="/home/case-product.webp" alt="智能手表商品场景图" width="720" height="480" loading="lazy" />
            <figcaption><strong>商品场景图</strong><span>突出材质与卖点</span></figcaption>
          </figure>
          <figure>
            <img src="/home/case-fashion.webp" alt="服装模特展示图" width="720" height="480" loading="lazy" />
            <figcaption><strong>模特展示图</strong><span>保持服装细节</span></figcaption>
          </figure>
          <figure>
            <img src="/home/case-outdoor.webp" alt="户外商品营销视觉" width="720" height="480" loading="lazy" />
            <figcaption><strong>渠道营销图</strong><span>适配不同场景</span></figcaption>
          </figure>
        </div>
      </section>

      <section id="faq" class="content-section faq-section" aria-labelledby="faq-title">
        <div class="section-heading align-left">
          <span>FREQUENTLY ASKED QUESTIONS</span>
          <h2 id="faq-title">关于 FusionAI 的常见问题</h2>
        </div>
        <div class="faq-list">
          <details v-for="(faq, index) in faqs" :key="faq.question" :open="index === 0">
            <summary>{{ faq.question }}<span aria-hidden="true">＋</span></summary>
            <p>{{ faq.answer }}</p>
          </details>
        </div>
      </section>

      <section class="final-cta" aria-labelledby="cta-title">
        <div>
          <span>FUSIONAI · 融艺 AI</span>
          <h2 id="cta-title">从一张商品图开始，建立你的内容生产线</h2>
          <p>注册即送免费体验积分，先完成第一张商品图，再按创作频率和团队规模选择方案。</p>
        </div>
        <div class="final-actions">
          <RouterLink to="/image" class="button button-primary">进入工作台 <span aria-hidden="true">→</span></RouterLink>
          <RouterLink to="/billing" class="button button-dark-quiet">查看套餐价格</RouterLink>
        </div>
      </section>
    </main>

    <MarketingFooter />
  </div>
</template>

<style scoped>
.marketing-home {
  min-height: 100vh;
  background: #fff;
  color: #151822;
  font-family: Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

.marketing-home * { box-sizing: border-box; }
a { color: inherit; }

.top-promotion {
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 8px 20px;
  background: #242531;
  color: #f4f5f8;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  text-align: center;
  text-decoration: none;
  transition: background .18s ease;
}

.top-promotion strong {
  color: #ffd36a;
  font-size: 14px;
}

.top-promotion b {
  color: #b9b4ff;
  font-size: 11px;
  white-space: nowrap;
}

.top-promotion:hover { background: #181a22; }

.hero {
  position: relative;
  height: calc(100svh - 108px);
  min-height: 560px;
  max-height: 680px;
  overflow: hidden;
  background: #171923;
}

.hero-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-shade {
  position: absolute;
  inset: 0 auto 0 0;
  width: 57%;
  background: rgba(16, 18, 27, .84);
}

.hero-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: min(620px, 49%);
  height: 100%;
  margin-left: max(28px, calc((100vw - 1180px) / 2));
  padding: 38px 0 72px;
  color: #fff;
}

.hero-kicker,
.section-heading > span,
.section-heading > div > span,
.showcase-copy > span,
.final-cta > div > span {
  color: #9188ff;
  font-size: 12px;
  font-weight: 850;
  letter-spacing: 0;
  text-transform: uppercase;
}

.hero h1 {
  max-width: 610px;
  margin: 18px 0 22px;
  font-size: 58px;
  line-height: 1.08;
  letter-spacing: 0;
}

.hero-content > p {
  max-width: 570px;
  margin: 0;
  color: #d5d7e0;
  font-size: 17px;
  line-height: 1.85;
}

.hero-actions,
.final-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 30px;
}

.button {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 0 20px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 800;
  text-decoration: none;
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
}

.button:hover { transform: translateY(-2px); }
.button-primary { background: #6358f5; color: #fff; box-shadow: 0 12px 30px rgba(69, 57, 222, .28); }
.button-primary:hover { background: #5045df; }
.button-quiet { border-color: rgba(255, 255, 255, .3); background: rgba(18, 20, 28, .58); color: #fff; }
.button-light { background: #fff; color: #171923; }
.button-dark-quiet { border-color: #3f4150; background: #242631; color: #fff; }

.hero-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
  margin-top: 32px;
  color: #afb2c0;
  font-size: 12px;
}

.hero-facts span { display: inline-flex; align-items: baseline; gap: 6px; }
.hero-facts strong { color: #fff; font-size: 18px; }

.hero-caption {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  width: 43%;
  min-height: 48px;
  background: rgba(255, 255, 255, .9);
  color: #333641;
  backdrop-filter: blur(12px);
}

.hero-caption span {
  display: grid;
  place-items: center;
  padding: 8px;
  border-left: 1px solid rgba(23, 26, 36, .1);
  font-size: 10px;
  font-weight: 750;
  text-align: center;
}

.proof-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  max-width: 1180px;
  margin: 0 auto;
  border-bottom: 1px solid #e6e8ee;
}

.proof-strip div { min-height: 112px; padding: 28px 26px; border-right: 1px solid #e6e8ee; }
.proof-strip div:first-child { border-left: 1px solid #e6e8ee; }
.proof-strip strong { display: block; margin-bottom: 8px; color: #171923; font-size: 14px; }
.proof-strip span { color: #737887; font-size: 11px; line-height: 1.6; }

.content-section {
  width: min(1180px, calc(100% - 56px));
  margin: 0 auto;
  padding: 104px 0;
}

.section-heading {
  max-width: 760px;
  margin: 0 auto 44px;
  text-align: center;
}

.section-heading.align-left { margin-left: 0; text-align: left; }
.section-heading h2,
.showcase-copy h2,
.final-cta h2 {
  margin: 12px 0 16px;
  font-size: 38px;
  line-height: 1.24;
  letter-spacing: 0;
}

.section-heading p,
.showcase-copy > p,
.final-cta p {
  margin: 0;
  color: #6a7080;
  font-size: 15px;
  line-height: 1.8;
}

.split-heading {
  max-width: none;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(300px, .75fr);
  gap: 72px;
  align-items: end;
  margin-bottom: 42px;
  text-align: left;
}

.split-heading h2 { margin-bottom: 0; }
.split-heading > div:last-child { display: grid; gap: 14px; }
.text-link { color: #5045df; font-size: 13px; font-weight: 850; text-decoration: none; }

.model-section { padding-top: 92px; padding-bottom: 112px; }
.model-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid #dfe2e9;
  border-left: 1px solid #dfe2e9;
}

.model-card {
  position: relative;
  min-height: 236px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 28px;
  padding: 24px;
  border-right: 1px solid #dfe2e9;
  border-bottom: 1px solid #dfe2e9;
  background: #fff;
  color: #1d2029;
  text-decoration: none;
  transition: background .18s ease, transform .18s ease, box-shadow .18s ease;
}

.model-card::before {
  content: "";
  position: absolute;
  top: -1px;
  right: -1px;
  left: -1px;
  height: 3px;
  background: #8b82f6;
}

.model-card:hover {
  z-index: 1;
  transform: translateY(-3px);
  background: #fafbfc;
  box-shadow: 0 20px 42px rgba(25, 29, 43, .1);
}

.model-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.model-card-top span { color: #777d8b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
.model-card-top em {
  padding: 4px 7px;
  border: 1px solid #e0e3e9;
  border-radius: 4px;
  color: #656b78;
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
}
.model-card h3 { margin: 0 0 10px; font-size: 20px; line-height: 1.25; }
.model-card p { margin: 0; color: #717684; font-size: 11px; line-height: 1.7; }
.model-card > strong { color: #4940cf; font-size: 10px; }
.model-card.accent-blue::before { background: #3d83ef; }
.model-card.accent-coral::before { background: #e77564; }
.model-card.accent-dark::before { background: #292c35; }
.model-card.accent-green::before { background: #3a9a79; }
.model-card.accent-amber::before { background: #d49a39; }

.flagship-section { padding-bottom: 120px; }
.flagship-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.flagship-card {
  position: relative;
  min-height: 360px;
  overflow: hidden;
  border-radius: 6px;
  background: #171923;
  color: #fff;
  text-decoration: none;
  isolation: isolate;
}

.flagship-card::after {
  content: "";
  position: absolute;
  z-index: 0;
  inset: 0;
  background: rgba(12, 14, 22, .56);
  transition: background .25s ease;
}

.flagship-card img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform .45s ease;
}

.flagship-card:hover::after { background: rgba(12, 14, 22, .48); }
.flagship-card:hover img { transform: scale(1.025); }
.flagship-overlay {
  position: relative;
  z-index: 1;
  min-height: 360px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 30px;
}

.flagship-overlay > span {
  align-self: flex-start;
  margin-bottom: 14px;
  padding: 6px 9px;
  border: 1px solid rgba(255, 255, 255, .38);
  border-radius: 4px;
  background: rgba(15, 17, 25, .5);
  color: #e5e6eb;
  font-size: 10px;
  font-weight: 800;
}

.flagship-overlay h3 { margin: 0 0 10px; font-size: 28px; line-height: 1.2; }
.flagship-overlay p {
  max-width: 480px;
  margin: 0;
  color: #e2e4e9;
  font-size: 13px;
  line-height: 1.65;
}

.flagship-overlay ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}

.flagship-overlay li {
  padding: 7px 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, .9);
  color: #20232d;
  font-size: 10px;
  font-weight: 750;
}

.model-ribbon {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 16px;
  padding: 18px;
  border: 1px solid #dfe2e9;
  background: #f5f6f8;
}

.model-ribbon span {
  padding: 8px 10px;
  border: 1px solid #d9dce4;
  border-radius: 4px;
  background: #fff;
  color: #4e5361;
  font-size: 10px;
  font-weight: 750;
}

.model-ribbon strong {
  margin-left: auto;
  color: #5045df;
  font-size: 11px;
}

.platform-section {
  padding: 104px max(28px, calc((100vw - 1180px) / 2)) 120px;
  background: #eff2f7;
}

.platform-intro {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(300px, .95fr);
  gap: 72px;
  align-items: end;
  max-width: 1180px;
  margin: 0 auto 44px;
}

.platform-intro > span {
  grid-column: 1 / 3;
  color: #397e68;
  font-size: 11px;
  font-weight: 850;
}

.platform-intro h2 {
  margin: 0;
  font-size: 38px;
  line-height: 1.24;
}

.platform-intro p {
  margin: 0;
  color: #69707f;
  font-size: 14px;
  line-height: 1.8;
}

.platform-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: 1180px;
  margin: 0 auto;
  border-top: 1px solid #d1d5df;
  border-left: 1px solid #d1d5df;
}

.platform-feature {
  min-height: 224px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 16px;
  padding: 28px 24px;
  border-right: 1px solid #d1d5df;
  border-bottom: 1px solid #d1d5df;
  background: #fff;
  text-decoration: none;
  transition: background .18s ease, color .18s ease;
}

.platform-feature:hover { background: #21232e; color: #fff; }
.platform-number { color: #5045df; font-size: 11px; font-weight: 850; }
.platform-feature small {
  display: block;
  margin-bottom: 16px;
  color: #777d8b;
  font-size: 9px;
  font-weight: 850;
}

.platform-feature h3 { margin: 0 0 10px; font-size: 19px; }
.platform-feature p {
  margin: 0;
  color: #707684;
  font-size: 11px;
  line-height: 1.75;
}

.platform-feature strong {
  display: block;
  margin-top: 28px;
  color: #5045df;
  font-size: 11px;
}

.platform-feature:hover small,
.platform-feature:hover p { color: #c1c5d0; }
.platform-feature:hover strong { color: #8f87ff; }

.tool-section { padding-bottom: 120px; }
.tool-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.tool-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e1e4eb;
  border-radius: 6px;
  background: #fff;
  text-decoration: none;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}

.tool-card:hover {
  transform: translateY(-4px);
  border-color: #aea8ff;
  box-shadow: 0 18px 42px rgba(24, 28, 43, .11);
}

.tool-card.featured { grid-column: auto; }
.tool-media { position: relative; aspect-ratio: 3 / 2; overflow: hidden; background: #eef0f4; }
.tool-media img { width: 100%; height: 100%; object-fit: cover; transition: transform .35s ease; }
.tool-card:hover .tool-media img { transform: scale(1.025); }
.tool-media > span {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 6px 9px;
  border-radius: 4px;
  background: rgba(255, 255, 255, .9);
  color: #20232d;
  font-size: 10px;
  font-weight: 850;
  backdrop-filter: blur(8px);
}

.tool-copy { min-height: 158px; display: flex; flex-direction: column; padding: 20px; }
.tool-copy h3 { margin: 0 0 8px; font-size: 18px; }
.tool-copy p { margin: 0; color: #747988; font-size: 12px; line-height: 1.7; }
.tool-copy strong { margin-top: auto; padding-top: 18px; color: #5045df; font-size: 11px; }

.showcase-section {
  display: grid;
  grid-template-columns: minmax(320px, .7fr) minmax(0, 1.3fr);
  gap: 70px;
  align-items: center;
  padding: 96px max(28px, calc((100vw - 1180px) / 2));
  background: #171923;
  color: #fff;
}

.showcase-copy > p { color: #b7bbc7; }
.showcase-copy ul { display: grid; gap: 12px; margin: 28px 0 0; padding: 0; list-style: none; }
.showcase-copy li { position: relative; padding-left: 20px; color: #d6d8df; font-size: 12px; line-height: 1.6; }
.showcase-copy li::before { content: ""; position: absolute; left: 0; top: 7px; width: 7px; height: 7px; background: #54c89d; }

.showcase-gallery {
  display: grid;
  grid-template-columns: 1.15fr .85fr;
  grid-template-rows: repeat(2, 210px);
  gap: 12px;
}

.showcase-gallery figure { position: relative; overflow: hidden; margin: 0; border: 1px solid rgba(255, 255, 255, .12); }
.showcase-gallery figure:first-child { grid-row: 1 / 3; }
.showcase-gallery img { width: 100%; height: 100%; object-fit: cover; }
.showcase-gallery figcaption {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(15, 17, 25, .78);
  color: #fff;
  backdrop-filter: blur(10px);
}
.showcase-gallery figcaption strong { font-size: 11px; }
.showcase-gallery figcaption span { color: #bec1cc; font-size: 9px; }

.workflow-section {
  padding: 96px max(28px, calc((100vw - 1180px) / 2));
  background: #eff2f7;
}

.workflow-section .light > span { color: #397e68; }
.workflow-list { display: grid; grid-template-columns: repeat(4, 1fr); margin: 44px 0 0; padding: 0; list-style: none; border-top: 1px solid #cdd2dc; }
.workflow-list li { min-height: 176px; display: grid; grid-template-columns: 34px 1fr; gap: 14px; padding: 24px 22px; border-right: 1px solid #cdd2dc; }
.workflow-list li:first-child { border-left: 1px solid #cdd2dc; }
.workflow-list > li > span { color: #5045df; font-size: 11px; font-weight: 850; }
.workflow-list h3 { margin: 0 0 10px; font-size: 16px; }
.workflow-list p { margin: 0; color: #6e7380; font-size: 11px; line-height: 1.7; }

.faq-section { display: grid; grid-template-columns: minmax(260px, .7fr) minmax(0, 1.3fr); gap: 80px; }
.faq-list { border-top: 1px solid #dfe2e9; }
.faq-list details { border-bottom: 1px solid #dfe2e9; }
.faq-list summary { min-height: 66px; display: flex; align-items: center; justify-content: space-between; gap: 16px; cursor: pointer; font-size: 14px; font-weight: 750; list-style: none; }
.faq-list summary::-webkit-details-marker { display: none; }
.faq-list summary span { color: #6860dc; font-size: 18px; }
.faq-list details[open] summary span { transform: rotate(45deg); }
.faq-list details p { margin: -2px 0 22px; padding-right: 40px; color: #737887; font-size: 12px; line-height: 1.8; }

.final-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 50px;
  padding: 76px max(28px, calc((100vw - 1180px) / 2));
  background: #21232e;
  color: #fff;
}
.final-cta > div:first-child { max-width: 720px; }
.final-cta p { color: #b9bdc8; }
.final-actions { flex: 0 0 auto; margin-top: 0; }

@media (max-width: 1080px) {
  .hero-shade { width: 68%; }
  .hero-content { width: 59%; }
  .hero h1 { font-size: 48px; }
  .hero-caption { width: 36%; grid-template-columns: repeat(2, 1fr); }
  .tool-grid { grid-template-columns: repeat(3, 1fr); }
  .tool-card.featured { grid-column: span 2; }
  .showcase-section { grid-template-columns: 1fr; }
  .showcase-copy { max-width: 680px; }
  .platform-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 820px) {
  .hero { min-height: 590px; max-height: 650px; }
  .hero-shade { width: 100%; background: rgba(16, 18, 27, .76); }
  .hero-background { object-position: 64% center; }
  .hero-content { width: calc(100% - 48px); margin: 0 24px; padding-bottom: 56px; }
  .hero h1 { max-width: 560px; font-size: 42px; }
  .hero-content > p { max-width: 540px; font-size: 15px; }
  .hero-caption { display: none; }
  .proof-strip { grid-template-columns: repeat(2, 1fr); padding: 0 20px; }
  .proof-strip div:nth-child(3) { border-left: 1px solid #e6e8ee; }
  .split-heading { grid-template-columns: 1fr; gap: 18px; }
  .flagship-grid { grid-template-columns: 1fr; }
  .model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .flagship-card,
  .flagship-overlay { min-height: 330px; }
  .platform-intro { grid-template-columns: 1fr; gap: 18px; }
  .platform-intro > span { grid-column: auto; }
  .tool-grid { grid-template-columns: repeat(2, 1fr); }
  .workflow-list { grid-template-columns: repeat(2, 1fr); }
  .faq-section { grid-template-columns: 1fr; gap: 18px; }
  .final-cta { align-items: flex-start; flex-direction: column; }
}

@media (max-width: 560px) {
  .top-promotion {
    min-height: 42px;
    justify-content: space-between;
    gap: 10px;
    padding: 7px 14px;
    font-size: 10px;
    text-align: left;
  }

  .top-promotion strong { font-size: 12px; }
  .top-promotion b { font-size: 10px; }

  .hero { height: calc(100svh - 72px); min-height: 560px; max-height: 620px; }
  .hero-background { object-position: 76% center; }
  .hero-shade { background: rgba(14, 16, 24, .8); }
  .hero-content { width: calc(100% - 40px); margin: 0 20px; padding: 34px 0 28px; }
  .hero-kicker { font-size: 10px; }
  .hero h1 { margin: 15px 0 18px; font-size: 34px; line-height: 1.12; }
  .hero-content > p { font-size: 13px; line-height: 1.7; }
  .hero-actions { margin-top: 22px; }
  .button { min-height: 44px; padding: 0 16px; font-size: 12px; }
  .hero-facts { gap: 10px 16px; margin-top: 22px; }
  .hero-facts strong { font-size: 16px; }
  .proof-strip { grid-template-columns: 1fr 1fr; padding: 0 14px; }
  .proof-strip div { min-height: 100px; padding: 20px 14px; }
  .proof-strip strong { font-size: 12px; }
  .proof-strip span { font-size: 10px; }
  .content-section { width: calc(100% - 40px); padding: 74px 0; }
  .section-heading h2,
  .showcase-copy h2,
  .final-cta h2 { font-size: 28px; }
  .section-heading p,
  .showcase-copy > p,
  .final-cta p { font-size: 13px; }
  .flagship-section { padding-bottom: 84px; }
  .model-section { padding-top: 72px; padding-bottom: 82px; }
  .model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .model-card { min-height: 205px; gap: 16px; padding: 16px 14px; }
  .model-card-top { align-items: flex-start; flex-direction: column; gap: 7px; }
  .model-card h3 { font-size: 16px; }
  .model-card p {
    display: -webkit-box;
    overflow: hidden;
    font-size: 10px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
  }
  .model-card > strong { display: none; }
  .flagship-card,
  .flagship-overlay { min-height: 360px; }
  .flagship-overlay { padding: 24px 20px; }
  .flagship-overlay h3 { font-size: 24px; }
  .model-ribbon { align-items: flex-start; }
  .model-ribbon strong { width: 100%; margin: 8px 0 0; }
  .platform-section { padding: 74px 20px 84px; }
  .platform-intro h2 { font-size: 28px; }
  .platform-intro p { font-size: 13px; }
  .platform-grid { grid-template-columns: 1fr; }
  .platform-feature { min-height: 210px; }
  .tool-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .tool-card.featured { grid-column: auto; }
  .tool-media { aspect-ratio: 4 / 3; }
  .tool-media > span { top: 8px; left: 8px; padding: 4px 6px; font-size: 8px; }
  .tool-copy { min-height: 134px; padding: 14px 12px; }
  .tool-copy h3 { font-size: 14px; }
  .tool-copy p {
    display: -webkit-box;
    overflow: hidden;
    font-size: 10px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .tool-copy strong { padding-top: 12px; font-size: 10px; }
  .showcase-section { gap: 38px; padding: 72px 20px; }
  .showcase-gallery { grid-template-columns: 1fr 1fr; grid-template-rows: 240px 150px; }
  .showcase-gallery figure:first-child { grid-column: 1 / 3; grid-row: auto; }
  .showcase-gallery figcaption { display: block; }
  .showcase-gallery figcaption span { display: none; }
  .workflow-section { padding: 72px 20px; }
  .workflow-list { grid-template-columns: 1fr; }
  .workflow-list li { min-height: 126px; border-left: 1px solid #cdd2dc; border-bottom: 1px solid #cdd2dc; }
  .final-cta { padding: 66px 20px; }
  .final-actions { width: 100%; }
  .final-actions .button { flex: 1 1 160px; }
}
</style>
