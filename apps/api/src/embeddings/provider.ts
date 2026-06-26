export interface EmbeddingProvider {
  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  private readonly dimensions = 96;

  async embedText(text: string): Promise<number[]> {
    const vector = Array.from({ length: this.dimensions }, () => 0);
    const tokens = tokenize(text);

    for (const token of tokens) {
      const index = hash(token) % this.dimensions;
      vector[index] += weight(token);
    }

    return normalize(vector);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedText(text)));
  }
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const terms: string[] = [...(normalized.match(/[\u4e00-\u9fff]{1,2}|[a-z0-9]+/g) ?? [])];
  const legalTerms = [
    "违约责任",
    "付款",
    "交付",
    "保密",
    "知识产权",
    "争议解决",
    "解除",
    "赔偿",
    "人工复核"
  ];

  for (const term of legalTerms) {
    if (normalized.includes(term)) {
      terms.push(term, term);
    }
  }

  return terms;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function weight(token: string): number {
  return token.length > 1 ? 1.4 : 0.6;
}

function normalize(vector: number[]): number[] {
  const length = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0));
  if (length === 0) {
    return vector;
  }
  return vector.map((item) => item / length);
}
