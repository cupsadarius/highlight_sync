# Bible Highlight Migrator

Migrate verse highlights (colored verses) from one Bible version to another on bible.com.

## Prerequisites

- Node.js 18+
- A bible.com account with highlights you want to migrate
- Your Bearer token from bible.com

## Installation

```bash
npm install
```

## Getting Your Bearer Token

1. Open [bible.com](https://www.bible.com) and log in
2. Open your browser's Developer Tools (F12)
3. Go to the **Network** tab
4. Navigate to any Bible chapter
5. Look for requests to `presentation.youversionapi.com`
6. Find the `authorization` header - it will look like `Bearer eyJhbG...`
7. Copy the token (everything after "Bearer ")

## Usage

```bash
npx ts-node migrate.ts --from <sourceVersionId> --to <targetVersionId> --token <yourBearerToken>
```

### Example

```bash
# Migrate from version 2311 (EDCR) to version 1 (KJV)
npx ts-node migrate.ts --from 2311 --to 1 --token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Finding Version IDs

Version IDs are visible in bible.com URLs. For example:
- `https://www.bible.com/bible/2311/GEN.1.EDCR` → Version ID is **2311**
- `https://www.bible.com/bible/1/GEN.1.KJV` → Version ID is **1**

## Progress Tracking & Resume

The script automatically saves progress to a JSON file named `migration-progress-{from}-to-{to}.json`. This means:

- **Resumable**: If the script is interrupted (Ctrl+C, network error, token expiry), just run the same command again and it will continue from where it left off
- **Idempotent**: Already-processed chapters are skipped
- **Persistent stats**: Total highlights found/migrated/failed are accumulated across runs

To start fresh, delete the progress file:
```bash
rm migration-progress-2311-to-1.json
```

## What Gets Migrated

- ✅ Verse highlight colors
- ❌ Notes (not implemented)
- ❌ Bookmarks (not implemented)

## Rate Limiting

The script includes a 200ms delay between API calls to avoid rate limiting. The entire Bible has 1,189 chapters, so a full migration takes approximately:
- ~4 minutes to scan all chapters
- Additional time for each highlight created

## Notes

- Highlights are copied, not moved - the source version highlights remain intact
- If a highlight already exists in the target version, it may create a duplicate
- The token expires periodically - you may need to get a fresh one (just run again with new token)
