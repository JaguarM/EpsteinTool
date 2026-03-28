export const siteData = JSON.parse("{\"base\":\"/EpsteinTool/\",\"lang\":\"en-US\",\"title\":\"Epstein Unredactor\",\"description\":\"Technical Documentation for the Epstein PDF Analysis Tool\",\"head\":[],\"locales\":{\"/\":{\"lang\":\"en-US\",\"title\":\"Epstein Unredactor\",\"description\":\"Technical Documentation for the Epstein PDF Analysis Tool\"}}}")

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
  __VUE_HMR_RUNTIME__.updateSiteData?.(siteData)
}

if (import.meta.hot) {
  import.meta.hot.accept((m) => {
    __VUE_HMR_RUNTIME__.updateSiteData?.(m.siteData)
  })
}
