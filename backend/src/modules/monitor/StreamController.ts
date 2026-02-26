import { NextFunction, Response } from 'express';
import { spawn } from 'child_process';
import { getCamerasFromDb } from '../../utils/db';
import { AppError } from '../../utils/AppError';
import { filterItemsByScope } from '../../utils/dataScope';
import { AuthenticatedRequest } from '../auth';

const FFMPEG_BIN = (process.env.FFMPEG_BIN || 'ffmpeg').trim() || 'ffmpeg';
const STREAM_OUTPUT_FPS = Math.max(1, Number(process.env.STREAM_OUTPUT_FPS || 8));
const STREAM_OUTPUT_WIDTH = Math.max(0, Number(process.env.STREAM_OUTPUT_WIDTH || 1280));
const STREAM_CONNECT_TIMEOUT_MS = Math.max(3000, Number(process.env.STREAM_CONNECT_TIMEOUT_MS || 12000));

function isRtspUrl(url: string): boolean {
  return /^rtsps?:\/\//i.test(url);
}

function buildFfmpegArgs(inputUrl: string): string[] {
  const args: string[] = ['-hide_banner', '-loglevel', 'error'];
  if (isRtspUrl(inputUrl)) {
    args.push('-rtsp_transport', 'tcp');
  }
  args.push(
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-i', inputUrl,
    '-an',
    '-sn',
    '-dn'
  );

  const filters = [`fps=${STREAM_OUTPUT_FPS}`];
  if (STREAM_OUTPUT_WIDTH > 0) {
    filters.push(`scale=${STREAM_OUTPUT_WIDTH}:-2:flags=lanczos`);
  }

  args.push(
    '-vf', filters.join(','),
    '-q:v', '5',
    '-f', 'mpjpeg',
    'pipe:1'
  );
  return args;
}

export const streamCameraLive = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const cameraId = req.params.id;
    if (!cameraId) {
      next(new AppError('Camera ID is required', 400, 'VALIDATION_ERROR'));
      return;
    }

    const cameras = await getCamerasFromDb();
    const scoped = filterItemsByScope(cameras, c => c.id, c => c.regionCode, req.dataScope);
    const camera = scoped.find(c => c.id === cameraId);

    if (!camera) {
      next(new AppError('Camera not found', 404, 'CAMERA_NOT_FOUND'));
      return;
    }
    if (camera.type !== 'stream') {
      next(new AppError('Only stream camera supports live proxy', 400, 'INVALID_CAMERA_TYPE'));
      return;
    }
    if (!camera.url) {
      next(new AppError('Camera stream URL is missing', 400, 'STREAM_URL_REQUIRED'));
      return;
    }

    const args = buildFfmpegArgs(camera.url);
    const ffmpeg = spawn(FFMPEG_BIN, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let closed = false;
    let firstChunkReceived = false;
    let stderrBuffer = '';

    const startupTimer = setTimeout(() => {
      if (!firstChunkReceived && !closed) {
        ffmpeg.kill('SIGKILL');
      }
    }, STREAM_CONNECT_TIMEOUT_MS);

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearTimeout(startupTimer);
      if (!ffmpeg.killed) {
        ffmpeg.kill('SIGKILL');
      }
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    const sendStreamError = (message: string, code: 502 | 500 = 502) => {
      if (closed || res.headersSent) return;
      closed = true;
      clearTimeout(startupTimer);
      if (!ffmpeg.killed) ffmpeg.kill('SIGKILL');
      next(new AppError(message, code, 'STREAM_OPEN_FAILED'));
    };

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderrBuffer = (stderrBuffer + text).slice(-2000);
    });

    ffmpeg.on('error', (error) => {
      cleanup();
      if (!res.headersSent) {
        next(new AppError(`Failed to start ffmpeg: ${error.message}`, 500, 'FFMPEG_START_FAILED'));
      }
    });

    ffmpeg.on('close', (code) => {
      clearTimeout(startupTimer);
      if (closed) return;
      if (!firstChunkReceived && !res.headersSent) {
        const isPrivateOrLocal = /^(https?:\/\/)(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)/i.test(camera.url || '') ||
          /^rtsps?:\/\/(10\.|172\.|192\.168\.|127\.)/i.test(camera.url || '');
        const hint = isPrivateOrLocal
          ? ' 摄像头为局域网地址时，服务器无法访问，请在监控页使用「直连」或与摄像头同网段的设备访问。'
          : '';
        sendStreamError(
          `无法打开流（${stderrBuffer || '未收到数据'}）。请检查流地址与鉴权。${hint}`.trim(),
          502
        );
        return;
      }
      if (!res.writableEnded) {
        res.end();
      }
    });

    // 先等收到第一帧再写响应头并 pipe，避免连接失败时已发出 200+multipart 导致无法返回 502
    ffmpeg.stdout.once('data', (firstChunk: Buffer) => {
      if (closed || res.headersSent) return;
      firstChunkReceived = true;
      res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=ffmpeg');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.status(200);
      res.write(firstChunk);
      ffmpeg.stdout.pipe(res);
    });
  } catch (error) {
    console.error('Error proxying camera live stream:', error);
    next(new AppError('Error proxying camera stream', 500, 'CAMERA_STREAM_PROXY_FAILED'));
  }
};
