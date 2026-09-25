# Firestore-only document ingestion

## Why this build changed

The document-ingestion path no longer depends on Firebase Storage. The browser sends a PDF or TXT file to the Next.js server. The server extracts readable text, normalizes it, calculates a SHA-256 baseline, and stores metadata plus chunked text in Firestore.

This keeps the MVP focused on Sentinel's real requirement: analyzing source text.

## Data model

```text
organizations/{orgId}/documents/{documentId}
  name                  Human-friendly document name
  originalFilename      Uploaded filename
  type                  CONTRACT | POLICY | REGULATION | PROCEDURE | OTHER
  mimeType              application/pdf | text/plain
  size                  Original upload byte size (request metadata)
  contentHash           SHA-256 of normalized extracted text
  contentStorage        FIRESTORE_CHUNKS
  textLength            Number of extracted characters
  chunkCount            Number of Firestore text chunks
  textPreview           Short UI preview
  status                READY after successful ingestion
  changeStatus          BASELINE | CHANGED
  createdBy             Authenticated user id
  createdAt             Firestore timestamp
  updatedAt             Firestore timestamp
  lastIngestedAt        Firestore timestamp
  schemaVersion         v5.1

organizations/{orgId}/documents/{documentId}/chunks/{chunkId}
  documentId
  order
  text
  start
  end
  charCount
  createdAt
```

## Ingestion pipeline

1. Authorize `UPLOAD_DOCUMENT`.
2. Validate the document name, file type, and maximum size.
3. Parse PDF or TXT into text.
4. Normalize the text.
5. Reject empty/unreadable documents.
6. Calculate a SHA-256 hash of the normalized text.
7. Create the document metadata record.
8. Write text chunks in Firestore batches.
9. Create the audit record.
10. Emit `sentinel/audit.requested`.

## Why chunks are used

Firestore documents have a size limit. Storing the complete extracted text in one record would eventually fail for larger documents. Sentinel therefore uses a parent document for metadata and a `chunks` subcollection for the source text.

## Trade-offs

This MVP cannot reconstruct/download the original PDF because the binary is deliberately discarded after text extraction. Scanned/image-only PDFs may also require OCR before they can be analyzed.

Scheduled monitoring now means scheduled re-auditing of the stored baseline. The previous Storage-based binary comparison job has been removed because there is no retained source binary to compare against.

## Next storage milestone

Add Firebase Storage only when Sentinel needs one of these capabilities:

- original-source download
- archival retention of source binaries
- source-file versioning
- attachments or non-text assets

At that point, Storage can be added without changing the Firestore metadata and chunk model.
