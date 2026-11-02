import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from './lib/api'
import './GamingSession.css'

const categories = [
  { name: 'Brain Training', icon: '🧠' },
  { name: 'Memory Games', icon: '🃏' },
  { name: 'Logic and Puzzle Games', icon: '🧩' },
  { name: 'Focus Games', icon: '🎯' },
  { name: 'Strategy Games', icon: '♟️' },
  { name: 'Chess', icon: '♞' },
  { name: 'Sudoku', icon: '▦' },
  { name: 'Casual Games', icon: '🎮' },
  { name: 'Arcade Games', icon: '👾' },
  { name: 'Racing Games', icon: '🏎️' },
  { name: 'Entertainment Games', icon: '🍿' },
  { name: 'Educational Games', icon: '📚' },
]

const builtinGames = [
  ['memory-card-matching', 'Memory Card Matching', 'Find matching pairs in this quick visual memory game.', 'Memory Games', '🃏'],
  ['sequence-memory', 'Sequence Memory', 'Watch a sequence of colors and repeat it from memory.', 'Memory Games', '🔢'],
  ['number-memory', 'Number Memory', 'Remember a number as each round adds another digit.', 'Brain Training', '🔠'],
  ['sudoku', 'Sudoku', 'Use logic and deduction to complete a number puzzle.', 'Sudoku', '▦'],
  ['chess', 'Chess', 'Practice tactics and play a timeless strategy game.', 'Chess', '♞'],
  ['2048', '2048', 'Slide and combine tiles to reach the 2048 tile.', 'Logic and Puzzle Games', '🔢'],
  ['spot-the-difference', 'Spot the Difference', 'Scan a pattern and identify the one different tile.', 'Focus Games', '🔍'],
  ['reaction-time-test', 'Reaction Time Test', 'Wait for the signal, then react as quickly as you can.', 'Focus Games', '⚡'],
  ['pattern-recognition', 'Pattern Recognition', 'Find a rule and choose the next item in a sequence.', 'Logic and Puzzle Games', '🧩'],
  ['checkers', 'Checkers', 'Plan ahead and outmaneuver your opponent.', 'Strategy Games', '🔴'],
  ['solitaire', 'Solitaire', 'Unwind with a classic single-player card game.', 'Casual Games', '🂡'],
  ['pac-man', 'Pac-Man', 'Enjoy an arcade classic full of quick decisions.', 'Arcade Games', '👾'],
  ['car-racing', 'Car Racing', 'Explore fast-paced online racing games.', 'Racing Games', '🏎️'],
  ['trivia-quiz', 'Trivia Quiz', 'Test what you know with a lively general-knowledge quiz.', 'Entertainment Games', '❓'],
  ['typing-challenge', 'Typing Challenge', 'Practice typing speed while learning something new.', 'Educational Games', '⌨️'],
].map(([id, name, description, category, icon]) => ({
  id,
  key: id,
  name,
  description,
  category,
  thumbnailUrl: '',
  icon,
  searchPhrase: id === 'car-racing' ? 'car racing games' : name,
  builtIn: true,
}))

const emptyGame = { name: '', description: '', category: categories[0].name, thumbnailUrl: '', icon: '🎮' }

function googleSearchUrl(game) {
  const query = `play ${game.searchPhrase || game.name} online`
  return `https://www.google.com/search?${new URLSearchParams({ q: query }).toString()}`
}

function GameCover({ game }) {
  const [imageFailed, setImageFailed] = useState(false)
  return game.thumbnailUrl && !imageFailed
    ? <img src={game.thumbnailUrl} alt={`${game.name} logo`} onError={() => setImageFailed(true)} />
    : <span aria-hidden="true">{game.icon || '🎮'}</span>
}

async function optimizeUploadedImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  const image = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const loadedImage = new Image()
      loadedImage.onload = () => resolve(loadedImage)
      loadedImage.onerror = () => reject(new Error('That image could not be opened.'))
      loadedImage.src = reader.result
    }
    reader.onerror = () => reject(new Error('That image could not be read.'))
    reader.readAsDataURL(file)
  })

  const scale = Math.min(1, 256 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
  let dataUrl = canvas.toDataURL('image/jpeg', 0.68)
  if (dataUrl.length > 24000) dataUrl = canvas.toDataURL('image/jpeg', 0.45)
  if (dataUrl.length > 25000) throw new Error('That image is too large after compression. Use a smaller image or an HTTPS logo URL.')
  return dataUrl
}

export default function GamingSession({ onBackToDashboard }) {
  const [customGames, setCustomGames] = useState([])
  const [preferences, setPreferences] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [recentOnly, setRecentOnly] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyGame)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    let active = true
    apiRequest('/games')
      .then((result) => {
        if (!active) return
        setCustomGames(result.games || [])
        setPreferences(Object.fromEntries((result.preferences || []).map((item) => [item.gameKey, item])))
      })
      .catch((loadError) => {
        if (active) setError(`Could not load your saved games: ${loadError.message}`)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const games = useMemo(() => [
    ...builtinGames,
    ...customGames.map((game) => ({ ...game, key: `custom-${game.id}`, builtIn: false })),
  ], [customGames])

  const visibleGames = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return games.filter((game) => {
      const preference = preferences[game.key]
      return (activeCategory === 'All' || game.category === activeCategory)
        && (!query || `${game.name} ${game.description} ${game.category}`.toLocaleLowerCase().includes(query))
        && (!favoritesOnly || preference?.isFavorite)
        && (!recentOnly || preference?.lastPlayedAt)
    })
  }, [games, activeCategory, favoritesOnly, recentOnly, preferences, search])

  const recentGames = useMemo(() => games
    .filter((game) => preferences[game.key]?.lastPlayedAt)
    .sort((left, right) => new Date(preferences[right.key].lastPlayedAt) - new Date(preferences[left.key].lastPlayedAt))
    .slice(0, 4), [games, preferences])

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const openAddForm = () => {
    setEditingId(null)
    setForm({ ...emptyGame })
    setErrors({})
    setFormOpen(true)
  }

  const openEditForm = (game) => {
    setEditingId(game.id)
    setForm({
      name: game.name,
      description: game.description,
      category: game.category,
      thumbnailUrl: game.thumbnailUrl || '',
      icon: game.icon || '🎮',
    })
    setErrors({})
    setFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    setFormOpen(false)
    setEditingId(null)
    setErrors({})
  }

  const uploadLogo = async (file) => {
    if (!file) return
    try {
      updateForm('thumbnailUrl', await optimizeUploadedImage(file))
    } catch (uploadError) {
      setErrors((current) => ({ ...current, thumbnailUrl: uploadError.message }))
    }
  }

  const submitForm = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Enter a game name.'
    if (!categories.some((category) => category.name === form.category)) nextErrors.category = 'Choose a category.'
    if (form.thumbnailUrl.trim() && !(
      /^https:\/\/[^\s]+$/i.test(form.thumbnailUrl.trim())
      || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(form.thumbnailUrl.trim())
    )) nextErrors.thumbnailUrl = 'Use an HTTPS logo URL or upload an image.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    setError('')
    const body = JSON.stringify({
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      thumbnailUrl: form.thumbnailUrl.trim(),
      icon: form.icon || '🎮',
    })
    try {
      const response = await apiRequest(editingId ? `/games/${editingId}` : '/games', {
        method: editingId ? 'PATCH' : 'POST',
        body,
      })
      setCustomGames((current) => editingId
        ? current.map((game) => game.id === editingId ? response.game : game)
        : [...current, response.game])
      setFormOpen(false)
      setEditingId(null)
      setForm({ ...emptyGame })
    } catch (saveError) {
      setError(`Could not save this game: ${saveError.message}`)
    } finally {
      setSaving(false)
    }
  }

  const deleteGame = async (game) => {
    if (!window.confirm(`Remove "${game.name}" from your game library?`)) return
    setError('')
    try {
      await apiRequest(`/games/${game.id}`, { method: 'DELETE' })
      setCustomGames((current) => current.filter((item) => item.id !== game.id))
      setPreferences((current) => {
        const next = { ...current }
        delete next[game.key]
        return next
      })
    } catch (deleteError) {
      setError(`Could not remove this game: ${deleteError.message}`)
    }
  }

  const toggleFavorite = async (game) => {
    const previous = preferences[game.key]?.isFavorite || false
    setError('')
    try {
      const result = await apiRequest(`/games/preferences/${encodeURIComponent(game.key)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite: !previous }),
      })
      setPreferences((current) => ({ ...current, [game.key]: result.preference }))
    } catch (favoriteError) {
      setError(`Could not update favorite: ${favoriteError.message}`)
    }
  }

  const markPlayed = async (game) => {
    try {
      const result = await apiRequest(`/games/preferences/${encodeURIComponent(game.key)}`, {
        method: 'PATCH',
        body: JSON.stringify({ played: true }),
      })
      setPreferences((current) => ({ ...current, [game.key]: result.preference }))
    } catch (playError) {
      setError(`The game opened, but its recent-play record could not be saved: ${playError.message}`)
    }
  }

  const launchLink = (game, className, children) => (
    <a
      className={className}
      href={game.searchUrl || googleSearchUrl(game)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => { void markPlayed(game) }}
      aria-label={`Search Google for how to play ${game.name} online in a new tab`}
    >
      {children}
    </a>
  )

  return (
    <main className="gaming-page brain-training-page">
      <header className="gaming-heading">
        <div>
          <button className="gaming-back" type="button" onClick={onBackToDashboard}>← Back to Dashboard</button>
          <span className="page-eyebrow">LIFEPILOT · GAMING SESSION</span>
          <h1>Gaming Session 🎮</h1>
          <p>Explore brain-training challenges, strategy games, and entertainment in one personal library.</p>
        </div>
        <button className="gaming-primary" type="button" onClick={openAddForm}>＋ <span>Add a game</span></button>
      </header>

      <div className="gaming-storage-note"><span>◉</span> Your custom games, favorites, and recent plays are saved to your LifePilot account. Play Now opens a Google search in a new tab.</div>
      {error && <p className="gaming-alert" role="alert">{error}</p>}

      {recentGames.length > 0 && (
        <section className="brain-recent" aria-label="Recently played games">
          <div className="gaming-section-heading">
            <h2>Recently played</h2>
            <button type="button" onClick={() => { setRecentOnly((value) => !value); setFavoritesOnly(false) }} aria-pressed={recentOnly}>
              {recentOnly ? 'Show all games' : 'View recent'}
            </button>
          </div>
          <div>{recentGames.map((game) => launchLink(game, 'brain-recent-link', <><span>{game.icon}</span><strong>{game.name}</strong><i>↗</i></>))}</div>
        </section>
      )}

      <section className="gaming-library">
        <div className="gaming-toolbar">
          <label className="gaming-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search games..." aria-label="Search games by name, description, or category" /></label>
          <button className={`gaming-view-toggle ${favoritesOnly ? 'active' : ''}`} type="button" onClick={() => { setFavoritesOnly((value) => !value); setRecentOnly(false) }} aria-pressed={favoritesOnly}>☆ Favorites</button>
          <span className="gaming-result-count">{visibleGames.length} {visibleGames.length === 1 ? 'game' : 'games'}</span>
        </div>
        <div className="gaming-filters brain-category-filters" aria-label="Filter by game category">
          {['All', ...categories.map((category) => category.name)].map((category) => (
            <button type="button" key={category} className={activeCategory === category ? 'active' : ''} onClick={() => setActiveCategory(category)} aria-pressed={activeCategory === category}>
              {category !== 'All' && <span>{categories.find((item) => item.name === category).icon}</span>} {category}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="gaming-empty" role="status"><span>◌</span><h2>Loading your games</h2><p>Connecting to your LifePilot library…</p></div>
        ) : visibleGames.length ? (
          <div className="gaming-grid">
            {visibleGames.map((game) => (
              <article className="game-card brain-game-card" key={game.key}>
                {launchLink(game, 'game-cover brain-game-cover', <GameCover game={game} />)}
                <div className="game-card-content">
                  <div className="game-card-heading">
                    {launchLink(game, 'brain-game-title', <h2>{game.name}</h2>)}
                    <span>{categories.find((category) => category.name === game.category)?.icon} {game.category}</span>
                  </div>
                  <p>{game.description || `Explore ${game.name} online.`}</p>
                  <div className="game-card-actions">
                    {launchLink(game, 'game-play-button', <>Play Now <span aria-hidden="true">↗</span></>)}
                    <button className={`game-favorite-button ${preferences[game.key]?.isFavorite ? 'active' : ''}`} type="button" onClick={() => { void toggleFavorite(game) }} aria-label={`${preferences[game.key]?.isFavorite ? 'Remove' : 'Add'} ${game.name} ${preferences[game.key]?.isFavorite ? 'from' : 'to'} favorites`} aria-pressed={Boolean(preferences[game.key]?.isFavorite)}>☆</button>
                  </div>
                  {!game.builtIn && <div className="game-manage-actions"><button type="button" onClick={() => openEditForm(game)}>Edit</button><button type="button" onClick={() => { void deleteGame(game) }}>Delete</button></div>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="gaming-empty"><span>⌕</span><h2>No games match your filters</h2><p>Try another search or category, or add a new game to your library.</p><button type="button" onClick={() => { setSearch(''); setActiveCategory('All'); setFavoritesOnly(false); setRecentOnly(false) }}>Clear filters</button></div>
        )}
      </section>

      {formOpen && (
        <div className="gaming-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <section className="gaming-modal" role="dialog" aria-modal="true" aria-labelledby="gaming-form-title">
            <button className="gaming-modal-close" type="button" onClick={closeForm} aria-label="Close game form">×</button>
            <span className="page-eyebrow">{editingId ? 'UPDATE YOUR LIBRARY' : 'GROW YOUR LIBRARY'}</span>
            <h2 id="gaming-form-title">{editingId ? 'Edit game' : 'Add a game'}</h2>
            <p>Add a game to your account. Play Now will search Google automatically.</p>
            <form className="gaming-form" onSubmit={(event) => { void submitForm(event) }} noValidate>
              <label htmlFor="game-name">Game name<input id="game-name" maxLength="60" value={form.name} onChange={(event) => updateForm('name', event.target.value)} aria-invalid={Boolean(errors.name)} />{errors.name && <span role="alert">{errors.name}</span>}</label>
              <label htmlFor="game-description">Short description <small>Optional</small><textarea id="game-description" maxLength="180" rows="3" value={form.description} onChange={(event) => updateForm('description', event.target.value)} /></label>
              <label htmlFor="game-category">Category<select id="game-category" value={form.category} onChange={(event) => updateForm('category', event.target.value)}>{categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}</select>{errors.category && <span role="alert">{errors.category}</span>}</label>
              <label htmlFor="game-thumbnail">Game logo URL <small>Optional</small><input id="game-thumbnail" type="url" value={form.thumbnailUrl.startsWith('data:') ? '' : form.thumbnailUrl} onChange={(event) => updateForm('thumbnailUrl', event.target.value)} placeholder="https://example.com/logo.png" aria-invalid={Boolean(errors.thumbnailUrl)} /></label>
              <label htmlFor="game-logo-file">Or upload a logo <small>Optional · PNG, JPEG, or WebP</small><input id="game-logo-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void uploadLogo(event.target.files?.[0]) }} aria-invalid={Boolean(errors.thumbnailUrl)} />{errors.thumbnailUrl && <span role="alert">{errors.thumbnailUrl}</span>}</label>
              {form.thumbnailUrl.startsWith('data:') && <p className="gaming-logo-ready">Uploaded logo ready to save.</p>}
              <p className="gaming-form-security">No playable URL or API key is needed. A Google search link is generated from the game name.</p>
              <div className="gaming-form-actions"><button type="button" onClick={closeForm} disabled={saving}>Cancel</button><button className="gaming-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add game'} {!saving && <span>↗</span>}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
