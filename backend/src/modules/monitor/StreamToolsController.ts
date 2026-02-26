import { NextFunction, Request, Response } from 'express';
import { spawn } from 'child_process';
import { AppError } from '../../utils/AppError';

type StreamVendor = 'hikvision' | 'dahua' | 'uniview' | 'axis' | 'custom';
type StreamProtocol = 'rtsp' | 'http';

const FFPROBE_BIN = (process.env.FFPROBE_BIN || 'ffprobe').trim() || 'ffprobe';
const STREAM_TEST_TIMEOUT_MS = Math.max(3000, Number(process.env.STREAM_TEST_TIMEOUT_MS || 9000));

interface BuildTemplateInput {
  vendor?: StreamVendor;
  protocol?: StreamProtocol;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  channel?: number;
  streamType?: 'main' | 'sub';
  customPath?: string;
}

function encodeCredential(value?: string): string {
  return encodeURIComponent((value || '').trim());
}

function buildAuthPart(username?: string, password?: string): string {
  if (!username?.trim()) return '';
  return `${encodeCredential(username)}:${encodeCredential(password)}@`;
}

function normalizeHost(host?: string): string {
  return (host || '').trim().replace(/^https?:\/\//i, '').replace(/^rtsp:\/\//i, '').replace(/\/+$/, '');
}

function resolveDefaultPort(protocol: StreamProtocol, vendor: StreamVendor): number {
  if (protocol === 'rtsp') return 554;
  if (vendor === 'axis') return 80;
  return 80;
}

function buildByVendor(input: Required<Pick<BuildTemplateInput, 'vendor' | 'protocol' | 'host'>> & BuildTemplateInput): string {
  const protocol = input.protocol || 'rtsp';
  const vendor = input.vendor || 'custom';
  const port = Number(input.port) > 0 ? Number(input.port) : resolveDefaultPort(protocol, vendor);
  const host = normalizeHost(input.host);
  const auth = buildAuthPart(input.username, input.password);
  const channel = Math.max(1, Number(input.channel) || 1);
  const isSub = (input.streamType || 'main') === 'sub';

  if (!host) {
    return '';
  }

  if (vendor === 'custom') {
    const customPath = (input.customPath || '').trim();
    if (!customPath) return '';
    if (/^https?:\/\//i.test(customPath) || /^rtsps?:\/\//i.test(customPath)) {
      return customPath;
    }
    return `${protocol}://${auth}${host}:${port}${customPath.startsWith('/') ? '' : '/'}${customPath}`;
  }

  if (protocol === 'http') {
    const fallbackHttpPath =
      vendor === 'hikvision'
        ? '/Streaming/channels/1/picture'
        : vendor === 'axis'
          ? '/axis-cgi/mjpg/video.cgi'
          : '/cgi-bin/snapshot.cgi';
    return `http://${auth}${host}:${port}${fallbackHttpPath}`;
  }

  switch (vendor) {
    case 'hikvision': {
      const streamCode = isSub ? '02' : '01';
      return `rtsp://${auth}${host}:${port}/Streaming/Channels/${channel}${streamCode}`;
    }
    case 'dahua': {
      const subtype = isSub ? 1 : 0;
      return `rtsp://${auth}${host}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}`;
    }
    case 'uniview': {
      const stream = isSub ? 1 : 0;
      return `rtsp://${auth}${host}:${port}/unicast/c${channel}/s${stream}/live`;
    }
    case 'axis': {
      return `rtsp://${auth}${host}:${port}/axis-media/media.amp`;
    }
    default: {
      return '';
    }
  }
}

export const buildStreamTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = (req.body || {}) as BuildTemplateInput;
    const vendor = (body.vendor || 'custom') as StreamVendor;
    const protocol = (body.protocol || 'rtsp') as StreamProtocol;
    const host = normalizeHost(body.host);
    if (!host && vendor !== 'custom') {
      next(new AppError('Host is required', 400, 'VALIDATION_ERROR'));
      return;
    }
    const url = buildByVendor({ ...body, vendor, protocol, host });
    if (!url) {
      next(new AppError('Unable to build stream url', 400, 'STREAM_TEMPLATE_FAILED'));
      return;
    }
    res.json({
      url,
      tips: [
        '若测试失败，请核对账号密码、通道号与主/子码流设置。',
        'RTSP 建议优先使用 TCP（系统已默认）。'
      ]
    });
  } catch (error) {
    console.error('Error building stream template:', error);
    next(new AppError('Error building stream template', 500, 'STREAM_TEMPLATE_ERROR'));
  }
};

export const testStreamConnection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!url) {
      next(new AppError('Stream URL is required', 400, 'VALIDATION_ERROR'));
      return;
    }

    const args = [
      '-v', 'error',
      '-show_entries', 'stream=codec_name,width,height,r_frame_rate',
      '-select_streams', 'v:0',
      '-of', 'json'
    ];
    if (/^rtsps?:\/\//i.test(url)) {
      args.push('-rtsp_transport', 'tcp');
    }
    args.push(url);

    const ffprobe = spawn(FFPROBE_BIN, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      ffprobe.kill('SIGKILL');
    }, STREAM_TEST_TIMEOUT_MS);

    ffprobe.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    ffprobe.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    ffprobe.on('error', (error) => {
      clearTimeout(timer);
      next(new AppError(`Failed to execute ffprobe: ${error.message}`, 500, 'FFPROBE_EXEC_ERROR'));
    });

    ffprobe.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        res.status(200).json({
          ok: false,
          message: `连接超时（>${STREAM_TEST_TIMEOUT_MS}ms）`,
          details: ''
        });
        return;
      }
      if (code !== 0) {
        res.status(200).json({
          ok: false,
          message: '流地址不可用或鉴权失败',
          details: stderr.trim().slice(0, 500)
        });
        return;
      }
      let parsed: any = {};
      try {
        parsed = stdout ? JSON.parse(stdout) : {};
      } catch (_error) {
        parsed = {};
      }
      const stream = Array.isArray(parsed?.streams) ? parsed.streams[0] : null;
      res.status(200).json({
        ok: true,
        message: '连接成功',
        details: stream
          ? {
              codec: stream.codec_name,
              width: stream.width,
              height: stream.height,
              fps: stream.r_frame_rate
            }
          : {}
      });
    });
  } catch (error) {
    console.error('Error testing stream connection:', error);
    next(new AppError('Error testing stream connection', 500, 'STREAM_TEST_ERROR'));
  }
};
