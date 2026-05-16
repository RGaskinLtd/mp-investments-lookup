import { getPool } from './db';

const BASE = 'https://members-api.parliament.uk/api';
const CACHE_TTL_HOURS = 24;

export interface MP {
  parliamentId: number;
  name: string;
  party: string;
  constituency: string | null;
  thumbnailUrl: string | null;
  nameFullTitle: string | null;
}

export interface Interest {
  category: string;
  rawText: string;
  companyName: string | null;
  amountGbp: number | null;
}

const COMPANY_SUFFIX =
  '(?:Ltd|Limited|plc|PLC|LLP|LLC|Inc\\.?|Group|Holdings|Capital|Partners|Ventures|Fund|Trust|Foundation|Association|Services|Solutions|Consulting|Media|Publishing)';

function parseInterest(rawText: string): { companyName: string | null; amountGbp: number | null } {
  const donorMatch = rawText.match(
    /Name of (?:donor|company|employer|organisation|organization):\s*([^\n\r]+)/i
  );
  const contextMatch = rawText.match(
    new RegExp(`(?:in|from|at|with|by|of)\\s+([A-Z][A-Za-z0-9\\s&'.,/-]+?${COMPANY_SUFFIX})`, '')
  );
  const bareMatch = rawText.match(
    new RegExp(`([A-Z][A-Za-z0-9\\s&'.,/-]+?${COMPANY_SUFFIX})`)
  );

  const rawName = (donorMatch?.[1] ?? contextMatch?.[1] ?? bareMatch?.[1] ?? '').trim();
  const companyName = rawName.replace(/,\s*[A-Z0-9]{1,4}\s+\w.*$/, '').trim() || null;

  const amountMatch = rawText.match(/£\s*([\d,]+(?:\.\d{1,2})?)\s*(k|thousand)?/i);
  let amountGbp: number | null = null;
  if (amountMatch) {
    const raw = parseFloat(amountMatch[1].replace(/,/g, ''));
    const suffix = (amountMatch[2] || '').toLowerCase();
    amountGbp = suffix === 'k' || suffix === 'thousand' ? raw * 1000 : raw;
  }

  return { companyName, amountGbp };
}

const PAGE_SIZE = 20; // Parliament API caps take at 20

async function fetchAllMPsFromAPI(partyId: number, partyName: string): Promise<MP[]> {
  const all: MP[] = [];
  let skip = 0;
  let total = Infinity;

  while (all.length < total) {
    const url = new URL(`${BASE}/Members/Search`);
    url.searchParams.set('PartyId', String(partyId));
    url.searchParams.set('House', '1');
    url.searchParams.set('IsCurrentMember', 'true');
    url.searchParams.set('take', String(PAGE_SIZE));
    url.searchParams.set('skip', String(skip));

    const data = await $fetch<any>(url.toString());
    total = data.totalResults ?? 0;
    const items: any[] = data.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      all.push({
        parliamentId: item.value.id,
        name: item.value.nameDisplayAs,
        party: partyName,
        constituency: item.value.latestHouseMembership?.membershipFrom ?? null,
        thumbnailUrl: item.value.thumbnailUrl ?? null,
        nameFullTitle: item.value.nameFullTitle ?? null,
      });
    }
    skip += items.length;
  }

  return all;
}

export async function getMPsByParty(partyId: number, partyName: string, limit: number): Promise<MP[]> {
  const pool = await getPool();

  const cached = await pool.query<any>(
    `SELECT * FROM mps WHERE party = $1 AND cached_at > NOW() - ($2 || ' hours')::INTERVAL ORDER BY name`,
    [partyName, CACHE_TTL_HOURS]
  );

  const countData = await $fetch<any>(`${BASE}/Members/Search`, {
    query: { PartyId: partyId, House: 1, IsCurrentMember: true, take: 1 },
  });
  const apiTotal: number = countData.totalResults ?? 0;

  if (cached.rows.length < apiTotal) {
    const mps = await fetchAllMPsFromAPI(partyId, partyName);
    for (const mp of mps) {
      await pool.query(
        `INSERT INTO mps (parliament_id, name, party, constituency, thumbnail_url, name_full_title, cached_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (parliament_id) DO UPDATE
           SET name=$2, party=$3, constituency=$4, thumbnail_url=$5, name_full_title=$6, cached_at=NOW()`,
        [mp.parliamentId, mp.name, mp.party, mp.constituency, mp.thumbnailUrl, mp.nameFullTitle]
      );
    }
    sortBySeniority(mps);
    return mps.slice(0, limit);
  }

  const all = cached.rows.map(rowToMP);
  sortBySeniority(all);
  return all.slice(0, limit);
}

export async function getInterestsForMP(parliamentId: number): Promise<Interest[]> {
  const pool = await getPool();

  const cached = await pool.query<any>(
    `SELECT * FROM interests WHERE mp_id = $1 AND cached_at > NOW() - ($2 || ' hours')::INTERVAL`,
    [parliamentId, CACHE_TTL_HOURS]
  );
  if (cached.rows.length > 0) return cached.rows.map(rowToInterest);

  const data = await $fetch<any>(`${BASE}/Members/${parliamentId}/RegisteredInterests`);
  const categories: any[] = data.value ?? [];

  const interests: Interest[] = [];
  for (const category of categories) {
    for (const entry of category.interests ?? []) {
      const rawText: string = entry.interest ?? entry.summary ?? '';
      const { companyName, amountGbp } = parseInterest(rawText);
      interests.push({ category: category.name, rawText, companyName, amountGbp });
    }
  }

  await pool.query('DELETE FROM interests WHERE mp_id = $1', [parliamentId]);
  for (const interest of interests) {
    await pool.query(
      `INSERT INTO interests (mp_id, category, raw_text, company_name, amount_gbp, cached_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [parliamentId, interest.category, interest.rawText, interest.companyName, interest.amountGbp]
    );
  }

  return interests;
}

export interface Party {
  id: number;
  name: string;
}

export async function getAllParties(): Promise<Party[]> {
  const data = await $fetch<any>(`${BASE}/Parties/GetActive/Commons`);
  const items: any[] = data.items ?? [];
  return items
    .map((item) => ({ id: item.value?.id as number, name: item.value?.name as string }))
    .filter((p) => p.id && p.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function seniorityScore(mp: MP): number {
  return /rt\.?\s*hon/i.test(mp.nameFullTitle ?? '') ? 0 : 1;
}

function sortBySeniority(mps: MP[]): void {
  mps.sort((a, b) => seniorityScore(a) - seniorityScore(b) || a.name.localeCompare(b.name));
}

function rowToMP(row: any): MP {
  return {
    parliamentId: row.parliament_id,
    name: row.name,
    party: row.party,
    constituency: row.constituency,
    thumbnailUrl: row.thumbnail_url,
    nameFullTitle: row.name_full_title ?? null,
  };
}

function rowToInterest(row: any): Interest {
  return {
    category: row.category,
    rawText: row.raw_text,
    companyName: row.company_name,
    amountGbp: row.amount_gbp != null ? parseFloat(row.amount_gbp) : null,
  };
}
