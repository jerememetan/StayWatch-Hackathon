"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  isPhotoReviewResult, MAX_PHOTO_BYTES, PHOTO_MIME_TYPES,
  photoLayoutLabels, photoLimitationLabels, photoObjectLabels, type PhotoReviewResult,
} from "@/lib/photo-review-types";
import styles from "./photo-review.module.css";

export function PhotoReviewPanel({ unitId, enabled }: { unitId: string; enabled: boolean }) {
  return <PhotoReviewSession key={unitId} unitId={unitId} enabled={enabled} />;
}

function PhotoReviewSession({ unitId, enabled }: { unitId: string; enabled: boolean }) {
  const inputId = useId();
  const helpId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoReviewResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => () => { activeRequest.current?.abort(); }, []);

  function clearPhoto() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setFile(null);
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectPhoto(nextFile: File | null) {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setFile(null);
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
    if (!nextFile) return;
    if (!PHOTO_MIME_TYPES.some((type) => type === nextFile.type)) {
      setError("Choose a JPEG, PNG, or WebP CCTV still.");
      return;
    }
    if (!nextFile.size || nextFile.size > MAX_PHOTO_BYTES) {
      setError("Choose a still smaller than 5 MB.");
      return;
    }
    setFile(nextFile);
  }

  async function analyzePhoto() {
    if (!file || !enabled || isAnalyzing) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    const form = new FormData();
    form.set("unitId", unitId);
    form.set("photo", file);
    try {
      const response = await fetch("/api/photo-review", { method: "POST", body: form, signal: controller.signal });
      const payload: unknown = await response.json();
      if (activeRequest.current !== controller) return;
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "CCTV review is unavailable. Try again shortly.";
        throw new Error(message);
      }
      if (!isPhotoReviewResult(payload) || payload.unitId !== unitId) throw new Error("The CCTV review could not be read. Please try again.");
      setResult(payload);
    } catch (caught) {
      if (activeRequest.current !== controller) return;
      setError(controller.signal.aborted ? "CCTV review took too long. Please try again." : caught instanceof Error ? caught.message : "CCTV review is unavailable. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      if (activeRequest.current === controller) { setIsAnalyzing(false); activeRequest.current = null; }
    }
  }

  return (
    <details className={styles.panel} id="photo-review-panel">
      <summary className={styles.summary}>
        <span className={styles.summaryCopy}>
          <span className={styles.heading}>Entrance CCTV review</span>
          <span className={styles.description}>Inspect a still from the driveway, drop-off, or common entrance.</span>
        </span>
        <span className={styles.availability}>{enabled ? "Available" : "Setup needed"}</span>
        <svg className={styles.chevron} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>

      <div className={styles.body}>
        <p className={styles.scope}>Review an outdoor CCTV still from a condominium or HDB block for luggage, vehicles at the drop-off, and other scene objects. Each observation needs human verification. This is a still frame, not live video or facial recognition.</p>
        {!enabled && <p className={styles.setup}>CCTV analysis is not enabled in this demo. An administrator needs to configure OpenAI. You can still preview a still locally.</p>}

        <div className={styles.upload}>
          <label className={styles.label} htmlFor={inputId}>Choose a CCTV still</label>
          <input ref={inputRef} id={inputId} className={styles.fileInput} type="file" accept={PHOTO_MIME_TYPES.join(",")} disabled={isAnalyzing} aria-describedby={helpId} onChange={(event) => selectPhoto(event.currentTarget.files?.[0] ?? null)} />
          <p id={helpId} className={styles.hint}>One JPEG, PNG, or WebP snapshot · up to 5 MB. Use an outdoor entrance or driveway still. Do not upload faces, plates, or personal documents.</p>
        </div>

        {file && preview && (
          <figure className={styles.preview}>
            <Image src={preview} alt="Local preview of the selected CCTV still" width={1600} height={1200} unoptimized className={styles.previewImage} />
            <figcaption><span className={styles.fileName}>{file.name}</span><span className={styles.localLabel}>Local preview</span></figcaption>
          </figure>
        )}

        <p className={styles.privacy}>Selecting a still keeps it in this browser. <strong>Analyze still</strong> sends it to OpenAI. StayWatch does not save the image; OpenAI data policies apply.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.analyzeButton} disabled={!enabled || !file || isAnalyzing} onClick={analyzePhoto}>{isAnalyzing ? "Analyzing still…" : result ? "Analyze again" : "Analyze still"}</button>
          {file && <button type="button" className={styles.removeButton} onClick={clearPhoto}>{isAnalyzing ? "Cancel & remove" : "Remove still"}</button>}
        </div>
        {isAnalyzing && <p className={styles.status} role="status">Reviewing visible scene objects. This usually takes a few seconds.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}

        {result && <PhotoObservations result={result} />}
        <p className={styles.boundary}>A CCTV still cannot establish who lives here, tenancy status, or wrongdoing. This review does not change the attention score or add evidence to an investigation. Faces and plates are out of scope.</p>
      </div>
    </details>
  );
}

function PhotoObservations({ result }: { result: PhotoReviewResult }) {
  const { assessment } = result;
  const usable = assessment.view === "exterior" && assessment.quality !== "unusable";
  return (
    <section className={styles.results} aria-label="CCTV observations">
      <div className={styles.resultHeading}>
        <h3>{usable ? "Visible observations" : "A clearer entrance still is needed"}</h3>
        <span className={styles.resultStatus} role="status">{usable ? "Ready for human review" : "Unable to assess"}</span>
      </div>
      {usable && <p className={styles.hint}>{assessment.quality === "clear" ? "The entrance or driveway is visible, but counts and timing still need verification." : "Some details are unclear. Treat these observations cautiously."}</p>}
      {assessment.objects.length > 0 ? (
        <table className={styles.objects}>
          <thead><tr><th scope="col">Visible object</th><th scope="col">Approx. count</th><th scope="col">Visibility</th></tr></thead>
          <tbody>{assessment.objects.map((object) => (
            <tr key={object.kind}><th scope="row">{photoObjectLabels[object.kind]}</th><td>{object.visibleCount}</td><td>{object.certainty === "clear" ? "Clear" : "Uncertain"}</td></tr>
          ))}</tbody>
        </table>
      ) : usable && <p className={styles.hint}>No supported scene objects could be identified with enough detail.</p>}
      {assessment.objects.length > 0 && <p className={styles.hint}>Object categories can overlap. Counts are not occupancy, arrivals, or confirmed stays.</p>}
      {assessment.layoutFeatures.length > 0 && <div className={styles.observationGroup}><h4>Scene to verify</h4><ul>{assessment.layoutFeatures.map((feature) => <li key={feature}>{photoLayoutLabels[feature]}</li>)}</ul></div>}
      <div className={styles.observationGroup}><h4>Limits of this still</h4><ul>{assessment.limitations.map((limitation) => <li key={limitation}>{photoLimitationLabels[limitation]}</li>)}</ul></div>
      <p className={styles.nextStep}><strong>Next step</strong> {usable ? "Verify the driveway or entrance scene on site. A still cannot confirm the unit, date, who was present, or why bags or vehicles were there." : "Choose a well-lit outdoor CCTV still of the entrance, drop-off, or driveway."}</p>
    </section>
  );
}
