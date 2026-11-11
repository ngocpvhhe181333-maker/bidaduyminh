const REFERENCE_SUFFIX = /\n?\[QRREF:([A-F0-9]{12})\]$/

export function createTransferReference() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()
  }
  return Math.floor(Math.random() * 0x1000000000000).toString(16).padStart(12, '0').toUpperCase()
}

export function referenceFromSessionId(sessionId) {
  return sessionId.replaceAll('-', '').slice(0, 12).toUpperCase()
}

export function transferMemo(reference) {
  return `BIDA ${reference}`
}

export function noteWithTransferReference(note, reference) {
  const text = String(note || '').trim()
  return `${text}${text ? '\n' : ''}[QRREF:${reference}]`
}

export function parseTransferNote(note) {
  const text = String(note || '')
  const match = text.match(REFERENCE_SUFFIX)
  return {
    reference: match?.[1] || '',
    note: match ? text.slice(0, match.index).trim() : text,
  }
}
