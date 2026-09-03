import { formatCurrency } from '../lib/formatCurrency'
import type { QuoteRoomGroup as RoomGroupData } from '../lib/groupQuoteItems'
import QuoteItemCard from './QuoteItemCard'

export default function QuoteRoomGroup({
  group,
  quoteId,
  quoteFrameColour,
  quoteCustomFrameColour,
  locked,
  onRemove,
  onSetQuantity,
}: {
  group: RoomGroupData
  quoteId: string
  quoteFrameColour: string
  quoteCustomFrameColour: string
  locked: boolean
  onRemove: (id: string) => void
  onSetQuantity: (id: string, quantity: number) => void
}) {
  return (
    <div className="quote-room-group">
      <div className="quote-room-group__header">
        <h3 className="quote-room-group__title">{group.location}</h3>
        <span className="muted small">
          {group.items.length} item{group.items.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="quote-room-group__items">
        {group.items.map((item) => (
          <QuoteItemCard
            key={item.id}
            item={item}
            quoteId={quoteId}
            quoteFrameColour={quoteFrameColour}
            quoteCustomFrameColour={quoteCustomFrameColour}
            locked={locked}
            onRemove={onRemove}
            onSetQuantity={onSetQuantity}
          />
        ))}
      </div>

      <div className="quote-room-group__footer">
        <span>Room total: {formatCurrency(group.subtotal)}</span>
      </div>
    </div>
  )
}
