export interface ApiExchange {
  method: string;
  url: string;
  status: number;
  requestBody: any;
  requestHeaders: Record<string, any>;
  responseBody: any;
}

const log: ApiExchange[] = [];

export const resetApiLog = () => {
  log.length = 0;
};

// Recorded at the transport level, before axios parses JSON bodies.
const parseJson = (value: any) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const recordApiExchange = (config: any, status: number, responseBody: any) => {
  log.push({
    method: String(config?.method || '').toUpperCase(),
    url: String(config?.url || ''),
    status,
    requestBody: parseJson(config?.data),
    requestHeaders: { ...(config?.headers || {}) },
    responseBody: parseJson(responseBody),
  });
};

export const apiLog = (): readonly ApiExchange[] => log;

/** Every recorded exchange matching the method and URL (string = substring, RegExp = test). */
export const findCalls = (method: string, url: string | RegExp) =>
  log.filter((x) => x.method === method.toUpperCase() && (typeof url === 'string' ? x.url.includes(url) : url.test(x.url)));

export const lastCall = (method: string, url: string | RegExp) => {
  const calls = findCalls(method, url);
  return calls[calls.length - 1];
};
