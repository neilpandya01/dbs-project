"use client";

import { useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { BANNER_PRESETS, BannerArt, DEFAULT_BANNER, type Banner } from "@/lib/banners";
import { BannerBackground } from "./BannerBackground";
import { CityPicker } from "./CityPicker";
import { Sheet } from "./Sheet";
import { AVATAR_COLORS, type Profile } from "@/lib/profileStore";
import { useMe } from "@/lib/useMe";

const isPreset = (c: string) => AVATAR_COLORS.includes(c);
const MAX_PHOTO_MB = 10;

/** Center-crop to a square and shrink, so the saved photo stays small (about 20-40 KB). */
async function toSquareJpeg(file: File, size = 256): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** Keep the photo's own proportions, capped in size so it fits the database limit (about 500 KB as text). */
async function toBannerJpeg(file: File, maxW = 1280): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  let out = "";
  for (const q of [0.8, 0.65, 0.5, 0.4]) {
    out = canvas.toDataURL("image/jpeg", q);
    if (out.length <= 520_000) return out;
  }
  throw new Error("too large");
}

export function ProfileForm({ profile, onSave, onClose }: { profile: Profile; onSave: (p: Profile) => Promise<string | null>; onClose: () => void }) {
  const me = useMe();
  const [name, setName] = useState(profile.name);
  const [home, setHome] = useState(profile.home);
  const [homePlace, setHomePlace] = useState(profile.homePlace);
  const [bio, setBio] = useState(profile.bio);
  const [photo, setPhoto] = useState<string | null>(profile.photo);
  const [color, setColor] = useState(profile.color);
  const [banner, setBanner] = useState<Banner>(profile.banner ?? DEFAULT_BANNER);
  const bannerFile = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file (JPG, PNG, HEIC…).");
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return setError(`That photo is over ${MAX_PHOTO_MB} MB.`);
    setBusy(true);
    setError(null);
    try {
      setPhoto(await toSquareJpeg(file));
    } catch {
      setError("Couldn’t read that image. Try a JPG or PNG.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const pickBanner = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file for the banner.");
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return setError(`That photo is over ${MAX_PHOTO_MB} MB.`);
    setBusy(true);
    setError(null);
    try {
      setBanner({ kind: "photo", src: await toBannerJpeg(file), focusY: 50 });
    } catch {
      setError("Couldn’t read that image. Try a JPG or PNG.");
    } finally {
      setBusy(false);
      if (bannerFile.current) bannerFile.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Add a display name.");
    if (!home) return setError("Choose your home city.");
    setBusy(true);
    setError(null);
    const err = await onSave({ name: name.trim(), home, homePlace, bio: bio.trim(), photo, color, banner });
    if (err) { setError(err); setBusy(false); }
  };

  return (
    <Sheet title="Edit profile" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <div className="photo-edit" id="pf-photo" tabIndex={-1}>
          <Avatar name={name || "?"} color={color} size={88} src={photo} />
          <div className="photo-actions">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <button type="button" className="btn small primary" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? "Processing…" : photo ? "Change photo" : "Upload photo"}
            </button>
            {photo && <button type="button" className="btn small" onClick={() => setPhoto(null)}>Remove</button>}
          </div>
        </div>

        {!photo && (
          <fieldset className="swatches">
            <legend>Avatar colour</legend>
            {AVATAR_COLORS.map((c) => (
              <button key={c} type="button" className="swatch" style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} />
            ))}
            <label className="swatch custom" aria-pressed={!isPreset(color)} style={!isPreset(color) ? { background: color } : undefined} title="Pick any colour">
              <span className="sr-only">Custom colour</span>
              <span aria-hidden="true">{isPreset(color) ? "+" : ""}</span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Custom colour" />
            </label>
            {!isPreset(color) && <span className="mono muted" style={{ fontSize: 13 }}>{color.toUpperCase()}</span>}
          </fieldset>
        )}

        <fieldset className="banner-picker" id="pf-banner" tabIndex={-1}>
          <legend>Banner</legend>
          <div className={`banner-preview`} aria-label="Banner preview">
            <div className="banner-preview-bg"><BannerBackground banner={banner} /></div>
          </div>
          {banner.kind === "photo" && (
            <label className="banner-focus">
              <span>Move picture up or down</span>
              <input type="range" min={0} max={100} value={banner.focusY ?? 50} onChange={(e) => setBanner({ ...banner, focusY: Number(e.target.value) })} aria-label="Move banner picture up or down" />
            </label>
          )}
          <p className="form-hint">Pick one of ours, or upload your own. Wide (landscape) photos look best; taller ones are cropped, so slide to choose what shows.</p>
          <div className="banner-grid">
            {BANNER_PRESETS.map((b) => (
              <button key={b.id} type="button" className="banner-thumb" aria-pressed={banner.kind === "preset" && banner.id === b.id} aria-label={b.name} title={b.name} onClick={() => setBanner({ kind: "preset", id: b.id })}>
                <BannerArt id={b.id} />
              </button>
            ))}
            <input ref={bannerFile} type="file" accept="image/*" hidden onChange={(e) => pickBanner(e.target.files?.[0])} />
            <button type="button" className="banner-thumb upload" aria-pressed={banner.kind === "photo"} aria-label="Upload your own banner photo" onClick={() => bannerFile.current?.click()} disabled={busy}>
              {banner.kind === "photo" ? <img src={banner.src} alt="" style={{ objectPosition: `50% ${banner.focusY ?? 50}%` }} /> : null}
              <span>{busy ? "Processing…" : banner.kind === "photo" ? "Change" : "＋ Upload"}</span>
            </button>
          </div>
        </fieldset>

        <label>
          <span>Display name</span>
          <input id="pf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="off" />
        </label>

        <label>
          <span>Username</span>
          <input className="input mono" value={`@${me.username}`} readOnly disabled aria-describedby="uname-hint" />
          <small id="uname-hint" className="muted">Usernames can’t be changed after sign-up.</small>
        </label>

        <CityPicker id="pf-home" value={home} onPick={(p) => { setHome(p.label); setHomePlace({ lat: p.lat, lon: p.lon }); setError(null); }} />

        <label>
          <span>Bio <small>optional · {bio.length}/120</small></span>
          <textarea id="pf-bio" className="input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={120} placeholder="Window seat, always. A220 enthusiast." />
        </label>

        {error && <p className="msg err" role="alert">{error}</p>}

        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Sheet>
  );
}
