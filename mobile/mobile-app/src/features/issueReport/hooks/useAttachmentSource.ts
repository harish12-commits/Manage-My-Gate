import { useEffect, useState } from 'react';
import storage from '../../../utils/storage';
import { getApiBaseUrl } from '../../../services/apiClient';

export interface AttachmentImageSource {
  uri: string;
  headers: { Authorization: string };
}

/**
 * Issue report screenshots are private and only served by the authenticated attachments endpoint,
 * so the image request must carry the user's bearer token.
 */
export const useAttachmentSource = (attachmentUrl?: string | null): AttachmentImageSource | null => {
  const [source, setSource] = useState<AttachmentImageSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    if (!attachmentUrl) return undefined;

    const filename = String(attachmentUrl).split('/').pop();
    if (!filename) return undefined;

    (async () => {
      const token = await storage.getItem('token');
      if (cancelled || !token) return;
      setSource({
        uri: `${getApiBaseUrl()}/support/reports/attachments/${encodeURIComponent(filename)}`,
        headers: { Authorization: `Bearer ${token}` },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [attachmentUrl]);

  return source;
};

export default useAttachmentSource;
