import { useEffect, useState } from "react"
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom"

import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/sonner"
import {
  canAccessPath,
  clearStoredSession,
  getDefaultPath,
  getSessionUser,
  hasValidStoredSession,
  sessionUserFromAppUser,
  setSessionUser,
  type SessionUser,
} from "@/lib/auth"
import { StoreProvider, useStore } from "@/lib/store"
import { API_AUTH_EXPIRED_EVENT } from "@/lib/api"
import { appRoutes } from "@/routes"
import DesayunoQrPage from "@/pages/DesayunoQrPage"
import LoginPage from "@/pages/LoginPage"

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => hasValidStoredSession(),
  )
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(() => getSessionUser())

  function handleLogin(user: SessionUser) {
    setCurrentUser(user)
    setIsAuthenticated(true)
  }

  function handleLogout() {
    clearStoredSession()
    setCurrentUser(null)
    setIsAuthenticated(false)
  }

  function handleSessionUserResolved(user: SessionUser) {
    setSessionUser(user)
    setCurrentUser(user)
  }

  const defaultPath = getDefaultPath(currentUser)
  const isBreakfastQrRoute = window.location.pathname.startsWith("/desayunos/qr/")

  useEffect(() => {
    if (isBreakfastQrRoute || !isAuthenticated) return

    const verifySession = () => {
      if (hasValidStoredSession()) return
      setCurrentUser(null)
      setIsAuthenticated(false)
    }

    verifySession()
    const intervalId = window.setInterval(verifySession, 60_000)
    window.addEventListener("focus", verifySession)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", verifySession)
    }
  }, [isAuthenticated, isBreakfastQrRoute])

  useEffect(() => {
    if (isBreakfastQrRoute) return

    const handleAuthExpired = () => {
      clearStoredSession()
      setCurrentUser(null)
      setIsAuthenticated(false)
    }

    window.addEventListener(API_AUTH_EXPIRED_EVENT, handleAuthExpired)
    return () => {
      window.removeEventListener(API_AUTH_EXPIRED_EVENT, handleAuthExpired)
    }
  }, [isBreakfastQrRoute])

  return (
    <StoreProvider apiEnabled={isAuthenticated}>
      {isBreakfastQrRoute ? (
        <>
          <Toaster richColors position="bottom-right" duration={3200} />
          <Routes>
            <Route path="/desayunos/qr/:qrCode" element={<DesayunoQrPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </>
      ) : isAuthenticated && currentUser ? (
        <SessionUserHydrator
          currentUser={currentUser}
          onResolve={handleSessionUserResolved}
        />
      ) : null}
      {!isBreakfastQrRoute ? <Toaster richColors position="bottom-right" duration={3200} /> : null}
      {!isBreakfastQrRoute ? (
        isAuthenticated ? (
          <AppShell currentUser={currentUser} onLogout={handleLogout}>
            <Routes>
              <Route path="/" element={<Navigate to={defaultPath} replace />} />
              <Route path="/facturacion" element={<Navigate to="/administracion/facturacion" replace />} />
              {appRoutes.map(({ path, component: Component }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    canAccessPath(currentUser, path) ? (
                      <Component />
                    ) : (
                      <AccessDeniedPage currentUser={currentUser} defaultPath={defaultPath} />
                    )
                  }
                />
              ))}
              <Route
                path="*"
                element={<AccessDeniedPage currentUser={currentUser} defaultPath={defaultPath} unknownRoute />}
              />
            </Routes>
          </AppShell>
        ) : (
          <Routes>
            <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
          </Routes>
        )
      ) : null}
    </StoreProvider>
  )
}

function AccessDeniedPage({
  currentUser,
  defaultPath,
  unknownRoute = false,
}: {
  currentUser: SessionUser | null
  defaultPath: string
  unknownRoute?: boolean
}) {
  const location = useLocation()
  const canReturnHome = canAccessPath(currentUser, defaultPath)

  return (
    <section className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center">
      <div className="w-full rounded-3xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
          Acceso restringido
        </p>
        <h1 className="mt-3 font-serif text-3xl font-light tracking-tight">
          No tienes acceso a esta vista
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
          Tu rol no tiene permiso para abrir esta ruta. Si necesitas usar esta pantalla,
          pide que actualicen los menus permitidos de tu rol en el backend.
        </p>
        <code className="mt-4 inline-flex max-w-full rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {unknownRoute ? "Ruta no registrada: " : "Ruta bloqueada: "}
          {location.pathname}
        </code>
        {canReturnHome ? (
          <div className="mt-6">
            <Link
              to={defaultPath}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Ir a mi inicio
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SessionUserHydrator({
  currentUser,
  onResolve,
}: {
  currentUser: SessionUser
  onResolve: (user: SessionUser) => void
}) {
  const { users } = useStore()

  useEffect(() => {
    if (currentUser.accessMode === "backend") return

    const match = users.find(
      (user) =>
        user.status === "activo" &&
        ((currentUser.email && user.email === currentUser.email) ||
          user.id === currentUser.id ||
          user.email === currentUser.id),
    )

    if (!match) return

    const nextUser = sessionUserFromAppUser(match)
    if (
      nextUser.id !== currentUser.id ||
      nextUser.role !== currentUser.role ||
      nextUser.name !== currentUser.name ||
      nextUser.permissions.join("|") !== currentUser.permissions.join("|")
    ) {
      onResolve(nextUser)
    }
  }, [currentUser, onResolve, users])

  return null
}
