/**
 * The Play Data Safety declaration is a compliance statement about what the app
 * actually does. A permission added to the manifest without a corresponding
 * entry in the declaration is a policy violation waiting to be found by someone
 * other than us — so the build fails instead.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const config = readFileSync(join(root, 'apps/buyer/app.config.ts'), 'utf8');
const declaration = readFileSync(join(root, 'apps/buyer/store/DATA-SAFETY.md'), 'utf8');

/** Each Android permission and the section of the declaration that must cover it. */
const REQUIRES_DECLARATION = {
  'android.permission.CAMERA': '### Photos',
  'android.permission.ACCESS_COARSE_LOCATION': '### Location',
  'android.permission.ACCESS_FINE_LOCATION': '### Location',
  'android.permission.RECORD_AUDIO': '### Audio',
  'android.permission.READ_CONTACTS': '### Contacts',
  'android.permission.READ_CALENDAR': '### Calendar',
  'android.permission.READ_SMS': '### SMS',
  'android.permission.BODY_SENSORS': '### Health',
};

const permissionsBlock = /permissions:\s*\[([\s\S]*?)\]/.exec(config)?.[1] ?? '';
const declared = [...permissionsBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);

const problems = [];
for (const permission of declared) {
  const section = REQUIRES_DECLARATION[permission];
  if (section === undefined) continue;
  if (!declaration.includes(section)) {
    problems.push(`${permission} is requested but "${section}" is missing from store/DATA-SAFETY.md`);
  }
}

// And the reverse: an advertising SDK would make the "no advertising identifier"
// claim false, so nothing may quietly introduce one.
const buyerPackage = JSON.parse(readFileSync(join(root, 'apps/buyer/package.json'), 'utf8'));
const dependencies = Object.keys({ ...buyerPackage.dependencies, ...buyerPackage.devDependencies });
const AD_SDK = /admob|facebook|firebase-analytics|appsflyer|adjust|branch|amplitude|mixpanel|segment/i;
for (const dependency of dependencies) {
  if (AD_SDK.test(dependency)) {
    problems.push(
      `${dependency} looks like an advertising or analytics SDK. The declaration claims no advertising identifier is collected — reconcile them before shipping.`,
    );
  }
}

if (problems.length > 0) {
  console.error('\nData safety declaration is out of step with the app:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  process.exit(1);
}
console.log(`data safety declaration covers ${declared.length} declared permission(s)`);
