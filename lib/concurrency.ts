export function pLimit(concurrency: number) {
  const queue: Array<() => void> = []
  let active = 0

  const next = () => {
    if (active >= concurrency) return
    const fn = queue.shift()
    if (!fn) return
    active++
    fn()
  }

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--
            next()
          })
      }
      queue.push(run)
      next()
    })
  }
}
