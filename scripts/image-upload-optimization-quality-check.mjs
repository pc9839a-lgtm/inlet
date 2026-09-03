import { readFile } from 'node:fs/promises';
import {
  IMAGE_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_MAX_DIMENSION,
  IMAGE_UPLOAD_SOURCE_MAX_BYTES,
  IMAGE_UPLOAD_WARN_BYTES,
  estimatedDataUrlBytes,
  imageDataFingerprint,
  storedDataImageBytes,
  validateImageUpload,
} from '../src/lib/imageUploadGuard.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const fakeFile = (type, size, name = 'image') => ({ type, size, name });

assert(IMAGE_UPLOAD_SOURCE_MAX_BYTES === 12 * 1024 * 1024, 'source image limit must allow common high-resolution mobile photos');
assert(IMAGE_UPLOAD_MAX_BYTES === 240 * 1024, 'embedded image hard limit must match the page-save per-image safety budget');
assert(IMAGE_UPLOAD_WARN_BYTES === 180 * 1024, 'embedded image target must leave room for page JSON and base64 expansion');
assert(IMAGE_UPLOAD_MAX_DIMENSION === 1600, 'editor images must match the page-save 1600px maximum edge');
assert(estimatedDataUrlBytes({ size: IMAGE_UPLOAD_MAX_BYTES }) < 330 * 1024, 'one maximum embedded image must stay near 320KB after base64 expansion');
assert(validateImageUpload(fakeFile('image/jpeg', 8 * 1024 * 1024, 'phone.jpg')).ok, 'an 8MB mobile JPG must be accepted for optimization');
assert(validateImageUpload(fakeFile('image/jpeg', 13 * 1024 * 1024, 'huge.jpg')).reason === 'source-size', 'source images over 12MB must be rejected before decoding');
assert(validateImageUpload(fakeFile('image/heic', 2 * 1024 * 1024, 'photo.heic')).reason === 'format', 'HEIC must return a clear conversion requirement');
assert(validateImageUpload(fakeFile('image/svg+xml', 20 * 1024, 'unsafe.svg')).reason === 'format', 'SVG must not enter the embedded image pipeline');
assert(validateImageUpload(fakeFile('image/gif', IMAGE_UPLOAD_MAX_BYTES + 1, 'animated.gif')).reason === 'animated-size', 'oversized animated GIFs must be rejected because animation cannot be canvas-compressed safely');
assert(validateImageUpload(fakeFile('text/plain', 10, 'bad.txt')).reason === 'type', 'non-image files must be rejected');

const sampleDataUrl = `data:image/png;base64,${Buffer.from('same-image').toString('base64')}`;
const otherDataUrl = `data:image/png;base64,${Buffer.from('other-image').toString('base64')}`;
assert(storedDataImageBytes(sampleDataUrl) === Buffer.byteLength('same-image'), 'stored data URL byte estimation must decode base64 payload size');
assert(imageDataFingerprint(sampleDataUrl) === imageDataFingerprint(sampleDataUrl), 'image fingerprints must be stable');
assert(imageDataFingerprint(sampleDataUrl) !== imageDataFingerprint(otherDataUrl), 'different images must have different fingerprints');

const guardSource = await readFile('src/lib/imageUploadGuard.js', 'utf8');
const pickerSource = await readFile('src/editor/useImageInputPicker.js', 'utf8');
const imageControlsSource = await readFile('src/editor/imageControls.jsx', 'utf8');
const previewSource = await readFile('src/editor/ImageInputPreview.jsx', 'utf8');
const storageNoteSource = await readFile('src/editor/ImageStorageNote.jsx', 'utf8');
const gallerySource = await readFile('src/editor/blockEditors/useGalleryMultiUpload.js', 'utf8');
const galleryEditorSource = await readFile('src/editor/blockEditors/ImageGalleryEditor.jsx', 'utf8');
const galleryButtonSource = await readFile('src/editor/blockEditors/GalleryUploadButton.jsx', 'utf8');
const stylesSource = await readFile('src/styles/editor-image-upload-status.css', 'utf8');
const appStyleEntrySource = await readFile('src/app-styles.css', 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const qaAllSource = await readFile('scripts/qa-all.mjs', 'utf8');

assert(guardSource.includes("createImageBitmap(file, { imageOrientation: 'from-image' })"), 'image decoding must request EXIF orientation correction');
assert(guardSource.includes('targetDimensions(decoded.width, decoded.height, maxDimension)'), 'image dimensions must be reduced before encoding');
assert(guardSource.includes("supportsWebp(canvas) ? 'image/webp'"), 'modern browsers must prefer WebP output');
assert(guardSource.includes('qualities =') && guardSource.includes('0.86') && guardSource.includes('0.54'), 'image quality must step down progressively instead of using one fixed encode');
assert(guardSource.includes('bestBlob.size > maxBytes'), 'final image size must be enforced after optimization');
assert(guardSource.includes("stage: 'optimizing'") && guardSource.includes("stage: 'encoding'") && guardSource.includes("stage: 'done'"), 'optimizer must expose meaningful progress stages');

assert(pickerSource.includes("status: 'processing'") && pickerSource.includes('onProgress:'), 'single image upload must expose processing progress');
assert(pickerSource.includes('imageDataFingerprint(value)') && pickerSource.includes('siblingFingerprints.has(result.fingerprint)'), 'single and gallery-slot uploads must reject identical images');
assert(imageControlsSource.includes('accept="image/jpeg,image/png,image/webp,image/gif"'), 'file picker must advertise only supported image formats');
assert(previewSource.includes('image-upload-progress') && previewSource.includes('aria-live="polite"'), 'image preview must show accessible progress feedback');
assert(storageNoteSource.includes('최대 1600px로 자동 최적화'), 'empty image inputs must explain the corrected automatic optimization limit');

assert(gallerySource.includes('GALLERY_EMBEDDED_TOTAL_TARGET_BYTES = 600 * 1024'), 'gallery uploads must share a total embedded image budget');
assert(gallerySource.includes('GALLERY_IMAGE_MIN_TARGET_BYTES = 72 * 1024'), 'gallery uploads must preserve the page-save minimum image target');
assert(gallerySource.includes('galleryImageBudget(count, limited.length, max)'), 'gallery uploads must size each image from the final gallery count');
assert(gallerySource.includes('targetBytes: imageBudget.targetBytes') && gallerySource.includes('maxBytes: imageBudget.maxBytes'), 'gallery optimization must enforce the calculated per-image budget');
assert(gallerySource.includes('for (let index = 0; index < limited.length; index += 1)'), 'gallery files must be optimized sequentially to limit memory spikes');
assert(!gallerySource.includes('Promise.all(limited.map'), 'gallery optimization must not decode all large files concurrently');
assert(gallerySource.includes('fingerprints.has(result.fingerprint)') && gallerySource.includes('duplicateCount'), 'multi-upload must skip duplicate images');
assert(galleryEditorSource.includes('duplicateValues={gallery.filter'), 'individual gallery replacements must check sibling images');
assert(galleryButtonSource.includes('aria-busy') && galleryButtonSource.includes('gallery-upload-progress'), 'multi-upload button must expose busy and progress states');
assert(stylesSource.includes('.image-upload-status') && stylesSource.includes('.gallery-upload-progress'), 'image progress UI styles are missing');
assert(appStyleEntrySource.includes("@import './styles/editor-image-upload-status.css';"), 'image progress stylesheet must be loaded by the workspace style bundle');

assert(packageJson.scripts?.['image:upload:qa'] === 'node scripts/image-upload-optimization-quality-check.mjs', 'image:upload:qa package script is missing');
assert(qaAllSource.includes("['image:upload:qa', ['scripts/image-upload-optimization-quality-check.mjs']]"), 'qa:all must enforce image upload optimization QA');

console.log(JSON.stringify({
  ok: true,
  scope: 'image-upload-optimization',
  sourceMaxMb: 12,
  outputMaxKb: 240,
  outputTargetKb: 180,
  maxDimension: 1600,
  galleryTotalTargetKb: 600,
  formats: ['jpeg', 'png', 'webp', 'gif'],
  sequentialGallery: true,
  duplicateGuard: true,
  progressUi: true,
}, null, 2));
