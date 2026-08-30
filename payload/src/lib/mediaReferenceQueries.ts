import type { Payload, PayloadRequest, Where } from 'payload'

import {
  imageReferenceSources,
  relationID,
  relationshipIncludes,
  type DocumentRecord,
  type ImageReferenceSource,
} from './mediaReferences'

type QueryArgs = {
  payload: Payload
  req?: PayloadRequest
}

type ImageReferenceQueryArgs = QueryArgs & {
  imageID: number | string
}

const relationshipIDs = (value: unknown): string[] => {
  const values = Array.isArray(value) ? value : [value]
  return values.map(relationID).filter((id): id is string => Boolean(id))
}

const sourceSelect = (source: ImageReferenceSource): Record<string, true> =>
  Object.fromEntries(source.fields.map((field) => [field, true]))

const sourceWhere = (source: ImageReferenceSource, imageID: string): Where => ({
  or: source.fields.map((field) => ({ [field]: { equals: imageID } })),
})

const findSourceDocuments = async ({
  payload,
  req,
  source,
}: QueryArgs & { source: ImageReferenceSource }): Promise<DocumentRecord[]> => {
  if (source.kind === 'global') {
    const document = await payload.findGlobal({
      slug: source.slug as 'about',
      depth: 0,
      overrideAccess: true,
      req,
      select: sourceSelect(source),
    })
    return [document as unknown as DocumentRecord]
  }

  const result = await payload.find({
    collection: source.slug as 'projects' | 'series' | 'illustrations' | 'animations' | 'videos',
    depth: 0,
    overrideAccess: true,
    pagination: false,
    req,
    select: sourceSelect(source),
  })
  return result.docs as unknown as DocumentRecord[]
}

export const getUsedImageIDs = async ({ payload, req }: QueryArgs): Promise<Set<string>> => {
  const documentsBySource = await Promise.all(
    imageReferenceSources.map(async (source) => ({
      documents: await findSourceDocuments({ payload, req, source }),
      source,
    })),
  )
  const usedIDs = new Set<string>()

  for (const { documents, source } of documentsBySource) {
    for (const document of documents) {
      for (const field of source.fields) {
        for (const id of relationshipIDs(document[field])) usedIDs.add(id)
      }
    }
  }

  return usedIDs
}

const sourceHasImageReference = async ({
  imageID,
  payload,
  req,
  source,
}: ImageReferenceQueryArgs & { source: ImageReferenceSource }): Promise<boolean> => {
  const normalizedID = String(imageID)

  if (source.kind === 'global') {
    const document = await payload.findGlobal({
      slug: source.slug as 'about',
      depth: 0,
      overrideAccess: true,
      req,
      select: sourceSelect(source),
    })
    return source.fields.some((field) =>
      relationshipIncludes((document as unknown as DocumentRecord)[field], normalizedID),
    )
  }

  const result = await payload.find({
    collection: source.slug as 'projects' | 'series' | 'illustrations' | 'animations' | 'videos',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: sourceWhere(source, normalizedID),
  })
  return result.totalDocs > 0
}

export const getImageReferenceLabels = async ({
  imageID,
  payload,
  req,
}: ImageReferenceQueryArgs): Promise<string[]> => {
  const labels = await Promise.all(
    imageReferenceSources.map(async (source) =>
      (await sourceHasImageReference({ imageID, payload, req, source })) ? source.listLabel : undefined,
    ),
  )

  return Array.from(new Set(labels.filter((label): label is string => Boolean(label))))
}
