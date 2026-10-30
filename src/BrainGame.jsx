import { useEffect, useMemo, useRef, useState } from 'react'
import './BrainGame.css'

const gameCatalog = {
  'memory-card-matching': { title: 'Memory Card Matching', category: 'Memory Games', icon: '🃏', description: 'Find every matching pair.' },
  'sequence-memory': { title: 'Sequence Memory', category: 'Memory Games', icon: '🔢', description: 'Watch and repeat the growing sequence.' },
  'number-memory': { title: 'Number Memory', category: 'Memory Games', icon: '🔠', description: 'Remember each number before it disappears.' },
  sudoku: { title: 'Sudoku', category: 'Logic & Problem-Solving', icon: '▦', description: 'Complete a compact 4 × 4 number grid.' },
  'chess-puzzles': { title: 'Chess Puzzles', category: 'Logic & Problem-Solving', icon: '♞', description: 'Spot a knight fork in a short chess puzzle.' },
  'spot-the-difference': { title: 'Spot the Difference', category: 'Focus and Attention', icon: '🔍', description: 'Find the one tile that breaks the pattern.' },
  'reaction-time-test': { title: 'Reaction Time Test', category: 'Focus and Attention', icon: '⚡', description: 'Tap as soon as the screen changes.' },
  'pattern-recognition': { title: 'Pattern Recognition', category: 'Brain Teasers', icon: '🧩', description: 'Work out what comes next in the pattern.' },
}

const sequenceOptions = ['🔵', '🟣', '🟢', '🟠']
const sudokuPuzzle = [[1, 0, 0, 4], [0, 4, 1, 0], [0, 1, 4, 0], [4, 0, 0, 1]]
const sudokuSolution = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]]
const patterns = [
  { sequence: [2, 4, 8, 16], answer: '32', choices: ['24', '30', '32', '34'], hint: 'Each number doubles.' },
  { sequence: [1, 4, 9, 16], answer: '25', choices: ['20', '24', '25', '36'], hint: 'These are consecutive square numbers.' },
  { sequence: [3, 6, 11, 18], answer: '27', choices: ['25', '26', '27', '29'], hint: 'The gaps grow by two each time.' },
]

function randomInt(max) {
  return Math.floor(Math.random() * max)
}

function shuffle(items) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1)
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]
  }
  return shuffled
}

export default function BrainGame({ gameId }) {
  const game = gameCatalog[gameId]
  if (!game) return <main className="brain-game-page"><p>This brain game could not be found.</p><a href="#gaming">← Back to Brain Training</a></main>
  return (
    <main className="brain-game-page">
      <a className="brain-game-back" href="#gaming">← Back to Brain Training</a>
      <header className="brain-game-heading">
        <span className="brain-game-icon">{game.icon}</span>
        <div><span className="brain-game-category">{game.category}</span><h1>{game.title}</h1><p>{game.description}</p></div>
      </header>
      {gameId === 'memory-card-matching' && <MemoryCards />}
      {gameId === 'sequence-memory' && <SequenceMemory />}
      {gameId === 'number-memory' && <NumberMemory />}
      {gameId === 'sudoku' && <Sudoku />}
      {gameId === 'chess-puzzles' && <ChessPuzzle />}
      {gameId === 'spot-the-difference' && <SpotDifference />}
      {gameId === 'reaction-time-test' && <ReactionTest />}
      {gameId === 'pattern-recognition' && <PatternRecognition />}
      <p className="brain-game-disclaimer">A casual brain-training activity for fun. Results do not measure intelligence or guarantee cognitive benefits.</p>
    </main>
  )
}

function GamePanel({ children, className = '' }) {
  return <section className={`brain-game-panel ${className}`}>{children}</section>
}

function MemoryCards() {
  const values = useMemo(() => shuffle(['🌙', '🌙', '🍀', '🍀', '🌼', '🌼', '⭐', '⭐', '🍉', '🍉', '🎈', '🎈', '🐳', '🐳', '🍄', '🍄']), [])
  const [opened, setOpened] = useState([])
  const [matched, setMatched] = useState([])
  const [moves, setMoves] = useState(0)
  const busy = useRef(false)
  const select = (index) => {
    if (busy.current || opened.includes(index) || matched.includes(index)) return
    const next = [...opened, index]
    setOpened(next)
    if (next.length < 2) return
    setMoves((count) => count + 1)
    if (values[next[0]] === values[next[1]]) {
      setMatched((current) => [...current, ...next])
      setOpened([])
      return
    }
    busy.current = true
    window.setTimeout(() => { setOpened([]); busy.current = false }, 700)
  }
  return <GamePanel>
    <div className="brain-game-stats"><span>Moves <strong>{moves}</strong></span><span>Pairs <strong>{matched.length / 2}/8</strong></span></div>
    <div className="memory-board">{values.map((value, index) => <button key={index} type="button" className={`memory-tile ${opened.includes(index) || matched.includes(index) ? 'revealed' : ''} ${matched.includes(index) ? 'matched' : ''}`} onClick={() => select(index)} aria-label={opened.includes(index) || matched.includes(index) ? value : 'Hidden card'}>{opened.includes(index) || matched.includes(index) ? value : '?'}</button>)}</div>
    {matched.length === values.length && <p className="brain-game-result" role="status">All pairs found in {moves} moves. Nice focus!</p>}
  </GamePanel>
}

function SequenceMemory() {
  const [sequence, setSequence] = useState(() => [randomInt(4)])
  const [active, setActive] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('Press Start to watch the sequence.')
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])
  const showSequence = (next) => {
    timers.current.forEach(window.clearTimeout)
    setPlaying(true); setProgress(0); setMessage('Watch carefully…')
    next.forEach((value, index) => {
      timers.current.push(window.setTimeout(() => setActive(value), 500 + index * 750))
      timers.current.push(window.setTimeout(() => setActive(null), 1000 + index * 750))
    })
    timers.current.push(window.setTimeout(() => { setPlaying(false); setMessage('Now repeat the sequence.') }, 1100 + next.length * 750))
  }
  const start = () => showSequence(sequence)
  const choose = (value) => {
    if (playing) return
    if (sequence[progress] !== value) {
      setMessage(`Not quite. You reached ${progress} ${progress === 1 ? 'step' : 'steps'}. Start again to retry.`)
      setSequence([randomInt(4)])
      setProgress(0)
      return
    }
    if (progress + 1 === sequence.length) {
      const next = [...sequence, randomInt(4)]
      setSequence(next); setProgress(0); showSequence(next)
      return
    }
    setProgress(progress + 1)
  }
  return <GamePanel><p className="brain-game-prompt">{message}</p><div className="sequence-board">{sequenceOptions.map((option, index) => <button key={option} type="button" className={active === index ? 'lit' : ''} disabled={playing} onClick={() => choose(index)} aria-label={`Sequence button ${index + 1}`}>{option}</button>)}</div><button className="brain-game-action" type="button" onClick={start} disabled={playing}>{sequence.length === 1 ? 'Start' : 'Replay sequence'}</button><p className="brain-game-stats">Sequence length <strong>{sequence.length}</strong></p></GamePanel>
}

function NumberMemory() {
  const [level, setLevel] = useState(2)
  const [number, setNumber] = useState(() => String(Math.floor(Math.random() * 90) + 10))
  const [visible, setVisible] = useState(false)
  const [answer, setAnswer] = useState('')
  const [message, setMessage] = useState('Press Start to memorize a number.')
  const reveal = () => { const next = String(Math.floor(10 ** (level - 1) + Math.random() * 9 * 10 ** (level - 1))); setNumber(next); setAnswer(''); setVisible(true); setMessage('Remember the number.'); window.setTimeout(() => { setVisible(false); setMessage('Type the number you saw.') }, 1800 + level * 250) }
  const submit = (event) => {
    event.preventDefault()
    if (answer === number) { setLevel((value) => value + 1); setMessage('Correct! Ready for a longer number?') }
    else { setLevel(2); setMessage(`The number was ${number}. Try again when ready.`) }
  }
  return <GamePanel><p className="brain-game-prompt">{message}</p><div className="number-display">{visible ? number : '••••••'}</div>{!visible && <form className="brain-game-answer" onSubmit={submit}><input inputMode="numeric" pattern="[0-9]*" value={answer} onChange={(event) => setAnswer(event.target.value)} aria-label="Your number guess" placeholder="Enter the number" /><button className="brain-game-action" type="submit" disabled={!answer}>Check</button></form>}<button className="brain-game-secondary" type="button" onClick={reveal} disabled={visible}>Start level {level}</button></GamePanel>
}

function Sudoku() {
  const [grid, setGrid] = useState(sudokuPuzzle)
  const [message, setMessage] = useState('')
  const update = (row, column, value) => {
    if (sudokuPuzzle[row][column]) return
    setGrid((current) => current.map((cells, rowIndex) => rowIndex === row ? cells.map((cell, colIndex) => colIndex === column ? Number(value) || 0 : cell) : cells))
  }
  const check = () => {
    const complete = grid.every((row, rowIndex) => row.every((value, column) => value === sudokuSolution[rowIndex][column]))
    setMessage(complete ? 'Puzzle solved! Great work.' : 'Some cells need another look.')
  }
  const reset = () => { setGrid(sudokuPuzzle); setMessage('') }
  return <GamePanel><p className="brain-game-prompt">Fill each row and column with 1–4, without repeating a number.</p><div className="sudoku-board">{grid.map((row, rowIndex) => row.map((value, column) => <select key={`${rowIndex}-${column}`} aria-label={`Row ${rowIndex + 1}, column ${column + 1}`} value={value || ''} disabled={Boolean(sudokuPuzzle[rowIndex][column])} onChange={(event) => update(rowIndex, column, event.target.value)}><option value=""></option>{[1, 2, 3, 4].map((number) => <option key={number}>{number}</option>)}</select>))}</div><div className="brain-game-buttons"><button className="brain-game-action" type="button" onClick={check}>Check answer</button><button className="brain-game-secondary" type="button" onClick={reset}>Reset</button></div>{message && <p className="brain-game-result" role="status">{message}</p>}</GamePanel>
}

function ChessPuzzle() {
  const [answer, setAnswer] = useState('')
  const [message, setMessage] = useState('')
  const choose = (move) => { setAnswer(move); setMessage(move === 'Nd7+' ? 'Correct! The knight checks the king and attacks the rook.' : 'Not this move. Look for a knight move that checks the king and attacks the rook.') }
  const pieces = { 1: '♜', 5: '♚', 28: '♞' }
  return <GamePanel><p className="brain-game-prompt">White to move. A knight on e5 can fork a king on f8 and rook on b8. Which move gives check and attacks the rook?</p><div className="chess-board" aria-label="Chess puzzle position">{Array.from({ length: 64 }, (_, square) => <span className={(Math.floor(square / 8) + square % 8) % 2 ? 'dark' : ''} key={square}>{pieces[square] || ''}</span>)}</div><div className="brain-game-buttons">{['Nc6+', 'Nd7+', 'Nf7+', 'Ng4+'].map((move) => <button key={move} type="button" className={answer === move ? 'selected' : 'brain-game-secondary'} onClick={() => choose(move)}>{move}</button>)}</div>{message && <p className="brain-game-result" role="status">{message}</p>}</GamePanel>
}

function SpotDifference() {
  const [odd, setOdd] = useState(() => randomInt(25))
  const [selected, setSelected] = useState(null)
  const correct = selected === odd
  const choose = (index) => setSelected(index)
  const nextBoard = () => { setOdd(randomInt(25)); setSelected(null) }
  return <GamePanel><p className="brain-game-prompt">Tap the one tile that is different from the rest.</p><div className="spot-board">{Array.from({ length: 25 }, (_, index) => <button key={index} type="button" disabled={correct} onClick={() => choose(index)} aria-label={`Tile ${index + 1}`}>{index === odd ? '◆' : '●'}</button>)}</div>{selected !== null && <p className="brain-game-result" role="status">{correct ? 'Found it!' : 'That tile matches. Keep looking.'}</p>}{correct && <button className="brain-game-action" type="button" onClick={nextBoard}>Next pattern</button>}</GamePanel>
}

function ReactionTest() {
  const [phase, setPhase] = useState('ready')
  const [result, setResult] = useState('')
  const startedAt = useRef(0)
  const timeout = useRef(null)
  useEffect(() => () => window.clearTimeout(timeout.current), [])
  const start = () => {
    window.clearTimeout(timeout.current); setResult(''); setPhase('waiting')
    timeout.current = window.setTimeout(() => { startedAt.current = performance.now(); setPhase('go') }, 1200 + Math.random() * 2600)
  }
  const click = () => {
    if (phase === 'waiting') { window.clearTimeout(timeout.current); setPhase('ready'); setResult('Too soon! Wait for the green signal, then click.'); return }
    if (phase === 'go') { setResult(`${Math.round(performance.now() - startedAt.current)} ms`); setPhase('result') }
  }
  return <GamePanel><p className="brain-game-prompt">{phase === 'waiting' ? 'Wait for green…' : phase === 'go' ? 'Click now!' : 'Test your reaction. Click when the color changes.'}</p><button type="button" className={`reaction-zone ${phase}`} onClick={() => phase === 'ready' ? start() : click()} disabled={phase === 'result'}>{phase === 'waiting' ? 'Wait' : phase === 'go' ? 'CLICK!' : phase === 'result' ? result : 'Start test'}</button>{phase === 'result' && <button className="brain-game-secondary" type="button" onClick={start}>Try again</button>}{result && phase !== 'result' && <p role="status" className="brain-game-result">{result}</p>}</GamePanel>
}

function PatternRecognition() {
  const [round, setRound] = useState(0)
  const [message, setMessage] = useState('')
  const puzzle = patterns[round % patterns.length]
  const choose = (value) => {
    if (value === puzzle.answer) { setMessage('Correct pattern! Here is another.'); setRound((current) => current + 1) }
    else setMessage(`Try again. Hint: ${puzzle.hint}`)
  }
  return <GamePanel><p className="brain-game-prompt">What number comes next?</p><div className="pattern-sequence">{puzzle.sequence.map((number) => <span key={number}>{number}</span>)}<b>?</b></div><div className="brain-game-buttons">{puzzle.choices.map((choice) => <button key={choice} type="button" className="brain-game-secondary" onClick={() => choose(choice)}>{choice}</button>)}</div>{message && <p className="brain-game-result" role="status">{message}</p>}</GamePanel>
}
