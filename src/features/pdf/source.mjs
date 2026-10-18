// ネイティブ側のファイルはWebViewのfetchに渡さず、アプリ側で読んだデータを使う。
export async function pdfSource(uri, readLocalPdf) {
  if (!/^(file|content):/i.test(uri)) return { url: uri };
  if (!readLocalPdf) throw new Error('LOCAL_PDF_READER_MISSING');
  let encoded;
  try { encoded = await readLocalPdf(); }
  catch { throw new Error('LOCAL_PDF_READ_FAILED'); }
  try {
    const binary = atob(encoded);
    if (!binary.slice(0, 1024).includes('%PDF-')) throw new Error();
    return { data: Uint8Array.from(binary, char => char.charCodeAt(0)) };
  } catch { throw new Error('LOCAL_PDF_INVALID_DATA'); }
}
