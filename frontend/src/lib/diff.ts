export interface DiffSegment {
  type: 'equal' | 'added' | 'removed';
  value: string;
}

/**
 * Word-level diff using a simplified LCS approach.
 * Splits on word boundaries and computes the longest common subsequence.
 */
export function wordDiff(oldText: string, newText: string): DiffSegment[] {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);

  const lcs = computeLCS(oldWords, newWords);
  const result: DiffSegment[] = [];

  let oi = 0;
  let ni = 0;
  let li = 0;

  while (oi < oldWords.length || ni < newWords.length) {
    if (li < lcs.length && oi < oldWords.length && ni < newWords.length && oldWords[oi] === lcs[li] && newWords[ni] === lcs[li]) {
      pushSegment(result, 'equal', oldWords[oi]);
      oi++;
      ni++;
      li++;
    } else if (li < lcs.length && ni < newWords.length && newWords[ni] === lcs[li]) {
      pushSegment(result, 'removed', oldWords[oi]);
      oi++;
    } else if (li < lcs.length && oi < oldWords.length && oldWords[oi] === lcs[li]) {
      pushSegment(result, 'added', newWords[ni]);
      ni++;
    } else {
      if (oi < oldWords.length) {
        pushSegment(result, 'removed', oldWords[oi]);
        oi++;
      }
      if (ni < newWords.length) {
        pushSegment(result, 'added', newWords[ni]);
        ni++;
      }
    }
  }

  return result;
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((s) => s.length > 0);
}

function pushSegment(segments: DiffSegment[], type: DiffSegment['type'], value: string) {
  const last = segments[segments.length - 1];
  if (last && last.type === type) {
    last.value += value;
  } else {
    segments.push({ type, value });
  }
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  if (m * n > 100_000) {
    return simpleLCS(a, b);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

function simpleLCS(a: string[], b: string[]): string[] {
  const result: string[] = [];
  let j = 0;
  for (let i = 0; i < a.length && j < b.length; i++) {
    if (a[i] === b[j]) {
      result.push(a[i]);
      j++;
    }
  }
  return result;
}
