/**
 * Turn a shared Google Drive link into a DIRECT image URL the browser can load.
 *
 * A normal Drive link (…/file/d/<id>/view?usp=sharing, or …/open?id=<id>) opens
 * a web page, not the image itself — so it renders blank on the site. We rewrite
 * it to Google's direct image endpoint. The Drive file must be shared as
 * "Anyone with the link". Non-Drive URLs pass through unchanged.
 */
export function toDirectImageUrl(raw: string): string {
  const url = (raw ?? "").trim();
  if (!url) return url;
  const m = url.match(
    /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=[^&]+&)?id=|thumbnail\?(?:[^&]*&)*id=)([A-Za-z0-9_-]{20,})/,
  );
  if (m) return `https://lh3.googleusercontent.com/d/${m[1]}=w1600`;
  return url;
}
