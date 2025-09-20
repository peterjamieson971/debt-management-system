import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Shield, Brain, Mail, FileText, Settings, Database, Users, BarChart3, Key } from 'lucide-react'

// TODO: In production, this should check actual user role from session
function checkAdminAccess() {
  // For now, return true. In production, verify JWT and check role
  return true
}

const adminNavItems = [
  {
    name: 'Overview',
    href: '/admin',
    icon: BarChart3,
    description: 'System overview and health'
  },
  {
    name: 'AI Configuration',
    href: '/admin/ai',
    icon: Brain,
    description: 'AI models, costs, and routing'
  },
  {
    name: 'Email Settings',
    href: '/admin/email',
    icon: Mail,
    description: 'Gmail integration and email settings'
  },
  {
    name: 'Prompt Templates',
    href: '/admin/prompts',
    icon: FileText,
    description: 'Manage AI prompt templates'
  },
  {
    name: 'Environment',
    href: '/admin/environment',
    icon: Key,
    description: 'Environment variables and secrets'
  },
  {
    name: 'User Management',
    href: '/admin/users',
    icon: Users,
    description: 'Manage users and roles'
  },
  {
    name: 'System Settings',
    href: '/admin/system',
    icon: Settings,
    description: 'General system configuration'
  },
  {
    name: 'Database',
    href: '/admin/database',
    icon: Database,
    description: 'Database management and backups'
  }
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const hasAccess = checkAdminAccess()

  if (!hasAccess) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-red-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">System Administration</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Back to Dashboard
              </Link>
              <div className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                Admin Mode
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Admin Sidebar */}
          <nav className="w-64 bg-white rounded-lg shadow-sm border border-gray-200 h-fit">
            <div className="p-6">
              <h2 className="text-sm font-medium text-gray-900 mb-4">Administration</h2>
              <ul className="space-y-2">
                {adminNavItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="flex items-center p-3 text-sm text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900 group"
                      >
                        <Icon className="h-5 w-5 mr-3 text-gray-400 group-hover:text-gray-500" />
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.description}</div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}