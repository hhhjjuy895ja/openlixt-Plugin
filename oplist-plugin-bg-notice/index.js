;(function (OpenListPlugin, plugin, config, privilege) {
  "use strict"

  const LAYER_CLASS = "oplist-bg-notice-layer"
  const WIDGET_ID = "oplist-notice-widget"
  const DISMISS_KEY = "oplist-plugin-notice-dismissed"

  /* 解析 "中文 (value)" 形式的下拉选项，提取括号内的机器值 */
  function parseOption(raw, fallback) {
    const m = String(raw || "").match(/\(([^)]*)\)/)
    return m ? m[1] : fallback
  }

  function clamp(n, min, max) {
    n = Number(n)
    if (Number.isNaN(n)) return min
    return Math.min(max, Math.max(min, n))
  }

  /* 转义配置文本，防止注入 HTML */
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
  }

  /* ============ 一、自定义背景 ============ */
  function applyBackground() {
    if (!config.enable_background) return

    // 清除系统页面默认背景，避免遮挡插件背景层
    OpenListPlugin.injectCSS(
      "oplist-bg-notice-reset",
      `
      html, body {
        background-color: transparent !important;
        background-image: none !important;
      }
      `,
    )

    const type = parseOption(config.bg_type, "color")
    const opacity = clamp(config.bg_opacity, 0, 100)
    const blur = Math.max(0, Number(config.bg_blur) || 0)

    let bgCss = ""
    if (type === "image" && config.bg_image_url) {
      bgCss = 'url("' + config.bg_image_url + '") center / cover no-repeat'
    } else if (type === "gradient" && config.bg_gradient) {
      bgCss = config.bg_gradient
    } else {
      bgCss = config.bg_color || "#0f172a"
    }

    // 通过独立背景层承载背景（z-index: -1，位于页面内容之下）
    const layer = document.createElement("div")
    layer.className = LAYER_CLASS
    layer.style.background = bgCss
    layer.style.opacity = opacity / 100
    if (blur > 0) {
      // 放大一点可避免模糊边缘露出底层
      layer.style.filter = "blur(" + blur + "px)"
      layer.style.transform = "scale(1.05)"
    }
    document.documentElement.appendChild(layer)

    console.log("[" + plugin.name + "] 已应用自定义背景:", type)
  }

  /* ============ 二、公告挂件 ============ */
  function initNoticeWidget() {
    if (!config.enable_notice) return

    // 用户曾手动关闭过公告，则本次会话不再展示
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1"
    } catch (e) {
      /* localStorage 不可用时忽略 */
    }
    if (dismissed) return

    const position = parseOption(config.notice_position, "top-right")
    const title = config.notice_title || "站点公告"
    const content = config.notice_content || ""

    OpenListPlugin.addFloatingWidget(WIDGET_ID, (container) => {
      container.className = "oplist-notice-container oplist-notice-" + position
      container.innerHTML =
        '<div class="oplist-notice-card">' +
        '<div class="oplist-notice-header">' +
        '<span class="oplist-notice-title">' + escapeHtml(title) + "</span>" +
        '<button type="button" class="oplist-notice-close" title="关闭公告">✕</button>' +
        "</div>" +
        '<div class="oplist-notice-body">' + escapeHtml(content) + "</div>" +
        "</div>"

      const closeBtn = container.querySelector(".oplist-notice-close")
      closeBtn.onclick = () => {
        container.remove()
        try {
          localStorage.setItem(DISMISS_KEY, "1")
        } catch (e) {
          /* ignore */
        }
        OpenListPlugin.notify.info("公告已关闭，刷新页面后重新显示")
      }
    })
  }

  /* ============ 启动插件 ============ */
  try {
    applyBackground()
    initNoticeWidget()
    console.log("[" + plugin.name + "] 初始化完成，版本: " + plugin.version)
  } catch (err) {
    console.error("[" + plugin.name + "] 初始化异常:", err)
  }
})(OpenListPlugin, plugin, config, privilege)