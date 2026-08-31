import AdminShell from './AdminShell.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import AdminMembers from './AdminMembers.jsx'
import AdminMemberRecordStub from './AdminMemberRecordStub.jsx'

function AdminApp({ path, onNavigate }) {
  const pathOnly = path.split('?')[0]
  const memberRecordMatch = pathOnly.match(/^\/admin\/members\/([^/]+)$/)

  let page = (
    <AdminDashboard onNavigate={onNavigate} />
  )

  if (memberRecordMatch) {
    page = (
      <AdminMemberRecordStub
        memberId={memberRecordMatch[1]}
        onNavigate={onNavigate}
      />
    )
  } else if (pathOnly.startsWith('/admin/members')) {
    page = <AdminMembers path={path} onNavigate={onNavigate} />
  }

  return (
    <AdminShell path={path} onNavigate={onNavigate}>
      {page}
    </AdminShell>
  )
}

export default AdminApp
