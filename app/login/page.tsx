"use client";

import { useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { AlertCircle, Eye, EyeOff, Loader } from "@/components/icons";

/**
 * Sign-in screen, matching the ETI admin console (eti_frontend): brand panel on
 * the left over the site's own footage, credentials on the right.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during login");
      setLoading(false);
    }
  }

  return (
    <div className="login-split">
      {/* Brand panel — hidden on small screens where it would only push the
          form down the page. */}
      <div className="login-brand">
        <video
          className="login-brand-video"
          src="/images/assets/eti-home.mp4"
          poster="/images/assets/home-video.jpg"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="login-brand-wash" aria-hidden="true" />
        <div className="login-brand-fade" aria-hidden="true" />

        <div className="login-brand-lockup">
          {/* light variant, straight on the navy — the mark already carries
              the wordmark, so no separate caption beside it */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ETI_logo_lt.svg" alt="Electrical Training Institute" />
        </div>

        <div className="login-brand-copy">
          <h2>Every word on the website, in one place.</h2>
          <p>
            The pages are built and styled for you. This is where the words, the
            photographs and the video that fill them are decided.
          </p>

          <div className="login-brand-rule" />
          <ul className="login-brand-list">
            <li>Edit any page&apos;s text and headings</li>
            <li>Swap images and video from the library</li>
            <li>Publish and see it live in seconds</li>
          </ul>
        </div>
      </div>

      {/* Form panel */}
      <div className="login-form-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          {/* Compact lockup for small screens — the light panel needs no white
              plate behind the logo. */}
          <div className="login-form-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ETI_logo.svg" alt="Electrical Training Institute" />
          </div>

          <h1>Sign in</h1>
          <p className="sub">Enter your credentials to manage the website.</p>

          {error ? (
            <div role="alert" className="login-alert">
              <AlertCircle />
              <p style={{ margin: 0 }}>{error}</p>
            </div>
          ) : null}

          <div className="login-fields">
            <div>
              <label htmlFor="username" className="eti-label">
                Email address or username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@sdett.org"
                autoFocus
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="eti-label">
                Password
              </label>
              <div className="login-password">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="login-reveal"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader className="spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </div>

          <p className="login-foot">Trouble signing in? Contact your administrator.</p>
        </form>
      </div>
    </div>
  );
}
