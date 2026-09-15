;(function (OpenListPlugin, plugin, config, privilege) {
  "use strict"

  const LAYER_CLASS = "oplist-bg-glass-layer"
  const GLASS_ATTR = "data-oplist-glass"
  const GLASS_BG_ATTR = "data-oplist-glass-bg" // 渐变背景卡片的清图标记

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

  /* ============ 一、自定义背景 ============ */
  function applyBackground() {
    if (!config.enable_background) return

    // 清除系统页面默认背景，避免遮挡插件背景层
    OpenListPlugin.injectCSS(
      "oplist-bg-glass-reset",
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

    // 独立背景层承载背景（z-index: -1，位于页面内容之下）
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

  /* ============ 二、界面毛玻璃（导航栏 + 卡片） ============ */
  let glassObserver = null

  // 这些元素不参与卡片标记，避免影响交互与弹层
  const GLASS_IGNORED = [
    "html",
    "body",
    "." + LAYER_CLASS,
    ".hope-ui-light", // 主题根容器自身不成卡片
    ".hope-ui-dark",
    ".header",
    ".nav",
    ".hope-tooltip",
    ".hope-tooltip *",
    ".hope-modal__overlay",
    ".hope-drawer__overlay",
    ".hope-select__option",
    ".monaco-editor",
    ".monaco-editor *",
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "img",
    "video",
    "audio",
    "canvas",
    "svg",
    "iframe",
  ]

  function shouldIgnore(el) {
    return (
      el.matches(GLASS_IGNORED.join(",")) ||
      el.closest(
        "." +
          LAYER_CLASS +
          ", .hope-tooltip, .hope-modal__overlay, .hope-drawer__overlay, .monaco-editor",
      )
    )
  }

  /* 判断是否为“有表面背景”的元素（即卡片/面板）：
     1) 有非透明背景色；2) 卡片形态（有内边距或圆角）且带渐变/图片背景 */
  function isSurface(el, cs) {
    const bgColor = cs.backgroundColor
    const hasColor =
      bgColor && bgColor !== "transparent" && bgColor !== "rgba(0, 0, 0, 0)"
    if (hasColor) return { glass: true, clearBgImage: false }

    const bgImage = cs.backgroundImage
    const looksCard = cs.paddingTop !== "0px" || cs.borderRadius !== "0px"
    if (bgImage && bgImage !== "none" && looksCard)
      return { glass: true, clearBgImage: true }
    return null
  }

  /* 找出页面中所有卡片/面板元素，标记为毛玻璃 */
  function markCards() {
    document.querySelectorAll(".hope-ui-light, .hope-ui-dark").forEach((themeRoot) => {
      themeRoot.querySelectorAll("*").forEach((el) => {
        if (shouldIgnore(el)) {
          el.removeAttribute(GLASS_ATTR)
          el.removeAttribute(GLASS_BG_ATTR)
          return
        }
        const surface = isSurface(el, getComputedStyle(el))
        if (surface) {
          el.setAttribute(GLASS_ATTR, "true")
          if (surface.clearBgImage) el.setAttribute(GLASS_BG_ATTR, "true")
        }
      })
    })
  }

  /* 用户额外指定的选择器（兜底自动识别遗漏的元素） */
  function customSelectorCss() {
    const sels = String(config.custom_selectors || "")
      .split(",")
      .map(function (s) {
        return s.trim()
      })
      .filter(Boolean)
    if (!sels.length) return ""
    const join = sels.join(", ")
    return (
      join +
      " { background-color: var(--oplist-card-bg-light) !important; backdrop-filter: blur(var(--oplist-card-blur)) !important; -webkit-backdrop-filter: blur(var(--oplist-card-blur)) !important; }" +
      "@media (prefers-color-scheme: dark) { " +
      join +
      " { background-color: var(--oplist-card-bg-dark) !important; } }"
    )
  }

  function buildGlassCss(navAlpha, navBlur, cardAlpha, cardBlur) {
    // 深浅色分别使用对应底色，通过 CSS 变量自动切换
    return (
      `
      .hope-ui-light, .hope-ui-dark { background-color: transparent !important; }
      .header, .nav {
        background-color: var(--oplist-nav-bg-light) !important;
        backdrop-filter: blur(var(--oplist-nav-blur)) !important;
        -webkit-backdrop-filter: blur(var(--oplist-nav-blur)) !important;
      }
      [${GLASS_ATTR}="true"] {
        background-color: var(--oplist-card-bg-light) !important;
        backdrop-filter: blur(var(--oplist-card-blur)) !important;
        -webkit-backdrop-filter: blur(var(--oplist-card-blur)) !important;
      }
      /* 渐变背景的卡片清除图片层，使透明度真正生效 */
      [${GLASS_BG_ATTR}="true"] { background-image: none !important; }
      @media (prefers-color-scheme: dark) {
        .header, .nav {
          background-color: var(--oplist-nav-bg-dark) !important;
        }
        [${GLASS_ATTR}="true"] {
          background-color: var(--oplist-card-bg-dark) !important;
        }
      }
      :root {
        --oplist-nav-bg-light: rgba(255, 255, 255, ${navAlpha});
        --oplist-nav-bg-dark: rgba(21, 23, 24, ${navAlpha});
        --oplist-nav-blur: ${navBlur}px;
        --oplist-card-bg-light: rgba(255, 255, 255, ${cardAlpha});
        --oplist-card-bg-dark: rgba(21, 23, 24, ${cardAlpha});
        --oplist-card-blur: ${cardBlur}px;
      }
      ` + customSelectorCss()
    ).trim()
  }

  function initGlass() {
    if (!config.enable_panel) return
    // 后台管理页与登录页保持原生样式
    if (location.pathname.startsWith("/@manage") || location.pathname.startsWith("/@login"))
      return

    const navAlpha = clamp(config.nav_opacity, 0, 100) / 100
    const navBlur = Math.max(0, Number(config.nav_blur) || 0)
    const cardAlpha = clamp(config.card_opacity, 0, 100) / 100
    const cardBlur = Math.max(0, Number(config.card_blur) || 0)

    OpenListPlugin.injectCSS(
      "oplist-bg-glass-theme",
      buildGlassCss(navAlpha, navBlur, cardAlpha, cardBlur),
    )

    // 先挂观察器再执行首次标记，避免首屏卡片漏标
    glassObserver = new MutationObserver(() => window.requestAnimationFrame(markCards))
    glassObserver.observe(document.body, { childList: true, subtree: true })
    // 首次渲染可能晚于插件加载，延迟一轮后再标记一次
    window.setTimeout(markCards, 0)
    window.setTimeout(markCards, 500)
  }

  /* ============ 启动插件 ============ */
  try {
    applyBackground()
    initGlass()
    console.log("[" + plugin.name + "] 初始化完成，版本: " + plugin.version)
  } catch (err) {
    console.error("[" + plugin.name + "] 初始化异常:", err)
  }
})(OpenListPlugin, plugin, config, privilege)