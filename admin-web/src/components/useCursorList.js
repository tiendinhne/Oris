import { useCallback, useEffect, useState } from 'react'

/** Tải danh sách phân trang theo cursor; "Xem thêm" nối tiếp trang sau (BR-GEN-07). */
export default function useCursorList(fetchPage, deps) {
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (append = false, from = null) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPage(from)
      setItems((prev) => (append ? [...prev, ...data.items] : data.items))
      setCursor(data.next_cursor)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { load(false) }, [load])

  const replaceItem = (item) => setItems((prev) => prev.map((x) => (x.id === item.id ? item : x)))
  const removeItem = (id) => setItems((prev) => prev.filter((x) => x.id !== id))

  return { items, loading, error, hasMore: !!cursor, loadMore: () => load(true, cursor), reload: () => load(false), replaceItem, removeItem }
}
