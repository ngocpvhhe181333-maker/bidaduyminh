import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { AdminView } from './components/AdminView'
import { HeaderBar } from './components/HeaderBar'
import { InvoiceModal } from './components/InvoiceModal'
import { LoginPage } from './components/LoginPage'
import { ReportsView } from './components/ReportsView'
import { ShiftModal } from './components/ShiftModal'
import { ShiftsInvoicesView } from './components/ShiftsInvoicesView'
import { TablesView } from './components/TablesView'
import { api } from './services/api'

function App() {
  const [authChecking, setAuthChecking] = useState(true)
  const [auth, setAuth] = useState(null) // { user, profile }
  const [authError, setAuthError] = useState('')

  const [activeTab, setActiveTab] = useState('tables')
  const [opsState, setOpsState] = useState({
    tableTypes: [],
    tables: [],
    menuItems: [],
    openSessions: [],
    openShift: null,
    openShiftSummary: null,
  })
  const [opsLoadedForUser, setOpsLoadedForUser] = useState(null)
  const [opsError, setOpsError] = useState('')

  const [shiftModalMode, setShiftModalMode] = useState(null) // 'open' | 'close' | null
  const [activeInvoice, setActiveInvoice] = useState(null)
  const [invoicesVersion, setInvoicesVersion] = useState(0)

  const loadOperationalState = useCallback(async () => {
    try {
      const data = await api.fetchOperationalState()
      setOpsState(data)
      setOpsError('')
    } catch (err) {
      setOpsError(err.message || 'Không thể tải trạng thái quán.')
    }
  }, [])

  useEffect(() => {
    let active = true

    async function checkAuth() {
      try {
        const session = await api.getSessionAndProfile()
        if (!active) return
        setAuth(session)
        setAuthError('')
      } catch (err) {
        if (!active) return
        setAuth(null)
        setAuthError(err.message || '')
      } finally {
        if (active) setAuthChecking(false)
      }
    }

    checkAuth()
    const unsubscribe = api.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setAuth(null)
        setActiveTab('tables')
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkAuth()
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const currentProfileId = auth?.profile?.id || null

  useEffect(() => {
    if (!currentProfileId) return
    let active = true

    async function syncOps() {
      try {
        const data = await api.fetchOperationalState()
        if (!active) return
        setOpsState(data)
        setOpsError('')
        setOpsLoadedForUser(currentProfileId)
      } catch (err) {
        if (!active) return
        setOpsError(err.message || 'Không thể tải trạng thái quán.')
        setOpsLoadedForUser(currentProfileId)
      }
    }

    syncOps()
    const unsubRealtime = api.subscribeOperationalChanges?.(() => {
      syncOps()
    })

    return () => {
      active = false
      unsubRealtime?.()
    }
  }, [currentProfileId])

  async function handleSignOut() {
    await api.signOut()
    setAuth(null)
    setOpsLoadedForUser(null)
    setActiveTab('tables')
    setActiveInvoice(null)
    setShiftModalMode(null)
  }

  function handleShiftActionClick() {
    setShiftModalMode(opsState.openShift ? 'close' : 'open')
  }

  if (authChecking) {
    return (
      <div className="splash-screen">
        <div className="spinner" />
        <p>Đang khởi tạo hệ thống...</p>
      </div>
    )
  }

  if (!auth?.profile) {
    return (
      <>
        {authError && (
          <div className="top-banner-error">
            <span>{authError}</span>
          </div>
        )}
        <LoginPage
          onAuthenticated={(session) => {
            setAuthError('')
            setAuth(session)
            setActiveTab('tables')
          }}
        />
      </>
    )
  }

  const isAdmin = auth.profile.role === 'admin'
  const safeTab = !isAdmin && (activeTab === 'reports' || activeTab === 'admin') ? 'tables' : activeTab
  const opsLoading = opsLoadedForUser !== auth.profile.id && opsState.tables.length === 0

  return (
    <div className="app-shell">
      <HeaderBar
        profile={auth.profile}
        activeTab={safeTab}
        onChangeTab={setActiveTab}
        openShift={opsState.openShift}
        onOpenShiftClick={handleShiftActionClick}
        onSignOut={handleSignOut}
      />

      <main className="main-container no-print">
        {opsError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{opsError}</div>}

        {opsLoading ? (
          <div className="card">
            <p className="muted-sm">Đang tải dữ liệu 5 bàn...</p>
          </div>
        ) : (
          <>
            {safeTab === 'tables' && (
              <TablesView
                tableTypes={opsState.tableTypes}
                tables={opsState.tables}
                menuItems={opsState.menuItems}
                openSessions={opsState.openSessions}
                openShift={opsState.openShift}
                onRefresh={loadOperationalState}
                onOpenShiftModal={() => setShiftModalMode('open')}
                onInvoiceCreated={(inv) => {
                  setActiveInvoice(inv)
                  setInvoicesVersion((v) => v + 1)
                }}
              />
            )}

            {safeTab === 'shifts' && (
              <ShiftsInvoicesView
                refreshKey={invoicesVersion}
                profile={auth.profile}
                tables={opsState.tables}
                openShift={opsState.openShift}
                openShiftSummary={opsState.openShiftSummary}
                onOpenShiftModal={() => setShiftModalMode('open')}
                onCloseShiftModal={() => setShiftModalMode('close')}
                onSelectInvoice={(inv) => setActiveInvoice(inv)}
              />
            )}

            {safeTab === 'reports' && isAdmin && <ReportsView />}

            {safeTab === 'admin' && isAdmin && (
              <AdminView
                currentProfile={auth.profile}
                tableTypes={opsState.tableTypes}
                tables={opsState.tables}
                menuItems={opsState.menuItems}
                onRefresh={loadOperationalState}
              />
            )}
          </>
        )}
      </main>

      {shiftModalMode && (
        <ShiftModal
          mode={shiftModalMode}
          openShift={opsState.openShift}
          openShiftSummary={opsState.openShiftSummary}
          onClose={() => setShiftModalMode(null)}
          onCompleted={async () => {
            await loadOperationalState()
            setInvoicesVersion((v) => v + 1)
          }}
        />
      )}

      {activeInvoice && (
        <InvoiceModal
          invoice={activeInvoice}
          isAdmin={isAdmin}
          onClose={() => setActiveInvoice(null)}
          onInvoiceUpdated={(updated) => {
            setActiveInvoice(updated)
            setInvoicesVersion((v) => v + 1)
            loadOperationalState()
          }}
        />
      )}
    </div>
  )
}

export default App
