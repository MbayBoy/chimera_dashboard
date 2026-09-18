import { I18nManager, StyleSheet } from 'react-native';

/**
 * The buyer app's visual language.
 *
 * Read on a workshop floor, in a hurry, on a mid-range Android phone. Large
 * type, strong contrast, generous targets — the same constraints as the terminal
 * for the same reasons, minus the gloves.
 */
export const colors = {
  ink: '#0b0d10',
  surface: '#151a20',
  surfaceRaised: '#1d242c',
  line: '#2b333d',
  text: '#f7f9fb',
  dim: '#a7b3c0',
  brand: '#f5b700',
  brandInk: '#0b0d10',
  ok: '#3ba55d',
  warn: '#f5b700',
  bad: '#e5484d',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/** `start`/`end` rather than `left`/`right`: the layout mirrors under RTL. */
export const isRtl = (): boolean => I18nManager.isRTL;

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.md, gap: spacing.md },

  h1: { color: colors.text, fontSize: 24, fontWeight: '800' },
  h2: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.text, fontSize: 16 },
  dim: { color: colors.dim, fontSize: 14 },

  label: {
    color: colors.dim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: isRtl() ? 0 : 1,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },

  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 2,
    borderRadius: 12,
    color: colors.text,
    fontSize: 18,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    // Mirrors automatically; never hardcode left.
    textAlign: isRtl() ? 'right' : 'left',
  },

  button: {
    minHeight: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.line,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  buttonPrimary: { backgroundColor: colors.brand, borderColor: colors.brand, minHeight: 64 },
  buttonText: { color: colors.text, fontSize: 17, fontWeight: '800' },
  buttonPrimaryText: { color: colors.brandInk, fontSize: 18, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  /* The countdown is the hero element of the waiting screen. */
  countdown: {
    color: colors.ok,
    fontSize: 64,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    // Digits read left to right even inside a mirrored layout.
    writingDirection: 'ltr',
  },
  countdownSoon: { color: colors.warn },
  countdownUrgent: { color: colors.bad },

  offer: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  offerPrice: { color: colors.text, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  offerLabel: { color: colors.brand, fontSize: 14, fontWeight: '800' },

  banner: { borderRadius: 12, padding: spacing.md, borderWidth: 1 },
  bannerInfo: { borderColor: colors.ok, backgroundColor: 'rgba(59,165,93,0.12)' },
  bannerWarn: { borderColor: colors.warn, backgroundColor: 'rgba(245,183,0,0.12)' },
  bannerError: { borderColor: colors.bad, backgroundColor: 'rgba(229,72,77,0.12)' },

  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  stepDone: { color: colors.ok, fontSize: 20 },
  stepPending: { color: colors.dim, fontSize: 20 },

  tabs: {
    flexDirection: 'row',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    backgroundColor: colors.surface,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  tabActive: { backgroundColor: colors.surfaceRaised },
  tabText: { color: colors.dim, fontWeight: '700' },
  tabTextActive: { color: colors.brand },
});
