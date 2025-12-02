#!/usr/bin/env npx ts-node

/**
 * Bible Highlight Migrator
 * 
 * Migrates verse colors/highlights from one Bible version to another on bible.com
 * 
 * Usage: npx ts-node migrate.ts --from <versionId> --to <versionId> --token <bearerToken>
 * 
 * Progress is saved to a file, so the script can resume from where it left off.
 */

import * as fs from "fs";
import * as path from "path";

// Bible book structure with USFM abbreviations and chapter counts
const BIBLE_BOOKS = [
  // Old Testament
  { usfm: "GEN", name: "Genesis", chapters: 50 },
  { usfm: "EXO", name: "Exodus", chapters: 40 },
  { usfm: "LEV", name: "Leviticus", chapters: 27 },
  { usfm: "NUM", name: "Numbers", chapters: 36 },
  { usfm: "DEU", name: "Deuteronomy", chapters: 34 },
  { usfm: "JOS", name: "Joshua", chapters: 24 },
  { usfm: "JDG", name: "Judges", chapters: 21 },
  { usfm: "RUT", name: "Ruth", chapters: 4 },
  { usfm: "1SA", name: "1 Samuel", chapters: 31 },
  { usfm: "2SA", name: "2 Samuel", chapters: 24 },
  { usfm: "1KI", name: "1 Kings", chapters: 22 },
  { usfm: "2KI", name: "2 Kings", chapters: 25 },
  { usfm: "1CH", name: "1 Chronicles", chapters: 29 },
  { usfm: "2CH", name: "2 Chronicles", chapters: 36 },
  { usfm: "EZR", name: "Ezra", chapters: 10 },
  { usfm: "NEH", name: "Nehemiah", chapters: 13 },
  { usfm: "EST", name: "Esther", chapters: 10 },
  { usfm: "JOB", name: "Job", chapters: 42 },
  { usfm: "PSA", name: "Psalms", chapters: 150 },
  { usfm: "PRO", name: "Proverbs", chapters: 31 },
  { usfm: "ECC", name: "Ecclesiastes", chapters: 12 },
  { usfm: "SNG", name: "Song of Solomon", chapters: 8 },
  { usfm: "ISA", name: "Isaiah", chapters: 66 },
  { usfm: "JER", name: "Jeremiah", chapters: 52 },
  { usfm: "LAM", name: "Lamentations", chapters: 5 },
  { usfm: "EZK", name: "Ezekiel", chapters: 48 },
  { usfm: "DAN", name: "Daniel", chapters: 12 },
  { usfm: "HOS", name: "Hosea", chapters: 14 },
  { usfm: "JOL", name: "Joel", chapters: 3 },
  { usfm: "AMO", name: "Amos", chapters: 9 },
  { usfm: "OBA", name: "Obadiah", chapters: 1 },
  { usfm: "JON", name: "Jonah", chapters: 4 },
  { usfm: "MIC", name: "Micah", chapters: 7 },
  { usfm: "NAM", name: "Nahum", chapters: 3 },
  { usfm: "HAB", name: "Habakkuk", chapters: 3 },
  { usfm: "ZEP", name: "Zephaniah", chapters: 3 },
  { usfm: "HAG", name: "Haggai", chapters: 2 },
  { usfm: "ZEC", name: "Zechariah", chapters: 14 },
  { usfm: "MAL", name: "Malachi", chapters: 4 },
  // New Testament
  { usfm: "MAT", name: "Matthew", chapters: 28 },
  { usfm: "MRK", name: "Mark", chapters: 16 },
  { usfm: "LUK", name: "Luke", chapters: 24 },
  { usfm: "JHN", name: "John", chapters: 21 },
  { usfm: "ACT", name: "Acts", chapters: 28 },
  { usfm: "ROM", name: "Romans", chapters: 16 },
  { usfm: "1CO", name: "1 Corinthians", chapters: 16 },
  { usfm: "2CO", name: "2 Corinthians", chapters: 13 },
  { usfm: "GAL", name: "Galatians", chapters: 6 },
  { usfm: "EPH", name: "Ephesians", chapters: 6 },
  { usfm: "PHP", name: "Philippians", chapters: 4 },
  { usfm: "COL", name: "Colossians", chapters: 4 },
  { usfm: "1TH", name: "1 Thessalonians", chapters: 5 },
  { usfm: "2TH", name: "2 Thessalonians", chapters: 3 },
  { usfm: "1TI", name: "1 Timothy", chapters: 6 },
  { usfm: "2TI", name: "2 Timothy", chapters: 4 },
  { usfm: "TIT", name: "Titus", chapters: 3 },
  { usfm: "PHM", name: "Philemon", chapters: 1 },
  { usfm: "HEB", name: "Hebrews", chapters: 13 },
  { usfm: "JAS", name: "James", chapters: 5 },
  { usfm: "1PE", name: "1 Peter", chapters: 5 },
  { usfm: "2PE", name: "2 Peter", chapters: 3 },
  { usfm: "1JN", name: "1 John", chapters: 5 },
  { usfm: "2JN", name: "2 John", chapters: 1 },
  { usfm: "3JN", name: "3 John", chapters: 1 },
  { usfm: "JUD", name: "Jude", chapters: 1 },
  { usfm: "REV", name: "Revelation", chapters: 22 },
] as const;

const GRAPHQL_ENDPOINT = "https://presentation.youversionapi.com/graphql";

const COMMON_HEADERS = {
  "accept": "*/*",
  "accept-language": "en",
  "content-type": "application/json",
  "origin": "https://www.bible.com",
  "x-youversion-app-platform": "web",
  "x-youversion-client": "youversion",
};

// Rate limiting - delay between requests in ms
const REQUEST_DELAY_MS = 200;

interface VerseColor {
  usfm: string;
  color: string;
}

interface GetVerseColorsResponse {
  data: {
    getVerseColors: {
      response: {
        data: [string, string][];
        code: number;
      };
    };
  };
}

interface CreateMomentResponse {
  data: {
    createMoment: {
      response: {
        code: number;
      };
    };
  };
}

interface MigrationProgress {
  fromVersion: number;
  toVersion: number;
  completedChapters: string[]; // Array of USFM chapter refs like "GEN.1", "GEN.2"
  totalHighlightsFound: number;
  totalHighlightsMigrated: number;
  totalHighlightsFailed: number;
  lastUpdated: string;
}

function getProgressFilePath(fromVersion: number, toVersion: number): string {
  return path.join(process.cwd(), `migration-progress-${fromVersion}-to-${toVersion}.json`);
}

function loadProgress(fromVersion: number, toVersion: number): MigrationProgress {
  const filePath = getProgressFilePath(fromVersion, toVersion);
  
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, "utf-8");
      const progress = JSON.parse(data) as MigrationProgress;
      
      // Validate that it's for the same migration
      if (progress.fromVersion === fromVersion && progress.toVersion === toVersion) {
        console.log(`📂 Found existing progress file: ${progress.completedChapters.length} chapters already processed`);
        return progress;
      }
    } catch (error) {
      console.warn(`⚠️  Could not load progress file, starting fresh: ${error}`);
    }
  }
  
  return {
    fromVersion,
    toVersion,
    completedChapters: [],
    totalHighlightsFound: 0,
    totalHighlightsMigrated: 0,
    totalHighlightsFailed: 0,
    lastUpdated: new Date().toISOString(),
  };
}

function saveProgress(progress: MigrationProgress): void {
  const filePath = getProgressFilePath(progress.fromVersion, progress.toVersion);
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getVerseColors(
  usfm: string,
  versionId: number,
  token: string
): Promise<VerseColor[]> {
  const query = `
    query GetVerseColors($usfm: String!, $versionId: Int!) {
      getVerseColors(usfm: $usfm, versionId: $versionId) {
        response {
          data
          code
        }
      }
    }
  `;

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables: { usfm, versionId },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
  }

  const result = (await response.json()) as GetVerseColorsResponse;

  // Handle GraphQL-level errors
  if ((result as any).errors) {
    const errors = (result as any).errors;
    // 404 "not_found" means no highlights exist - this is normal, not an error
    const isNotFound = errors.some((e: any) =>
      e.extensions?.statusCode === 404 ||
      e.extensions?.responseBody?.response?.data?.errors?.some((err: any) =>
        err.key === 'moments.verse_colors.not_found'
      )
    );
    if (isNotFound) {
      return []; // No highlights for this chapter - normal case
    }
    // Log other errors
    console.error(`GraphQL errors for ${usfm}:`, JSON.stringify(errors, null, 2));
    return [];
  }

  if (result.data?.getVerseColors?.response?.code !== 200) {
    console.warn(`Warning: Non-200 response for ${usfm}:`);
    console.warn(JSON.stringify(result, null, 2));
    return [];
  }

  const data = result.data.getVerseColors.response.data;
  if (!data || !Array.isArray(data)) {
    return [];
  }

  return data.map(([verseUsfm, color]) => ({ usfm: verseUsfm, color }));
}

async function createHighlight(
  verseUsfm: string,
  color: string,
  versionId: number,
  token: string
): Promise<boolean> {
  const query = `
    mutation CreateMoment($input: MomentsCreateRequestInput) {
      createMoment(momentsCreateRequestInput: $input) {
        response {
          code
        }
      }
    }
  `;

  // API requires format "2025-11-30T14:36:23+00:00" (no milliseconds, +00:00 not Z)
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          color,
          createdDt: now,
          kind: "HIGHLIGHT",
          references: [
            {
              usfm: [verseUsfm],
              versionId,
            },
          ],
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
  }

  const result = (await response.json()) as CreateMomentResponse;
  const code = result.data?.createMoment?.response?.code;

  if (code !== 201 && code !== 200) {
    console.warn(`createHighlight failed for ${verseUsfm}:`, JSON.stringify(result, null, 2));
  }

  return code === 201 || code === 200;
}

function parseArgs(args: string[]): { fromVersion: number; toVersion: number; token: string } {
  let fromVersion: number | undefined;
  let toVersion: number | undefined;
  let token: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--from":
        fromVersion = parseInt(args[++i], 10);
        break;
      case "--to":
        toVersion = parseInt(args[++i], 10);
        break;
      case "--token":
        token = args[++i];
        break;
    }
  }

  if (!fromVersion || !toVersion || !token) {
    console.error("Usage: npx ts-node migrate.ts --from <versionId> --to <versionId> --token <bearerToken>");
    console.error("");
    console.error("Example:");
    console.error("  npx ts-node migrate.ts --from 2311 --to 1 --token eyJhbGci...");
    process.exit(1);
  }

  return { fromVersion, toVersion, token };
}

async function migrate(fromVersion: number, toVersion: number, token: string): Promise<void> {
  console.log(`\n🔄 Migrating highlights from version ${fromVersion} to version ${toVersion}\n`);

  // Load existing progress or start fresh
  const progress = loadProgress(fromVersion, toVersion);
  const completedSet = new Set(progress.completedChapters);

  const totalChapters = BIBLE_BOOKS.reduce((sum, book) => sum + book.chapters, 0);
  const remainingChapters = totalChapters - completedSet.size;
  
  if (completedSet.size > 0) {
    console.log(`⏩ Resuming migration: ${completedSet.size}/${totalChapters} chapters already done`);
    console.log(`   Highlights so far: ${progress.totalHighlightsMigrated} migrated, ${progress.totalHighlightsFailed} failed\n`);
  }

  let processedThisRun = 0;

  for (const book of BIBLE_BOOKS) {
    // Check if entire book is already done
    const bookChaptersCompleted = Array.from({ length: book.chapters }, (_, i) => 
      completedSet.has(`${book.usfm}.${i + 1}`)
    ).filter(Boolean).length;
    
    if (bookChaptersCompleted === book.chapters) {
      // Entire book already processed, skip silently
      continue;
    }

    console.log(`\n📖 Processing ${book.name} (${bookChaptersCompleted}/${book.chapters} chapters done)...`);

    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      const chapterUsfm = `${book.usfm}.${chapter}`;

      // Skip if already completed
      if (completedSet.has(chapterUsfm)) {
        continue;
      }

      processedThisRun++;

      // Fetch colors from source version
      let verseColors: VerseColor[];
      try {
        verseColors = await getVerseColors(chapterUsfm, fromVersion, token);
      } catch (error) {
        console.error(`  ❌ Failed to fetch ${chapterUsfm}: ${error}`);
        await sleep(REQUEST_DELAY_MS);
        continue; // Don't mark as complete - retry on next run
      }

      if (verseColors.length === 0) {
        // No highlights in this chapter, mark as complete and continue
        completedSet.add(chapterUsfm);
        progress.completedChapters.push(chapterUsfm);
        saveProgress(progress);
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      console.log(`  📍 ${chapterUsfm}: Found ${verseColors.length} highlights`);
      progress.totalHighlightsFound += verseColors.length;

      // Create highlights in target version
      let chapterSuccess = true;
      for (const { usfm: verseUsfm, color } of verseColors) {
        try {
          const success = await createHighlight(verseUsfm, color, toVersion, token);
          if (success) {
            progress.totalHighlightsMigrated++;
            console.log(`    ✅ ${verseUsfm} (${color})`);
          } else {
            progress.totalHighlightsFailed++;
            console.log(`    ⚠️  ${verseUsfm} - unexpected response`);
          }
        } catch (error) {
          progress.totalHighlightsFailed++;
          chapterSuccess = false;
          console.error(`    ❌ ${verseUsfm}: ${error}`);
        }
        await sleep(REQUEST_DELAY_MS);
      }

      // Mark chapter as complete (even if some highlights failed - they're logged)
      if (chapterSuccess) {
        completedSet.add(chapterUsfm);
        progress.completedChapters.push(chapterUsfm);
      }
      
      // Save progress after each chapter
      saveProgress(progress);

      // Progress update
      const totalDone = completedSet.size;
      const pct = ((totalDone / totalChapters) * 100).toFixed(1);
      console.log(`  📊 Overall: ${pct}% (${totalDone}/${totalChapters} chapters)`);
    }
  }

  console.log("\n\n" + "=".repeat(50));
  console.log("📊 Migration Summary");
  console.log("=".repeat(50));
  console.log(`Chapters processed this run:  ${processedThisRun}`);
  console.log(`Total chapters completed:     ${completedSet.size}/${totalChapters}`);
  console.log(`Total highlights found:       ${progress.totalHighlightsFound}`);
  console.log(`Successfully migrated:        ${progress.totalHighlightsMigrated}`);
  console.log(`Failed:                       ${progress.totalHighlightsFailed}`);
  console.log("=".repeat(50));
  
  if (completedSet.size === totalChapters) {
    console.log("\n✨ Migration complete! All chapters processed.");
    const progressFile = getProgressFilePath(fromVersion, toVersion);
    console.log(`   You can delete the progress file: ${progressFile}\n`);
  } else {
    console.log(`\n⏸️  Migration paused. Run the same command to continue.\n`);
  }
}

// Main execution
const { fromVersion, toVersion, token } = parseArgs(process.argv.slice(2));
migrate(fromVersion, toVersion, token).catch(console.error);
