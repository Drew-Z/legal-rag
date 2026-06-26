const CONTEXTUAL_REFERENCE = /^(它|他|她|上述|上面|这个|该|这条|这项|前面).{0,16}$/;

export function rewriteQuestion(question: string): string {
  const normalized = question.trim();
  if (!needsRewrite(normalized)) {
    return normalized;
  }

  return `${normalized}。请结合当前合同中与付款、交付标准、违约责任、知识产权、争议解决相关的条款进行检索。`;
}

function needsRewrite(question: string): boolean {
  if (question.length <= 5 && /它|他|她|这|该|上述|上面/.test(question)) {
    return true;
  }

  return CONTEXTUAL_REFERENCE.test(question);
}
