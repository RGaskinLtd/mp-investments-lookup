import axios from 'axios';
import { pool } from '../db/pool';

const BASE = 'https://api.company-information.service.gov.uk';
const CACHE_TTL_HOURS = 168; // 1 week — company data changes slowly

export interface Company {
  companyNumber: string;
  name: string;
  status: string | null;
  sicCodes: string[];
}

export async function searchCompany(name: string): Promise<Company | null> {
  const cached = await pool.query<any>(
    `SELECT * FROM companies WHERE LOWER(name) = LOWER($1) AND cached_at > NOW() - ($2 || ' hours')::INTERVAL`,
    [name, CACHE_TTL_HOURS]
  );
  if (cached.rows.length > 0) {
    return rowToCompany(cached.rows[0]);
  }

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await axios.get(`${BASE}/search/companies`, {
      params: { q: name, items_per_page: 1 },
      auth: { username: apiKey, password: '' },
    });

    const item = response.data.items?.[0];
    if (!item) return null;

    const company: Company = {
      companyNumber: item.company_number,
      name: item.title,
      status: item.company_status ?? null,
      sicCodes: item.sic_codes ?? [],
    };

    await pool.query(
      `INSERT INTO companies (company_number, name, status, sic_codes, cached_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (company_number) DO UPDATE
         SET name=$2, status=$3, sic_codes=$4, cached_at=NOW()`,
      [company.companyNumber, company.name, company.status, company.sicCodes]
    );

    return company;
  } catch {
    return null;
  }
}

function rowToCompany(row: any): Company {
  return {
    companyNumber: row.company_number,
    name: row.name,
    status: row.status,
    sicCodes: row.sic_codes ?? [],
  };
}
