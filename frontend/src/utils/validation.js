/**
 * Web Centralized Validation & Error-Handling Engine
 */

export const validateEmail = (rawEmail) => {
  if (!rawEmail || !rawEmail.trim()) {
    return {
      isValid: false,
      status: 'idle',
      message: 'Email address is required.',
    }
  }

  const email = rawEmail.trim().toLowerCase()

  if (/\s/.test(email) || /[^\w@.\-+_]/.test(email)) {
    return {
      isValid: false,
      status: 'invalid',
      message: 'Email cannot contain spaces or special characters.',
    }
  }

  const atIndex = email.indexOf('@')
  if (atIndex === -1) {
    if (email.length < 3) {
      return {
        isValid: false,
        status: 'incomplete',
        message: 'Enter a valid email address.',
      }
    }
    return {
      isValid: false,
      status: 'incomplete',
      message: 'Include an "@" in the email address.',
    }
  }

  if (email.indexOf('@', atIndex + 1) !== -1) {
    return {
      isValid: false,
      status: 'invalid',
      message: 'Email can only contain one "@" symbol.',
    }
  }

  const domainPart = email.substring(atIndex + 1)
  if (!domainPart || domainPart.lastIndexOf('.') === -1) {
    return {
      isValid: false,
      status: 'incomplete',
      message: 'Complete the domain name (e.g. .com).',
    }
  }

  const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!strictEmailRegex.test(email)) {
    return {
      isValid: false,
      status: 'invalid',
      message: 'Enter a valid email address.',
    }
  }

  return {
    isValid: true,
    status: 'valid',
    message: 'Email format is valid.',
  }
}

export const parseBackendError = (
  error,
  fallbackMessage = 'Something went wrong. Please try again.',
) => {
  if (!error) {
    return { userMessage: fallbackMessage, isDuplicate: false }
  }

  const rawMsg =
    typeof error === 'string'
      ? error
      : error?.response?.data?.message || error?.response?.data?.error || error?.message || ''

  const status = error?.response?.status

  if (rawMsg.includes('E11000') || rawMsg.includes('duplicate key error')) {
    if (rawMsg.toLowerCase().includes('email')) {
      return {
        userMessage: 'This email address is already registered.',
        field: 'email',
        isDuplicate: true,
      }
    }
    if (rawMsg.toLowerCase().includes('phone')) {
      return {
        userMessage: 'This phone number is already registered.',
        field: 'phone',
        isDuplicate: true,
      }
    }
    return {
      userMessage: 'A record with this information already exists.',
      isDuplicate: true,
    }
  }

  if (
    status === 409 ||
    rawMsg.toLowerCase().includes('already exists') ||
    rawMsg.toLowerCase().includes('already an active member')
  ) {
    return {
      userMessage: rawMsg || 'This entry already exists.',
      isDuplicate: true,
    }
  }

  if (status === 400 && rawMsg.toLowerCase().includes('validation failed')) {
    return {
      userMessage:
        'Please check your inputs and make sure all required fields are filled correctly.',
      isDuplicate: false,
    }
  }

  if (
    error?.code === 'ECONNABORTED' ||
    rawMsg.toLowerCase().includes('network error') ||
    rawMsg.toLowerCase().includes('timeout')
  ) {
    return {
      userMessage: 'Unable to connect right now. Please check your internet connection.',
      isDuplicate: false,
    }
  }

  if (rawMsg && !rawMsg.includes('at ') && !rawMsg.includes('Error:') && rawMsg.length < 150) {
    return {
      userMessage: rawMsg,
      isDuplicate: false,
    }
  }

  return {
    userMessage: fallbackMessage,
    isDuplicate: false,
  }
}
