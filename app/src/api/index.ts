import type { RankingData, CategoryStatData, TrendData } from '@/types';

const BASE_URL = '/api';
const REQUEST_TIMEOUT = 15000;

function getToken(): string | null {
  return sessionStorage.getItem('token');
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  opts?: { responseType?: string; params?: Record<string, string> }
): Promise<{ data: T }> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let url = `${BASE_URL}${path}`;
  if (opts?.params) {
    const sp = new URLSearchParams(opts.params);
    url += `?${sp.toString()}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const fetchOpts: RequestInit = { method, headers, signal: controller.signal };
  if (body) {
    headers['Content-Type'] = 'application/json';
    fetchOpts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, fetchOpts);

    if (opts?.responseType === 'blob') {
      const blob = await res.blob();
      if (!res.ok) {
        let errorText = '';
        try { errorText = await blob.text(); } catch { /* ignore */ }
        throw { response: { status: res.status, data: { error: errorText } } };
      }
      return { data: blob as unknown as T };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`服务器返回了无效响应 (HTTP ${res.status})`);
    }

    if (!res.ok) {
      const err: { response?: { data?: { error?: string } } } = { response: { data: json as Record<string, unknown> } };
      throw err;
    }
    return { data: json as T };
  } finally {
    clearTimeout(timeoutId);
  }
}

const api = {
  get: <T = unknown>(path: string, opts?: { params?: Record<string, string>; responseType?: string }) =>
    request<T>('GET', path, undefined, opts),
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>('POST', path, body),
  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>('PUT', path, body),
  delete: <T = unknown>(path: string) =>
    request<T>('DELETE', path),
  handlers: {
    list: () =>
      request<{ user_id: string; user_name: string }[]>('GET', '/handlers'),
  },
  stats: {
    rankings: (params?: Record<string, string>) =>
      request<RankingData[]>('GET', '/stats/rankings', undefined, { params }),
    categories: (params?: Record<string, string>) =>
      request<CategoryStatData[]>('GET', '/stats/categories', undefined, { params }),
    trends: (params?: Record<string, string>) =>
      request<TrendData[]>('GET', '/stats/trends', undefined, { params }),
  },
};

export default api;
