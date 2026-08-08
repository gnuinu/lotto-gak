export type ShareOutcome = 'shared' | 'copied' | 'failed';

/**
 * Web Share API 가 있으면 공유하고, 없으면 클립보드에 복사한다.
 * 사용자가 공유 시트를 닫은 경우(AbortError)는 실패로 취급하지 않는다.
 */
export async function shareOrCopy(text: string): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'shared';
      // 공유가 막힌 환경이면 복사로 내려간다.
    }
  }
  return copyToClipboard(text);
}

export async function copyToClipboard(text: string): Promise<ShareOutcome> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    // execCommand 폴백으로 내려간다.
  }
  return legacyCopy(text);
}

/** clipboard API 가 없거나 권한이 없을 때의 폴백. */
function legacyCopy(text: string): ShareOutcome {
  if (typeof document === 'undefined') return 'failed';
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}
