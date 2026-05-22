import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { t, isRtl } from '../i18n'
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  LogOut,
  FolderOpen,
  Package,
  CalendarClock,
  User,
  Loader2,
  X,
  Trash2,
  Tag,
  DollarSign,
  Calendar,
  Bell,
  Power as PowerIcon,
  Crown,
  ImageIcon,
  File,
  Search,
  Download,
  ZoomIn,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard({ session, onLogout }) {
  const [profile, setProfile] = useState(null)
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  const lang = profile?.language || 'en'
  const rtl = isRtl(lang)

  useEffect(() => {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr'
  }, [rtl])

  const refreshAssets = useCallback(() => {
    const user = session.user

    let query = supabase.from('profiles').select('*')
    if (user.email) {
      query = query.eq('email', user.email)
    } else if (user.tg_id) {
      query = query.eq('user_id', user.tg_id)
    } else {
      setLoading(false)
      return
    }

    query.maybeSingle().then(({ data: profileData, error: profileError }) => {
      if (profileError || !profileData) {
        if (!user.tg_id) {
          supabase
            .from('profiles')
            .select('*')
            .eq('user_id', parseInt(user.id))
            .maybeSingle()
            .then(({ data: fallback }) => {
              if (fallback) {
                setProfile(fallback)
                loadAssets(fallback.user_id)
              } else {
                setLoading(false)
              }
            })
        } else {
          setLoading(false)
        }
        return
      }
      setProfile(profileData)
      loadAssets(profileData.user_id)
    })
  }, [session.user])

  function loadAssets(telegramId) {
    supabase
      .from('assets')
      .select('*')
      .eq('user_id', telegramId)
      .order('expiry_date', { ascending: true, nullsFirst: false })
      .then(({ data: assetsData, error: assetsError }) => {
        if (assetsError) {
          setError(t('failedLoadAssets', lang) + ': ' + assetsError.message)
        } else {
          setAssets(assetsData || [])
        }
        setLoading(false)
      })
  }

  useEffect(() => {
    refreshAssets()
  }, [refreshAssets])

  async function handleLogout() {
    await supabase.auth.signOut()
    onLogout()
  }

  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const totalDocs = assets.length

  const activeCount = assets.filter((a) => {
    if (a.is_active === false) return false
    if (!a.expiry_date) return true
    return new Date(a.expiry_date) > now
  }).length

  const expiringCount = assets.filter((a) => {
    if (!a.expiry_date) return false
    const expiry = new Date(a.expiry_date)
    return expiry > now && expiry <= thirtyDaysFromNow
  }).length

  const filteredAssets = useMemo(() => {
    let result = assets

    if (activeFilter === 'bill') {
      result = result.filter((a) => a.doc_type === 'bill')
    } else if (activeFilter === 'warranty') {
      result = result.filter((a) => a.doc_type === 'warranty' || a.doc_type === 'warrantee' || !a.doc_type)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase()
      result = result.filter((a) =>
        (a.item_name && a.item_name.toLowerCase().includes(term)) ||
        (a.doc_type && a.doc_type.toLowerCase().includes(term)) ||
        (a.currency && a.currency.toLowerCase().includes(term))
      )
    }

    return result
  }, [assets, activeFilter, searchTerm])

  function exportCsv() {
    const headers = ['item_name', 'doc_type', 'price', 'currency', 'document_date', 'expiry_date', 'due_date', 'is_active']
    const rows = filteredAssets.map((a) =>
      headers.map((h) => {
        const val = a[h]
        if (val === null || val === undefined) return ''
        const str = String(val)
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
      }).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'warrantyguard_export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const chartData = useMemo(() => {
    const months = {}
    assets.forEach((a) => {
      if (a.is_active === false) return
      const date = a.expiry_date || a.document_date
      if (!date) return
      const d = new Date(date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) months[key] = { month: key, expenses: 0, expiries: 0, label: '' }
      months[key].expiries += 1
      if (a.price) months[key].expenses += Number(a.price)
    })
    const sorted = Object.values(months).sort((a, b) => a.month.localeCompare(b.month))
    sorted.forEach((m) => {
      const [y, mo] = m.month.split('-')
      const d = new Date(Number(y), Number(mo) - 1)
      m.label = d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { year: '2-digit', month: 'short' })
    })
    return sorted.slice(0, 12)
  }, [assets, lang])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-200 rounded-lg animate-pulse" />
              <div className="h-6 w-36 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="h-8 w-20 bg-slate-200 rounded animate-pulse" />
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
                <div className="w-10 h-10 rounded-lg bg-slate-200 animate-pulse mb-3" />
                <div className="h-3 w-20 bg-slate-200 rounded animate-pulse mb-2" />
                <div className="h-7 w-12 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
              <div className="h-5 w-44 bg-slate-200 rounded animate-pulse" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 sm:px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 animate-pulse shrink-0" />
                  <div>
                    <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-1.5" />
                    <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">{t('appName', lang)}</h1>
            {profile?.tier === 'pro' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                <Crown className="w-3 h-3" />
                {t('premium', lang)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden md:block text-sm text-gray-500 truncate max-w-[200px]">{session.user.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('signOut', lang)}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<File className="w-5 h-5 text-indigo-600" />}
            label={t('totalDocuments', lang)}
            value={totalDocs}
            bgColor="bg-indigo-50"
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
            label={t('summaryActive', lang)}
            value={activeCount}
            bgColor="bg-emerald-50"
          />
          <StatCard
            icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
            label={t('summaryExpiring', lang)}
            value={expiringCount}
            bgColor="bg-amber-50"
            tooltip={t('expiringTooltip', lang)}
          />
          <StatCard
            icon={<User className="w-5 h-5 text-purple-600" />}
            label={t('summaryAccount', lang)}
            value={profile?.tier === 'pro' ? t('tierPro', lang) : t('tierFree', lang)}
            bgColor={profile?.tier === 'pro' ? 'bg-purple-50' : 'bg-slate-100'}
            badge={profile?.tier === 'pro' ? { text: t('premium', lang), className: 'bg-purple-100 text-purple-700' } : null}
          />
        </div>

        {profile?.tier === 'pro' ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('chartTitle', lang)}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expiriesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="expiries" stroke="#4f46e5" strokeWidth={2} fill="url(#expensesGrad)" name={lang === 'he' ? 'תפוגות' : 'Expiries'} />
                <Area type="monotone" dataKey="expenses" stroke="#f59e0b" strokeWidth={2} fill="url(#expiriesGrad)" name={lang === 'he' ? 'הוצאות' : 'Expenses'} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="relative mb-8 overflow-hidden rounded-xl">
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl p-5 blur-sm select-none">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('chartTitle', lang)}</h3>
              <div className="h-[220px] bg-slate-100 rounded-lg" />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <p className="text-sm text-slate-600 mb-3 max-w-xs">{t('chartUpgrade', lang)}</p>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm">
                <Crown className="w-4 h-4" />
                {t('upgrade', lang)}
              </span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{t('yourAssets', lang)}</h2>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 ${rtl ? 'right-3' : 'left-3'}`} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('searchPlaceholder', lang)}
                    className={`w-full sm:w-52 h-10 ${rtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition`}
                  />
                </div>
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 h-10 px-3 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">{t('exportCsv', lang)}</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              {['all', 'bill', 'warranty'].map((f) => {
                const label = f === 'all' ? t('filterAll', lang) : f === 'bill' ? t('filterBill', lang) : t('filterWarranty', lang)
                return (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                      activeFilter === f
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          {filteredAssets.length === 0 ? (
            <div className={`p-16 text-center ${rtl ? 'text-right' : 'text-left'}`}>
              <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
                {searchTerm || activeFilter !== 'all' ? t('noResults', lang) : t('noAssetsTelegram', lang)}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredAssets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  now={now}
                  lang={lang}
                  rtl={rtl}
                  onSelect={() => setSelectedAsset(asset)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <AssetDrawer
        asset={selectedAsset}
        telegramId={profile?.user_id}
        lang={lang}
        rtl={rtl}
        onClose={() => setSelectedAsset(null)}
        onDeleted={() => {
          setSelectedAsset(null)
          setLoading(true)
          refreshAssets()
        }}
        onToggled={() => {
          setSelectedAsset(null)
          setLoading(true)
          refreshAssets()
        }}
      />
    </div>
  )
}

function StatCard({ icon, label, value, bgColor, tooltip, badge }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        {badge && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-sm text-slate-500 flex items-center gap-1">
          {label}
          {tooltip && (
            <span className="relative group">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-xs text-slate-500 cursor-help">?</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 shadow-lg">
                {tooltip}
              </span>
            </span>
          )}
        </p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function AssetRow({ asset, now, lang, rtl, onSelect }) {
  const isExpired = asset.expiry_date && new Date(asset.expiry_date) <= now
  const expiringSoon =
    asset.expiry_date &&
    !isExpired &&
    new Date(asset.expiry_date) <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  let statusIcon = <CheckCircle className="w-4 h-4 text-emerald-500" />
  let statusLabel = t('active', lang)
  let statusBadge = 'bg-emerald-50 text-emerald-700'

  if (asset.is_active === false) {
    statusIcon = <X className="w-4 h-4 text-gray-400" />
    statusLabel = t('inactive', lang)
    statusBadge = 'bg-gray-100 text-gray-600'
  } else if (isExpired) {
    statusIcon = <AlertTriangle className="w-4 h-4 text-red-500" />
    statusLabel = t('expired', lang)
    statusBadge = 'bg-red-50 text-red-700'
  } else if (expiringSoon) {
    statusIcon = <Clock className="w-4 h-4 text-amber-500" />
    statusLabel = t('expiringSoon', lang)
    statusBadge = 'bg-amber-50 text-amber-700'
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      className="px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-slate-50 hover:shadow-sm transition-all duration-200 cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Package className="w-5 h-5 text-slate-600" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {asset.item_name || t('unnamed', lang)}
          </p>
          {asset.doc_type && (
            <p className="text-sm text-slate-500">{asset.doc_type}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
        {asset.expiry_date && (
          <div className={`text-sm text-slate-500 ${rtl ? 'text-left' : 'text-right'} hidden sm:block`}>
            <span className="text-xs text-slate-400">{t('expires', lang)}</span>
            <br />
            {formatDate(asset.expiry_date)}
          </div>
        )}
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge}`}>
          {statusIcon}
          <span className="hidden xs:inline">{statusLabel}</span>
        </span>
      </div>
    </div>
  )
}

function DetailField({ icon, label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        {icon}
        {label}
      </div>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  )
}

function AssetDrawer({ asset, telegramId, lang, rtl, onClose, onDeleted, onToggled }) {
  const [reminders, setReminders] = useState([])
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [loadingReminders, setLoadingReminders] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)

  useEffect(() => {
    if (!asset || !telegramId) return

    supabase
      .from('reminders')
      .select('*')
      .eq('asset_id', asset.id)
      .eq('user_id', telegramId)
      .then(({ data, error }) => {
        if (!error) setReminders(data || [])
      })
      .finally(() => setLoadingReminders(false))
  }, [asset?.id, telegramId])

  async function handleToggleActive() {
    setToggling(true)
    const newVal = asset.is_active === false
    const { error } = await supabase.from('assets').update({ is_active: newVal }).eq('id', asset.id)
    if (error) {
      alert(t('failedToUpdate', lang) + ': ' + error.message)
      setToggling(false)
      return
    }
    setToggling(false)
    onToggled()
  }

  async function handleDelete() {
    if (!window.confirm(t('deleteConfirm', lang))) return
    setDeleting(true)
    const { error } = await supabase.from('assets').delete().eq('id', asset.id)
    if (error) {
      alert(t('failedToDelete', lang) + ': ' + error.message)
      setDeleting(false)
      return
    }
    onDeleted()
  }

  function formatDate(dateStr) {
    if (!dateStr) return '\u2014'
    return new Date(dateStr).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const imgSrc = asset?.image_url?.startsWith('http')
    ? asset.image_url
    : asset?.image_url && !asset.image_url.startsWith('telegram:')
      ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${asset.image_url}`
      : null

  return (
    <>
      <div
        className={`fixed inset-0 z-50 transition-all duration-300 ${asset ? 'visible' : 'invisible'}`}
      >
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${asset ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />
        <div
          className={`absolute inset-y-0 ${rtl ? 'left-0' : 'right-0'} w-full sm:w-[450px] bg-white shadow-2xl transition-transform duration-300 ease-out ${asset ? 'translate-x-0' : rtl ? '-translate-x-full' : 'translate-x-full'}`}
        >
          {asset && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-gray-900 truncate pr-2">
                    {asset.item_name || t('unnamed', lang)}
                  </h2>
                  {asset.doc_type && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium mt-1">
                      {asset.doc_type}
                    </span>
                  )}
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition cursor-pointer shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {imgSrc && !imageError ? (
                  <div className="relative group">
                    <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-slate-100">
                      {!imageLoaded && (
                        <div className="flex items-center justify-center h-48 bg-slate-100">
                          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                        </div>
                      )}
                      <img
                        src={imgSrc}
                        alt={asset.item_name}
                        className={`w-full max-h-[250px] object-contain cursor-pointer hover:opacity-90 transition-opacity ${imageLoaded ? 'block' : 'hidden'}`}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageError(true)}
                        onClick={() => setIsZoomed(true)}
                      />
                    </div>
                    {imageLoaded && (
                      <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5 pointer-events-none">
                        <ZoomIn className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                ) : asset?.image_url ? (
                  <div className="rounded-xl border border-slate-200 shadow-sm bg-slate-100 flex items-center justify-center h-48">
                    <div className="text-center text-slate-400">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2" />
                      <p className="text-sm">{t('imageInTelegram', lang)}</p>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <DetailField icon={<Tag className="w-4 h-4" />} label={t('type', lang)} value={asset.doc_type || '\u2014'} />
                  <DetailField icon={<DollarSign className="w-4 h-4" />} label={t('price', lang)} value={asset.price ? `${asset.currency || 'ILS'} ${asset.price}` : '\u2014'} />
                  <DetailField icon={<Calendar className="w-4 h-4" />} label={t('documentDate', lang)} value={formatDate(asset.document_date)} />
                  <DetailField icon={<CalendarClock className="w-4 h-4" />} label={t('expiryDate', lang)} value={formatDate(asset.expiry_date)} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <Bell className="w-4 h-4" />
                    {t('reminders', lang)}
                  </h3>
                  {loadingReminders ? (
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  ) : reminders.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('noReminders', lang)}</p>
                  ) : (
                    <div className="space-y-2">
                      {reminders.map((r) => (
                        <div key={r.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                          <span className="text-gray-700">{formatDate(r.reminder_date)}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.is_sent ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {r.is_sent ? t('sent', lang) : t('pending', lang)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 space-y-2 shrink-0">
                <button
                  onClick={handleToggleActive}
                  disabled={toggling}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition text-sm font-medium cursor-pointer disabled:opacity-50"
                >
                  {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerIcon className="w-4 h-4" />}
                  {asset.is_active === false ? t('activate', lang) : t('deactivate', lang)}
                </button>

                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition text-sm font-medium cursor-pointer disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {t('delete', lang)}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isZoomed && imgSrc && (
        <div
          className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4"
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition cursor-pointer z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={imgSrc}
            alt={asset?.item_name}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
