import { RequestState } from '@ninety/shared';
import { getSql } from '../db/client.js';
import { notify } from '../notifications/service.js';

/**
 * What the buyer is told when they cancel.
 *
 * Two different truths, and sending the wrong one is worse than sending
 * nothing. Before a driver has the part, the hold is released and that is the
 * whole story. After collection, a physical object is in a van and somebody has
 * to deal with it — saying "released, nothing taken" would be true about the
 * money and misleading about the part.
 */
export async function notifyBuyerUnhappyPath(requestId: string, fromState: string): Promise<void> {
  const rows = await getSql()<{ reference: string; user_id: string }[]>`
    SELECT r.reference, b.user_id
      FROM requests r JOIN buyers b ON b.id = r.buyer_id
     WHERE r.id = ${requestId}
  `;
  const row = rows[0];
  if (row === undefined) return;

  const afterCollection: readonly string[] = [
    RequestState.DISPATCHED,
    RequestState.IN_TRANSIT,
    RequestState.DELIVERED,
  ];
  const messageKey = afterCollection.includes(fromState)
    ? 'unhappy.buyer_cancelled_dispatched'
    : 'unhappy.buyer_cancelled_authorised';

  await notify({
    userId: row.user_id,
    channel: 'push',
    messageKey,
    params: { reference: row.reference },
    requestId,
  });
}
