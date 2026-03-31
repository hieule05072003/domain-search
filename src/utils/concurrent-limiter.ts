/**
 * Execute async tasks with concurrency limit.
 * Prevents overloading RDAP/WHOIS servers with parallel requests.
 */
export async function limitConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  // Spawn `limit` workers that each process tasks sequentially
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    runNext()
  );

  await Promise.all(workers);
  return results;
}
