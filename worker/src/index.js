/**
 * Jonas-Proxy - Cloudflare Worker Backend
 * 
 * Sicherer Web-Proxy mit Domain-Filterung.
 * Nur freigegebene Domains (ALLOWED_HOSTS) werden durchgelassen.
 */

// Konfiguration
const ALLOWED_HOSTS = (typeof ALLOWED_HOSTS_ENV !== 'undefined' ? ALLOWED_HOSTS_ENV : '')
  .split(',')
  .map(h => h.trim().toLowerCase())
  .filter(h => h.length > 0);

// CORS Origins
const CORS_ORIGINS = [
  'https://username.github.io', // Ersetzen durch tatsächliche GitHub Pages URL
  'http://localhost:5173',
  'http://localhost:4173',
];

// Maximale Antwortgröße (5 MB)
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

// Erlaubte Content-Types
const ALLOWED_CONTENT_TYPES = [
  'text/html',
  'text/plain',
  'text/css',
  'text/xml',
  'application/json',
  'application/xml',
  'application/xhtml+xml',
];

// Blockierte IP-Bereiche
const BLOCKED_IP_PATTERNS = [
  /^127\./,                          // localhost
  /^10\./,                           // private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // private
  /^192\.168\./,                     // private
  /^169\.254\./,                     // link-local
  /^0\./,                            // current network
  /^::1$/,                           // IPv6 localhost
  /^fc00:/,                          // IPv6 unique local
  /^fe80:/,                          // IPv6 link-local
];

// Cloud-Metadaten-Endpunkte
const BLOCKED_HOSTS = [
  'metadata.google.internal',
  'metadata.goog',
  '169.254.169.254',
  '[fd00:ec2::254]',
];

/**
 * CORS Headers
 */
function getCorsHeaders(origin) {
  const allowedOrigin = CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * JSON Response Helper
 */
function jsonResponse(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

/**
 * Error Response Helper
 */
function errorResponse(message, status, origin = '') {
  return jsonResponse({ error: message, status }, status, origin);
}

/**
 * Prüfe ob eine IP-Adresse blockiert ist
 */
function isBlockedIP(hostname) {
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) return true;
  }
  return false;
}

/**
 * Prüfe ob ein Host in der Allowlist ist (exakte Übereinstimmung)
 */
function isAllowedHost(hostname) {
  const normalizedHost = hostname.toLowerCase().trim();
  
  // Blockierte Hosts prüfen
  if (BLOCKED_HOSTS.includes(normalizedHost)) return false;
  
  // IP-Adressen blockieren
  if (isBlockedIP(normalizedHost)) return false;
  
  // Exakte Übereinstimmung mit Allowlist
  return ALLOWED_HOSTS.includes(normalizedHost);
}

/**
 * Validiere eine URL sicher
 */
function validateUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, error: 'Ungültige URL.' };
  }

  // Nur HTTPS erlauben
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Nur HTTPS-Verbindungen sind erlaubt.' };
  }

  // Hostname prüfen
  const hostname = parsed.hostname.toLowerCase();
  
  if (!hostname || hostname.length === 0) {
    return { valid: false, error: 'Kein Hostname angegeben.' };
  }

  // Blockierte Hosts
  if (BLOCKED_HOSTS.includes(hostname)) {
    return { valid: false, error: 'Diese Domain ist nicht zugänglich.' };
  }

  // IP-Adressen blockieren
  if (isBlockedIP(hostname)) {
    return { valid: false, error: 'Interne Adressen sind nicht erlaubt.' };
  }

  // Allowlist prüfen
  if (!isAllowedHost(hostname)) {
    return { valid: false, error: 'Domain nicht freigegeben.' };
  }

  return { valid: true, url: parsed };
}

/**
 * Extrahiere Text-Inhalt aus HTML
 */
function extractTextFromHTML(html) {
  // Einfache HTML-Tag-Entfernung für Textanzeige
  // Entferne Script und Style Tags komplett
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/\s+/g, ' ');
  return text.trim().substring(0, 50000);
}

/**
 * Extrahiere Titel aus HTML
 */
function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

/**
 * Führe einen sicheren Fetch durch mit Redirect-Validierung
 */
async function safeFetch(targetUrl, maxRedirects = 5) {
  let currentUrl = targetUrl;
  
  for (let i = 0; i < maxRedirects; i++) {
    const response = await fetch(currentUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Jonas-Proxy/1.0',
        'Accept': 'text/html, text/plain, application/json, application/xml, */*;q=0.1',
      },
      redirect: 'manual',
    });

    // Redirect prüfen
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (!location) {
        return { error: 'Weiterleitung ohne Ziel-URL.', status: 502 };
      }

      // Relative URLs auflösen
      let redirectUrl;
      try {
        redirectUrl = new URL(location, currentUrl).href;
      } catch {
        return { error: 'Ungültige Weiterleitungs-URL.', status: 502 };
      }

      // Weiterleitung validieren
      const validation = validateUrl(redirectUrl);
      if (!validation.valid) {
        return { error: `Weiterleitung zu nicht freigegebener Domain: ${validation.error}`, status: 403 };
      }

      currentUrl = redirectUrl;
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  return { error: 'Zu viele Weiterleitungen.', status: 502 };
}

/**
 * Health Endpoint
 */
async function handleHealth(request) {
  const origin = request.headers.get('Origin') || '';
  return jsonResponse({
    status: 'ok',
    service: 'jonas-proxy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    allowed_hosts_count: ALLOWED_HOSTS.length,
  }, 200, origin);
}

/**
 * Proxy Endpoint
 */
async function handleProxy(request) {
  const origin = request.headers.get('Origin') || '';

  // Nur POST erlauben
  if (request.method !== 'POST') {
    return errorResponse('Nur POST-Anfragen werden unterstützt.', 405, origin);
  }

  // Body parsen
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Ungültiges JSON.', 400, origin);
  }

  const { url: targetUrl } = body;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return errorResponse('URL fehlt oder ist ungültig.', 400, origin);
  }

  // URL validieren
  const validation = validateUrl(targetUrl);
  if (!validation.valid) {
    return errorResponse(validation.error, 403, origin);
  }

  // Fetch durchführen
  try {
    const result = await safeFetch(validation.url.href);
    
    if (result.error) {
      return errorResponse(result.error, result.status, origin);
    }

    const response = result.response;
    const contentType = response.headers.get('Content-Type') || 'text/plain';

    // Content-Type prüfen
    const isAllowedType = ALLOWED_CONTENT_TYPES.some(type => contentType.includes(type));
    if (!isAllowedType && !contentType.includes('text/')) {
      return errorResponse('Website unterstützt die angeforderte Darstellung nicht.', 415, origin);
    }

    // Größe prüfen
    const contentLength = response.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      return errorResponse('Antwort zu groß.', 413, origin);
    }

    // Body lesen
    let responseBody = await response.text();
    
    if (responseBody.length > MAX_RESPONSE_SIZE) {
      responseBody = responseBody.substring(0, MAX_RESPONSE_SIZE);
    }

    // Sensible Header filtern
    const safeHeaders = {};
    const blockedHeaders = ['set-cookie', 'cookie', 'authorization', 'www-authenticate', 'proxy-authenticate'];
    response.headers.forEach((value, key) => {
      if (!blockedHeaders.includes(key.toLowerCase())) {
        safeHeaders[key] = value;
      }
    });

    // Text-Inhalt extrahieren
    let textContent = '';
    let title = '';
    if (contentType.includes('text/html')) {
      textContent = extractTextFromHTML(responseBody);
      title = extractTitle(responseBody);
    } else {
      textContent = responseBody.substring(0, 50000);
    }

    return jsonResponse({
      url: result.finalUrl,
      statusCode: response.status,
      contentType: contentType,
      title: title,
      content: textContent,
      headers: safeHeaders,
    }, 200, origin);

  } catch (err) {
    if (err.message && err.message.includes('timeout')) {
      return errorResponse('Zeitüberschreitung. Die Website antwortet nicht.', 408, origin);
    }
    return errorResponse('Die Website ist nicht erreichbar.', 502, origin);
  }
}

/**
 * Main Worker Handler
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    // Routing
    if (url.pathname === '/health') {
      return handleHealth(request);
    }

    if (url.pathname === '/proxy') {
      return handleProxy(request);
    }

    // Root info
    if (url.pathname === '/' || url.pathname === '') {
      return jsonResponse({
        service: 'jonas-proxy',
        version: '1.0.0',
        endpoints: ['/health', '/proxy'],
      }, 200, origin);
    }

    return errorResponse('Endpunkt nicht gefunden.', 404, origin);
  },
};
