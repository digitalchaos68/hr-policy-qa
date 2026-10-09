export async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HRPolicyQA-Demo/1.0)' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  // Strip script/style/nav/footer, then tags, then collapse whitespace
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&times;/g, 'x')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/You are using a version of browser which will not be supported after 27 May 2018\. To continue to transact with MOM securely, please follow these steps to enable the Transport Layer Security \(TLS\) of your web browser, or upgrade to the latest version of your browser\.?/gi, '')
    .replace(/Skip to main content\s*/gi, '')
    .replace(/About us\s+Work passes\s+Employment practices\s+Workplace safety and health\s+More\s+Statistics[^.]*?(?=\s[A-Z])/gi, '')
    .trim();
  return stripped;
}