export function cleanText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function estimateTokens(text: string): number {
  const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latinWords = text.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  return Math.ceil(chineseChars * 0.75 + latinWords * 1.3);
}

export function detectSection(paragraph: string, fallback: string): string {
  const firstLine = paragraph.split("\n")[0]?.trim() ?? "";
  const articleMatch = firstLine.match(/第[零〇一二三四五六七八九十百千两0-9]+条\s*([^\n。；;]*)/);
  if (articleMatch) {
    return firstLine.slice(0, 40);
  }

  const positionMatch = firstLine.match(/^位置：([^。；;]+)/);
  if (positionMatch) {
    return positionMatch[1].trim().slice(0, 40);
  }

  if (firstLine.length > 0 && firstLine.length <= 28 && !/[。；;]/.test(firstLine)) {
    return firstLine;
  }

  return fallback;
}
