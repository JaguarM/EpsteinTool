export const themeData = JSON.parse("{\"logo\":null,\"repo\":\"JaguarM/EpsteinTool\",\"docsDir\":\"guide\",\"navbar\":[{\"text\":\"Home\",\"link\":\"/\"},{\"text\":\"Architecture\",\"link\":\"/architecture/architecture-overview.html\"},{\"text\":\"API\",\"link\":\"/api-reference/api-reference.html\"}],\"sidebar\":[{\"text\":\"Getting Started\",\"children\":[\"/setup-and-deployment/setup-deployment.md\",\"/setup-and-deployment/local-development.md\",\"/setup-and-deployment/production-deployment.md\",\"/setup-and-deployment/TROUBLESHOOTING.md\"]},{\"text\":\"Architecture\",\"children\":[\"/architecture/architecture-overview.md\"]},{\"text\":\"Redaction Processing\",\"children\":[\"/redaction-processing/backend-logic.md\",\"/redaction-processing/process_redactions_docs.md\",\"/redaction-processing/boxdetector.md\",\"/redaction-processing/surrounding-word-width.md\",\"/redaction-processing/scale-and-size-detection.md\",\"/redaction-processing/artifact_visualizer_documentation.md\",\"/redaction-processing/width_calculator_documentation.md\",\"/redaction-processing/extract_fonts.md\"]},{\"text\":\"Frontend Implementation\",\"children\":[\"/frontend/JavaScript module-reference.md\",\"/frontend/state-management.md\",\"/frontend/pdf-viewer.md\",\"/frontend/api-and-logic.md\",\"/frontend/ui-events.md\",\"/frontend/webgl-mask.md\",\"/frontend/text-tool.md\"]},{\"text\":\"API Reference\",\"children\":[\"/api-reference/api-reference.md\"]}],\"locales\":{\"/\":{\"selectLanguageName\":\"English\"}},\"colorMode\":\"auto\",\"colorModeSwitch\":true,\"selectLanguageText\":\"Languages\",\"selectLanguageAriaLabel\":\"Select language\",\"sidebarDepth\":2,\"editLink\":true,\"editLinkText\":\"Edit this page\",\"lastUpdated\":true,\"contributors\":true,\"contributorsText\":\"Contributors\",\"notFound\":[\"There's nothing here.\",\"How did we get here?\",\"That's a Four-Oh-Four.\",\"Looks like we've got some broken links.\"],\"backToHome\":\"Take me home\",\"openInNewWindow\":\"open in new window\",\"toggleColorMode\":\"toggle color mode\",\"toggleSidebar\":\"toggle sidebar\"}")

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
  if (__VUE_HMR_RUNTIME__.updateThemeData) {
    __VUE_HMR_RUNTIME__.updateThemeData(themeData)
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(({ themeData }) => {
    __VUE_HMR_RUNTIME__.updateThemeData(themeData)
  })
}
