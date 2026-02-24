import { createApp, h } from 'vue'
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import App from './App.vue'
import './style.css'

createApp({
  render() {
    return h(NConfigProvider, null, {
      default: () => h(NMessageProvider, null, { default: () => h(App) }),
    })
  },
}).mount('#app')
