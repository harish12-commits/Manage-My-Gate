/**
 * One-time migration: rewrite visitor-module phone numbers to E.164.
 *
 * Before international support, visitor passes, walk-in logs and blacklist
 * entries stored bare 10-digit numbers ("9876543210"). Lookups (blacklist
 * match) are exact, so every stored number must share one format.
 *
 * Bare numbers are read in the organization's countryCode (default IN).
 * Numbers that cannot be parsed are left untouched and reported.
 *
 * Usage:  node scripts/migrate-phones-e164.js           (dry run)
 *         node scripts/migrate-phones-e164.js --apply   (write changes)
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectToDb } from '../src/config/db/mongodbConnectToDb.config.js';
import Organization from '../src/features/organization/organization.model.js';
import { VisitorPass } from '../src/features/visitorPass/visitorPass.model.js';
import { VisitorLog } from '../src/features/visitorLog/visitorLog.model.js';
import { Blacklist } from '../src/features/blacklist/blacklist.model.js';
import { normalizePhone } from '../src/utils/phone.utils.js';

const APPLY = process.argv.includes('--apply');
const stats = { scanned: 0, changed: 0, unparseable: [] };
const countryCache = new Map();

async function countryFor(orgId) {
  const key = String(orgId || '');
  if (!countryCache.has(key)) {
    const org = key ? await Organization.findById(key).select('countryCode').lean() : null;
    countryCache.set(key, org?.countryCode || 'IN');
  }
  return countryCache.get(key);
}

/** Returns the E.164 value, or null when unchanged / unparseable. */
function convert(raw, country, where) {
  if (!raw || typeof raw !== 'string' || !raw.trim() || raw.trim() === '—') return null;
  const e164 = normalizePhone(raw, country);
  if (!e164) {
    stats.unparseable.push(`${where}: "${raw}"`);
    return null;
  }
  return e164 === raw ? null : e164;
}

async function migrate(Model, name, fields) {
  const cursor = Model.find({ $or: fields.map((f) => ({ [f.query]: { $exists: true, $nin: [null, ''] } })) })
    .select(['orgId', ...fields.map((f) => f.select)].join(' '))
    .lean()
    .cursor();

  for await (const doc of cursor) {
    stats.scanned += 1;
    const country = await countryFor(doc.orgId);
    const $set = {};
    for (const f of fields) f.collect(doc, country, $set, `${name}/${doc._id}`);
    if (Object.keys($set).length) {
      stats.changed += 1;
      if (APPLY) await Model.updateOne({ _id: doc._id }, { $set });
    }
  }
}

async function run() {
  await connectToDb();

  await migrate(VisitorPass, 'VisitorPass', [
    {
      query: 'visitorDetails.phone',
      select: 'visitorDetails.phone',
      collect: (doc, c, $set, where) => {
        const v = convert(doc.visitorDetails?.phone, c, where);
        if (v) $set['visitorDetails.phone'] = v;
      },
    },
    {
      query: 'groupGuests.phone',
      select: 'groupGuests',
      collect: (doc, c, $set, where) => {
        (doc.groupGuests || []).forEach((g, i) => {
          const v = convert(g?.phone, c, `${where}/guest${i}`);
          if (v) $set[`groupGuests.${i}.phone`] = v;
        });
      },
    },
  ]);

  await migrate(VisitorLog, 'VisitorLog', [
    {
      query: 'snapshot.phone',
      select: 'snapshot.phone',
      collect: (doc, c, $set, where) => {
        const v = convert(doc.snapshot?.phone, c, where);
        if (v) $set['snapshot.phone'] = v;
      },
    },
  ]);

  await migrate(Blacklist, 'Blacklist', [
    {
      query: 'phone',
      select: 'phone',
      collect: (doc, c, $set, where) => {
        const v = convert(doc.phone, c, where);
        if (v) $set.phone = v;
      },
    },
  ]);

  console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'} — scanned ${stats.scanned}, ${APPLY ? 'updated' : 'would update'} ${stats.changed}`);
  if (stats.unparseable.length) {
    console.log(`Left unchanged (unparseable) ${stats.unparseable.length}:`);
    stats.unparseable.slice(0, 200).forEach((line) => console.log(`  ${line}`));
  }
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Phone migration failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
