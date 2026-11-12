import { useState } from 'react'

// Campo de contraseña del login, de "Olvidó su contraseña" y de restablecer:
// oculta lo escrito (como secureTextEntry) y tiene el ojito para mostrarlo.
// Sin corrector ni mayúsculas automáticas, y un máximo razonable de caracteres.
export default function CampoContrasena({
  id,
  value,
  onChange,
  onBlur,
  autoComplete = 'current-password',
  enterKeyHint,
  placeholder = '••••••••',
  error = '',
  descripcion,
  autoFocus = false,
}) {
  const [ver, setVer] = useState(false)
  const idError = `${id}-error`
  return (
    <>
      <div className={`login__field${error ? ' login__field--error' : ''}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <input
          id={id}
          type={ver ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={enterKeyHint}
          maxLength={128}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={[error && idError, descripcion].filter(Boolean).join(' ') || undefined}
        />
        <button
          type="button"
          className="login__eye"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={ver}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {ver && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
      {error && (
        <p id={idError} className="login__ayuda login__ayuda--error">
          {error}
        </p>
      )}
    </>
  )
}
