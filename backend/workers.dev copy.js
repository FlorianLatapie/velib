const SOURCES = { 
  opendata: {
    information:
      'https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_information.json',

    status:
      'https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_status.json',
  },

  velibest: (stationId) =>
    `https://tdqr.ovh/api/stations/station_${stationId}/details`,
};

const ALLOWED_ORIGIN = 'https://florianlatapie.github.io';
const ALLOWED_REFERER_PREFIX = 'https://florianlatapie.github.io/velib/';

const CORS = {
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CACHE = 'public, max-age=30';
const TIMEOUT = 8_000;

const isAllowedRequest = (request) => {
  const origin = request?.headers.get('Origin');
  const referer = request?.headers.get('Referer');

  if (origin && origin !== ALLOWED_ORIGIN) {
    return false;
  }

  if (referer && !referer.startsWith(ALLOWED_REFERER_PREFIX)) {
    return false;
  }

  return true;
};

const headers = (request, contentType = 'application/json; charset=utf-8') => ({
  ...(isAllowedRequest(request) ? { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN } : {}),
  ...CORS,
  Vary: 'Origin, Referer',
  'Content-Type': contentType,
  'Cache-Control': CACHE,
});

const json = (data, status = 200, request) =>
  Response.json(data, {
    status,
    headers: headers(request),
  });

const badRequest = (message, request) =>
  json(
    {
      error: 'Bad Request',
      message,
    },
    400,
    request,
  );

const forbidden = (request) =>
  new Response(
    JSON.stringify({
      error: 'Forbidden',
      message: 'Origin not allowed',
    }),
    {
      status: 403,
      headers: headers(request),
    },
  );

const proxy = async (request, url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT),
  });

  return new Response(response.body, {
    status: response.ok ? response.status : 502,
    headers: headers(
      request,
      response.headers.get('Content-Type') ||
        'application/json; charset=utf-8',
    ),
  });
};

async function handleOpenData(request, pathname) {
  const source =
    pathname === '/opendata/information'
      ? SOURCES.opendata.information
      : pathname === '/opendata/status'
        ? SOURCES.opendata.status
        : null;

  if (!source) {
    return json({ error: 'Not Found' }, 404, request);
  }

  try {
    return await proxy(request, source);
  } catch {
    return json(
      { error: 'Upstream API unavailable' },
      502,
      request,
    );
  }
}

async function handleVelibest(request, stationId) {
  if (!/^\d+$/.test(stationId)) {
    return badRequest('Invalid stationId', request);
  }

  try {
    return await proxy(
      request,
      SOURCES.velibest(stationId),
    );
  } catch {
    return json(
      { error: 'Upstream API unavailable' },
      502,
      request,
    );
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (!isAllowedRequest(request)) {
      return forbidden(request);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: headers(request),
      });
    }

    if (
      request.method === 'GET' &&
      pathname.startsWith('/opendata/')
    ) {
      return handleOpenData(request, pathname);
    }

    const match = pathname.match(
      /^\/velibest\/(\d+)\/?$/,
    );

    if (request.method === 'GET' && match) {
      return handleVelibest(request, match[1]);
    }

    if (request.method !== 'GET') {
      return new Response(null, {
        status: 405,
        headers: {
          ...headers(request),
          Allow: 'GET, OPTIONS',
        },
      });
    }

    return json({ error: 'Not Found' }, 404, request);
  },
};