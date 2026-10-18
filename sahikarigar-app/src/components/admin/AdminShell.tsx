'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  LogOut,
  ShieldCheck,
  Users,
  UserCheck,
  ClipboardList,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { adminLogout } from '@/lib/api';

const NAV_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/approvals', label: 'Worker Verification', icon: UserCheck },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/hires', label: 'Hire Requests', icon: ClipboardList },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false,
  );
  const email = typeof window !== 'undefined' ? localStorage.getItem('admin_email') : null;

  const isActive = (href: string) =>
    href === '/admin' ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 z-50 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 border-b border-gray-200 flex items-center gap-2">
          <ShieldCheck size={24} className="text-primary-dark" />
          <span className="text-xl font-bold text-text-primary tracking-tight">SahiAdmin</span>
        </div>
        <nav className="p-3 space-y-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setSidebarOpen(false);
                }
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-small font-medium transition-colors ${
                isActive(href)
                  ? 'bg-green-50 text-green-700 border-r-3 border-green-600'
                  : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 mt-auto">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              adminLogout();
              if (typeof window !== 'undefined') {
                localStorage.removeItem('admin_token');
                localStorage.removeItem('admin_email');
              }
              window.location.href = '/admin';
            }}
          >
            <LogOut size={16} className="mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content area */}
      <div className={`flex-1 overflow-hidden transition-all duration-300 ${sidebarOpen ? 'pl-64' : ''}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-2 text-text-secondary hover:bg-gray-100 rounded-lg md:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <ShieldCheck size={20} className="text-primary-dark" />
              <span className="ml-1 text-sm font-semibold text-text-primary">Admin Panel</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="relative p-2 text-text-secondary hover:text-text-primary"
                aria-label="Notifications"
              >
                <Bell size={20} />
                <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border border-white"></span>
              </button>
              {email ? (
                <div className="hidden md:flex items-center gap-2 pl-3 border-l border-gray-300">
                  <span className="text-sm text-text-secondary">Signed in as</span>
                  <span className="text-sm font-medium text-text-primary capitalize">{email}</span>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
