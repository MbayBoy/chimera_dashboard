import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { colors, styles } from '../lib/theme.js';
import { formatTime, translate, type Language } from '../lib/i18n.js';
import { confirmReceipt, fetchTracking, type ClientOptions, type TrackingResponse } from '../lib/api.js';

/**
 * Tracking.
 *
 * Deliberately a list of steps and an ETA, and deliberately NOT a live map.
 *
 * A moving dot draws a line straight back to the yard. It is the single most
 * common way a delivery product undoes its own double-blind, and it is lovely
 * enough that somebody suggests it every few months — so the absence is written
 * down here rather than left to be rediscovered.
 *
 * The payload this screen renders has no pickup location in it at all. That is
 * enforced by the server's tracking serialiser and asserted in a test against
 * the whole payload, not by this file remembering not to display it.
 */
export function TrackingScreen({
  client,
  requestId,
  orderId,
  language,
  timezone,
  onProblem,
  onConfirmed,
}: {
  client: ClientOptions;
  requestId: string;
  orderId: string;
  language: Language;
  timezone: string;
  onProblem: () => void;
  onConfirmed: () => void;
}): JSX.Element {
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchTracking(client, requestId));
    } catch {
      /* retried on the next poll */
    }
  }, [client, requestId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [load]);

  if (data === null || data.tracking === null) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const { tracking } = data;
  const delivered = tracking.deliveredAt !== null;

  const confirm = async () => {
    setBusy(true);
    try {
      await confirmReceipt(client, orderId);
      onConfirmed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t('tracking.title')}</Text>
      <Text style={styles.dim}>{data.reference}</Text>

      <View style={styles.card}>
        {tracking.steps.map((step) => (
          <View key={step.key} style={styles.step}>
            <Text style={step.done ? styles.stepDone : styles.stepPending}>{step.done ? '✓' : '○'}</Text>
            <Text style={[styles.body, step.done ? null : styles.dim]}>{step.label}</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.dim}>{step.at === null ? '' : formatTime(language, new Date(step.at), timezone)}</Text>
          </View>
        ))}
      </View>

      {tracking.etaAt !== null && !delivered && (
        <View style={[styles.banner, styles.bannerInfo]}>
          <Text style={styles.h2}>{t('tracking.eta', { time: formatTime(language, new Date(tracking.etaAt), timezone) })}</Text>
        </View>
      )}

      {delivered && (
        <>
          <Pressable style={[styles.button, styles.buttonPrimary]} disabled={busy} onPress={() => void confirm()}>
            <Text style={styles.buttonPrimaryText}>{t('tracking.confirm')}</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={onProblem}>
            <Text style={styles.buttonText}>{t('tracking.problem')}</Text>
          </Pressable>
          {/* Said out loud, because a silent auto-capture is how trust goes. */}
          <Text style={styles.dim}>{t('tracking.autoConfirm')}</Text>
        </>
      )}
    </ScrollView>
  );
}
