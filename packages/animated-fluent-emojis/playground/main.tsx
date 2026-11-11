import {
  StrictMode,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'

import { configureEmojis } from '../src/index.js'
import type { SkinTone } from '../src/index.js'
import { Emoji } from '../src/react/index.js'

const rootElement = document.querySelector('#root')

if (!rootElement) {
  throw new Error('Root element #root not found')
}

const DEFAULT_SITE_URL = 'https://animated-fluent-emojis-cdn.andryore.dev'
const BAD_SITE_URL = 'https://invalid.example.invalid'
const SKIN_TONES: SkinTone[] = [
  'default',
  'light',
  'medium-light',
  'medium',
  'medium-dark',
  'dark',
]
const FALLBACK_OPTIONS = ['glyph', 'node', 'null'] as const
const SIZE_OPTIONS = ['96', '6rem', '10vw', 'var(--emoji-size)'] as const

type FallbackOption = (typeof FALLBACK_OPTIONS)[number]
type PlayingOption = 'auto' | 'true' | 'false'

const toFallback = (option: FallbackOption): ReactNode => {
  if (option === 'node') return <strong>fallback node</strong>
  return option === 'null' ? null : undefined
}

const toPlaying = (option: PlayingOption): { playing?: boolean } =>
  option === 'auto' ? {} : { playing: option === 'true' }

const toSize = (option: string): number | string =>
  /^\d+$/.test(option) ? Number(option) : option

function Choice<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: Value
  options: readonly Value[]
  onChange: (value: Value) => void
}): ReactElement {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      {label}
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value as Value)
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function Playground(): ReactElement {
  const [unknownId, setUnknownId] = useState(false)
  const [fallback, setFallback] = useState<FallbackOption>('glyph')
  const [skinTone, setSkinTone] = useState<SkinTone>('default')
  const [playing, setPlaying] = useState<PlayingOption>('auto')
  const [size, setSize] = useState<string>('96')
  const [badSite, setBadSite] = useState(false)
  const [runKey, setRunKey] = useState(0)
  const [endedRuns, setEndedRuns] = useState(0)

  const toggleBadSite = (enabled: boolean): void => {
    setBadSite(enabled)
    configureEmojis({
      assetSiteUrl: enabled ? BAD_SITE_URL : DEFAULT_SITE_URL,
    })
  }

  return (
    <main style={{ display: 'grid', gap: 24, padding: 24 }}>
      <section
        style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}
        aria-label="Controls"
      >
        <label style={{ display: 'grid', gap: 4 }}>
          unknown id
          <input
            type="checkbox"
            checked={unknownId}
            onChange={(event) => {
              setUnknownId(event.target.checked)
            }}
          />
        </label>
        <Choice
          label="fallback"
          value={fallback}
          options={FALLBACK_OPTIONS}
          onChange={setFallback}
        />
        <Choice
          label="skinTone"
          value={skinTone}
          options={SKIN_TONES}
          onChange={setSkinTone}
        />
        <Choice
          label="playing"
          value={playing}
          options={['auto', 'true', 'false'] as const}
          onChange={setPlaying}
        />
        <Choice
          label="size"
          value={size}
          options={SIZE_OPTIONS}
          onChange={setSize}
        />
        <label style={{ display: 'grid', gap: 4 }}>
          bad site URL (configureEmojis)
          <input
            type="checkbox"
            checked={badSite}
            onChange={(event) => {
              toggleBadSite(event.target.checked)
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setRunKey((current) => current + 1)
          }}
        >
          replay (new key)
        </button>
        <output>finite runs ended: {endedRuns}</output>
      </section>
      <p>
        Reduced motion: in Chromium DevTools open Rendering, then Emulate CSS
        media feature prefers-reduced-motion. Playwright: emulateMedia with
        reducedMotion reduce. Set playing to true to see it override.
      </p>
      <section
        style={
          {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 24,
            '--emoji-size': '72px',
          } as CSSProperties
        }
      >
        <Emoji id="1f603_grinningfacewithbigeyes" size={96} />
        <Emoji id="1f44b_wavinghand" size={96} playOnHover skinTone="medium" />
        <Emoji id="launch" size={96} animationIterations="infinite" />
        <Emoji
          key={runKey}
          id={unknownId ? 'not-a-real-emoji' : '1f44b_wavinghand'}
          size={toSize(size)}
          skinTone={skinTone}
          fallback={toFallback(fallback)}
          {...toPlaying(playing)}
          onPlaybackEnd={() => {
            setEndedRuns((current) => current + 1)
          }}
        />
      </section>
    </main>
  )
}

createRoot(rootElement).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
)
