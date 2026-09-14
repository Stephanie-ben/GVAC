const GA_MEASUREMENT_ID = 'G-EDDKK2RC5G'
const PAGE_TITLE = 'GVAC Dues Management'

let started = false

export function memberAnalyticsPath(pathname) {
  const pathOnly = String(pathname || '/').split('?')[0].split('#')[0] || '/'
  if (pathOnly.startsWith('/admin')) return null
  if (pathOnly.startsWith('/members/') || pathOnly === '/members') return '/members'
  return pathOnly
}

function loadGtag() {
  if (typeof window === 'undefined' || window.gtag) return

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
    anonymize_ip: true,
  })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)
}

export function trackMemberPageView(pathname = window.location.pathname) {
  const pagePath = memberAnalyticsPath(pathname)
  if (!pagePath || typeof window === 'undefined' || typeof window.gtag !== 'function') return

  window.gtag('event', 'page_view', {
    page_title: PAGE_TITLE,
    page_path: pagePath,
    page_location: `${window.location.origin}${pagePath}`,
  })
}

export function memberAnalyticsEvent(eventName, pathname) {
  if (memberAnalyticsPath(pathname) === null) return null
  return ['event', eventName]
}

function trackMemberEvent(eventName, pathname) {
  const path =
    pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '')
  const payload = memberAnalyticsEvent(eventName, path)
  if (!payload || typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return
  }

  window.gtag(...payload)
}

export function trackMemberSearch(pathname) {
  trackMemberEvent('member_search', pathname)
}

export function trackRecordView(pathname) {
  trackMemberEvent('record_view', pathname)
}

export function initMemberAnalytics() {
  if (started || typeof window === 'undefined') return
  if (memberAnalyticsPath(window.location.pathname) === null) return

  started = true
  loadGtag()
  trackMemberPageView(window.location.pathname)

  window.addEventListener('popstate', () => {
    trackMemberPageView(window.location.pathname)
  })

  const pushState = window.history.pushState.bind(window.history)
  window.history.pushState = (...args) => {
    const result = pushState(...args)
    trackMemberPageView(window.location.pathname)
    return result
  }
}
