import { useMemo, useState } from 'react'
import './GamingSession.css'

const STORAGE_KEY = 'lifepilot-brain-training-library-v1'
const RECENT_KEY = 'lifepilot-brain-training-recent-v1'
const categories = [
  { name: 'Memory Games', icon: '🧠' },
  { name: 'Focus and Attention', icon: '👁' },
  { name: 'Logic and Problem-Solving', icon: '♟' },
  { name: 'Brain Teasers', icon: '🧩' },
]
const builtinGames = [
  ['memory-card-matching', 'Memory Card Matching', 'Find matching pairs in this quick visual memory game.', 'Memory Games', '🃏'],
  ['sequence-memory', 'Sequence Memory', 'Watch a sequence of colors and repeat it from memory.', 'Memory Games', '🔢'],
  ['number-memory', 'Number Memory', 'Remember a number as each round adds another digit.', 'Memory Games', '🔠'],
  ['sudoku', 'Sudoku', 'Use deduction to complete a compact 4 × 4 number puzzle.', 'Logic and Problem-Solving', '▦'],
  ['chess-puzzles', 'Chess Puzzles', 'Find a knight fork in a short chess tactics challenge.', 'Logic and Problem-Solving', '♞'],
  ['spot-the-difference', 'Spot the Difference', 'Scan a pattern and identify the one different tile.', 'Focus and Attention', '🔍'],
  ['reaction-time-test', 'Reaction Time Test', 'Wait for the signal, then react as quickly as you can.', 'Focus and Attention', '⚡'],
  ['pattern-recognition', 'Pattern Recognition', 'Find the rule and choose the next number in the sequence.', 'Brain Teasers', '🧩'],
].map(([id, name, description, category, icon]) => ({
  id,
  name,
  description,
  category,
  thumbnailUrl: '',
  gameUrl: `#brain-game/${id}`,
  icon,
  builtIn: true,
}))
const builtinGameIds = new Set(builtinGames.map((game) => game.id))

function isSafeUrl(value, required = false) {
  if (!value) return !required
  const internalId = value.match(/^#brain-game\/([a-z0-9-]+)$/)?.[1]
  if (internalId) return builtinGameIds.has(internalId)
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

function isGame(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && Boolean(value.name.trim())
    && typeof value.description === 'string'
    && typeof value.gameUrl === 'string'
    && isSafeUrl(value.gameUrl, true)
    && typeof value.thumbnailUrl === 'string'
    && isSafeUrl(value.thumbnailUrl)
    && categories.some((category) => category.name === value.category)
}

function getLocalGames() {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved) {
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed) || !parsed.every(isGame)) throw new Error('The saved brain-training library has an unexpected format.')
    return parsed
  }

  const legacy = window.localStorage.getItem('lifepilot-game-library-v1')
  if (!legacy) return builtinGames
  const parsedLegacy = JSON.parse(legacy)
  if (!Array.isArray(parsedLegacy)) throw new Error('The previous game library has an unexpected format.')
  const migrated = parsedLegacy.filter((game) => (
    game && typeof game.name === 'string'
    && typeof game.description === 'string'
    && typeof game.gameUrl === 'string'
    && isSafeUrl(game.gameUrl, true)
    && typeof game.thumbnailUrl === 'string'
    && isSafeUrl(game.thumbnailUrl)
  )).map((game, index) => ({
    id: `saved-${game.id || index}`,
    name: game.name,
    description: game.description,
    category: 'Brain Teasers',
    thumbnailUrl: game.thumbnailUrl,
    gameUrl: game.gameUrl,
    icon: '🎮',
    builtIn: false,
  }))
  return [...builtinGames, ...migrated]
}

function readRecentGames() {
  try {
    const recent = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(recent) ? recent.filter((id) => typeof id === 'string') : []
  } catch (error) {
    console.error('Unable to load recently played brain games.', error)
    return []
  }
}

const emptyGame = { name: '', description: '', category: categories[0].name, thumbnailUrl: '', gameUrl: '' }

function GameCover({ game }) {
  const [imageFailed, setImageFailed] = useState(false)
  return game.thumbnailUrl && !imageFailed
    ? <img src={game.thumbnailUrl} alt={`${game.name} thumbnail`} onError={() => setImageFailed(true)} />
    : <span aria-hidden="true">{game.icon || '🧠'}</span>
}

export default function GamingSession({ onBackToDashboard }) {
  const [initialGames] = useState(() => {
    try {
      return { games: getLocalGames(), error: '' }
    } catch (error) {
      console.error('Unable to load the brain-training library.', error)
      return { games: builtinGames, error: 'Your saved library could not be read. The starter games are shown; changes may not persist in this browser.' }
    }
  })
  const [games, setGames] = useState(initialGames.games)
  const [recent, setRecent] = useState(readRecentGames)
  const [storageError, setStorageError] = useState(initialGames.error)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyGame)
  const [errors, setErrors] = useState({})

  const visibleGames = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return games.filter((game) => (
      (activeCategory === 'All' || game.category === activeCategory)
      && (!query || game.name.toLocaleLowerCase().includes(query))
    ))
  }, [games, activeCategory, search])

  const recentGames = recent.map((id) => games.find((game) => game.id === id)).filter(Boolean).slice(0, 3)
  const saveGames = (nextGames) => {
    setGames(nextGames)
    if (storageError) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextGames))
    } catch (error) {
      console.error('Unable to save the brain-training library.', error)
      setStorageError('Your browser could not save changes. They will remain visible until you leave this page.')
    }
  }
  const markPlayed = (game) => {
    const nextRecent = [game.id, ...recent.filter((id) => id !== game.id)].slice(0, 8)
    setRecent(nextRecent)
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent))
    } catch (error) {
      console.error('Unable to save recently played games.', error)
      setStorageError('Recently played games could not be saved in this browser.')
    }
  }
  const openAddForm = () => {
    setEditingId(null)
    setForm({ ...emptyGame })
    setErrors({})
    setFormOpen(true)
  }
  const openEditForm = (game) => {
    setEditingId(game.id)
    setForm({ name: game.name, description: game.description, category: game.category, thumbnailUrl: game.thumbnailUrl, gameUrl: game.gameUrl })
    setErrors({})
    setFormOpen(true)
  }
  const closeForm = () => { setFormOpen(false); setEditingId(null); setErrors({}) }
  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }
  const submitForm = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Enter a game name.'
    if (!form.description.trim()) nextErrors.description = 'Add a short description.'
    if (!isSafeUrl(form.gameUrl.trim(), true)) nextErrors.gameUrl = 'Use a valid HTTPS game link or a built-in Brain Training game link.'
    if (form.thumbnailUrl.trim() && !isSafeUrl(form.thumbnailUrl.trim())) nextErrors.thumbnailUrl = 'Use an HTTPS image link.'
    if (!categories.some((category) => category.name === form.category)) nextErrors.category = 'Choose a category.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const previous = games.find((game) => game.id === editingId)
    const updated = {
      id: editingId || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      thumbnailUrl: form.thumbnailUrl.trim(),
      gameUrl: form.gameUrl.trim(),
      icon: previous?.icon || '🧠',
      builtIn: previous?.builtIn || false,
    }
    saveGames(editingId ? games.map((game) => game.id === editingId ? updated : game) : [...games, updated])
    closeForm()
  }
  const deleteGame = (game) => {
    if (!window.confirm(`Remove "${game.name}" from this browser's library?`)) return
    saveGames(games.filter((item) => item.id !== game.id))
    setRecent((items) => items.filter((id) => id !== game.id))
  }
  const gameHref = (game) => game.gameUrl.startsWith('#') ? `${window.location.pathname}${game.gameUrl}` : game.gameUrl
  const launchLink = (game, className, children) => (
    <a className={className} href={gameHref(game)} target="_blank" rel="noopener noreferrer" onClick={() => markPlayed(game)} aria-label={`Play ${game.name} in a new tab`}>
      {children}
    </a>
  )

  return (
    <main className="gaming-page brain-training-page">
      <header className="gaming-heading">
        <div>
          <button className="gaming-back" type="button" onClick={onBackToDashboard}>← Back to Dashboard</button>
          <span className="page-eyebrow">LIFEPILOT · BRAIN TRAINING</span>
          <h1>Brain Training 🎮</h1>
          <p>Challenge your mind. Train your memory. Sharpen your focus.</p>
        </div>
        <button className="gaming-primary" type="button" onClick={openAddForm}>＋ <span>Add a game</span></button>
      </header>

      <div className="gaming-storage-note"><span>◉</span> This library is saved in this browser only; game management is not admin-restricted. Activities are for fun and do not guarantee cognitive benefits.</div>
      {storageError && <p className="gaming-alert" role="alert">{storageError}</p>}

      {recentGames.length > 0 && (
        <section className="brain-recent" aria-label="Recently played games">
          <h2>Recently played</h2>
          <div>{recentGames.map((game) => launchLink(game, 'brain-recent-link', <><span>{game.icon}</span><strong>{game.name}</strong><i>↗</i></>))}</div>
        </section>
      )}

      <section className="gaming-library">
        <div className="gaming-toolbar">
          <label className="gaming-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search brain games..." aria-label="Search games by name" /></label>
          <span className="gaming-result-count">{visibleGames.length} {visibleGames.length === 1 ? 'game' : 'games'}</span>
        </div>
        <div className="gaming-filters brain-category-filters" aria-label="Filter by brain-training category">
          {['All', ...categories.map((category) => category.name)].map((category) => (
            <button type="button" key={category} className={activeCategory === category ? 'active' : ''} onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category}>
              {category !== 'All' && <span>{categories.find((item) => item.name === category).icon}</span>} {category}
            </button>
          ))}
        </div>

        {visibleGames.length ? (
          <div className="gaming-grid">
            {visibleGames.map((game) => (
              <article className="game-card brain-game-card" key={game.id}>
                {launchLink(game, 'game-cover brain-game-cover', <GameCover game={game} />)}
                <div className="game-card-content">
                  <div className="game-card-heading">
                    {launchLink(game, 'brain-game-title', <h2>{game.name}</h2>)}
                    <span>{categories.find((category) => category.name === game.category)?.icon} {game.category}</span>
                  </div>
                  <p>{game.description}</p>
                  {launchLink(game, 'game-play-button', <>Play Now <span aria-hidden="true">↗</span></>)}
                  <div className="game-manage-actions"><button type="button" onClick={() => openEditForm(game)}>Edit</button><button type="button" onClick={() => deleteGame(game)}>Delete</button></div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="gaming-empty"><span>⌕</span><h2>No games match your search</h2><p>Try a different name or category, or add a new game to your library.</p><button type="button" onClick={() => { setSearch(''); setActiveCategory('All') }}>Clear filters</button></div>
        )}
      </section>

      {formOpen && (
        <div className="gaming-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <section className="gaming-modal" role="dialog" aria-modal="true" aria-labelledby="gaming-form-title">
            <button className="gaming-modal-close" type="button" onClick={closeForm} aria-label="Close game form">×</button>
            <span className="page-eyebrow">{editingId ? 'UPDATE YOUR LIBRARY' : 'GROW YOUR LIBRARY'}</span>
            <h2 id="gaming-form-title">{editingId ? 'Edit game' : 'Add a game'}</h2>
            <p>Save a playable game link in this browser’s library.</p>
            <form className="gaming-form" onSubmit={submitForm} noValidate>
              <label htmlFor="game-name">Game name<input id="game-name" maxLength="60" value={form.name} onChange={(event) => updateForm('name', event.target.value)} aria-invalid={Boolean(errors.name)} />{errors.name && <span role="alert">{errors.name}</span>}</label>
              <label htmlFor="game-description">Short description<textarea id="game-description" maxLength="180" rows="3" value={form.description} onChange={(event) => updateForm('description', event.target.value)} aria-invalid={Boolean(errors.description)} />{errors.description && <span role="alert">{errors.description}</span>}</label>
              <label htmlFor="game-thumbnail">Thumbnail image URL <small>Optional</small><input id="game-thumbnail" type="url" value={form.thumbnailUrl} onChange={(event) => updateForm('thumbnailUrl', event.target.value)} placeholder="https://example.com/image.jpg" aria-invalid={Boolean(errors.thumbnailUrl)} />{errors.thumbnailUrl && <span role="alert">{errors.thumbnailUrl}</span>}</label>
              <label htmlFor="game-url">Game URL<input id="game-url" value={form.gameUrl} onChange={(event) => updateForm('gameUrl', event.target.value)} placeholder="https://example.com/game" aria-invalid={Boolean(errors.gameUrl)} />{errors.gameUrl && <span role="alert">{errors.gameUrl}</span>}</label>
              <label htmlFor="game-category">Skill category<select id="game-category" value={form.category} onChange={(event) => updateForm('category', event.target.value)}>{categories.map((category) => <option key={category.name}>{category.name}</option>)}</select>{errors.category && <span role="alert">{errors.category}</span>}</label>
              <p className="gaming-form-security">External game and thumbnail links must use HTTPS. Built-in brain games open in a separate tab.</p>
              <div className="gaming-form-actions"><button type="button" onClick={closeForm}>Cancel</button><button className="gaming-primary" type="submit">{editingId ? 'Save changes' : 'Add game'} <span>↗</span></button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
