// Base64を含むDOMブリッジのメッセージを小さく保つ。PDF全体の文字列は作らない。
export const PDF_CHUNK_BYTES = 256 * 1024;

export async function pdfSource(uri, readLocalPdf, cancelled = () => false) {
  if (!/^(file|content):/i.test(uri)) return { url: uri };
  if (!readLocalPdf) throw new Error('LOCAL_PDF_READER_MISSING');
  let data;
  let offset = 0;
  do {
    if (cancelled()) throw new Error('LOCAL_PDF_CANCELLED');
    let chunk;
    try { chunk = await readLocalPdf(offset, PDF_CHUNK_BYTES); }
    catch { throw new Error('LOCAL_PDF_READ_FAILED'); }
    if (cancelled()) throw new Error('LOCAL_PDF_CANCELLED');
    try {
      if (!Number.isSafeInteger(chunk.size) || chunk.size <= 0 || (data && chunk.size !== data.length)) throw new Error();
      const binary = atob(chunk.base64);
      if (binary.length !== Math.min(PDF_CHUNK_BYTES, chunk.size - offset)) throw new Error();
      if (offset === 0 && !binary.slice(0, 1024).includes('%PDF-')) throw new Error();
      data ??= new Uint8Array(chunk.size);
      for (let index = 0; index < binary.length; index++) data[offset + index] = binary.charCodeAt(index);
      offset += binary.length;
    } catch { throw new Error('LOCAL_PDF_INVALID_DATA'); }
  } while (offset < data.length);
  return { data };
}
