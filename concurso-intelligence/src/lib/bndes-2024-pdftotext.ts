import { spawn } from 'node:child_process';
import type { Bndes2024PdfTextExtractor, Bndes2024PdfRole } from './bndes-2024-pipeline.ts';
import type { Bndes2024TextPage } from './bndes-2024-extraction.ts';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_NODE_TIMEOUT_MS = 2_147_483_647;

export function splitPdftotextPages(text: string): Bndes2024TextPage[] {
  return text
    .split('\f')
    .map((pageText, index) => ({ page: index + 1, text: pageText.replace(/\r\n?/g, '\n').trimEnd() }))
    .filter((page) => page.text.trim().length > 0);
}

export type PdftotextExtractorOptions = {
  command?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
};

function validatePositiveInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`BNDES 2024: ${label} deve ser inteiro positivo.`);
  }
}

function validateTimeout(timeoutMs: number) {
  validatePositiveInteger(timeoutMs, 'timeout do pdftotext');
  if (timeoutMs > MAX_NODE_TIMEOUT_MS) {
    throw new Error(`BNDES 2024: timeout do pdftotext deve ser <= ${MAX_NODE_TIMEOUT_MS}ms.`);
  }
}

async function runPdftotext(
  bytes: Uint8Array,
  role: Bndes2024PdfRole,
  options: PdftotextExtractorOptions,
): Promise<string> {
  const command = options.command ?? 'pdftotext';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  validateTimeout(timeoutMs);
  validatePositiveInteger(maxOutputBytes, 'limite de saída do pdftotext');

  return new Promise((resolve, reject) => {
    const child = spawn(command, ['-layout', '-enc', 'UTF-8', '-', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let settled = false;

    const finish = (error?: Error, output?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(output ?? '');
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error(`BNDES 2024: pdftotext excedeu ${timeoutMs}ms em ${role}.`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxOutputBytes) {
        child.kill('SIGKILL');
        finish(new Error(`BNDES 2024: saída do pdftotext excedeu ${maxOutputBytes} bytes em ${role}.`));
        return;
      }
      stdoutChunks.push(chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderrChunks.reduce((sum, item) => sum + item.length, 0) < 64 * 1024) {
        stderrChunks.push(chunk);
      }
    });

    child.on('error', (error) => {
      finish(new Error(`BNDES 2024: não foi possível executar ${command} em ${role}: ${error.message}`));
    });

    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
        finish(new Error(`BNDES 2024: pdftotext falhou em ${role} com código ${code}${stderr ? `: ${stderr}` : '.'}`));
        return;
      }
      finish(undefined, Buffer.concat(stdoutChunks).toString('utf8'));
    });

    child.stdin.on('error', (error) => {
      finish(new Error(`BNDES 2024: falha ao enviar PDF para pdftotext em ${role}: ${error.message}`));
    });
    child.stdin.end(Buffer.from(bytes));
  });
}

export function createBndes2024PdftotextExtractor(
  options: PdftotextExtractorOptions = {},
): Bndes2024PdfTextExtractor {
  return async (bytes, role) => {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
      throw new Error(`BNDES 2024: PDF vazio recebido pelo pdftotext em ${role}.`);
    }

    const output = await runPdftotext(bytes, role, options);
    const pages = splitPdftotextPages(output);
    if (pages.length === 0) {
      throw new Error(`BNDES 2024: pdftotext não produziu texto utilizável em ${role}.`);
    }
    return pages;
  };
}
