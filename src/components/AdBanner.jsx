import { useEffect, useRef } from 'react';

// Replace PUBLISHER_ID and SLOT_ID with your AdSense values
const PUBLISHER_ID = 'ca-pub-XXXXXXXXXXXXXXXXX';
const SLOT_ID = 'XXXXXXXXXX';

export default function AdBanner({ className = '' }) {
  const insRef = useRef(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
  }, []);

  if (PUBLISHER_ID.includes('XXXX')) {
    return (
      <div className={`ad-banner ad-placeholder ${className}`}>
        <span>広告スペース（AdSense設定後に表示）</span>
      </div>
    );
  }

  return (
    <div className={`ad-banner ${className}`}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={PUBLISHER_ID}
        data-ad-slot={SLOT_ID}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
