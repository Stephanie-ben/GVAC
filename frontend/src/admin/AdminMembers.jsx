import { useEffect, useState } from 'react'
import MemberSearch from '../components/MemberSearch.jsx'
import { API_BASE_URL } from '../api.js'

const PAGE_SIZE = 20

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'up_to_date', label: 'Financially Up-to-date' },
  { id: 'owing', label: 'Owing' },
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

    fetch(`${API_BASE_URL}/api/members?${params.toString()}`)
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

  return (
    <section className="admin-page">
      <div className="admin-dashboard-header">
        <h1>Members</h1>
      </div>

      <MemberSearch
        search={search}
        onSearchChange={setSearch}
        showResults={false}
        inputId="admin-member-search"
        label="Search members"
        placeholder="Search your name"
        hint="Search using your first or last name."
      />

      <div className="admin-filters" role="tablist" aria-label="Member filters">
        {FILTERS.map((filter) => (
          <button
            className={`admin-filter${status === filter.id ? ' active' : ''}`}
            type="button"
            key={filter.id}
            onClick={() => onNavigate(
              filter.id === 'all'
                ? '/admin/members'
                : `/admin/members?status=${filter.id}`
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="admin-stub-copy">Unable to load members.</p>
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
        <p className="admin-stub-copy">No members to display.</p>
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
                  <th>View Details</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.full_name}</td>
                    <td>
                      <span className={`admin-member-status ${member.financial_status}`}>
                        {statusLabel(member.financial_status)}
                      </span>
                    </td>
                    <td>{formatOutstanding(member.outstanding_balance_ngn)}</td>
                    <td>
                      <button
                        className="admin-view-details admin-table-details"
                        type="button"
                        onClick={() => openMember(member.id)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-members-list">
            {members.map((member) => (
              <button
                className="admin-member-row"
                type="button"
                key={member.id}
                onClick={() => openMember(member.id)}
              >
                <span className="admin-member-row-name">{member.full_name}</span>
                <span className={`admin-member-status ${member.financial_status}`}>
                  {statusLabel(member.financial_status)}
                </span>
                <span className="admin-member-row-amount">
                  {formatOutstanding(member.outstanding_balance_ngn)}
                </span>
                <span className="year-arrow" aria-hidden="true">
                  <span className="chevron"></span>
                </span>
              </button>
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
    </section>
  )
}

export default AdminMembers
