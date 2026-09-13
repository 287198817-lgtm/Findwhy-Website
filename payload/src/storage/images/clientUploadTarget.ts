export const resolveImageClientUploadTarget = ({
  data,
  docPrefix,
  id,
  savedDocumentData,
}: {
  data?: Record<string, unknown>
  docPrefix?: string
  id?: number | string
  savedDocumentData?: Record<string, unknown>
}) => {
  const contextDocumentID = id ?? data?.id ?? savedDocumentData?.id
  const documentID = contextDocumentID == null ? undefined : String(contextDocumentID)
  const operation = documentID ? ('replacement' as const) : ('create' as const)
  const oldPrefix =
    operation === 'replacement'
      ? typeof data?.prefix === 'string'
        ? data.prefix
        : typeof savedDocumentData?.prefix === 'string'
          ? savedDocumentData.prefix
          : docPrefix
      : undefined
  return { documentID, oldPrefix, operation }
}
