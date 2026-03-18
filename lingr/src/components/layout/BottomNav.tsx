'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface BottomNavProps {
  active?: 'chat' | 'vocab' | 'profile'
}

const navItems = [
  {
    key: 'chat',
    href: '/chat',
    label: 'Chat',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    key: 'vocab',
    href: '/vocab',
    label: 'Notebook',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
      </svg>
    ),
  },
  {
    key: 'profile',
    href: '/profile',
    label: 'Partner',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export function BottomNav({ active }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className="safe-bottom"
      style={{
        background: 'rgba(245, 240, 235, 0.97)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex">
        {navItems.map((item) => {
          const isActive = active === item.key || pathname === item.href
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
              style={{
                color: isActive ? '#1A1A1A' : '#AAAAAA',
              }}
            >
              {item.icon(isActive)}
              <span
                className="text-[10px] font-inter"
                style={{
                  fontWeight: isActive ? 500 : 400,
                  letterSpacing: '0.02em',
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
