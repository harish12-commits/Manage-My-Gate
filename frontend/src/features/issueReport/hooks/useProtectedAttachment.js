import { useEffect, useState } from 'react'
import { fetchReportAttachmentBlob } from '../services/issueReportApi.js'

/**
 * Loads a private report screenshot as an object URL (revoked on unmount / change).
 * @param {string|undefined} attachmentUrl
 * @returns {{ src: string|null, failed: boolean }}
 */
export const useProtectedAttachment = (attachmentUrl) => {
  const [state, setState] = useState({ src: null, failed: false })

  useEffect(() => {
    if (!attachmentUrl) {
      setState({ src: null, failed: false })
      return undefined
    }

    let cancelled = false
    let objectUrl = null
    setState({ src: null, failed: false })

    fetchReportAttachmentBlob(attachmentUrl)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setState({ src: objectUrl, failed: false })
      })
      .catch(() => {
        if (!cancelled) setState({ src: null, failed: true })
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachmentUrl])

  return state
}

export default useProtectedAttachment
