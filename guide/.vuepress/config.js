import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'
import fs from 'fs'
import path from 'path'

function generateSidebar() {
  const guidePath = path.resolve(process.cwd(), 'guide')
  if (!fs.existsSync(guidePath)) return []
  
  const dirs = fs.readdirSync(guidePath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
    .map(dirent => dirent.name)

  const formatTitle = (str) => {
    if (str.toLowerCase() === 'api-reference') return 'API Reference'
    return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const sidebar = []
  
  // Ordered based on the previous configuration
  const customOrder = ['setup-and-deployment', 'architecture', 'redaction-processing', 'frontend', 'api-reference']
  
  dirs.sort((a, b) => {
    const indexA = customOrder.indexOf(a)
    const indexB = customOrder.indexOf(b)
    if (indexA === -1 && indexB === -1) return a.localeCompare(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })

  for (const dir of dirs) {
    const dirPath = path.join(guidePath, dir)
    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.md'))
      .map(file => `/${dir}/${file}`)
      
    if (files.length > 0) {
      sidebar.push({
        text: formatTitle(dir),
        children: files
      })
    }
  }
  
  return sidebar
}

export default defineUserConfig({
  base: '/EpsteinTool/',
  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap', rel: 'stylesheet' }]
  ],
  bundler: viteBundler(),
  theme: defaultTheme({
    colorModeSwitch: true,
    colorMode: 'auto',
    logo: null,
    repo: 'JaguarM/EpsteinTool',
    docsDir: 'guide',
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Architecture', link: '/architecture/architecture-overview.html' },
      { text: 'API', link: '/api-reference/api-reference.html' },
    ],
    sidebar: generateSidebar(),
  }),
  title: 'Epstein Unredactor',
  description: 'Technical Documentation for the Epstein PDF Analysis Tool',
})
