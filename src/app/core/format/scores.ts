/** "38.45" -> "38,45" */
export function formatScore(score: string): string {
  return score.replace('.', ',');
}
