import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/main.css'
import { applyRouteSeo } from './seo'

router.afterEach(to => applyRouteSeo(to))

createApp(App).use(createPinia()).use(router).mount('#app')
