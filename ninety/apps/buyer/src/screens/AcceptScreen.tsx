import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { styles } from '../lib/theme.js';
import { formatMoney, translate, type Language } from '../lib/i18n.js';
import { acceptOffer, type BuyerOffer, type ClientOptions } from '../lib/api.js';

/**
 * Accept and pay.
 *
 * The breakdown is shown in full, and the authorisation is described in plain
 * words. "Your card is authorised, not charged" is a genuine reassurance to
 * someone spending a workshop's money on a part they have not seen, and burying
 * it in a terms link wastes it.
 *
 * A declined card returns the buyer to their offers rather than closing the
 * request: fifteen minutes of supplier effort is not thrown away because a card
 * was declined.
 */
export function AcceptScreen({
  client,
  offer,
  language,
  currency,
  currencyExponent,
  taxLabel,
  onAuthorised,
  onDeclined,
  collectPaymentMethod,
}: {
  client: ClientOptions;
  offer: BuyerOffer;
  language: Language;
  currency: string;
  currencyExponent: number;
  taxLabel: string;
  onAuthorised: (orderId: string) => void;
  onDeclined: () => void;
  collectPaymentMethod: () => Promise<string | null>;
}): JSX.Element {
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Record<string, number | string> | null>(null);

  const pay = async () => {
    setError(null);
    // Card details are collected by the provider's own hosted fields and never
    // touch this app or our servers. What comes back is a token.
    const token = await collectPaymentMethod();
    if (token === null) return;

    setBusy(true);
    try {
      const result = await acceptOffer(client, offer.id, token);
      setBreakdown(result.breakdown);
      onAuthorised(result.orderId);
    } catch (err) {
      const apiError = err as { status?: number; message?: string };
      if (apiError.status === 402) {
        setError(t('accept.declined'));
        onDeclined();
      } else {
        setError(apiError.message ?? t('errors.generic'));
      }
    } finally {
      setBusy(false);
    }
  };

  const total = breakdown === null ? offer.priceCents : Number(breakdown.totalCents);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t('accept.title')}</Text>

      {error !== null && (
        <View style={[styles.banner, styles.bannerError]}>
          <Text style={styles.body}>{error}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Row label={t('accept.part')} value={formatMoney(language, offer.priceCents, currency, currencyExponent)} />
        {breakdown !== null && (
          <>
            <Row label={t('accept.delivery')} value={formatMoney(language, Number(breakdown.deliveryCents), currency, currencyExponent)} />
            <Row label={t('accept.serviceFee')} value={formatMoney(language, Number(breakdown.buyerFeeCents), currency, currencyExponent)} />
            <Row label={taxLabel} value={formatMoney(language, Number(breakdown.taxCents), currency, currencyExponent)} />
          </>
        )}
        <View style={{ height: 1, backgroundColor: '#2b333d' }} />
        <Row label={t('accept.total')} value={formatMoney(language, total, currency, currencyExponent)} strong />
      </View>

      <View style={[styles.banner, styles.bannerInfo]}>
        <Text style={styles.body}>{t('accept.authorisedNotCharged')}</Text>
      </View>

      <Pressable style={[styles.button, styles.buttonPrimary]} disabled={busy} onPress={() => void pay()}>
        <Text style={styles.buttonPrimaryText}>
          {busy ? t('accept.paying') : t('accept.pay', { total: formatMoney(language, total, currency, currencyExponent) })}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }): JSX.Element {
  return (
    <View style={styles.spread}>
      <Text style={strong === true ? styles.h2 : styles.dim}>{label}</Text>
      <Text style={strong === true ? styles.h2 : styles.body}>{value}</Text>
    </View>
  );
}
