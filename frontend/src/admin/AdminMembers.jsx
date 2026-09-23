import { useEffect, useState } from 'react'
import MemberSearch from '../components/MemberSearch.jsx'
import StatusFeedback from './StatusFeedback.jsx'
import { adminFetch } from './adminApi.js'
import { MoreVertical } from 'lucide-react'

const PAGE_SIZE = 20

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'up_to_date', label: 'Financially Up-to-date' },
  { id: 'owing', label: 'Owing' },
  { id: 'archived', label: 'Archived' },
]

function statusFromPath(path) {
  const query = path.includes('?') ? path.slice(path.indexOf('?') + 1) : ''
  const status = new URLSearchParams(query).get('status') || 'all'

  if (FILTERS.some((filter) => filter.id === status)) {
    return status
  }

  return 'all'
}

function statusLabel(status) {
  return status === 'owing' ? 'Owing' : 'Up-to-date'
}

function formatOutstanding(amount) {
  return `₦${Number(amount).toLocaleString()}`
}

function MemberName({ name }) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)

  return (
    <span className="admin-member-name-parts">
      {parts.map((part, index) => (
        <span className="admin-member-name-part" key={`${part}-${index}`}>
          {part}
        </span>
      ))}
    </span>
  )
}

function pageNumbers(totalPages) {
  return Array.from({ length: totalPages }, (_, index) => index + 1)
}

function AdminMembers({ path, onNavigate }) {
  const status = statusFromPath(path)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [directory, setDirectory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [pendingStatusChange, setPendingStatusChange] = useState(null)
  const [statusChangeSaving, setStatusChangeSaving] = useState(false)

useEffect(() => {
  const handleDocumentPointerDown = (event) => {
    if (!(event.target instanceof Element)) return

    if (!event.target.closest('.admin-member-actions')) {
      setOpenMenuId(null)
    }
  }

  document.addEventListener('pointerdown', handleDocumentPointerDown)

  return () => {
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
  }
}, [])

  useEffect(() => {
    const message = sessionStorage.getItem('adminMemberFeedback')

    if (message) {
      setSuccessMessage(message)
      sessionStorage.removeItem('adminMemberFeedback')
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 250)

    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [status, debouncedSearch])

  useEffect(() => {
    let cancelled = false

    const params = new URLSearchParams({
      search: debouncedSearch,
      status,
      page: String(page),
      page_size: String(PAGE_SIZE),
    })

    setLoading(true)
    setError(false)

    adminFetch(`/api/members?${params.toString()}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load members')
        }

        return response.json()
      })
      .then((data) => {
        if (!cancelled) {
          setDirectory(data)
          setLoading(false)
        }
      })
      .catch((loadError) => {
        console.error('Admin members lookup failed:', loadError)
        if (!cancelled) {
          setError(true)
          setDirectory(null)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [debouncedSearch, status, page])

  const members = directory?.members || []
  const totalPages = directory?.total_pages || 0
  const showEmpty = !loading && !error && search.trim() && members.length === 0
  const showDirectoryEmpty = !loading && !error && !search.trim() && members.length === 0

  const openMember = (memberId) => {
    onNavigate(`/admin/members/${memberId}`)
  }
  const requestStatusChange = (member) => {
  setOpenMenuId(null)
  setPendingStatusChange({
    member,
    status: member.membership_status === 'archived' ? 'active' : 'archived',
  })
}

const confirmStatusChange = async () => {
  if (!pendingStatusChange || statusChangeSaving) return

  const isArchiving = pendingStatusChange.status === 'archived'
  const memberName = pendingStatusChange.member.full_name

  setStatusChangeSaving(true)
  setError(false)

  try {
    const response = await adminFetch(
      `/api/admin/members/${pendingStatusChange.member.id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: pendingStatusChange.status,
        }),
      }
    )

    if (!response.ok) {
      throw new Error('Member status could not be updated')
    }

    const feedbackMessage = isArchiving
      ? `${memberName} has been moved to Archive successfully.`
      : `${memberName} has been restored successfully.`

    setSuccessMessage(feedbackMessage)
    sessionStorage.setItem('adminMemberFeedback', feedbackMessage)
    setPendingStatusChange(null)

    onNavigate(isArchiving ? '/admin?status=archived' : '/admin')
  } catch (error) {
    console.error('Update member status failed:', error)
    setError(true)
  } finally {
    setStatusChangeSaving(false)
  }
}

  return (
    <section className="admin-members-section">
      <h2>Members</h2>

      <MemberSearch
        search={search}
        onSearchChange={setSearch}
        showResults={false}
        inputId="admin-member-search"
        label="Find member record"
        placeholder="Search by member first or last name"
      />

      <div className="admin-filters" role="tablist" aria-label="Member filters">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`admin-filter${status === filter.id ? ' active' : ''}`}
            onClick={() =>
              onNavigate(
                filter.id === 'all'
                  ? '/admin'
                  : `/admin?status=${filter.id}`
              )
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="admin-stub-copy">Unable to load members.</p>
      )}

      {successMessage && (
        <StatusFeedback
          type="success"
          message={successMessage}
          onClose={() => setSuccessMessage('')}
        />
      )}

      {loading && (
        <div className="admin-members-loading" aria-hidden="true">
          <div className="skeleton skeleton-year-card"></div>
          <div className="skeleton skeleton-year-card"></div>
          <div className="skeleton skeleton-year-card"></div>
        </div>
      )}

      {showEmpty && (
        <div className="no-results">
          No member found. Try another name.
        </div>
      )}

{showDirectoryEmpty && (
  <p className="admin-stub-copy">
    {status === 'archived'
      ? 'Archived members will appear here.'
      : 'No members to display.'}
  </p>
)}
      {!loading && !error && members.length > 0 && (
        <>
          <div className="admin-members-table-wrap">
            <table className="admin-members-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Outstanding</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td className="admin-member-name"><MemberName name={member.full_name} /></td>
                    <td>
                      <span className={`admin-member-status ${member.financial_status}`}>
                        {statusLabel(member.financial_status)}
                      </span>
                    </td>
                    <td>{formatOutstanding(member.outstanding_balance_ngn)}</td>
<td className="admin-member-actions">
  <button
    className="admin-member-menu-button"
    type="button"
    aria-label={`Actions for ${member.full_name}`}
    aria-expanded={openMenuId === member.id}
    onClick={() =>
      setOpenMenuId(openMenuId === member.id ? null : member.id)
    }
  >
    <MoreVertical size={20} />
  </button>

  {openMenuId === member.id && (
    <div className="admin-member-menu">
      <button
        type="button"
        onClick={() => openMember(member.id)}
      >
        View member
      </button>

<button
  className={member.membership_status === 'archived' ? '' : 'admin-member-menu-danger'}
  type="button"
  onClick={() => requestStatusChange(member)}
>
        {member.membership_status === 'archived'
          ? 'Restore member'
          : 'Archive member'}
      </button>
    </div>
  )}
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-members-list">
            {members.map((member) => (
              <div
                className="admin-member-row"
                key={member.id}
              >
                <span className="admin-member-row-name">{member.full_name}</span>
                <span className={`admin-member-status ${member.financial_status}`}>
                  {statusLabel(member.financial_status)}
                </span>
                <span className="admin-member-row-amount">
                  {formatOutstanding(member.outstanding_balance_ngn)}
                </span>
<div className="admin-member-actions">
  <button
    className="admin-member-menu-button"
    type="button"
    aria-label={`Actions for ${member.full_name}`}
    aria-expanded={openMenuId === member.id}
    onClick={() =>
      setOpenMenuId(openMenuId === member.id ? null : member.id)
    }
  >
    <MoreVertical size={20} />
  </button>

  {openMenuId === member.id && (
    <div className="admin-member-menu">
      <button
        type="button"
        onClick={() => openMember(member.id)}
      >
        View member
      </button>

      <button
        className={
          member.membership_status === 'archived'
            ? ''
            : 'admin-member-menu-danger'
        }
        type="button"
        onClick={() => requestStatusChange(member)}
      >
        {member.membership_status === 'archived'
          ? 'Restore member'
          : 'Archive member'}
      </button>
    </div>
  )}
</div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="admin-pagination" aria-label="Members pagination">
              <button
                className="admin-page-button"
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              {pageNumbers(totalPages).map((pageNumber) => (
                <button
                  className={`admin-page-button${page === pageNumber ? ' active' : ''}`}
                  type="button"
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                className="admin-page-button"
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}

      {pendingStatusChange && (
        <div
          className="payment-confirmation-backdrop"
          role="presentation"
          onClick={() => setPendingStatusChange(null)}
        >
          <section
            className="payment-confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-member-status-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="confirm-member-status-title">
              {pendingStatusChange.status === 'archived'
                ? 'Archive member'
                : 'Restore member'}
            </h3>

            <p>
              {pendingStatusChange.status === 'archived'
                ? 'When you archive a member, they will be removed from the active member list, but their payment history will be preserved.'
                : 'This member will be returned to the active member list.'}
            </p>

              <p className="archive-confirm-question">
              Are you sure you want to{' '}
              {pendingStatusChange.status === 'archived' ? 'archive' : 'restore'}{' '}
              <strong>{pendingStatusChange.member.full_name}</strong>?
            </p>

            <div className="payment-confirmation-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => setPendingStatusChange(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`save-payment-button${
                  pendingStatusChange.status === 'archived'
                    ? ' archive-confirm-button'
                    : ' restore-confirm-button'
                }`}
                onClick={confirmStatusChange}
                disabled={statusChangeSaving}
              >
                {statusChangeSaving
                  ? 'Processing…'
                  : pendingStatusChange.status === 'archived'
                    ? 'Archive Member'
                    : 'Restore Member'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default AdminMembers
