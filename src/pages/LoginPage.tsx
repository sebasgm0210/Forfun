import { FormEvent, useState } from "react"
import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react"

import { CasaLunaLogo } from "@/components/brand/casa-luna-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, extractApiToken, getApiErrorMessage, setApiToken } from "@/lib/api"
import {
  clearStoredSession,
  createSessionUserFromLogin,
  sessionUserNeedsMenuCatalog,
  setSessionUser,
  type SessionUser,
} from "@/lib/auth"

type LoginPageProps = {
  onLogin: (user: SessionUser) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("admin")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)
    clearStoredSession()

    try {
      const session = await api.users.login({
        username: username.trim(),
        password,
      })
      const token = extractApiToken(session)
      if (!token) {
        throw new Error("El servidor no devolvio token de sesion.")
      }
      setApiToken(token)

      let sessionUser = createSessionUserFromLogin(session, username.trim())
      if (token && sessionUserNeedsMenuCatalog(sessionUser)) {
        const [menuCatalogResult, roleMenusResult] = await Promise.allSettled([
          api.menuRoles.listMenus(),
          sessionUser.roleId
            ? api.menu.getMenusByRole({ id_rol: sessionUser.roleId })
            : Promise.resolve(undefined),
        ])

        sessionUser = createSessionUserFromLogin(session, username.trim(), {
          menuCatalog: menuCatalogResult.status === "fulfilled" ? menuCatalogResult.value : undefined,
          roleMenus: roleMenusResult.status === "fulfilled" ? roleMenusResult.value : undefined,
        })
      }

      setSessionUser(sessionUser)
      window.localStorage.setItem("casa-luna-session", token)
      onLogin(sessionUser)
      return
    } catch (error) {
      clearStoredSession()
      setApiToken(null)
      setError(
        getApiErrorMessage(
          error,
          "Usuario o contrasena incorrectos. Revisa los datos e intenta de nuevo.",
        ),
      )
    } finally {
      setIsSubmitting(false)
    }

  }

  return (
    <main className="min-h-screen bg-sidebar text-sidebar-foreground">
      <div className="grid min-h-screen 2xl:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(135deg, oklch(0.7 0.14 55 / 0.45), transparent 42%), radial-gradient(circle at 18% 18%, oklch(0.985 0.008 75 / 0.32), transparent 28%)",
            }}
          />
          <div className="relative">
            <CasaLunaLogo variant="horizontal" tone="light" />
          </div>

          <div className="relative max-w-xl">
            <p className="text-xs uppercase tracking-[0.34em] text-sidebar-primary">
              Panel administrativo
            </p>
            <h1 className="mt-5 font-serif text-5xl font-light leading-tight">
              Operación completa del hotel en un solo lugar.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-sidebar-foreground/75">
              Acceso principal para gerencia: recepción, habitaciones, inventarios,
              facturación, reportes y configuración.
            </p>
          </div>

          <div className="relative grid max-w-xl grid-cols-3 gap-3 text-sm">
            {["Recepción", "Inventarios", "Reportes"].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-sidebar-border bg-sidebar-accent/45 p-3"
              >
                <p className="font-medium">{item}</p>
                <p className="mt-1 text-xs text-sidebar-foreground/55">Admin</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <CasaLunaLogo variant="stacked" tone="dark" />
            </div>

            <div className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
              <div className="mb-7">
                <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3 text-primary">
                  <ShieldCheck className="size-6" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Iniciar sesión
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Ingresa con el usuario administrador para acceder a todas las
                  funciones del sistema.
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Usuario</span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value)
                        setError("")
                      }}
                      className="h-11 rounded-2xl pl-10"
                      autoComplete="username"
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Contraseña</span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setError("")
                      }}
                      className="h-11 rounded-2xl pl-10 pr-11"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label={
                        showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </label>

                {error ? (
                  <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="h-11 w-full rounded-2xl"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Validando..." : "Entrar al sistema"}
                </Button>
              </form>

              <div className="mt-5 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">
                Usa las credenciales asignadas por administracion. La sesion se valida contra el servidor.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default LoginPage
