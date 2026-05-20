import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { t, isRtl } from '../i18n'
import {
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  LogOut,
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
} from 'lucide-react'

export default function Dashboard({ session, onLogout }) {
  const [profile, setProfile] = useState(null)
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAsset, setSelectedAsset] = useState(null)

  const lang = profile?.language || 'en'

  useEffect(() => {
    document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr'
  }, [lang])

  const refreshAssets = useCallback(() => {
    const user = session.user

    supabase
      .from('profiles')
      .select('*')
      .eq('email', user.email)
      .maybeSingle()
      .then(({ data: profileData, error: profileError }) => {
        if (profileError || !profileData) {
          setLoading(false)
          return
        }
        setProfile(profileData)
        const telegramId = profileData.user_id

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
      })
  }, [session.user])

  useEffect(() => {
    refreshAssets()
  }, [refreshAssets])

  async function handleLogout() {
    await supabase.auth.signOut()
    onLogout()
  }

  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const totalActiveBills = assets.filter((a) => {
    if (a.is_active === false) return false
    if (!a.expiry_date) return true
    return new Date(a.expiry_date) > now
  }).length

  const expiringWarranties = assets.filter((a) => {
    if (!a.expiry_date) return false
    const expiry = new Date(a.expiry_date)
    return expiry > now && expiry <= thirtyDaysFromNow
  }).length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <SummaryCard
            icon={<FileText className="w-5 h-5 text-indigo-600" />}
            label={t('summaryActive', lang)}
            value={totalActiveBills}
            bgColor="bg-indigo-50"
          />
          <SummaryCard
            icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
            label={t('summaryExpiring', lang)}
            value={expiringWarranties}
            bgColor="bg-amber-50"
            tooltip={t('expiringTooltip', lang)}
          />
          <SummaryCard
            icon={<User className="w-5 h-5 text-emerald-600" />}
            label={t('summaryAccount', lang)}
            value={profile?.tier === 'pro' ? t('tierPro', lang) : t('tierFree', lang)}
            bgColor="bg-emerald-50"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('yourAssets', lang)}</h2>
          </div>
          {assets.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('noAssets', lang)}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {assets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  now={now}
                  lang={lang}
                  onSelect={() => setSelectedAsset(asset)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedAsset && (
        <AssetModal
          asset={selectedAsset}
          telegramId={profile?.user_id}
          lang={lang}
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
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, bgColor, tooltip }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center`}>
          {icon}
        </div>
        <div>
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
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

function AssetRow({ asset, now, lang, onSelect }) {
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
    if (!dateStr) return '\u2014'
    return new Date(dateStr).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-center gap-4 min-w-0">
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

      <div className="flex items-center gap-6 flex-shrink-0">
        {asset.expiry_date && (
          <div className="text-sm text-slate-500 text-right">
            <span className="text-xs text-slate-400">{t('expires', lang)}</span>
            <br />
            {formatDate(asset.expiry_date)}
          </div>
        )}
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge}`}>
          {statusIcon}
          {statusLabel}
        </span>
      </div>
    </div>
  )
}

function AssetModal({ asset, telegramId, lang, onClose, onDeleted, onToggled }) {
  const [reminders, setReminders] = useState([])
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [loadingReminders, setLoadingReminders] = useState(true)

  useEffect(() => {
    if (!telegramId) {
      return
    }
    supabase
      .from('reminders')
      .select('*')
      .eq('asset_id', asset.id)
      .eq('user_id', telegramId)
      .then(({ data, error }) => {
        if (!error) setReminders(data || [])
      })
      .finally(() => setLoadingReminders(false))
  }, [asset.id, telegramId])

  async function handleToggleActive() {
    setToggling(true)
    const newVal = asset.is_active === false ? true : false
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-gray-900 truncate pr-4">
            {asset.item_name || t('unnamed', lang)}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <DetailField icon={<Tag className="w-4 h-4" />} label={t('type', lang)} value={asset.doc_type} />
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
