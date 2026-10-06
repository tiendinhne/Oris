import Nav from './Nav'
import Trending from './Trending'

// Bố cục 3 cột: Nav 248px · nội dung ≤620px · Trending 300px
export default function Shell({ active, children }) {
  return (
    <div className="shell">
      <Nav active={active} />
      <main className="shell-main">
        <div className="shell-col">{children}</div>
        <Trending />
      </main>
    </div>
  )
}
