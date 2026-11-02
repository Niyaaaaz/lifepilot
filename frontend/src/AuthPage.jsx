import { useState } from 'react'
import './AuthPage.css'
import { useAuth } from './AuthState'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function EyeIcon({ visible }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.8 4.5 9.5 6-.3.7-1.4 2.4-3.5 3.9M6.2 6.2C3.9 7.7 2.5 10 2.5 11c.7 1.5 4.3 6 9.5 6 1.1 0 2.1-.2 3-.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

function PasswordField({ id, label, value, onChange, error, autoComplete }) {
  const [visible, setVisible] = useState(false)
  const errorId = `${id}-error`

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className={`auth-input-wrap ${error ? 'has-error' : ''}`}>
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          required
        />
        <button
          className="auth-password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        >
          <EyeIcon visible={visible} />
        </button>
      </div>
      {error && <span className="auth-error" id={errorId}>{error}</span>}
    </div>
  )
}

export default function AuthPage({ initialMode, initialError = '' }) {
  const isSignup = initialMode === 'signup'
  const [forgotPassword, setForgotPassword] = useState(false)
  const [values, setValues] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(initialError)
  const [noticeType, setNoticeType] = useState(initialError ? 'error' : 'success')
  const [submitting, setSubmitting] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const { signup, login } = useAuth()

  const update = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: '' }))
    setNotice('')
    setNoticeType('success')
  }

  const navigate = (destination) => {
    window.location.hash = destination
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    const email = values.email.trim()

    if (!emailPattern.test(email)) nextErrors.email = 'Enter a valid email address.'

    if (forgotPassword) {
      setErrors(nextErrors)
      if (!Object.keys(nextErrors).length) {
        setNotice('Password reset is not available yet. Contact support if you cannot access your account.')
        setNoticeType('error')
      }
      return
    }

    if (isSignup && values.name.trim().length < 2) nextErrors.name = 'Enter your full name.'
    if (!values.password) nextErrors.password = 'Enter your password.'
    else if (isSignup && values.password.length < 12) nextErrors.password = 'Use at least 12 characters.'
    else if (isSignup && (!/[A-Za-z]/.test(values.password) || !/\d/.test(values.password))) {
      nextErrors.password = 'Include at least one letter and one number.'
    }
    if (isSignup && values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    setSubmitting(true)
    setNotice('')
    try {
      if (isSignup) await signup({ name: values.name.trim(), email, password: values.password })
      else await login({ email, password: values.password, rememberMe })
      setNotice(isSignup ? 'Your account is ready. Taking you to your plan…' : 'You’re signed in. Welcome back.')
      setNoticeType('success')
      window.setTimeout(() => navigate('daily'), 400)
    } catch (error) {
      setNotice(error.message || 'Authentication failed. Please try again.')
      setNoticeType('error')
    } finally {
      setSubmitting(false)
    }
  }

  const switchToForgot = () => {
    setForgotPassword(true)
    setErrors({})
    setNotice('')
    setNoticeType('success')
  }

  const switchToLogin = () => {
    setForgotPassword(false)
    setErrors({})
    setNotice('')
    setNoticeType('success')
  }

  return (
    <main className="auth-page">
      <section className="auth-promo" aria-label="LifePilot introduction">
        <a className="auth-brand" href="#landing" aria-label="LifePilot home">
          <span className="auth-brand-mark">↗</span>
          <span>Life<span>Pilot</span></span>
        </a>
        <div className="auth-promo-content">
          <span className="auth-eyebrow"><i /> YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>{isSignup ? <>Make space for<br /><em>what matters.</em></> : <>Welcome back<br /><em>to your journey.</em></>}</h1>
          <p>Small steps, steady progress. LifePilot helps you turn the life you imagine into the one you live.</p>
          <div className="auth-promo-note">
            <span className="auth-note-icon">✦</span>
            <span><strong>One clear step at a time.</strong><small>Your goals. Your pace. Your life.</small></span>
          </div>
        </div>
        <div className="auth-orbit auth-orbit-one" />
        <div className="auth-orbit auth-orbit-two" />
        <div className="auth-promo-footer"><span>✦</span> A little progress, every day.</div>
      </section>

      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <a className="auth-brand" href="#landing" aria-label="LifePilot home">
            <span className="auth-brand-mark">↗</span>
            <span>Life<span>Pilot</span></span>
          </a>
          <span>YOUR NEXT CHAPTER</span>
        </div>

        <div className="auth-form-card" key={`${initialMode}-${forgotPassword ? 'forgot' : 'form'}`}>
          <div className="auth-form-heading">
            <span className="auth-eyebrow">{forgotPassword ? 'ACCOUNT RECOVERY' : isSignup ? 'START YOUR JOURNEY' : 'WELCOME BACK'}</span>
            <h2>{forgotPassword ? 'Reset your password' : isSignup ? 'Create your account' : 'Sign in to LifePilot'}</h2>
            <p>{forgotPassword
              ? 'Enter the email address associated with your account.'
              : isSignup
                ? 'A little progress starts with a first step.'
                : 'Pick up where you left off.'}</p>
          </div>

          <form onSubmit={submit} noValidate>
            {isSignup && !forgotPassword && (
              <div className="auth-field">
                <label htmlFor="auth-name">Full name</label>
                <input
                  className={errors.name ? 'has-error' : ''}
                  id="auth-name"
                  name="name"
                  type="text"
                  value={values.name}
                  onChange={update('name')}
                  autoComplete="name"
                  placeholder="e.g. Alex Morgan"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'auth-name-error' : undefined}
                  required
                />
                {errors.name && <span className="auth-error" id="auth-name-error">{errors.name}</span>}
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">Email address</label>
              <input
                className={errors.email ? 'has-error' : ''}
                id="auth-email"
                name="email"
                type="email"
                value={values.email}
                onChange={update('email')}
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'auth-email-error' : undefined}
                required
              />
              {errors.email && <span className="auth-error" id="auth-email-error">{errors.email}</span>}
            </div>

            {!forgotPassword && (
              <PasswordField
                id="auth-password"
                label="Password"
                value={values.password}
                onChange={update('password')}
                error={errors.password}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            )}

            {isSignup && !forgotPassword && (
              <PasswordField
                id="auth-confirm-password"
                label="Confirm password"
                value={values.confirmPassword}
                onChange={update('confirmPassword')}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />
            )}

            {!isSignup && !forgotPassword && (
              <div className="auth-form-options">
                <label className="auth-remember"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> <span>Remember me</span></label>
                <button type="button" className="auth-text-button" onClick={switchToForgot}>Forgot password?</button>
              </div>
            )}

            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : forgotPassword ? 'Continue' : isSignup ? 'Create Account' : 'Log In'} {!submitting && <span>↗</span>}
            </button>

            {notice && <p className={`auth-notice ${noticeType}`} role={noticeType === 'error' ? 'alert' : 'status'}>{notice}</p>}
          </form>

          {forgotPassword ? (
            <p className="auth-switch"><button type="button" className="auth-text-button" onClick={switchToLogin}>← Back to log in</button></p>
          ) : (
            <p className="auth-switch">
              {isSignup ? 'Already have an account?' : 'New to LifePilot?'}{' '}
              <button type="button" className="auth-text-button" onClick={() => navigate(isSignup ? 'login' : 'signup')}>
                {isSignup ? 'Log in' : 'Create an account'}
              </button>
            </p>
          )}
          <p className="auth-terms">By continuing, you agree to LifePilot’s <span>Terms</span> and <span>Privacy Policy</span>.</p>
        </div>
        <div className="auth-panel-footer">© 2026 LifePilot <span>•</span> Built for your next step</div>
      </section>
    </main>
  )
}
