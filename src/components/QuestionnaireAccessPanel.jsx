import { useMemo, useState } from 'react';
import { Copy, MessageSquare, QrCode, Maximize2 } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { Button, Field, Modal } from './UI';
import { displayPersonName } from '../model';

function qrImage(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const code = qrcode(0, 'M');
    code.addData(url.href);
    code.make();
    const size = code.getModuleCount();
    let path = '';
    for (let y = 0; y < size; y += 1)
      for (let x = 0; x < size; x += 1)
        if (code.isDark(y, x)) path += `M${x + 4},${y + 4}h1v1h-1z`;
    return { size: size + 8, path, url: url.href, local: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) };
  } catch { return null; }
}

export default function QuestionnaireAccessPanel({ person, episodeId, collectionId, mode, onBack }) {
  const [link, setLink] = useState(() => `${window.location.origin}/questionnaire?${new URLSearchParams({
    person: person.id, episode: episodeId, collection: collectionId,
  })}`);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [smsStatus, setSmsStatus] = useState('');
  const qr = useMemo(() => qrImage(link), [link]);
  const message = `Your YSCC assessment is ready. Open: ${qr?.url || link}`;

  return <section className={`questionnaire-access-panel${mode ? " questionnaire-access-tab" : ""}`} aria-label="Open assessment on another device">
    {mode !== "sms" && <section className="questionnaire-access-section" aria-labelledby="tablet-access-heading">
      <h2 id="tablet-access-heading"><QrCode size={20} aria-hidden="true" /> Open on a tablet</h2>
      <p>Scan the QR code with the tablet camera to open the assessment link.</p>
      <div className="questionnaire-tablet-access">
        {qr ? <div className="questionnaire-qr-preview"><svg className="questionnaire-qr-code" role="img" aria-label="QR code for the assessment link"
          viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges">
          <rect width={qr.size} height={qr.size} fill="white" />
          <path d={qr.path} fill="#14200f" />
        </svg><Button type="button" variant="ghost" onClick={() => setQrExpanded(true)}>
          <Maximize2 size={14} aria-hidden="true" /> Enlarge QR
        </Button></div> : <div className="questionnaire-qr-placeholder">Enter a valid assessment link to generate a QR code.</div>}
        <div className="questionnaire-access-link">
          <Field label="Assessment link">
            <input type="url" aria-label="Assessment link" value={link} onChange={event => {
              setLink(event.target.value); setCopyStatus(''); setSmsStatus('');
            }} />
          </Field>
          <div className="button-row">
          <Button type="button" disabled={!qr} onClick={async () => {
            try { await navigator.clipboard.writeText(qr.url); setCopyStatus('Link copied'); }
            catch { setCopyStatus('Select the link above and copy it manually.'); }
          }}><Copy size={16} aria-hidden="true" /> Copy link</Button>
          {onBack && <Button variant="ghost" onClick={onBack}>Back to record</Button>}
          </div>
          <p className="questionnaire-access-feedback" role="status">{copyStatus}</p>
        </div>
      </div>
    </section>}
    {mode !== "tablet" && <section className="questionnaire-access-section" aria-labelledby="sms-access-heading">
      <h2 id="sms-access-heading"><MessageSquare size={20} aria-hidden="true" /> Send SMS</h2>
      <p>Send the assessment link to the mobile number already on the record.</p>
      <dl className="questionnaire-sms-recipient">
        <div><dt>Recipient</dt><dd>{displayPersonName(person)}</dd></div>
        <div><dt>Destination</dt><dd>Mobile number on record</dd></div>
      </dl>
      <div className="questionnaire-sms-preview"><strong>Message preview</strong><p>{message}</p></div>
      <div className="button-row">
      <Button type="button" variant="primary" disabled={!qr} onClick={() => {
        setSmsStatus(`SMS sent to ${displayPersonName(person)}.`);
      }}><MessageSquare size={16} aria-hidden="true" /> Send SMS</Button>
      {onBack && mode === "sms" && <Button variant="ghost" onClick={onBack}>Back to record</Button>}
      </div>
      <p className="questionnaire-access-feedback" role="status">{smsStatus}</p>
    </section>}
    {qrExpanded && qr && <Modal title="Assessment QR code" onClose={() => setQrExpanded(false)}>
      <div className="questionnaire-qr-modal-body">
      <svg className="questionnaire-qr-expanded" role="img" aria-label="Enlarged QR code for the assessment link"
        viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges">
        <rect width={qr.size} height={qr.size} fill="white" />
        <path d={qr.path} fill="#14200f" />
      </svg>
      <p>Scan with the tablet camera to open the instrument.</p>
      </div>
    </Modal>}
  </section>;
}
