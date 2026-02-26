import { NextFunction, Request, Response } from 'express';
import dgram from 'dgram';
import { randomUUID } from 'crypto';
import { URL } from 'url';
import { AppError } from '../../utils/AppError';

interface DiscoveredOnvifDevice {
  endpoint: string;
  xaddrs: string[];
  scopes: string[];
  types: string[];
  ip?: string;
  name?: string;
  location?: string;
  vendorGuess: 'hikvision' | 'dahua' | 'uniview' | 'axis' | 'custom';
}

const ONVIF_MULTICAST_ADDR = '239.255.255.250';
const ONVIF_MULTICAST_PORT = 3702;
const ONVIF_DISCOVER_TIMEOUT_MS = Math.max(1200, Number(process.env.ONVIF_DISCOVER_TIMEOUT_MS || 3500));
const ONVIF_DISCOVER_MAX_RESULTS = Math.max(1, Number(process.env.ONVIF_DISCOVER_MAX_RESULTS || 30));

function buildProbeMessage(messageId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"
            xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"
            xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"
            xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <e:Header>
    <w:MessageID>uuid:${messageId}</w:MessageID>
    <w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>
    <w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>
  </e:Header>
  <e:Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
    </d:Probe>
  </e:Body>
</e:Envelope>`;
}

function extractTag(content: string, tagName: string): string[] {
  const regex = new RegExp(`<[^>]*:?${tagName}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tagName}>`, 'gi');
  const values: string[] = [];
  let match: RegExpExecArray | null = regex.exec(content);
  while (match) {
    values.push((match[1] || '').trim());
    match = regex.exec(content);
  }
  return values.filter(Boolean);
}

function decodeOnvifScope(scope: string): string {
  const idx = scope.lastIndexOf('/');
  const raw = idx >= 0 ? scope.slice(idx + 1) : scope;
  try {
    return decodeURIComponent(raw);
  } catch (_error) {
    return raw;
  }
}

function guessVendor(scopes: string[]): DiscoveredOnvifDevice['vendorGuess'] {
  const text = scopes.join(' ').toLowerCase();
  if (text.includes('hikvision') || text.includes('海康')) return 'hikvision';
  if (text.includes('dahua') || text.includes('大华')) return 'dahua';
  if (text.includes('uniview') || text.includes('宇视')) return 'uniview';
  if (text.includes('axis')) return 'axis';
  return 'custom';
}

function parseIpFromXaddr(xaddr?: string): string | undefined {
  if (!xaddr) return undefined;
  try {
    const parsed = new URL(xaddr);
    return parsed.hostname || undefined;
  } catch (_error) {
    return undefined;
  }
}

function parseDeviceFromPayload(payload: string): DiscoveredOnvifDevice | null {
  const endpoint = extractTag(payload, 'Address')[0] || '';
  const xaddrsRaw = extractTag(payload, 'XAddrs')[0] || '';
  const scopesRaw = extractTag(payload, 'Scopes')[0] || '';
  const typesRaw = extractTag(payload, 'Types')[0] || '';
  const xaddrs = xaddrsRaw.split(/\s+/).map(s => s.trim()).filter(Boolean);
  if (!endpoint && !xaddrs.length) {
    return null;
  }
  const scopes = scopesRaw.split(/\s+/).map(s => s.trim()).filter(Boolean);
  const types = typesRaw.split(/\s+/).map(s => s.trim()).filter(Boolean);
  const nameScope = scopes.find(s => s.toLowerCase().includes('/name/'));
  const locationScope = scopes.find(s => s.toLowerCase().includes('/location/'));
  const vendorGuess = guessVendor(scopes);

  return {
    endpoint,
    xaddrs,
    scopes,
    types,
    ip: parseIpFromXaddr(xaddrs[0]),
    name: nameScope ? decodeOnvifScope(nameScope) : undefined,
    location: locationScope ? decodeOnvifScope(locationScope) : undefined,
    vendorGuess
  };
}

function discoverOnvifDevices(timeoutMs: number): Promise<DiscoveredOnvifDevice[]> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const discovered = new Map<string, DiscoveredOnvifDevice>();
    let finished = false;

    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      try {
        socket.close();
      } catch (_error) {
        // ignore
      }
      if (error) {
        reject(error);
        return;
      }
      resolve(Array.from(discovered.values()).slice(0, ONVIF_DISCOVER_MAX_RESULTS));
    };

    const timer = setTimeout(() => {
      finish();
    }, timeoutMs);

    socket.on('error', (error) => {
      clearTimeout(timer);
      finish(error);
    });

    socket.on('message', (message) => {
      const payload = message.toString('utf8');
      const device = parseDeviceFromPayload(payload);
      if (!device) return;
      const key = device.endpoint || device.xaddrs[0] || randomUUID();
      if (!discovered.has(key)) {
        discovered.set(key, device);
        if (discovered.size >= ONVIF_DISCOVER_MAX_RESULTS) {
          clearTimeout(timer);
          finish();
        }
      }
    });

    socket.bind(0, () => {
      const messageId = randomUUID();
      const probe = buildProbeMessage(messageId);
      const buffer = Buffer.from(probe, 'utf8');
      socket.setMulticastTTL(2);
      socket.send(buffer, ONVIF_MULTICAST_PORT, ONVIF_MULTICAST_ADDR, (error) => {
        if (error) {
          clearTimeout(timer);
          finish(error);
        }
      });
    });
  });
}

export const discoverOnvif = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timeoutInput = Number(req.body?.timeoutMs);
    const timeoutMs = Number.isFinite(timeoutInput)
      ? Math.min(Math.max(timeoutInput, 1000), 12000)
      : ONVIF_DISCOVER_TIMEOUT_MS;
    const devices = await discoverOnvifDevices(timeoutMs);
    res.json({
      devices,
      elapsedMs: timeoutMs,
      tips: [
        '请确保摄像头与服务端在同一二层网络，且开启 ONVIF/发现功能。',
        '若能发现但无法播放，请补充用户名/密码后用“生成地址+连通测试”。'
      ]
    });
  } catch (error) {
    console.error('ONVIF discover failed:', error);
    next(new AppError('ONVIF discover failed', 500, 'ONVIF_DISCOVER_FAILED'));
  }
};
