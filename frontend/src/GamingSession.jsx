import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from './lib/api'
import './GamingSession.css'

const categories = [
  { name: 'Brain Training', icon: '🧠' },
  { name: 'Memory Games', icon: '🃏' },
  { name: 'Logic and Puzzle Games', icon: '🧩' },
  { name: 'Focus and Concentration', icon: '🎯' },
  { name: 'Chess and Strategy', icon: '♟️' },
  { name: 'Sudoku', icon: '▦' },
  { name: 'Casual Games', icon: '🎮' },
  { name: 'Arcade Games', icon: '👾' },
  { name: 'Racing Games', icon: '🏎️' },
  { name: 'Entertainment Games', icon: '🍿' },
  { name: 'Educational Games', icon: '📚' },
  { name: 'Relaxation Games', icon: '🌿' },
]

function websiteFavicon(gameUrl) {
  try {
    return new URL('/favicon.ico', gameUrl).href
  } catch {
    return ''
  }
}

const builtinGames = [
  ['lumosity', 'Lumosity', 'Play short brain-training exercises for memory, attention, and problem solving.', 'Brain Training', 'https://www.lumosity.com/', '🧠'],
  ['humanbenchmark-memory', 'Memory Test', 'Challenge your visual memory with Human Benchmark.', 'Memory Games', 'https://humanbenchmark.com/tests/memory', '🃏'],
  ['humanbenchmark-sequence', 'Sequence Memory', 'Remember and repeat increasingly long color sequences.', 'Memory Games', 'https://humanbenchmark.com/tests/sequence', '🔢'],
  ['2048', '2048', 'Slide and combine tiles to reach the 2048 tile.', 'Logic and Puzzle Games', 'https://play2048.co/', '🔢'],
  ['reaction-time', 'Reaction Time Test', 'Wait for the signal, then react as quickly as you can.', 'Focus and Concentration', 'https://humanbenchmark.com/tests/reactiontime', '⚡'],
  ['chess-com', 'Chess.com', 'Play chess online, solve puzzles, and learn new tactics.', 'Chess and Strategy', 'https://www.chess.com/', '♟️'],
  ['lichess', 'Lichess', 'Play free online chess and sharpen your strategy.', 'Chess and Strategy', 'https://lichess.org/', '♞'],
  ['web-sudoku', 'Web Sudoku', 'Solve daily Sudoku puzzles at four difficulty levels.', 'Sudoku', 'https://www.websudoku.com/', '▦'],
  ['solitaire', 'Solitaire', 'Play classic Klondike solitaire in your browser.', 'Casual Games', 'https://www.solitaire.org/', '🂡'],
  ['tetris', 'Tetris', 'Play the iconic arcade puzzle game online.', 'Arcade Games', 'https://tetris.com/play-tetris', '🟪'],
  ['moto-x3m', 'Moto X3M', 'Race through obstacle-filled tracks in this motorcycle game.', 'Racing Games', 'https://www.crazygames.com/game/moto-x3m', '🏎️'],
  ['wordle', 'Wordle', 'Find the hidden five-letter word in six guesses.', 'Entertainment Games', 'https://www.nytimes.com/games/wordle/index.html', '🔤'],
  ['sporcle', 'Sporcle Quizzes', 'Explore trivia quizzes across a wide range of topics.', 'Educational Games', 'https://www.sporcle.com/', '📚'],
  ['minecraft', 'Minecraft', 'Explore, create, and play in the world of Minecraft.', 'Educational Games', 'https://www.minecraft.net/', '⛏️'],
  ['jigsaw-planet', 'Jigsaw Planet', 'Relax with thousands of picture jigsaw puzzles.', 'Relaxation Games', 'https://www.jigsawplanet.com/', '🌿'],
].map(([id, name, description, category, gameUrl, icon]) => ({
  id,
  key: id,
  name,
  description,
  category,
  gameUrl,
  thumbnailUrl: websiteFavicon(gameUrl),
  icon,
  builtIn: true,
}))

const emptyGame = { name: '', gameUrl: '', description: '', category: categories[0].name, thumbnailUrl: '', icon: '🎮' }

function isSafeWebUrl(value) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false
    return !(
      /^(.+\.)?google\.[a-z.]+$/i.test(url.hostname)
      && /^\/search(?:\/|$)/i.test(url.pathname)
    )
  } catch {
    return false
  }
}

function GameCover({ game }) {
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = game.thumbnailUrl || websiteFavicon(game.gameUrl)
  return imageUrl && !imageFailed
    ? <img src={imageUrl} alt={`${game.name} logo`} referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
    : <span aria-hidden="true">{game.icon || '🎮'}</span>
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
    apiRequest('/gaming')
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
    .filter((game) => isSafeWebUrl(game.gameUrl) && preferences[game.key]?.lastPlayedAt)
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
      gameUrl: game.gameUrl || '',
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

  const submitForm = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Enter a game name.'
    if (!isSafeWebUrl(form.gameUrl.trim())) nextErrors.gameUrl = 'Enter a safe HTTP or HTTPS game website URL.'
    if (!categories.some((category) => category.name === form.category)) nextErrors.category = 'Choose a category.'
    if (form.thumbnailUrl.trim() && !isSafeWebUrl(form.thumbnailUrl.trim())) {
      nextErrors.thumbnailUrl = 'Use a safe HTTP or HTTPS logo URL.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSaving(true)
    setError('')
    const body = JSON.stringify({
      name: form.name.trim(),
      gameUrl: form.gameUrl.trim(),
      description: form.description.trim(),
      category: form.category,
      thumbnailUrl: form.thumbnailUrl.trim(),
      icon: form.icon || '🎮',
    })
    try {
      const response = await apiRequest(editingId ? `/gaming/${editingId}` : '/gaming', {
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
      await apiRequest(`/gaming/${game.id}`, { method: 'DELETE' })
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
      const result = await apiRequest(`/gaming/preferences/${encodeURIComponent(game.key)}`, {
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
      const result = await apiRequest(`/gaming/preferences/${encodeURIComponent(game.key)}`, {
        method: 'PATCH',
        body: JSON.stringify({ played: true }),
      })
      setPreferences((current) => ({ ...current, [game.key]: result.preference }))
    } catch (playError) {
      setError(`The game opened, but its recent-play record could not be saved: ${playError.message}`)
    }
  }

  const launchLink = (game, className, children) => (
    isSafeWebUrl(game.gameUrl)
      ? (
        <a
          className={className}
          href={game.gameUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            void markPlayed(game)
          }}
          aria-label={`Play ${game.name} on its website in a new tab`}
        >
          {children}
        </a>
      )
      : (
        <button
          className={`${className} game-needs-url`}
          type="button"
          onClick={() => openEditForm(game)}
          aria-label={`Add a website URL for ${game.name}`}
        >
          {children}
        </button>
      )
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

      <div className="gaming-storage-note"><span>◉</span> Your custom games, favorites, and recent plays are saved to your LifePilot account. Games open directly on their websites in a new tab.</div>
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
                {launchLink(game, 'game-cover brain-game-cover', <GameCover key={game.thumbnailUrl || game.gameUrl} game={game} />)}
                <div className="game-card-content">
                  <div className="game-card-heading">
                    {launchLink(game, 'brain-game-title', <h2>{game.name}</h2>)}
                    <span>{categories.find((category) => category.name === game.category)?.icon} {game.category}</span>
                  </div>
                  <p>{game.description || `Explore ${game.name} online.`}</p>
                  <div className="game-card-actions">
                    {isSafeWebUrl(game.gameUrl)
                      ? launchLink(game, 'game-play-button', <>Play Now <span aria-hidden="true">↗</span></>)
                      : <button className="game-play-button" type="button" onClick={() => openEditForm(game)}>Set website URL</button>}
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
            <p>Add a game to your account with the website you want to open when you play.</p>
            <form className="gaming-form" onSubmit={(event) => { void submitForm(event) }} noValidate>
              <label htmlFor="game-name">Game name<input id="game-name" maxLength="60" value={form.name} onChange={(event) => updateForm('name', event.target.value)} aria-invalid={Boolean(errors.name)} />{errors.name && <span role="alert">{errors.name}</span>}</label>
              <label htmlFor="game-url">Website URL<input id="game-url" type="url" maxLength="2048" value={form.gameUrl} onChange={(event) => updateForm('gameUrl', event.target.value)} placeholder="https://example.com/game" aria-invalid={Boolean(errors.gameUrl)} />{errors.gameUrl && <span role="alert">{errors.gameUrl}</span>}</label>
              <label htmlFor="game-description">Short description <small>Optional</small><textarea id="game-description" maxLength="180" rows="3" value={form.description} onChange={(event) => updateForm('description', event.target.value)} /></label>
              <label htmlFor="game-category">Category<select id="game-category" value={form.category} onChange={(event) => updateForm('category', event.target.value)}>{categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}</select>{errors.category && <span role="alert">{errors.category}</span>}</label>
              <label htmlFor="game-thumbnail">Logo/image URL <small>Optional · defaults to the game website favicon</small><input id="game-thumbnail" type="url" maxLength="2048" value={form.thumbnailUrl} onChange={(event) => updateForm('thumbnailUrl', event.target.value)} placeholder="https://example.com/logo.png" aria-invalid={Boolean(errors.thumbnailUrl)} />{errors.thumbnailUrl && <span role="alert">{errors.thumbnailUrl}</span>}</label>
              <p className="gaming-form-security">Only HTTP and HTTPS website links are accepted. Your game opens directly in a new tab.</p>
              <div className="gaming-form-actions"><button type="button" onClick={closeForm} disabled={saving}>Cancel</button><button className="gaming-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add game'} {!saving && <span>↗</span>}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
