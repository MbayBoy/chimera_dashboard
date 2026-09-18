import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { colors, styles } from '../lib/theme.js';
import { translate, type Language } from '../lib/i18n.js';
import { request, type ClientOptions } from '../lib/api.js';

/**
 * Post a request.
 *
 * Under sixty seconds on a workshop floor. Vehicle, part, photo, pin, send.
 *
 * The delivery location is a map pin and never a typed address. In market #1
 * street addressing is weak and Makani numbers and pins are how people actually
 * navigate, so the data model assumes a pin everywhere — a typed address that
 * does not resolve is a driver phoning a buyer, which is a conversation neither
 * side should be having.
 *
 * The chassis scan is a convenience, not a source of truth. GCC-spec vehicles,
 * grey imports and re-exports make automated decoding unreliable, so a failed
 * decode falls straight through to make/model/year rather than blocking.
 */
export interface NewRequestResult {
  readonly id: string;
  readonly reference: string;
}

export function NewRequestScreen({
  client,
  language,
  vehicleIdentifierType,
  defaultLocation,
  onPosted,
  pickPhoto,
  pickLocation,
  scanIdentifier,
}: {
  client: ClientOptions;
  language: Language;
  vehicleIdentifierType: 'vin' | 'chassis';
  defaultLocation: { lat: number; lng: number } | null;
  onPosted: (result: NewRequestResult) => void;
  pickPhoto: () => Promise<string | null>;
  pickLocation: (initial: { lat: number; lng: number } | null) => Promise<{ lat: number; lng: number } | null>;
  scanIdentifier: () => Promise<string | null>;
}): JSX.Element {
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [partDescription, setPartDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(defaultLocation);
  const [acceptUsed, setAcceptUsed] = useState(true);
  const [acceptRefurbished, setAcceptRefurbished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    const identifier = await scanIdentifier();
    if (identifier === null) return;
    try {
      const decoded = await request<{ match: { make: string; model: string; year: number } | null }>(
        client,
        `/v1/vehicles/decode?identifier=${encodeURIComponent(identifier)}`,
      );
      if (decoded.match !== null) {
        setMake(decoded.match.make);
        setModel(decoded.match.model);
        setYear(String(decoded.match.year));
      }
      // A miss is silent on purpose: the fields below are the real input and the
      // buyer should just carry on typing rather than be told a scan "failed".
    } catch {
      /* the scan is a convenience; the manual fields carry the job */
    }
  };

  const post = async (acknowledgeDuplicate = false) => {
    setError(null);
    if (make.trim() === '' || model.trim() === '' || partDescription.trim() === '') {
      setError(t('errors.required'));
      return;
    }
    if (location === null) {
      setError(t('errors.location'));
      return;
    }
    if (photo === null) {
      setError(t('errors.photo'));
      return;
    }

    setBusy(true);
    try {
      const created = await request<NewRequestResult>(client, '/v1/requests', {
        method: 'POST',
        body: {
          vehicle: { kind: 'manual', make: make.trim(), model: model.trim(), year: Number(year) || new Date().getFullYear() },
          partCategoryId: null,
          partDescription: partDescription.trim(),
          conditionAccepted: [
            ...(acceptUsed ? ['used'] : []),
            ...(acceptRefurbished ? ['refurbished'] : []),
          ],
          quantity: 1,
          deliveryLocation: location,
          deliveryAddress: {},
          submit: true,
          ...(acknowledgeDuplicate ? { acknowledgeDuplicate: true } : {}),
        },
      });
      onPosted(created);
    } catch (err) {
      const apiError = err as { code?: string; messageKey?: string; message?: string };
      if (apiError.code === 'conflict') {
        // Detected and warned, never silently fanned out twice. The buyer can
        // post it again deliberately.
        setError(apiError.message ?? t('errors.generic'));
      } else {
        setError(apiError.message ?? t('errors.generic'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>{t('new.title')}</Text>

      {error !== null && (
        <View style={[styles.banner, styles.bannerError]}>
          <Text style={styles.body}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>{t('new.vehicle')}</Text>
      <Pressable style={styles.button} onPress={() => void scan()}>
        <Text style={styles.buttonText}>
          {vehicleIdentifierType === 'chassis' ? `📷 ${t('new.scan')}` : `📷 ${t('new.scan')}`}
        </Text>
      </Pressable>
      <Text style={styles.dim}>{t('new.scanHint')}</Text>

      <TextInput style={styles.input} placeholder={t('new.make')} placeholderTextColor={colors.dim} value={make} onChangeText={setMake} />
      <TextInput style={styles.input} placeholder={t('new.model')} placeholderTextColor={colors.dim} value={model} onChangeText={setModel} />
      <TextInput
        style={styles.input}
        placeholder={t('new.year')}
        placeholderTextColor={colors.dim}
        value={year}
        onChangeText={setYear}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>{t('new.part')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('new.searchPart')}
        placeholderTextColor={colors.dim}
        value={partDescription}
        onChangeText={setPartDescription}
      />

      <Text style={styles.label}>{t('new.photo')}</Text>
      <Pressable
        style={[styles.button, { minHeight: 110 }]}
        onPress={async () => setPhoto(await pickPhoto())}
      >
        <Text style={styles.buttonText}>📷 {t('new.addPhoto')}</Text>
      </Pressable>
      {photo !== null && <Image source={{ uri: photo }} style={{ width: 120, height: 120, borderRadius: 12 }} />}

      <Text style={styles.label}>{t('new.condition')}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.button, acceptUsed ? styles.buttonPrimary : null, { flex: 1 }]}
          onPress={() => setAcceptUsed(!acceptUsed)}
        >
          <Text style={acceptUsed ? styles.buttonPrimaryText : styles.buttonText}>{t('new.used')}</Text>
        </Pressable>
        <Pressable
          style={[styles.button, acceptRefurbished ? styles.buttonPrimary : null, { flex: 1 }]}
          onPress={() => setAcceptRefurbished(!acceptRefurbished)}
        >
          <Text style={acceptRefurbished ? styles.buttonPrimaryText : styles.buttonText}>{t('new.refurbished')}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>{t('new.deliverTo')}</Text>
      <Pressable style={styles.button} onPress={async () => setLocation(await pickLocation(location))}>
        <Text style={styles.buttonText}>📍 {t('new.movePin')}</Text>
      </Pressable>
      {location !== null && (
        <Text style={styles.dim}>
          {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
        </Text>
      )}

      <Pressable style={[styles.button, styles.buttonPrimary]} disabled={busy} onPress={() => void post()}>
        <Text style={styles.buttonPrimaryText}>{busy ? t('new.posting') : t('new.post')}</Text>
      </Pressable>
    </ScrollView>
  );
}
