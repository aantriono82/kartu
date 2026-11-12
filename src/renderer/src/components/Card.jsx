import { Hash, IdCard, User, GraduationCap, DoorOpen, Clock, MapPin, KeyRound, ShieldCheck } from 'lucide-react'
import { FitText, FitBox } from './Fit'
import { qrPath } from '../lib/qr'
import { assetUrl, cardTitle, formatNip, photoUrl, qrText } from '../lib/format'
import './card.css'

export const CARD_W = 950 // 1 px desain = 0,1 mm
export const CARD_H = 680

const ROWS = [
  [Hash, 'NO URUT', 'no_urut'],
  [IdCard, 'NOMOR PESERTA', 'nomor_peserta'],
  [User, 'NAMA', 'nama'],
  [GraduationCap, 'KELAS', 'kelas'],
  [DoorOpen, 'RUANG', 'ruang'],
  [Clock, 'SESI', 'sesi']
]

function Img({ src, className, alt, fallback = null }) {
  if (!src) return fallback
  return <img src={src} className={className} alt={alt} draggable={false} />
}

function LogoSlot({ src, label }) {
  return <Img src={src} className="logo-img" alt={label} fallback={<div className="logo-empty">{label}</div>} />
}

function Photo({ p }) {
  return (
    <Img
      src={photoUrl(p)}
      className="photo-img"
      alt="foto"
      fallback={
        <div className="photo-empty">
          <svg viewBox="0 0 100 120" width="60%">
            <circle cx="50" cy="42" r="22" fill="currentColor" />
            <path d="M8 120c4-30 22-44 42-44s38 14 42 44z" fill="currentColor" />
          </svg>
          <span>FOTO 3×4</span>
        </div>
      }
    />
  )
}

function Qr({ text, size }) {
  const { size: n, path } = qrPath(text)
  const pad = 2
  return (
    <svg className="qr" width={size} height={size} viewBox={`${-pad} ${-pad} ${n + pad * 2} ${n + pad * 2}`} shapeRendering="crispEdges">
      <rect x={-pad} y={-pad} width={n + pad * 2} height={n + pad * 2} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}

function Signature({ settings, height, invert }) {
  const ttd = assetUrl(settings, 'ttd')
  const stempel = assetUrl(settings, 'stempel')
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' ? Number(v) : d)
  const ttdH = (height * num(settings.ttdScale, 100)) / 100
  const stampH = (height * num(settings.stempelScale, 150)) / 100
  // 1 px desain = 0,1 mm
  const dx = num(settings.stempelX, 0) * 10
  const dy = num(settings.stempelY, 0) * 10
  return (
    <div className="sig" style={{ height }}>
      {stempel && (
        <img
          src={stempel}
          className="sig-stamp"
          alt="stempel"
          style={{ height: stampH, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))` }}
          draggable={false}
        />
      )}
      {ttd && (
        <img src={ttd} className={'sig-ttd' + (invert ? ' sig-invert' : '')} alt="tanda tangan" style={{ height: ttdH }} draggable={false} />
      )}
    </div>
  )
}

// ======================= TEMPLATE TERANG =======================
function FrontTerang({ p, settings, exam }) {
  return (
    <div className="card terang">
      <svg className="t-stripe-top" width="950" height="22" viewBox="0 0 950 22">
        <polygon points="0,0 610,0 592,22 0,22" fill="#0d3a8c" />
        <polygon points="618,0 676,0 658,22 600,22" fill="#2a6fdb" />
        <polygon points="684,0 880,0 862,22 666,22" fill="#f5b800" />
        <polygon points="888,0 950,0 950,22 870,22" fill="#0d3a8c" />
      </svg>

      <div className="t-logo t-logo-l">
        <LogoSlot src={assetUrl(settings, 'logoKab')} label="LOGO KAB" />
      </div>
      <div className="t-logo t-logo-r">
        <LogoSlot src={assetUrl(settings, 'logoSekolah')} label="LOGO SEKOLAH" />
      </div>

      <div className="t-head">
        <FitText size={31} className="t-h1">{settings.pemerintah}</FitText>
        <FitText size={23} className="t-h2">{settings.dinas}</FitText>
        <FitText size={28} className="t-h3">{settings.uptd}</FitText>
        <FitText size={41} className="t-h4">{settings.namaSekolah}</FitText>
        <div className="t-addr">
          <MapPin size={22} strokeWidth={2.6} color="#1554b3" fill="#1554b333" />
          <FitText size={19}>{settings.alamat}</FitText>
        </div>
      </div>

      <div className="t-title">
        <FitText size={25}>{cardTitle(exam)}</FitText>
      </div>

      <div className="t-rows">
        {ROWS.map(([Icon, label, key]) => (
          <div className="t-row" key={key}>
            <div className="t-ico">
              <Icon size={21} strokeWidth={2.4} color="#fff" />
            </div>
            <div className="t-label">{label}</div>
            <div className="t-colon">:</div>
            <FitText size={22} min={11} lines={key === 'nama' ? 2 : 1} className="t-val">
              {p[key] || '-'}
            </FitText>
          </div>
        ))}
      </div>

      <div className="t-photo">
        <Photo p={p} />
      </div>

      <div className="t-sign">
        <Qr text={qrText(p, settings, exam)} size={84} />
        <div className="t-kepsek">Kepala Sekolah</div>
        <Signature settings={settings} height={86} />
        <div className="t-name">
          <FitText size={18} min={10}>{settings.kepalaSekolah}</FitText>
        </div>
        <FitText size={15} min={9} className="t-nip">
          {settings.nip ? 'NIP. ' + formatNip(settings.nip) : ''}
        </FitText>
      </div>

      <svg className="t-stripe-bot" width="950" height="34" viewBox="0 0 950 34">
        <polygon points="0,6 250,6 226,34 0,34" fill="#f5b800" />
        <polygon points="258,6 560,6 580,0 950,0 950,34 234,34" fill="#0d3a8c" />
        <polygon points="760,6 900,6 880,34 740,34" fill="#f5b800" />
      </svg>
    </div>
  )
}

function BackTerang({ p, settings, exam }) {
  return (
    <div className="card terang back">
      <div className="b-band">
        <div className="b-logo">
          <LogoSlot src={assetUrl(settings, 'logoSekolah')} label="LOGO" />
        </div>
        <div className="b-head">
          <FitText size={32} className="b-h1">TATA TERTIB PESERTA UJIAN</FitText>
          <FitText size={19} className="b-h2">
            {settings.namaSekolah} · {cardTitle(exam).replace('KARTU TANDA PESERTA ', '')}
          </FitText>
        </div>
      </div>
      <BackBody p={p} settings={settings} />
      <svg className="t-stripe-bot" width="950" height="22" viewBox="0 0 950 22">
        <polygon points="0,4 250,4 232,22 0,22" fill="#f5b800" />
        <polygon points="258,4 950,4 950,22 240,22" fill="#0d3a8c" />
      </svg>
    </div>
  )
}

function BackBody({ p, settings }) {
  const rules = String(settings.tataTertib || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  return (
    <>
      <FitBox size={22} min={10} className="b-rules" deps={[settings.tataTertib]}>
        <ol>
          {rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>
      </FitBox>
      <div className="b-acc">
        <div className="b-acc-title">
          <ShieldCheck size={22} strokeWidth={2.4} /> AKUN UJIAN
        </div>
        <div className="b-acc-who">
          <FitText size={21} min={10} lines={2} className="b-acc-name">{p.nama}</FitText>
          <FitText size={16} min={9} className="b-acc-sub">
            {[p.nomor_peserta && 'No. ' + p.nomor_peserta, p.kelas, p.ruang && 'Ruang ' + p.ruang, p.sesi && 'Sesi ' + p.sesi]
              .filter(Boolean)
              .join(' · ')}
          </FitText>
        </div>
        <div className="b-acc-label">
          <User size={16} strokeWidth={2.6} /> USERNAME
        </div>
        <FitText size={30} min={12} className="b-acc-val">{p.username || '-'}</FitText>
        <div className="b-acc-label">
          <KeyRound size={16} strokeWidth={2.6} /> PASSWORD
        </div>
        <FitText size={30} min={12} className="b-acc-val">{p.password || '-'}</FitText>
        <div className="b-acc-note">Jaga kerahasiaan username &amp; password Anda.</div>
      </div>
    </>
  )
}

// ======================= TEMPLATE GELAP =======================
function DarkBg() {
  return (
    <svg className="g-bg" width="950" height="680" viewBox="0 0 950 680">
      <defs>
        <radialGradient id="g-glow" cx="50%" cy="18%" r="55%">
          <stop offset="0" stopColor="#2f7fd6" stopOpacity=".35" />
          <stop offset="1" stopColor="#2f7fd6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="950" height="680" fill="url(#g-glow)" />
      <g stroke="#6fb6ff" strokeOpacity=".09" strokeWidth="1.2" fill="none">
        <path d="M0 60 L120 0 M0 160 L260 0 M820 0 L950 90 M700 0 L950 200 M640 680 L950 420 M760 680 L950 520" />
        <path d="M600 300 L700 240 L800 300 L900 250 M560 560 L660 520 L760 580" />
      </g>
      <g fill="#6fb6ff" fillOpacity=".25">
        <circle cx="700" cy="240" r="2.5" />
        <circle cx="800" cy="300" r="2.5" />
        <circle cx="900" cy="250" r="2.5" />
        <circle cx="660" cy="520" r="2.5" />
      </g>
    </svg>
  )
}

function DarkWave() {
  return (
    <svg className="g-wave" width="680" height="150" viewBox="0 0 680 150" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g-y" x1="0" x2="1">
          <stop offset="0" stopColor="#ffb300" />
          <stop offset="1" stopColor="#ffe066" />
        </linearGradient>
        <linearGradient id="g-c" x1="0" x2="1">
          <stop offset="0" stopColor="#1597ff" />
          <stop offset="1" stopColor="#7fd8ff" />
        </linearGradient>
      </defs>
      <path d="M0 62 C160 20 360 40 680 120 L680 150 L0 150Z" fill="url(#g-y)" />
      <path d="M0 98 C200 58 420 82 680 138 L680 150 L0 150Z" fill="url(#g-c)" />
    </svg>
  )
}

function FrontGelap({ p, settings, exam }) {
  return (
    <div className="card gelap">
      <DarkBg />
      <div className="g-logo g-logo-l">
        <LogoSlot src={assetUrl(settings, 'logoKab')} label="LOGO KAB" />
      </div>
      <div className="g-logo g-logo-r">
        <LogoSlot src={assetUrl(settings, 'logoSekolah')} label="LOGO SEKOLAH" />
      </div>

      <div className="g-head">
        <FitText size={46} className="g-h1">{settings.namaSekolah}</FitText>
        <FitText size={22} className="g-h2">{settings.dinas}</FitText>
        <FitText size={22} className="g-h2">{settings.wilayah}</FitText>
        <div className="g-addr">
          <MapPin size={20} strokeWidth={2.4} color="#46b8ff" />
          <FitText size={16.5}>{settings.alamat}</FitText>
        </div>
      </div>
      <div className="g-line" />

      <div className="g-title">
        <FitText size={21}>{cardTitle(exam)}</FitText>
      </div>

      <div className="g-rows">
        {ROWS.map(([Icon, label, key]) => (
          <div className="g-row" key={key}>
            <div className="g-ico">
              <Icon size={18} strokeWidth={2.4} color="#6cc4ff" />
            </div>
            <div className="g-label">{label}</div>
            <div className="g-colon">:</div>
            <FitText size={21} min={10} lines={key === 'nama' ? 2 : 1} className="g-val">
              {p[key] || '-'}
            </FitText>
          </div>
        ))}
      </div>

      <div className="g-photo">
        <Photo p={p} />
      </div>

      <div className="g-sign">
        <div className="g-kepsek">Kepala Sekolah</div>
        <Signature settings={settings} height={60} invert />
        <div className="g-name">
          <FitText size={19} min={10}>{settings.kepalaSekolah}</FitText>
        </div>
        <FitText size={13.5} min={8} className="g-nip">
          {settings.nip ? 'NIP. ' + formatNip(settings.nip) : ''}
        </FitText>
      </div>

      <DarkWave />
      <div className="g-qr">
        <Qr text={qrText(p, settings, exam)} size={86} />
      </div>
    </div>
  )
}

function BackGelap({ p, settings, exam }) {
  return (
    <div className="card gelap back">
      <DarkBg />
      <div className="b-band">
        <div className="b-logo g-logo-small">
          <LogoSlot src={assetUrl(settings, 'logoSekolah')} label="LOGO" />
        </div>
        <div className="b-head">
          <FitText size={32} className="b-h1">TATA TERTIB PESERTA UJIAN</FitText>
          <FitText size={19} className="b-h2">
            {settings.namaSekolah} · {cardTitle(exam).replace('KARTU TANDA PESERTA ', '')}
          </FitText>
        </div>
      </div>
      <div className="g-line g-line-back" />
      <BackBody p={p} settings={settings} />
    </div>
  )
}

const TEMPLATES = {
  terang: { front: FrontTerang, back: BackTerang },
  gelap: { front: FrontGelap, back: BackGelap }
}

/** Renders a card at design size (950×680 px). */
export function Card({ template = 'terang', side = 'front', ...props }) {
  const C = (TEMPLATES[template] || TEMPLATES.terang)[side === 'back' ? 'back' : 'front']
  return <C {...props} />
}

/** Card scaled to a box; width can be px number or CSS length (e.g. "95mm"). */
export function ScaledCard({ scale, width, height, ...props }) {
  return (
    <div className="card-box" style={{ width: width ?? CARD_W * scale, height: height ?? CARD_H * scale }}>
      <div className="card-scale" style={{ transform: `scale(${scale})` }}>
        <Card {...props} />
      </div>
    </div>
  )
}
