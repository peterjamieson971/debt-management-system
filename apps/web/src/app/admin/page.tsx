'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  Activity,
  Database,
  Mail,
  Brain,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  MessageSquare
} from 'lucide-react'

interface SystemStatus {
  database: 'healthy' | 'warning' | 'error'
  email: 'connected' | 'warning' | 'disconnected'
  ai: 'operational' | 'warning' | 'error'
  authentication: 'active' | 'warning' | 'inactive'
}

interface SystemStats {
  totalUsers: number
  activeCases: number
  emailsSentToday: number
  aiCostToday: number
  recentActivity: Array<{
    id: string
    type: string
    message: string
    timestamp: string
    severity: 'info' | 'warning' | 'error'
  }>
}

export default function AdminDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    database: 'healthy',
    email: 'connected',
    ai: 'operational',
    authentication: 'active'
  })

  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalUsers: 0,
    activeCases: 0,
    emailsSentToday: 0,
    aiCostToday: 0,
    recentActivity: []
  })

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSystemStatus()
    fetchSystemStats()
  }, [])

  const fetchSystemStatus = async () => {
    try {
      // TODO: Replace with actual API calls when backend health checks are available
      // For now, showing mock data
      setSystemStatus({
        database: 'healthy',
        email: 'connected',
        ai: 'operational',
        authentication: 'active'
      })
    } catch (error) {
      console.error('Failed to fetch system status:', error)
    }
  }

  const fetchSystemStats = async () => {
    try {
      // TODO: Replace with actual API calls
      // Mock data for demonstration
      setSystemStats({
        totalUsers: 12,
        activeCases: 45,
        emailsSentToday: 23,
        aiCostToday: 4.67,
        recentActivity: [
          {
            id: '1',
            type: 'email',
            message: 'Gmail OAuth connection established for organization ABC Corp',
            timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            severity: 'info'
          },
          {
            id: '2',
            type: 'ai',
            message: 'AI cost alert: Monthly budget at 75%',
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            severity: 'warning'
          },
          {
            id: '3',
            type: 'system',
            message: 'New prompt template created: Escalation Notice (Arabic)',
            timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            severity: 'info'
          },
          {
            id: '4',
            type: 'user',
            message: 'New user registered: john.doe@example.com',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            severity: 'info'
          }
        ]
      })
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch system stats:', error)
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'operational':
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'error':
      case 'disconnected':
      case 'inactive':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'operational':
      case 'active':
        return 'text-green-700 bg-green-100'
      case 'warning':
        return 'text-yellow-700 bg-yellow-100'
      case 'error':
      case 'disconnected':
      case 'inactive':
        return 'text-red-700 bg-red-100'
      default:
        return 'text-gray-700 bg-gray-100'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <Activity className="h-4 w-4 text-blue-500" />
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`

    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}d ago`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">System Overview</h1>
        <Button onClick={() => window.location.reload()} variant="outline">
          Refresh
        </Button>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Database</p>
              <div className="flex items-center mt-2">
                {getStatusIcon(systemStatus.database)}
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemStatus.database)}`}>
                  {systemStatus.database}
                </span>
              </div>
            </div>
            <Database className="h-8 w-8 text-gray-400" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Email Service</p>
              <div className="flex items-center mt-2">
                {getStatusIcon(systemStatus.email)}
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemStatus.email)}`}>
                  {systemStatus.email}
                </span>
              </div>
            </div>
            <Mail className="h-8 w-8 text-gray-400" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">AI Services</p>
              <div className="flex items-center mt-2">
                {getStatusIcon(systemStatus.ai)}
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemStatus.ai)}`}>
                  {systemStatus.ai}
                </span>
              </div>
            </div>
            <Brain className="h-8 w-8 text-gray-400" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Authentication</p>
              <div className="flex items-center mt-2">
                {getStatusIcon(systemStatus.authentication)}
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(systemStatus.authentication)}`}>
                  {systemStatus.authentication}
                </span>
              </div>
            </div>
            <CheckCircle className="h-8 w-8 text-gray-400" />
          </div>
        </Card>
      </div>

      {/* System Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{systemStats.totalUsers}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Cases</p>
              <p className="text-2xl font-bold text-gray-900">{systemStats.activeCases}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <MessageSquare className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Emails Today</p>
              <p className="text-2xl font-bold text-gray-900">{systemStats.emailsSentToday}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">AI Cost Today</p>
              <p className="text-2xl font-bold text-gray-900">${systemStats.aiCostToday.toFixed(2)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent System Activity</h2>
        <div className="space-y-4">
          {systemStats.recentActivity.length > 0 ? (
            systemStats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                {getSeverityIcon(activity.severity)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatTimeAgo(activity.timestamp)}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  activity.type === 'email' ? 'bg-purple-100 text-purple-800' :
                  activity.type === 'ai' ? 'bg-blue-100 text-blue-800' :
                  activity.type === 'user' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {activity.type}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-8">No recent activity</p>
          )}
        </div>
      </Card>
    </div>
  )
}