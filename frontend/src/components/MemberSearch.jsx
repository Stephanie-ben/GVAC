function MemberSearch({
  search,
  onSearchChange,
  results = [],
  onSelectMember,
  showResults = true,
  inputId = 'member-search',
  label = 'Find your record',
  placeholder = 'Search your name',
  hint = 'Search using your first or last name.',
}) {
  return (
          <div className="search-card">
            <label htmlFor={inputId}>{label}</label>

            <div className="search-input">
              <span>⌕</span>

              <input
                id={inputId}
                type="text"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={placeholder}
                autoComplete="off"
              />
            </div>

            <p className="search-hint">
              {hint}
            </p>

            {showResults && results.length > 0 && (
              <div className="search-results">
                {results.map((member) => (
                  <button
                    className="search-result"
                    key={member.id}
                    onClick={() => onSelectMember(member)}
                  >
                    <span className="result-icon">○</span>
                    <span>{member.full_name}</span>
                  </button>
                ))}
              </div>
            )}

            {showResults && search.trim() && results.length === 0 && (
              <div className="no-results">
                No member found. Try another name.
              </div>
            )}
          </div>
  )
}

export default MemberSearch
