import { defineLinkFormat, sanitizeUrl } from '../link-format.js';
import { registerFormatGroup } from '../block-format.js';

const Link = defineLinkFormat({
  protocolWhitelist: ['http', 'https', 'mailto', 'tel', 'sms'],
  sanitize: sanitizeUrl,
});

registerFormatGroup('link', [Link]);

export { sanitizeUrl as sanitize };
export default Link;
