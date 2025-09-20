'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ApiError, useErrorHandler } from '@/components/ui/ErrorBoundary'
import { PageLoading, TableSkeleton, ButtonLoading } from '@/components/ui/LoadingStates'
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Shield,
  UserCheck,
  UserX,
  MoreHorizontal,
  Mail,
  Phone,
  Calendar
} from 'lucide-react'

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'manager' | 'collector' | 'viewer'
  status: 'active' | 'inactive' | 'pending'
  organization_id: string
  job_title?: string
  phone?: string
  last_login?: string
  created_at: string
  updated_at: string
}

interface UserStats {
  total_users: number
  active_users: number
  admin_users: number
  pending_invites: number
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { error, resetError, handleError } = useErrorHandler()

  // Mock organization ID - in production, get from auth context
  const organizationId = '550e8400-e29b-41d4-a716-446655440000'

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      resetError()

      const response = await fetch(`/api/admin/users?organization_id=${organizationId}`, {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setStats(data.stats)
      } else if (response.status === 500 || response.status === 404) {
        // Handle API errors gracefully by showing mock data
        console.warn('API endpoint not available, using mock data')
        setUsers([
          {
            id: '1',
            email: 'admin@company.com',
            first_name: 'Admin',
            last_name: 'User',
            role: 'admin',
            status: 'active',
            organization_id: organizationId,
            job_title: 'System Administrator',
            phone: '+971 50 123 4567',
            last_login: '2024-09-20T10:30:00Z',
            created_at: '2024-01-15T08:00:00Z',
            updated_at: '2024-09-20T10:30:00Z'
          },
          {
            id: '2',
            email: 'manager@company.com',
            first_name: 'Sarah',
            last_name: 'Johnson',
            role: 'manager',
            status: 'active',
            organization_id: organizationId,
            job_title: 'Collections Manager',
            phone: '+971 50 234 5678',
            last_login: '2024-09-19T16:45:00Z',
            created_at: '2024-02-01T09:30:00Z',
            updated_at: '2024-09-19T16:45:00Z'
          },
          {
            id: '3',
            email: 'collector1@company.com',
            first_name: 'Ahmed',
            last_name: 'Al-Rashid',
            role: 'collector',
            status: 'active',
            organization_id: organizationId,
            job_title: 'Collections Specialist',
            phone: '+971 50 345 6789',
            last_login: '2024-09-20T09:15:00Z',
            created_at: '2024-03-10T11:00:00Z',
            updated_at: '2024-09-20T09:15:00Z'
          },
          {
            id: '4',
            email: 'viewer@company.com',
            first_name: 'Maria',
            last_name: 'Garcia',
            role: 'viewer',
            status: 'active',
            organization_id: organizationId,
            job_title: 'Analyst',
            last_login: '2024-09-18T14:20:00Z',
            created_at: '2024-04-05T10:15:00Z',
            updated_at: '2024-09-18T14:20:00Z'
          },
          {
            id: '5',
            email: 'newuser@company.com',
            first_name: 'John',
            last_name: 'Doe',
            role: 'collector',
            status: 'pending',
            organization_id: organizationId,
            job_title: 'Junior Collector',
            created_at: '2024-09-15T16:00:00Z',
            updated_at: '2024-09-15T16:00:00Z'
          }
        ])

        setStats({
          total_users: 5,
          active_users: 4,
          admin_users: 1,
          pending_invites: 1
        })
      } else {
        const errorText = await response.text()
        throw new Error(`Failed to load users: ${response.status} ${errorText}`)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      if (error instanceof Error) {
        handleError(error)
      } else {
        handleError(new Error('An unexpected error occurred while loading users'))
      }
    } finally {
      setLoading(false)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800'
      case 'manager':
        return 'bg-blue-100 text-blue-800'
      case 'collector':
        return 'bg-green-100 text-green-800'
      case 'viewer':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'inactive':
        return 'bg-gray-100 text-gray-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <UserCheck className="h-4 w-4" />
      case 'inactive':
        return <UserX className="h-4 w-4" />
      case 'pending':
        return <Calendar className="h-4 w-4" />
      default:
        return null
    }
  }

  const formatLastLogin = (lastLogin?: string) => {
    if (!lastLogin) return 'Never'
    return new Date(lastLogin).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.job_title && user.job_title.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter

    return matchesSearch && matchesRole && matchesStatus
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <PageLoading
          title="Loading User Management"
          description="Please wait while we fetch user information..."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Manage users, roles, and permissions</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Error Display */}
      <ApiError
        error={error}
        onRetry={fetchUsers}
        onDismiss={resetError}
        title="User Management Error"
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_users}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active_users}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Administrators</p>
                <p className="text-2xl font-bold text-gray-900">{stats.admin_users}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Invites</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending_invites}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex space-x-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="collector">Collector</option>
              <option value="viewer">Viewer</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {user.first_name[0]}{user.last_name[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {user.email}
                        </div>
                        {user.job_title && (
                          <div className="text-xs text-gray-400">{user.job_title}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                      {getStatusIcon(user.status)}
                      <span className="ml-1">{user.status.charAt(0).toUpperCase() + user.status.slice(1)}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatLastLogin(user.last_login)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by inviting your first team member.'
              }
            </p>
            {!searchTerm && roleFilter === 'all' && statusFilter === 'all' && (
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Invite First User
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}