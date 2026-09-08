import AdminShell from './AdminShell.jsx'
import AdminDashboard from './AdminDashboard.jsx'
import AdminMemberRecordStub from './AdminMemberRecordStub.jsx'
import AddMember from './AddMember.jsx'

function AdminApp({ path, onNavigate }) {
  const pathOnly = path.split('?')[0]
  const memberRecordMatch = pathOnly.match(/^\/admin\/members\/([^/]+)$/)

  if (pathOnly === '/admin/add-member') {
    return (
      <AdminShell>
        <AddMember onNavigate={onNavigate} />
      </AdminShell>
    )
  }

  if (memberRecordMatch) {
    return (
      <AdminMemberRecordStub
        memberId={memberRecordMatch[1]}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <AdminShell>
      <AdminDashboard path={path} onNavigate={onNavigate} />
    </AdminShell>
  )
}

export default AdminApp
