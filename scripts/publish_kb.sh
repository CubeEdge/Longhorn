#!/bin/bash
# ==========================================
# Knowledge Base Publisher
# Reads .md files with YAML frontmatter and
# publishes to remote knowledge_articles table
# ==========================================
# Usage:
#   ./scripts/publish_kb.sh docs/kb/rma-process-sop.md
#   ./scripts/publish_kb.sh docs/kb/*.md              # Batch publish
#
# Frontmatter format:
#   ---
#   title: "Article Title"
#   slug: article-slug
#   product_line: GENERIC
#   category: Manual
#   visibility: Internal
#   tags: ["Tag1", "Tag2"]
#   summary: "Short summary"
#   ---
# ==========================================

set -e

SERVER_HOST="mini"
REMOTE_DB="/Users/admin/Documents/server/Longhorn/server/longhorn.db"
AUTHOR_ID=4  # Default author: Jihua

log() { echo "📝 $1"; }
error() { echo "❌ $1"; exit 1; }
success() { echo "✅ $1"; }

# Parse YAML frontmatter value (simple grep-based)
parse_fm() {
    local key="$1"
    local file="$2"
    # Extract value after "key:" from frontmatter block
    sed -n '/^---$/,/^---$/p' "$file" | grep "^${key}:" | sed "s/^${key}:[ ]*//" | sed 's/^"//' | sed 's/"$//' | head -1
}

# Extract content after second --- line
extract_content() {
    local file="$1"
    awk 'BEGIN{c=0} /^---$/{c++; next} c>=2{print}' "$file"
}

if [ $# -eq 0 ]; then
    echo "Usage: $0 <file.md> [file2.md ...]"
    echo ""
    echo "Publishes .md files with YAML frontmatter to remote knowledge_articles table."
    echo ""
    echo "Examples:"
    echo "  $0 docs/kb/rma-process-sop.md"
    echo "  $0 docs/kb/*.md"
    exit 1
fi

PUBLISHED=0
FAILED=0

for MD_FILE in "$@"; do
    if [ ! -f "$MD_FILE" ]; then
        echo "⚠️  File not found: $MD_FILE (skipped)"
        FAILED=$((FAILED + 1))
        continue
    fi

    log "Processing: $MD_FILE"

    # Parse frontmatter
    TITLE=$(parse_fm "title" "$MD_FILE")
    SLUG=$(parse_fm "slug" "$MD_FILE")
    PRODUCT_LINE=$(parse_fm "product_line" "$MD_FILE")
    CATEGORY=$(parse_fm "category" "$MD_FILE")
    VISIBILITY=$(parse_fm "visibility" "$MD_FILE")
    TAGS=$(parse_fm "tags" "$MD_FILE")
    SUMMARY=$(parse_fm "summary" "$MD_FILE")

    # Validate required fields
    if [ -z "$TITLE" ] || [ -z "$SLUG" ]; then
        echo "⚠️  Missing title or slug in $MD_FILE (skipped)"
        FAILED=$((FAILED + 1))
        continue
    fi

    # Defaults
    [ -z "$PRODUCT_LINE" ] && PRODUCT_LINE="GENERIC"
    [ -z "$CATEGORY" ] && CATEGORY="Manual"
    [ -z "$VISIBILITY" ] && VISIBILITY="Internal"
    [ -z "$TAGS" ] && TAGS="[]"
    [ -z "$SUMMARY" ] && SUMMARY=""

    # Extract content (everything after the second ---)
    CONTENT=$(extract_content "$MD_FILE")

    if [ -z "$CONTENT" ]; then
        echo "⚠️  No content found in $MD_FILE (skipped)"
        FAILED=$((FAILED + 1))
        continue
    fi

    echo "   Title: $TITLE"
    echo "   Slug: $SLUG"
    echo "   Product Line: $PRODUCT_LINE | Category: $CATEGORY"
    echo "   Content: $(echo "$CONTENT" | wc -c | tr -d ' ') bytes"

    # Write content to temp file, then scp to remote, then execute SQL
    TEMP_CONTENT="/tmp/kb_content_$(date +%s).md"
    TEMP_SQL="/tmp/kb_publish_$(date +%s).sql"
    REMOTE_CONTENT="/tmp/kb_content_$$_$(date +%s).md"

    echo "$CONTENT" > "$TEMP_CONTENT"

    # Build SQL using heredoc
    cat > "$TEMP_SQL" << EOSQL
-- Upsert: update if slug exists, otherwise insert
INSERT INTO knowledge_articles (
    title, slug, summary, content, category,
    product_line, product_models, tags, visibility, status,
    formatted_content, format_status, formatted_by, formatted_at,
    source_type, created_by, published_at, updated_at
) VALUES (
    '$(echo "$TITLE" | sed "s/'/''/g")',
    '$(echo "$SLUG" | sed "s/'/''/g")',
    '$(echo "$SUMMARY" | sed "s/'/''/g")',
    CAST(readfile('${REMOTE_CONTENT}') AS TEXT),
    '${CATEGORY}',
    '${PRODUCT_LINE}',
    '[]',
    '${TAGS}',
    '${VISIBILITY}',
    'Published',
    NULL,
    'none',
    NULL,
    NULL,
    'Text',
    ${AUTHOR_ID},
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT(slug) DO UPDATE SET
    title = excluded.title,
    summary = excluded.summary,
    content = CAST(readfile('${REMOTE_CONTENT}') AS TEXT),
    category = excluded.category,
    product_line = excluded.product_line,
    tags = excluded.tags,
    visibility = excluded.visibility,
    status = 'Published',
    formatted_content = NULL,
    format_status = 'none',
    updated_at = CURRENT_TIMESTAMP;
EOSQL

    # Upload content file to remote
    scp -q "$TEMP_CONTENT" "${SERVER_HOST}:${REMOTE_CONTENT}" || {
        echo "⚠️  Failed to upload content for $SLUG (skipped)"
        FAILED=$((FAILED + 1))
        rm -f "$TEMP_CONTENT" "$TEMP_SQL"
        continue
    }

    # Upload and execute SQL
    scp -q "$TEMP_SQL" "${SERVER_HOST}:/tmp/kb_publish.sql" || {
        echo "⚠️  Failed to upload SQL for $SLUG (skipped)"
        FAILED=$((FAILED + 1))
        rm -f "$TEMP_CONTENT" "$TEMP_SQL"
        continue
    }

    ssh "$SERVER_HOST" "sqlite3 '${REMOTE_DB}' < /tmp/kb_publish.sql && rm -f '${REMOTE_CONTENT}' /tmp/kb_publish.sql" 2>&1
    RESULT=$?

    # Cleanup local temp files
    rm -f "$TEMP_CONTENT" "$TEMP_SQL"

    if [ $RESULT -eq 0 ]; then
        success "Published: $TITLE ($SLUG)"
        PUBLISHED=$((PUBLISHED + 1))
    else
        echo "⚠️  Failed to publish $SLUG"
        FAILED=$((FAILED + 1))
    fi

    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Results: ${PUBLISHED} published, ${FAILED} failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
