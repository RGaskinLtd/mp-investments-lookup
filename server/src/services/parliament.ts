import axios from 'axios';
import { pool } from '../db/pool';

const BASE = 'https://members-api.parliament.uk/api';
const CACHE_TTL_HOURS = 24;

export interface MP {
  parliamentId: number;
  name: string;
  party: string;
  constituency: string | null;
  thumbnailUrl: string | null;
}

export interface Interest {
  category: string;
  rawText: string;
  companyName: string | null;
  amountGbp: number | null;
}

const COMPANY_SUFFIX = '(?:Ltd|Limited|plc|PLC|LLP|LLC|Inc\\.?|Group|Holdings|Capital|Partners|Ventures|Fund|Trust|Foundation|Association|Services|Solutions|Consulting|Media|Publishing)';

function parseInterest(rawText: string): { companyName: string | null; amountGbp: number | null } {
  // "Name of donor: Acme Ltd" / "Name of company: Acme Ltd"
  const donorMatch = rawText.match(
    /Name of (?:donor|company|employer|organisation|organization):\s*([^\n\r]+)/i
  );

  // "payment from Acme Ltd" / "employed by Acme Ltd" / "shareholder in Acme Ltd"
  const contextMatch = rawText.match(
    new RegExp(`(?:in|from|at|with|by|of)\\s+([A-Z][A-Za-z0-9\\s&'.,/-]+?${COMPANY_SUFFIX})`, '')
  );

  // bare company name anywhere in text (last resort)
  const bareMatch = rawText.match(
    new RegExp(`([A-Z][A-Za-z0-9\\s&'.,/-]+?${COMPANY_SUFFIX})`)
  );

  const rawName = (donorMatch?.[1] ?? contextMatch?.[1] ?? bareMatch?.[1] ?? '').trim();
  // strip trailing address fragments after first comma that looks like a postcode/road
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

const PAGE_SIZE = 100;

async function fetchAllMPsFromAPI(partyId: number, partyName: string): Promise<MP[]> {
  const all: MP[] = [];
  let skip = 0;
  let total = Infinity;

  while (all.length < total) {
    const response = await axios.get(`${BASE}/Members/Search`, {
      params: { PartyId: partyId, House: 1, IsCurrentMember: true, take: PAGE_SIZE, skip },
    });
    const data = response.data;
    total = data.totalResults ?? 0;
    const items: any[] = data.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      all.push({
        parliamentId: item.value.id,
        name: item.value.nameDisplayAs,
        party: item.value.latestParty?.name ?? partyName,
        constituency: item.value.latestHouseMembership?.membershipFrom ?? null,
        thumbnailUrl: item.value.thumbnailUrl ?? null,
      });
    }
    skip += PAGE_SIZE;
  }

  return all;
}

export async function getMPsByParty(partyId: number, partyName: string, limit: number): Promise<MP[]> {
  // Check how many we have cached for this party
  const cached = await pool.query<any>(
    `SELECT * FROM mps WHERE party = $1 AND cached_at > NOW() - ($2 || ' hours')::INTERVAL ORDER BY name`,
    [partyName, CACHE_TTL_HOURS]
  );

  // Count how many the API has for this party (cheap HEAD-style request)
  const countResp = await axios.get(`${BASE}/Members/Search`, {
    params: { PartyId: partyId, House: 1, IsCurrentMember: true, take: 1 },
  });
  const apiTotal: number = countResp.data.totalResults ?? 0;

  // Re-fetch if our cache is stale or incomplete
  if (cached.rows.length < apiTotal) {
    const mps = await fetchAllMPsFromAPI(partyId, partyName);
    for (const mp of mps) {
      await pool.query(
        `INSERT INTO mps (parliament_id, name, party, constituency, thumbnail_url, cached_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (parliament_id) DO UPDATE
           SET name=$2, party=$3, constituency=$4, thumbnail_url=$5, cached_at=NOW()`,
        [mp.parliamentId, mp.name, mp.party, mp.constituency, mp.thumbnailUrl]
      );
    }
    // Sort by name for consistent top-N selection
    mps.sort((a, b) => a.name.localeCompare(b.name));
    return mps.slice(0, limit);
  }

  return cached.rows.map(rowToMP).slice(0, limit);
}

export async function getInterestsForMP(parliamentId: number): Promise<Interest[]> {
  const cached = await pool.query<any>(
    `SELECT * FROM interests WHERE mp_id = $1 AND cached_at > NOW() - ($2 || ' hours')::INTERVAL`,
    [parliamentId, CACHE_TTL_HOURS]
  );
  if (cached.rows.length > 0) {
    return cached.rows.map(rowToInterest);
  }

  const response = await axios.get(`${BASE}/Members/${parliamentId}/RegisteredInterests`);
  const categories: any[] = response.data.value ?? [];

  const interests: Interest[] = [];
  for (const category of categories) {
    for (const entry of (category.interests ?? [])) {
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
  const response = await axios.get(`${BASE}/Parties/GetActive/Commons`);
  const items: any[] = response.data.items ?? [];
  return items
    .map((item) => ({ id: item.value?.id as number, name: item.value?.name as string }))
    .filter((p) => p.id && p.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function rowToMP(row: any): MP {
  return {
    parliamentId: row.parliament_id,
    name: row.name,
    party: row.party,
    constituency: row.constituency,
    thumbnailUrl: row.thumbnail_url,
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
