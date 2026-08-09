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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CACHE = 'public, max-age=30';
const TIMEOUT = 8_000;

const headers = (contentType = 'application/json; charset=utf-8') => ({
  ...CORS,
  'Content-Type': contentType,
  'Cache-Control': CACHE,
});

const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: headers(),
  });

const badRequest = (message) =>
  json(
    {
      error: 'Bad Request',
      message,
    },
    400,
  );

const proxy = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT),
  });

  return new Response(response.body, {
    status: response.ok ? response.status : 502,
    headers: headers(
      response.headers.get('Content-Type') ||
        'application/json; charset=utf-8',
    ),
  });
};

async function handleOpenData(pathname) {
  const source =
    pathname === '/opendata/information'
      ? SOURCES.opendata.information
      : pathname === '/opendata/status'
        ? SOURCES.opendata.status
        : null;

  if (!source) {
    return json({ error: 'Not Found' }, 404);
  }

  try {
    return await proxy(source);
  } catch {
    return json(
      { error: 'Upstream API unavailable' },
      502,
    );
  }
}

async function handleVelibest(stationId) {
  if (!/^\d+$/.test(stationId)) {
    return badRequest('Invalid stationId');
  }

  try {
    return await proxy(
      SOURCES.velibest(stationId),
    );
  } catch {
    return json(
      { error: 'Upstream API unavailable' },
      502,
    );
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS,
      });
    }

    if (
      request.method === 'GET' &&
      pathname.startsWith('/opendata/')
    ) {
      return handleOpenData(pathname);
    }

    const match = pathname.match(
      /^\/velibest\/(\d+)\/?$/,
    );

    if (request.method === 'GET' && match) {
      return handleVelibest(match[1]);
    }

    if (request.method !== 'GET') {
      return new Response(null, {
        status: 405,
        headers: {
          ...CORS,
          Allow: 'GET, OPTIONS',
        },
      });
    }

    return json({ error: 'Not Found' }, 404);
  },
};