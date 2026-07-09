import { useEffect, useRef, useState, useId, forwardRef, useImperativeHandle } from 'react';
import { RefreshCw, Volume2 } from 'lucide-react';

// No confusing look-alike characters (0/O, 1/I/L).
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(length = 5) {
  let code = '';
  for (let i = 0; i < length; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

// Muted pastel tones — enough colour to stay legible, desaturated enough
// to blend into the card background instead of popping out in bright,
// easily colour-segmented neon hues.
function charColor() {
  const hue = Math.floor(Math.random() * 360);
  const sat = 28 + Math.random() * 20;
  const light = 62 + Math.random() * 14;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function draw(canvas, code) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255,255,255,.06)';
  ctx.fillRect(0, 0, w, h);

  // Curved noise strokes (harder for OCR line-removal than straight lines).
  for (let i = 0; i < 7; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.14 + Math.random() * 0.22})`;
    ctx.lineWidth = 1 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, Math.random() * h);
    ctx.bezierCurveTo(
      Math.random() * w, Math.random() * h,
      Math.random() * w, Math.random() * h,
      Math.random() * w, Math.random() * h,
    );
    ctx.stroke();
  }

  // Slight overlap between characters + randomised size/baseline wave.
  const charWidth = w / (code.length - 0.4);
  ctx.save();
  ctx.filter = 'blur(0.5px)';
  for (let i = 0; i < code.length; i++) {
    ctx.save();
    const cx = charWidth * (i + 0.5) - (charWidth * 0.1 * i);
    const cy = h / 2 + Math.sin(i * 1.7) * 5 + (Math.random() - 0.5) * 4;
    ctx.translate(cx, cy);
    ctx.rotate((Math.random() - 0.5) * 0.7);
    const size = h * (0.5 + Math.random() * 0.18);
    ctx.font = `800 ${Math.floor(size)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillStyle = charColor();
    ctx.globalAlpha = 0.88 + Math.random() * 0.12;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // Foreground speckle + a few thin overlay lines cutting across the glyphs.
  for (let i = 0; i < 45; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.15})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, Math.random() * h);
    ctx.lineTo(Math.random() * w, Math.random() * h);
    ctx.stroke();
  }
}

const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function speakCode(code) {
  if (!speechSupported) return;
  window.speechSynthesis.cancel();
  // Spell out each character with a pause so it's unambiguous by ear.
  const utterance = new SpeechSynthesisUtterance(code.split('').join(', '));
  utterance.rate = 0.75;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

/**
 * Self-contained, offline captcha — generated, spoken and verified entirely
 * in the browser (canvas + Web Speech API), no external service/API call
 * involved. Meets GIGW 3.0 / WCAG 2.1 (1.1.1) requirements for CAPTCHA:
 *  - a text alternative that identifies the purpose (without revealing the
 *    answer) is exposed via aria-label on the image; and
 *  - an alternative output mode for a different sensory perception (audio)
 *    is provided via the "Listen" control, for users who cannot read the
 *    distorted visual code.
 *
 * Usage: const captchaRef = useRef(null);
 *   captchaRef.current.validate()  -> boolean (also shakes the input if wrong)
 *   captchaRef.current.reset()     -> generates a fresh code
 *   onStatusChange({ touched, valid }) fires live as the user types, so the
 *   parent can keep a submit button soft-disabled until the code is correct.
 */
const Captcha = forwardRef(function Captcha({ label = 'Security Check', style, onStatusChange }, ref) {
  const canvasRef = useRef(null);
  const codeRef = useRef('');
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const inputId = useId();

  const notify = (val) => {
    const touched = val.length > 0;
    const valid = touched && val.trim().toUpperCase() === codeRef.current;
    onStatusChange?.({ touched, valid });
  };

  const refresh = () => {
    codeRef.current = generateCode();
    setInput('');
    draw(canvasRef.current, codeRef.current);
    notify('');
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => () => { if (speechSupported) window.speechSynthesis.cancel(); }, []);

  useImperativeHandle(ref, () => ({
    validate: () => {
      const ok = input.trim().toUpperCase() === codeRef.current;
      if (!ok) {
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
      return ok;
    },
    reset: refresh,
  }));

  return (
    <div style={style}>
      <style>{`
        @keyframes captchaShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
        .captcha-refresh, .captcha-listen { transition:background .15s,transform .15s; cursor:pointer; }
        .captcha-refresh:hover, .captcha-listen:hover { background:rgba(255,255,255,.16) !important; }
        .captcha-refresh:active { transform:rotate(90deg); }
        .captcha-listen:active { transform:scale(.92); }
        .captcha-inp { outline:none; transition:border-color .15s,box-shadow .15s; }
        .captcha-inp:focus { border-color:rgba(74,222,128,.7) !important; box-shadow:0 0 0 3px rgba(74,222,128,.15) !important; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 8, marginBottom: 8 }}>
        <label htmlFor={inputId} style={{
          fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,.5)',
          letterSpacing: '.08em', textTransform: 'uppercase',
        }}>
          {label}
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <canvas
            ref={canvasRef}
            width={128}
            height={40}
            role="img"
            aria-label="CAPTCHA verification image showing a distorted code. If you cannot read it, use the listen button for an audio version, then type the code in the field below."
            style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)' }}
          />
          {speechSupported && (
            <button
              type="button"
              onClick={() => speakCode(codeRef.current)}
              className="captcha-listen"
              title="Listen to the code"
              aria-label="Listen to the captcha code spoken aloud"
              style={{
                width: 36, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.18)',
                background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.65)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <Volume2 size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={refresh}
            className="captcha-refresh"
            title="Generate a new code"
            aria-label="Generate a new captcha code"
            style={{
              width: 36, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.18)',
              background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.65)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      <input
        id={inputId}
        className="captcha-inp"
        type="text"
        value={input}
        onChange={e => { setInput(e.target.value); notify(e.target.value); }}
        placeholder="Enter the code shown above or heard via audio"
        autoComplete="off"
        style={{
          width: '100%', padding: '11px 13px',
          background: 'rgba(255,255,255,.10)',
          border: '1px solid rgba(255,255,255,.18)',
          borderRadius: 11, fontSize: 13.5, color: '#fff',
          animation: shake ? 'captchaShake .4s ease' : undefined,
        }}
      />
    </div>
  );
});

export default Captcha;
