# Prompt Log

## [V13.4.0] - 2026-01-21
**Commit**: bf5cb8e
**Changes**:
- **Fix**: Resolved major compilation errors in `StarredView.swift` by refactoring the structural hierarchy and brace matching.
- **Fix**: Fixed "Expected declaration" error in `SharesListView.swift` caused by a redundant closing brace.
- **Fix**: Resolved `Cannot find 'FileDetailSheet' in scope` error by merging the component into `FileBrowserView.swift` to ensure global visibility across targets.
- **Resources**: Integrated `Localizable.xcstrings` for comprehensive multi-language support (CN, EN, DE, JA).
- **Cleanup**: Removed redundant `FileDetailSheet.swift` and `FileStatsView.swift` shims where necessary.


## [V13.2.0] - 2026-01-16
**Commit**: 5434829
**Changes**:
- **Feature**: Added language selection (zh/en) to Share and Batch Share dialogs in iOS App to match Web version.
- **Fix**: Fixed `CreateShareRequest` API parameter mismatch causes 400 error.
- **feature**: Added Confirmation Dialogs for single file deletion.
- **Fix**: Fixed thumbnail path encoding for subfolders (stripped leading slash).
- **UI**: Removed "Pull to refresh" hint from file list footer.
