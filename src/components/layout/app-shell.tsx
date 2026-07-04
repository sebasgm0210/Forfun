import type { ReactNode } from "react"

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import type { SessionUser } from "@/lib/auth"
import { AppSidebar } from "./app-sidebar"
import { AppHeader } from "./app-header"

export function AppShell({
  children,
  currentUser,
  onLogout,
}: {
  children: ReactNode
  currentUser: SessionUser | null
  onLogout: () => void
}) {
  return (
    <SidebarProvider>
      <AppSidebar currentUser={currentUser} onLogout={onLogout} />
      <SidebarInset className="min-w-0 bg-background">
        <AppHeader currentUser={currentUser} onLogout={onLogout} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div
            className="mx-auto min-w-0 w-full max-w-[1600px] px-3 py-5 sm:px-4 md:px-8 md:py-8"
            data-view-export-root
          >
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
