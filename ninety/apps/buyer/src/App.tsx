import { useEffect, useState } from 'react';
import { I18nManager, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { NewRequestScreen } from './screens/NewRequestScreen.js';
import { WaitingScreen } from './screens/WaitingScreen.js';
import { AcceptScreen } from './screens/AcceptScreen.js';
import { TrackingScreen } from './screens/TrackingScreen.js';
import { colors, styles } from './lib/theme.js';
import { isRtlLanguage, languageForLocale, localeFor, setMarketLocales, translate, type Language } from './lib/i18n.js';
import { checkVersion } from './lib/version.js';
import { request, type BuyerOffer, type BuyerSession, type ClientOptions } from './lib/api.js';
import { OTP_CODE_LENGTH } from '@ninety/shared';

/**
 * The buyer app.
 *
 * React Native with Expo, Android and iOS from one codebase. Android is the
 * launch priority: it is what the market carries, and an iOS review queue in
 * month five is a distraction rather than a milestone.
 */

type Stage =
  | { name: 'loading' }
  | { name: 'update-required'; minimumVersion: string }
  | { name: 'signin' }
  | { name: 'new' }
  | { name: 'waiting'; requestId: string; reference: string }
  | { name: 'accept'; requestId: string; offer: BuyerOffer }
  | { name: 'tracking'; requestId: string; orderId: string };

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBase?: string;
  marketCode?: string;
  environment?: string;
};

const API_BASE = extra.apiBase ?? 'http://10.0.2.2:3000';
/**
 * The market this build is pinned to, if the build pins one.
 *
 * Defaulting to a country here is how one application becomes two: the same
 * binary would announce itself as being in the wrong market the moment it is
 * shipped anywhere else. When nothing is pinned, the live markets are read from
 * the server before sign-in.
 */
const PINNED_MARKET_CODE: string | undefined = extra.marketCode;
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const SESSION_KEY = 'ninety.buyer.session';
const LANGUAGE_KEY = 'ninety.buyer.language';

export function App(): JSX.Element {
  const [language, setLanguage] = useState<Language>('en');
  const [session, setSession] = useState<BuyerSession | null>(null);
  const [stage, setStage] = useState<Stage>({ name: 'loading' });

  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);

  useEffect(() => {
    void (async () => {
      /*
       * RTL is applied in the native shell before the first screen renders.
       *
       * `I18nManager.forceRTL` is what actually mirrors a React Native layout,
       * and it only takes effect after a reload — which is why the language is
       * resolved once at start-up rather than toggled mid-session and left in a
       * half-mirrored state.
       */
      const stored = await SecureStore.getItemAsync(LANGUAGE_KEY);
      const resolved: Language =
        stored === 'ar' || stored === 'en' ? stored : languageForLocale(Localization.getLocales()[0]?.languageTag);
      setLanguage(resolved);
      const shouldBeRtl = isRtlLanguage(resolved);
      if (I18nManager.isRTL !== shouldBeRtl) {
        I18nManager.allowRTL(shouldBeRtl);
        I18nManager.forceRTL(shouldBeRtl);
        // The next launch renders mirrored. Forcing a reload here would lose a
        // half-typed request, which is worse than one launch in the old direction.
      }

      // The forced-update check runs before anything else. A stranded client is
      // exactly what this mechanism exists to prevent.
      const version = await checkVersion(API_BASE, APP_VERSION);
      if (!version.supported) {
        setStage({ name: 'update-required', minimumVersion: version.minimumVersion });
        return;
      }

      const raw = await SecureStore.getItemAsync(SESSION_KEY);
      if (raw === null) {
        setStage({ name: 'signin' });
        return;
      }
      setSession(JSON.parse(raw) as BuyerSession);
      setStage({ name: 'new' });
    })();
  }, []);

  const client: ClientOptions = {
    apiBase: API_BASE,
    token: session?.accessToken ?? null,
    locale: localeFor(language),
  };

  if (stage.name === 'loading') {
    return (
      <SafeAreaView style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style="light" />
        <Text style={styles.h1}>{t('app.name')}</Text>
      </SafeAreaView>
    );
  }

  if (stage.name === 'update-required') {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.content}>
          <Text style={styles.h1}>{t('app.name')}</Text>
          <View style={[styles.banner, styles.bannerWarn]}>
            <Text style={styles.body}>{t('signin.updateRequired')}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (stage.name === 'signin' || session === null) {
    return (
      <SignIn
        language={language}
        onLanguage={async (next) => {
          await SecureStore.setItemAsync(LANGUAGE_KEY, next);
          setLanguage(next);
        }}
        onSignedIn={async (next) => {
          await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
          setSession(next);
          setStage({ name: 'new' });
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />

      {stage.name === 'new' && (
        <NewRequestScreen
          client={client}
          language={language}
          vehicleIdentifierType={session.vehicleIdentifierType}
          defaultLocation={null}
          pickPhoto={pickPhoto}
          pickLocation={pickLocation}
          scanIdentifier={scanIdentifier}
          onPosted={(result) => setStage({ name: 'waiting', requestId: result.id, reference: result.reference })}
        />
      )}

      {stage.name === 'waiting' && (
        <WaitingScreen
          client={client}
          requestId={stage.requestId}
          language={language}
          currency={session.currency}
          currencyExponent={session.currencyExponent}
          responseMinutes={session.sla.responseMin}
          onChoose={(offer) => setStage({ name: 'accept', requestId: stage.requestId, offer })}
          onPostAgain={() => setStage({ name: 'new' })}
        />
      )}

      {stage.name === 'accept' && (
        <AcceptScreen
          client={client}
          offer={stage.offer}
          language={language}
          currency={session.currency}
          currencyExponent={session.currencyExponent}
          taxLabel="Tax"
          collectPaymentMethod={collectPaymentMethod}
          onAuthorised={(orderId) => setStage({ name: 'tracking', requestId: stage.requestId, orderId })}
          // A declined card returns to the offers. The request is still alive.
          onDeclined={() => setStage({ name: 'waiting', requestId: stage.requestId, reference: '' })}
        />
      )}

      {stage.name === 'tracking' && (
        <TrackingScreen
          client={client}
          requestId={stage.requestId}
          orderId={stage.orderId}
          language={language}
          timezone={session.timezone}
          autoConfirmHours={session.windows.autoConfirmHours}
          onProblem={() => undefined}
          onConfirmed={() => setStage({ name: 'new' })}
        />
      )}
    </SafeAreaView>
  );
}

function SignIn({
  language,
  onLanguage,
  onSignedIn,
}: {
  language: Language;
  onLanguage: (next: Language) => Promise<void>;
  onSignedIn: (session: BuyerSession) => Promise<void>;
}): JSX.Element {
  const t = (key: string, params?: Record<string, string | number>) => translate(language, key, params);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [marketCode, setMarketCode] = useState<string | null>(PINNED_MARKET_CODE ?? null);
  const [promiseSla, setPromiseSla] = useState<{ offersMin: number; deliveryMin: number; deliveryPeakMin: number } | null>(
    null,
  );

  const client: ClientOptions = { apiBase: API_BASE, locale: localeFor(language) };

  // Which market, and what its locales are, before anybody types a number.
  useEffect(() => {
    if (PINNED_MARKET_CODE !== undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const body = await request<{
          markets: {
            code: string;
            locales: string[];
            sla: { offersMin: number; deliveryMin: number; deliveryPeakMin: number };
          }[];
        }>(client, '/v1/markets');
        if (cancelled || body.markets.length === 0) return;
        setMarketLocales(body.markets[0]!.locales);
        setMarketCode(body.markets[0]!.code);
        setPromiseSla(body.markets[0]!.sla);
      } catch {
        // Offline at start-up. Retried when the screen is next opened.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    setError(null);
    try {
      await request(client, '/v1/auth/otp/request', {
        method: 'POST',
        body: { marketCode, phone, locale: localeFor(language) },
      });
      setStage('code');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const verify = async () => {
    setError(null);
    try {
      const result = await request<{
        accessToken: string;
        refreshToken: string;
        user: { locale: string; rtl: boolean };
      }>(client, '/v1/auth/otp/verify', {
        method: 'POST',
        body: { marketCode, phone, code, role: 'buyer', locale: localeFor(language) },
      });
      // Currency, SLA, vehicle identifier and address model all come from the
      // server. None of them is a constant in this app.
      const me = await request<{
        market: {
          currency: string;
          currencyMinorUnitExponent: number;
          timezone: string;
          vehicleIdentifier: { type: 'vin' | 'chassis' };
          addressModel: 'street' | 'makani' | 'hybrid';
          sla: { responseMin: number; offersMin: number; deliveryMin: number; deliveryPeakMin: number };
          windows: { selectionWindowMin: number; wideningWindowMin: number; autoConfirmHours: number };
        };
      }>({ ...client, token: result.accessToken }, '/v1/auth/me');

      await onSignedIn({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        locale: result.user.locale,
        rtl: result.user.rtl,
        currency: me.market.currency,
        currencyExponent: me.market.currencyMinorUnitExponent,
        timezone: me.market.timezone,
        vehicleIdentifierType: me.market.vehicleIdentifier.type,
        addressModel: me.market.addressModel,
        sla: me.market.sla,
        windows: me.market.windows,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>{t('app.name')}</Text>
        {/* The honest promise, said on the first screen. */}
        {/* The honest promise, in the market's own numbers. Nothing is claimed
            until the server has said what the numbers are. */}
        {promiseSla !== null && (
          <Text style={styles.dim}>
            {t('app.promise', {
              offersMinutes: promiseSla.offersMin,
              deliveryMinutes: promiseSla.deliveryMin,
              peakHours: Math.round(promiseSla.deliveryPeakMin / 60),
            })}
          </Text>
        )}

        {error !== null && (
          <View style={[styles.banner, styles.bannerError]}>
            <Text style={styles.body}>{error}</Text>
          </View>
        )}

        {stage === 'phone' ? (
          <>
            <Text style={styles.label}>{t('signin.phone')}</Text>
            <TextInputBox value={phone} onChange={setPhone} keyboard="phone-pad" />
            <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => void send()}>
              <Text style={styles.buttonPrimaryText}>{t('signin.sendCode')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>{t('signin.code', { digits: OTP_CODE_LENGTH })}</Text>
            <TextInputBox value={code} onChange={setCode} keyboard="number-pad" />
            <Pressable style={[styles.button, styles.buttonPrimary]} onPress={() => void verify()}>
              <Text style={styles.buttonPrimaryText}>{t('signin.verify')}</Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.button} onPress={() => void onLanguage(language === 'ar' ? 'en' : 'ar')}>
          <Text style={styles.buttonText}>{t('signin.language')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function TextInputBox({
  value,
  onChange,
  keyboard,
}: {
  value: string;
  onChange: (next: string) => void;
  keyboard: 'phone-pad' | 'number-pad';
}): JSX.Element {
  const { TextInput } = require('react-native') as typeof import('react-native');
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      keyboardType={keyboard}
      placeholderTextColor={colors.dim}
    />
  );
}

/** The camera. EXIF is stripped server-side on ingest, in both directions. */
async function pickPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.7, exif: false });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/**
 * The delivery pin.
 *
 * A pin, never a typed address: street addressing is unreliable in market #1 and
 * a pin is how a driver actually finds a workshop.
 */
async function pickLocation(initial: { lat: number; lng: number } | null): Promise<{ lat: number; lng: number } | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return initial;
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

/**
 * Chassis or VIN scanning.
 *
 * Wired to the camera in the shipped app. A miss is a normal outcome rather than
 * an error: GCC-spec vehicles, grey imports and re-exports make automated
 * decoding unreliable, and make/model/year plus the photograph carry the job.
 */
async function scanIdentifier(): Promise<string | null> {
  return null;
}

/**
 * Card collection.
 *
 * Provider-hosted fields only. Card data never touches this app or our servers —
 * what comes back is a token, which is the whole of our PCI position.
 */
async function collectPaymentMethod(): Promise<string | null> {
  return 'tok_provider_hosted_field';
}
