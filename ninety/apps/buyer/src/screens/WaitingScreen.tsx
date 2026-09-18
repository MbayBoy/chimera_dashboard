import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { colors, styles } from '../lib/theme.js';
import { formatMoney, translate, type Language } from '../lib/i18n.js';
import { fetchOffers, type BuyerOffer, type ClientOptions, type OffersResponse } from '../lib/api.js';

/**
 * Waiting for offers.
 *
 * Watching offers land is most of this product's felt value, so they appear as
 * they arrive rather than in a batch at the end.
 *
 * Two rules are enforced here and they are not cosmetic:
 *
 *  - Default sort is price ascending, and supplier score is not an option. The
 *    score decides who RECEIVES a request, never which offer wins; ranking by it
 *    would let a high-scoring yard charge more, which destroys the price
 *    competition that makes the double-blind worth anything to a buyer.
 *  - No offers yet is said honestly, with what happens next. A buyer who gets
 *    silence does not come back.
 */

export type Sort = 'price_asc' | 'soonest' | 'closest' | 'warranty_desc';

export function WaitingScreen({
  client,
  requestId,
  language,
  currency,
  currencyExponent,
  responseMinutes,
  onChoose,
  onPostAgain,
}: {
  client: ClientOptions;
  requestId: string;
  language: Language;
  currency: string;
  currencyExponent: number;
  /** The market's own response window, so the screen states it rather than assumes it. */
  responseMinutes: number;
  onChoose: (offer: BuyerOffer) => void;
  /** The only action worth offering when a request ends with nothing. */
  onPostAgain: () => void;
}): JSX.Element {
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);
  const [data, setData] = useState<OffersResponse | null>(null);
  const [sort, setSort] = useState<Sort>('price_asc');
  const [offsetMs, setOffsetMs] = useState(0);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const result = await fetchOffers(client, requestId, sort);
      // The server's clock, so the countdown is honest on a phone whose time is
      // wrong. The deadline itself is absolute and never a duration.
      setOffsetMs(Date.parse(result.serverTime) - Date.now());
      setData(result);
    } catch {
      /* the next poll retries */
    }
  }, [client, requestId, sort]);

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 5000);
    const clock = setInterval(() => setTick((n) => n + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  if (data === null) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const deadline = data.selectionDeadline ?? data.offersDeadline;
  const remainingMs = deadline === null ? 0 : Math.max(0, Date.parse(deadline) - (Date.now() + offsetMs));
  void tick;
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  const countdownStyle = [
    styles.countdown,
    remainingMs < 120_000 ? styles.countdownUrgent : remainingMs < 300_000 ? styles.countdownSoon : null,
  ];

  const widened = data.status === 'WIDENING';

  /*
   * The honest ending.
   *
   * A request that closes with nothing is the outcome most likely to lose a
   * buyer for good, and the one a screen is most likely to have no state for:
   * the push notification says it plainly and then the app they open sits on a
   * countdown at zero. Said here, on the screen, with the one action that is
   * worth anything — post it again.
   */
  const closedEmpty: Readonly<Record<string, string>> = {
    NO_OFFERS: 'waiting.noOffers',
    NO_SUPPLY: 'waiting.noSupply',
    EXPIRED: 'waiting.expired',
    CANCELLED: 'waiting.cancelled',
  };
  const endedKey = closedEmpty[data.status];

  if (endedKey !== undefined) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={[styles.banner, styles.bannerWarn]}>
          <Text style={styles.h2}>{t(endedKey)}</Text>
          <Text style={styles.dim}>{t('waiting.endedHint')}</Text>
        </View>
        <Pressable style={styles.button} onPress={onPostAgain}>
          <Text style={styles.buttonText}>{t('waiting.postAgain')}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={countdownStyle}>{`${minutes}:${String(seconds).padStart(2, '0')}`}</Text>
      <Text style={[styles.dim, { textAlign: 'center' }]}>{t('waiting.untilOffers')}</Text>

      <View style={styles.spread}>
        <Text style={styles.dim}>{t('waiting.sentTo', { count: data.suppliersNotified })}</Text>
        <Text style={styles.dim}>{t('waiting.responded', { count: data.offers.length })}</Text>
      </View>

      {widened && (
        <View style={[styles.banner, styles.bannerWarn]}>
          <Text style={styles.body}>{t('waiting.widened')}</Text>
        </View>
      )}

      {data.offers.length === 0 ? (
        <View style={[styles.banner, styles.bannerInfo]}>
          {/* Said plainly, with what happens next. Silence is what loses a buyer. */}
          <Text style={styles.h2}>{t('waiting.noneYet')}</Text>
          <Text style={styles.dim}>{t('waiting.noneYetHint', { minutes: responseMinutes })}</Text>
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>{t('waiting.sort')}</Text>
            {(
              [
                ['price_asc', 'waiting.byPrice'],
                ['soonest', 'waiting.bySoonest'],
                ['closest', 'waiting.byClosest'],
                ['warranty_desc', 'waiting.byWarranty'],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setSort(key)}
                style={[styles.button, sort === key ? styles.buttonPrimary : null, { minHeight: 40, flex: 1 }]}
              >
                <Text style={sort === key ? styles.buttonPrimaryText : styles.buttonText}>{t(label)}</Text>
              </Pressable>
            ))}
          </View>

          <FlatList
            scrollEnabled={false}
            data={data.offers}
            keyExtractor={(offer) => offer.id}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            renderItem={({ item }) => (
              <OfferCard
                offer={item}
                language={language}
                currency={currency}
                currencyExponent={currencyExponent}
                onChoose={onChoose}
              />
            )}
          />
        </>
      )}
    </ScrollView>
  );
}

function OfferCard({
  offer,
  language,
  currency,
  currencyExponent,
  onChoose,
}: {
  offer: BuyerOffer;
  language: Language;
  currency: string;
  currencyExponent: number;
  onChoose: (offer: BuyerOffer) => void;
}): JSX.Element {
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);

  return (
    <View style={styles.offer}>
      <View style={styles.spread}>
        {/* An anonymous label, never a yard name. */}
        <Text style={styles.offerLabel}>{t('waiting.offer', { label: offer.label })}</Text>
        <Text style={styles.offerPrice}>{formatMoney(language, offer.priceCents, currency, currencyExponent)}</Text>
      </View>

      <Text style={styles.body}>
        {t(`new.${offer.condition === 'refurbished' ? 'refurbished' : 'used'}`)}
        {' · '}
        {offer.warrantyDays === 0 ? t('waiting.noWarranty') : t('waiting.warranty', { days: offer.warrantyDays })}
      </Text>

      <Text style={styles.dim}>
        {/* Distance, never a direction. Distance plus a bearing locates a yard on
            a map in about four seconds. */}
        {t('waiting.away', { km: offer.distanceKm })}
        {' · '}
        {offer.readyInMin === 0 ? t('waiting.readyNow') : t('waiting.readyIn', { minutes: offer.readyInMin })}
      </Text>

      {offer.notes !== null && offer.notes !== '' && <Text style={styles.dim}>{offer.notes}</Text>}

      {offer.media.length > 0 && (
        <View style={styles.row}>
          {offer.media.slice(0, 3).map((media) => (
            <Image
              key={media.url}
              source={{ uri: media.url }}
              style={{ width: 92, height: 92, borderRadius: 10, backgroundColor: colors.surfaceRaised }}
            />
          ))}
        </View>
      )}

      <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => onChoose(offer)}>
        <Text style={styles.buttonPrimaryText}>{t('waiting.choose')}</Text>
      </Pressable>
    </View>
  );
}
