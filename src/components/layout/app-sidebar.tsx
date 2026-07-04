"use client"

import { Link } from "react-router-dom"
import { useLocation } from "react-router-dom"
import { useState } from "react"
import { LogOut } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CasaLunaLogo } from "@/components/brand/casa-luna-logo"
import { CasaLunaMark } from "@/components/brand/casa-luna-mark"
import { navigation } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import {
  DEFAULT_ADMIN_SESSION,
  filterNavigationForUser,
  getUserInitials,
  getUserRoleLabel,
  type SessionUser,
} from "@/lib/auth"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function AppSidebar({
  currentUser,
  onLogout,
}: {
  currentUser: SessionUser | null
  onLogout: () => void
}) {
  const { pathname } = useLocation()
  const { state } = useSidebar()
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const isCollapsed = state === "collapsed"
  const user = currentUser ?? DEFAULT_ADMIN_SESSION
  const visibleNavigation = filterNavigationForUser(navigation, user)

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      {/* Marca */}
      <SidebarHeader className="border-b border-sidebar-border/60">
        <div
          className={cn(
            "relative flex items-center px-2 py-3",
            isCollapsed ? "justify-center" : "justify-start",
          )}
        >
          {/* Halo decorativo sutil */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, oklch(1 0 0) 0, transparent 60%)",
            }}
          />
          {isCollapsed ? (
            <CasaLunaMark className="size-8 text-sidebar-primary" strokeWidth={1.4} />
          ) : (
            <CasaLunaLogo variant="horizontal" tone="light" />
          )}
          <SidebarTrigger
            aria-label="Contraer menú lateral"
            className="absolute right-2 top-3 hidden size-8 rounded-full border border-sidebar-border/70 bg-sidebar-accent/40 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-primary md:inline-flex"
          />
        </div>
        {!isCollapsed && (
          <div className="px-3 pb-2">
            <p className="text-[0.6rem] tracking-[0.3em] uppercase text-sidebar-foreground/50">
              Operations Suite
            </p>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {visibleNavigation.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-[0.6rem] tracking-[0.28em] uppercase text-sidebar-foreground/45">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`)
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className={cn(
                          "group/menu transition-colors",
                          "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary",
                          "data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1/2 data-[active=true]:before:h-5 data-[active=true]:before:w-0.5 data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-r-full data-[active=true]:before:bg-sidebar-primary",
                          "relative",
                        )}
                      >
                        <Link to={item.href}>
                          <Icon className="size-4" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <div
          className={cn(
            "flex items-center gap-3 px-2 py-2",
            isCollapsed && "justify-center",
          )}
        >
          <Avatar className="size-8 border border-sidebar-border">
            <AvatarFallback className="bg-sidebar-primary/15 text-sidebar-primary text-xs font-semibold">
              {getUserInitials(user)}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {user.name}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/60">
                  {getUserRoleLabel(user)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar sesión"
                onClick={() => setLogoutDialogOpen(true)}
                className="rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
              >
                <LogOut className="size-4" />
              </button>
            </>
          )}
        </div>
      </SidebarFooter>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Seguro que quieres cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrará tu sesión actual y volverás a la pantalla de inicio de sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onLogout}
            >
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SidebarRail />
    </Sidebar>
  )
}
