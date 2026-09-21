function MemberSearch({
  search,
  onSearchChange,
  results = [],
  isSearching = false,
  onSelectMember,
  showResults = true,
  inputId = 'member-search',
  label = 'Find your record',
  placeholder = 'Search by first or last name',
  hint,
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

            {hint ? (
              <p className="search-hint">
                {hint}
              </p>
            ) : null}

            {showResults && results.length > 0 && (
              <div className="search-results">
                {results.map((member) => (
                  <button
                    className="search-result"
                    key={member.id}
                    onClick={() => onSelectMember(member)}
                  >
                    <span>{member.full_name}</span>
                  </button>
                ))}
              </div>
            )}

            {showResults && search.trim() && !isSearching && results.length === 0 && (
              <div className="no-results">
                No record found. We couldn’t find a financial record matching your search.
              </div>
            )}
          </div>
  )
}

export default MemberSearch
