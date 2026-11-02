import { useEffect, useMemo, useState } from 'react'
import { ThemeContext, useTheme } from './ThemeState'

const THEME_STORAGE_KEY = 'lifepilot-theme'
const LEGACY_PREFERENCES_KEY = 'lifepilot-preferences'
function getInitialTheme() {
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (['light', 'dark', 'system'].includes(savedTheme)) return savedTheme
    const savedPreferences = window.localStorage.getItem(LEGACY_PREFERENCES_KEY)
    if (savedPreferences) {
      const { theme } = JSON.parse(savedPreferences)
      if (['light', 'dark', 'system'].includes(theme)) return theme
    }
  } catch (error) {
    console.error('Unable to load the saved LifePilot theme.', error)
  }
  return 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = (event) => setSystemDark(event.matches)
    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? '#20272B' : '#F3F4F2')
  }, [resolvedTheme])

  const setTheme = (nextTheme) => {
    if (!['light', 'dark', 'system'].includes(nextTheme)) return
    setThemeState(nextTheme)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    } catch (error) {
      console.error('Unable to save the LifePilot theme preference.', error)
    }
  }

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function ThemeSelect({ compact = false }) {
  const { theme, setTheme } = useTheme()
  return (
    <label className={`theme-select${compact ? ' compact' : ''}`}>
      {!compact && <span>Color theme</span>}
      <select aria-label="Color theme" value={theme} onChange={(event) => setTheme(event.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </label>
  )
}
