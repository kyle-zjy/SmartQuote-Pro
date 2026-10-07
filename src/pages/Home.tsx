import { Link } from 'react-router-dom'
import { Card, Statistic } from 'antd'
import { ArrowRightOutlined, FileTextOutlined, PlusOutlined, SettingOutlined, TagsOutlined } from '@ant-design/icons'
import { useQuote } from '../lib/quoteContext'
import { partitionArchivedQuoteGroups } from '../lib/quoteArchive'
import { displayQuoteNo } from '../lib/displayQuoteNo'
import { formatCurrency } from '../lib/formatCurrency'
import QuoteStatusBadge from '../components/QuoteStatusBadge'

export default function Home() {
  const { items, customer, quoteNo, quoteNumber, status, total, savedQuotes } = useQuote()
  const boards = partitionArchivedQuoteGroups(savedQuotes)
  const hasDraft = items.length > 0 || Boolean(customer.name.trim())
  const recent = Object.values(boards).flat().map((group) => group.versions[0])
    .filter(Boolean).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 5)

  return (
    <div className="home-page">
      <header className="home-heading">
        <div><span className="home-label">OVERVIEW / 01</span><h1>Workspace<span className="home-heading-dot">.</span></h1></div>
        <Link to="/quotes/new" className="primary-button"><PlusOutlined aria-hidden="true" /> New quote</Link>
      </header>
      <div className="home-overview-grid">
      <section className="home-stats" aria-label="Saved quote overview">
        {[{ label: 'Saved quotes', value: Object.values(boards).flat().length }, { label: 'In progress', value: boards.open.length }, { label: 'Closed deals', value: boards.closed.length }].map((stat) => (
          <Card key={stat.label}><Statistic title={stat.label} value={stat.value} /></Card>
        ))}
      </section>
      <Link to="/quotes/new" className="home-create">
        <div className="home-create__art" aria-hidden="true"><span /><span /><span /></div>
        <span className="home-create__label">NEW QUOTE</span>
        <span className="home-create__bottom"><strong>Create quote</strong><ArrowRightOutlined aria-hidden="true" /></span>
      </Link>
      </div>
      <div className="home-columns">
        <Card className="home-recent" title="Recent quotes" extra={<Link to="/quotes">View all</Link>}>
          {recent.length ? <div className="home-recent__list">{recent.map((record) => (
            <div className="home-recent__row" key={record.quoteNo}>
              <div><strong>{record.quote.customer.name.trim() || 'Unnamed customer'}</strong><span className="muted small">{displayQuoteNo(record.quoteNo, record.quote.quoteNumber)} · Rev {record.version}</span></div>
              <QuoteStatusBadge status={record.quote.status} />
              <strong>{formatCurrency(record.total)}</strong>
            </div>
          ))}</div> : <div className="home-empty"><div className="home-empty__art" aria-hidden="true"><FileTextOutlined /><span /></div><p>No saved quotes</p><Link to="/quotes/new">New quote <ArrowRightOutlined aria-hidden="true" /></Link></div>}
        </Card>
        <div className="home-side">
          <Card className="home-current-card" title="Current quote">
            {hasDraft ? <>
              <div className="home-current__heading"><strong>{displayQuoteNo(quoteNo, quoteNumber)}</strong><QuoteStatusBadge status={status} /></div>
              <p className="muted">{customer.name.trim() || 'Unnamed customer'}</p>
              <div className="home-current__summary"><span>{items.reduce((sum, item) => sum + item.quantity, 0)} items</span><strong>{formatCurrency(total)}</strong></div>
              <Link to={`/quotes/${quoteNo}`} className="home-current__link">Continue current quote <ArrowRightOutlined aria-hidden="true" /></Link>
            </> : <><p className="muted">No active quote</p><Link to="/quotes/new" className="home-current__link">New quote <ArrowRightOutlined aria-hidden="true" /></Link></>}
          </Card>
          <Card title="Quick access">
            <nav className="home-shortcuts" aria-label="Workspace shortcuts">
              {[
                { to: '/quotes', icon: <FileTextOutlined aria-hidden="true" />, title: 'Quote library' },
                { to: '/admin/pricing', icon: <TagsOutlined aria-hidden="true" />, title: 'Products & pricing' },
                { to: '/admin', icon: <SettingOutlined aria-hidden="true" />, title: 'Company settings' },
              ].map((link) => <Link key={link.to} to={link.to} className="home-shortcut">{link.icon}<span>{link.title}</span><ArrowRightOutlined aria-hidden="true" /></Link>)}
            </nav>
          </Card>
        </div>
      </div>
    </div>
  )
}

