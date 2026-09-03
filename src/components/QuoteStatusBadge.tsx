import type { QuoteStatus } from '../lib/quoteLifecycle'

const LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  'office-review': 'Office Review',
  issued: 'Issued',
}

const CLASS_NAMES: Record<QuoteStatus, string> = {
  draft: 'status-badge status-badge--draft',
  'office-review': 'status-badge status-badge--office-review',
  issued: 'status-badge status-badge--issued',
}

export default function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <span className={CLASS_NAMES[status]}>{LABELS[status]}</span>
}
