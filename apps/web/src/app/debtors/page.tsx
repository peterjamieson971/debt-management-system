'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Building2, Mail, Phone, MapPin, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { Tables } from '@/lib/supabase/database.types'

type Debtor = Tables<'debtors'>

export default function DebtorsPage() {
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
    loadDebtors()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
  }

  const loadDebtors = async () => {
    try {
      const { data, error } = await supabase
        .from('debtors')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading debtors:', error)
      } else {
        setDebtors(data || [])
      }
    } catch (error) {
      console.error('Error loading debtors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredDebtors = debtors.filter(debtor =>
    debtor.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debtor.primary_contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debtor.country?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getCountryFlag = (countryCode: string | null) => {
    const flags: { [key: string]: string } = {
      'AE': '🇦🇪',
      'SA': '🇸🇦',
      'KW': '🇰🇼',
      'QA': '🇶🇦',
      'BH': '🇧🇭',
      'OM': '🇴🇲'
    }
    return flags[countryCode || ''] || '🌐'
  }

  const getCompanyTypeColor = (type: string | null) => {
    switch (type) {
      case 'SME': return 'bg-blue-100 text-blue-800'
      case 'Enterprise': return 'bg-purple-100 text-purple-800'
      case 'Multinational': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading debtors...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Debt Collection System
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <nav className="flex space-x-8">
                <a href="/dashboard" className="text-gray-600 hover:text-gray-800">Dashboard</a>
                <a href="/cases" className="text-gray-600 hover:text-gray-800">Cases</a>
                <a href="/debtors" className="text-blue-600 hover:text-blue-800 font-medium">Debtors</a>
                <a href="/analytics" className="text-gray-600 hover:text-gray-800">Analytics</a>
              </nav>
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-600 hover:text-gray-800"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Debtors</h2>
            <p className="text-gray-600">Manage your company records and contacts</p>
          </div>
          <Button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Debtor
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by company name, email, or country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Building2 className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Companies</p>
                  <p className="text-2xl font-bold text-gray-900">{debtors.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="text-2xl mr-4">🇦🇪</div>
                <div>
                  <p className="text-sm font-medium text-gray-600">UAE Companies</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {debtors.filter(d => d.country === 'AE').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="text-2xl mr-4">🇸🇦</div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Saudi Companies</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {debtors.filter(d => d.country === 'SA').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Enterprise</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {debtors.filter(d => d.company_type === 'Enterprise').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debtors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDebtors.map((debtor) => (
            <Card key={debtor.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">{getCountryFlag(debtor.country)}</div>
                    <div>
                      <CardTitle className="text-lg">{debtor.company_name}</CardTitle>
                      {debtor.company_type && (
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${getCompanyTypeColor(debtor.company_type)}`}>
                          {debtor.company_type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {debtor.primary_contact_name && (
                    <div className="flex items-center text-sm text-gray-600">
                      <div className="h-4 w-4 bg-gray-300 rounded-full mr-3 flex items-center justify-center">
                        <div className="h-2 w-2 bg-gray-600 rounded-full"></div>
                      </div>
                      {debtor.primary_contact_name}
                    </div>
                  )}

                  {debtor.primary_contact_email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-3 text-gray-400" />
                      <a href={`mailto:${debtor.primary_contact_email}`} className="hover:text-blue-600">
                        {debtor.primary_contact_email}
                      </a>
                    </div>
                  )}

                  {debtor.primary_contact_phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-3 text-gray-400" />
                      <a href={`tel:${debtor.primary_contact_phone}`} className="hover:text-blue-600">
                        {debtor.primary_contact_phone}
                      </a>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center text-sm text-gray-500">
                      <div className={`h-2 w-2 rounded-full mr-2 ${
                        debtor.risk_profile === 'low' ? 'bg-green-400' :
                        debtor.risk_profile === 'medium' ? 'bg-yellow-400' : 'bg-red-400'
                      }`}></div>
                      {debtor.risk_profile} risk
                    </div>
                    <div className="text-sm text-gray-500">
                      {debtor.language_preference === 'ar' ? '🇸🇦 Arabic' : '🇺🇸 English'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredDebtors.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No debtors found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding your first debtor'}
            </p>
            <Button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Debtor
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}